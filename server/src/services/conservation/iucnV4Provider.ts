import { IUCN_TTL_MS } from '../../constants/cache';
import { normalizeIucnStatus } from '../../constants/taxonomy';
import { withCache } from '../../utils/cache';
import { ExternalApiError, fetchJsonWithTimeout } from '../externalApiService';
import {
  ConservationProvider,
  ConservationStatus,
  IucnNotConfiguredError,
  PopulationTrend,
} from './types';

/**
 * IUCN Red List API v4。
 *
 * 接口契约实测记录见同目录 README.md（2026-09-16 实测），要点：
 *   - 鉴权头是**裸 token**：`Authorization: <token>`，不是 `Bearer <token>`
 *   - 学名查询只接受拆分后的 genus / species，不接受完整二名法
 *   - 三跳：scientific_name → sis/{id}（拿 latest assessment_id）→ assessment/{id}
 *
 * v3（apiv3.iucnredlist.org）已于 2025-03-27 下线，且官方明确 v3 账号不迁移。
 */

const IUCN_BASE = 'https://api.iucnredlist.org/api/v4';

// 上游偶发 5xx，给两次重试；IUCN 是低频接口，超时可以放宽到 8s。
const IUCN_REQUEST = { retries: 2, timeoutMs: 8000 } as const;

type TaxonByNameResponse = {
  taxon?: {
    sis_id?: number;
    scientific_name?: string;
  };
};

type IucnAssessmentSummary = {
  assessment_id?: number;
  latest?: boolean;
  year_published?: string;
  red_list_category_code?: string;
};

type TaxonResponse = {
  sis_id?: number;
  assessments?: IucnAssessmentSummary[];
};

type AssessmentResponse = {
  assessment_id?: number;
  year_published?: string;
  red_list_category?: { code?: string; description?: { en?: string } };
  population_trend?: { code?: string; description?: { en?: string } };
  supplementary_info?: { population_size?: string | null };
  threats?: Array<{ description?: { en?: string } }>;
};

const getToken = (): string => {
  const token = (process.env.IUCN_API_TOKEN ?? '').trim();
  if (!token) {
    throw new IucnNotConfiguredError();
  }
  return token;
};

/** 上游 404 视为「查无此物」，返回 null；其余异常向上抛由聚合层降级 */
const iucnFetch = async <T>(path: string): Promise<T | null> => {
  const token = getToken();
  try {
    return await fetchJsonWithTimeout<T>(
      `${IUCN_BASE}${path}`,
      { headers: { Authorization: token } },
      IUCN_REQUEST,
    );
  } catch (err) {
    if (err instanceof ExternalApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
};

/** IUCN 只认拆开的 genus / species；三段学名（亚种）归并到种 */
const splitBinomial = (scientificName: string): { genus: string; species: string } | null => {
  const words = scientificName.trim().split(/\s+/);
  if (words.length < 2 || !words[0] || !words[1]) {
    return null;
  }
  return { genus: words[0], species: words[1] };
};

const findLatestAssessmentId = (assessments: IucnAssessmentSummary[]): number | undefined => {
  if (assessments.length === 0) {
    return undefined;
  }

  const latest = assessments.filter(item => item.latest);
  const pool = latest.length > 0 ? latest : assessments;

  const sorted = [...pool].sort(
    (a, b) => (Number(b.year_published) || 0) - (Number(a.year_published) || 0),
  );

  return sorted[0]?.assessment_id;
};

/**
 * IUCN 的 population_size 常是区间或区间加估值，例如 `"2608-3905,3140"`。
 * 只有能确定解析成单个整数时才填，否则留空 —— 不要取区间端点假装是总数。
 */
const parsePopulation = (value?: string | null): number | undefined => {
  const trimmed = (value ?? '').trim();
  return /^\d{1,12}$/.test(trimmed) ? Number(trimmed) : undefined;
};

const mapPopulationTrend = (trend?: {
  description?: { en?: string };
}): PopulationTrend | undefined => {
  const text = trend?.description?.en?.trim().toLowerCase();
  if (!text) {
    return undefined;
  }
  if (text.startsWith('increas')) {
    return 'increasing';
  }
  if (text.startsWith('decreas')) {
    return 'decreasing';
  }
  if (text.startsWith('stable')) {
    return 'stable';
  }
  return 'unknown';
};

const MAX_THREATS = 5;

const mapAssessment = (assessment: AssessmentResponse): ConservationStatus => {
  const year = Number(assessment.year_published);

  const threats = [
    ...new Set(
      (assessment.threats ?? [])
        .map(item => item.description?.en?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ].slice(0, MAX_THREATS);

  return {
    iucnStatus: normalizeIucnStatus(assessment.red_list_category?.code),
    population: parsePopulation(assessment.supplementary_info?.population_size),
    populationTrend: mapPopulationTrend(assessment.population_trend),
    assessmentYear: Number.isInteger(year) ? year : undefined,
    threats: threats.length > 0 ? threats : undefined,
    source: 'iucn_v4',
  };
};

export const iucnV4Provider: ConservationProvider = {
  name: 'iucn_v4',

  async lookup(scientificName: string): Promise<ConservationStatus | null> {
    // 未配置 token 时立刻抛错：调用方据此降级到 static，而不是拿到假数据
    const binomial = splitBinomial(scientificName);
    if (!binomial) {
      return null;
    }

    const { genus, species } = binomial;
    const taxonKey = `${genus} ${species}`.toLowerCase();

    const byName = await withCache(`iucn:taxa:${taxonKey}`, IUCN_TTL_MS, () =>
      iucnFetch<TaxonByNameResponse>(
        `/taxa/scientific_name?genus_name=${encodeURIComponent(genus)}&species_name=${encodeURIComponent(species)}`,
      ),
    );

    const sisId = byName?.taxon?.sis_id;
    if (!sisId) {
      return null;
    }

    const taxon = await withCache(`iucn:sis:${sisId}`, IUCN_TTL_MS, () =>
      iucnFetch<TaxonResponse>(`/taxa/sis/${sisId}`),
    );

    const assessmentId = findLatestAssessmentId(taxon?.assessments ?? []);
    if (!assessmentId) {
      return null;
    }

    const assessment = await withCache(`iucn:assessment:${assessmentId}`, IUCN_TTL_MS, () =>
      iucnFetch<AssessmentResponse>(`/assessment/${assessmentId}`),
    );

    return assessment ? mapAssessment(assessment) : null;
  },
};
