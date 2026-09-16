import { IUCNStatus, normalizeIucnStatus, TAXONOMY_ORDER } from '../constants/taxonomy';
import { getCommonNameZh } from '../data/taxonomyZh';
import { resolveQueryToScientificName } from '../data/zhNameIndex';
import { AnimalLike, AnimalTaxonomy, EnrichedAnimal } from '../types/animal';
import { TaxonomyLineage } from '../types/taxonomy';
import { withCache } from '../utils/cache';
import { logger } from '../utils/logger';
import { lookupConservation } from './conservation';
import { ConservationStatus } from './conservation/types';
import { fetchJsonWithTimeout } from './externalApiService';
import { fetchLineage } from './taxonomyService';

const DAY_MS = 24 * 60 * 60 * 1000;

// Unsplash 图库内容变化慢，缓存一天即可（也省配额）。
const UNSPLASH_TTL_MS = DAY_MS;

/**
 * IUCN 分类码 → 九级枚举。
 *
 * 历史上这里只认 CR/EN/VU/NT/LC，其余一律兜底 `'EN'` —— 后果是把 EX（灭绝）
 * 和 EW（野外灭绝）显示成「濒危」，也把 DD/NE 伪装成已知状态。
 * 现在由 `constants/taxonomy.ts` 的 `IUCN_STATUS` 键集合派生，未知一律 `DD`。
 */
export const mapIucnCategory = (category?: string | null): IUCNStatus =>
  normalizeIucnStatus(category);

type UnsplashResponse = {
  results?: Array<{
    urls?: { regular?: string; small?: string };
  }>;
};

const getAnimalImages = async (query: string): Promise<string[]> => {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey || !query.trim()) {
    return [];
  }

  try {
    const encoded = encodeURIComponent(query.trim());
    const data = await withCache(`media:unsplash:${encoded.toLowerCase()}`, UNSPLASH_TTL_MS, () =>
      fetchJsonWithTimeout<UnsplashResponse>(
        `https://api.unsplash.com/search/photos?query=${encoded}&per_page=3`,
        { headers: { Authorization: `Client-ID ${accessKey}` } },
        { retries: 0 },
      ),
    );

    return (data.results ?? [])
      .map(item => item.urls?.regular || item.urls?.small || '')
      .filter(Boolean);
  } catch (err) {
    logger.warn(
      'animal',
      `image lookup failed for "${query}": ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
};

const lineageToTaxonomy = (lineage: TaxonomyLineage): AnimalTaxonomy => {
  const taxonomy: AnimalTaxonomy = {};
  for (const level of TAXONOMY_ORDER) {
    const item = lineage[level];
    if (!item) {
      continue;
    }
    taxonomy[level] = {
      scientificName: item.scientificName,
      commonNameZh: item.commonNameZh,
    };
  }
  return taxonomy;
};

const hasAnyLevel = (taxonomy: AnimalTaxonomy): boolean =>
  TAXONOMY_ORDER.some(level => Boolean(taxonomy[level]));

/**
 * 用 ITIS 校正过的谱系覆盖 base 的分类信息。
 * 学名归一化到**种**（亚种另存 subspecies），保证详情页 id 能稳定回查。
 */
const applyLineage = (base: AnimalLike, lineage: TaxonomyLineage): AnimalLike => {
  const taxonomy = lineageToTaxonomy(lineage);
  const speciesName = lineage.species?.scientificName?.trim();

  return {
    ...base,
    id: speciesName || base.id,
    scientificName: speciesName || base.scientificName,
    commonNameZh: base.commonNameZh?.trim()
      ? base.commonNameZh
      : getCommonNameZh(speciesName || base.scientificName),
    taxonomy,
    subspecies: lineage.subspecies.length > 0
      ? lineage.subspecies.map(item => ({
          scientificName: item.scientificName,
          commonNameZh: item.commonNameZh,
        }))
      : base.subspecies,
  };
};

const resolveConservation = async (
  base: AnimalLike,
): Promise<{ status?: ConservationStatus; source: EnrichedAnimal['dataSources']['conservation'] }> => {
  try {
    const status = await lookupConservation(base.scientificName);
    if (!status) {
      // 上游可达但没查到 —— 保留 base 已有信息，绝不造一个等级出来
      return {
        status: base.conservationStatus,
        source: base.conservationStatus ? 'static' : 'none',
      };
    }
    return { status, source: status.source };
  } catch (err) {
    logger.warn(
      'animal',
      `conservation lookup failed for "${base.scientificName}": ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return {
      status: base.conservationStatus,
      source: base.conservationStatus ? 'static' : 'none',
    };
  }
};

/**
 * 把 ITIS（分类）与 IUCN（濒危）的结果合并进动物对象。
 * 两个外部依赖**各自独立降级**：任一方失败都不得让整个请求失败，
 * 也不得编造缺失的字段。
 */
export const enrichAnimal = async (base: AnimalLike): Promise<EnrichedAnimal> => {
  const scientificName = base.scientificName?.trim();

  if (!scientificName) {
    return {
      ...base,
      dataSources: {
        taxonomy: hasAnyLevel(base.taxonomy ?? {}) ? 'llm' : 'none',
        conservation: base.conservationStatus ? 'static' : 'none',
      },
    };
  }

  const [lineageResult, conservation] = await Promise.allSettled([
    fetchLineage(scientificName),
    resolveConservation(base),
  ]);

  let animal: AnimalLike = base;
  let taxonomySource: EnrichedAnimal['dataSources']['taxonomy'] = hasAnyLevel(
    base.taxonomy ?? {},
  )
    ? 'llm'
    : 'none';

  if (lineageResult.status === 'fulfilled' && lineageResult.value) {
    const lineage = lineageResult.value;
    if (hasAnyLevel(lineageToTaxonomy(lineage))) {
      animal = applyLineage(base, lineage);
      taxonomySource = 'itis';
    }
  } else if (lineageResult.status === 'rejected') {
    logger.warn(
      'animal',
      `itis lineage lookup failed for "${scientificName}": ${
        lineageResult.reason instanceof Error
          ? lineageResult.reason.message
          : String(lineageResult.reason)
      }`,
    );
  }

  const conservationOutcome =
    conservation.status === 'fulfilled'
      ? conservation.value
      : { status: base.conservationStatus, source: 'none' as const };

  return {
    ...animal,
    conservationStatus: conservationOutcome.status,
    dataSources: {
      taxonomy: taxonomySource,
      conservation: conservationOutcome.source,
    },
  };
};

export class UpstreamUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpstreamUnavailableError';
  }
}

/**
 * 按学名（或中文名）取动物详情。
 * - 返回 null 表示**确实查不到**，路由层映射为 404 —— 不再恒返回硬编码的东北虎
 * - 抛 `UpstreamUnavailableError` 表示「无法判断」（上游挂了且本地也不认识），
 *   路由层映射为 502。这种情况绝不能谎报 404
 *
 * 上游不可用但本地字典认识这个名字时尽力降级：返回一个最小可用对象
 * （名称 + 离线濒危信息），并在 dataSources 里如实标注 taxonomy: 'none'。
 */
export const getAnimalById = async (id: string): Promise<EnrichedAnimal | null> => {
  const scientificName = resolveQueryToScientificName(id);
  if (!scientificName) {
    return null;
  }

  let lineage: TaxonomyLineage | null = null;
  let upstreamFailed = false;

  try {
    lineage = await fetchLineage(scientificName);
  } catch (err) {
    upstreamFailed = true;
    logger.warn(
      'animal',
      `lineage unavailable for "${scientificName}": ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  if (!lineage?.species) {
    if (!upstreamFailed) {
      // ITIS 明确答「没这个物种」—— 不要用本地字典硬凑一个出来
      return null;
    }

    const localName = getLocalKnownName(scientificName);
    if (!localName) {
      throw new UpstreamUnavailableError(
        `Unable to resolve "${scientificName}": ITIS is unavailable and the local dictionary does not know it`,
      );
    }

    const degraded: AnimalLike = {
      id: scientificName,
      commonNameZh: localName,
      commonNameEn: scientificName,
      scientificName,
      taxonomy: { species: { scientificName, commonNameZh: localName } },
    };

    const enriched = await enrichAnimal(degraded);
    const images = await getAnimalImages(scientificName);
    return { ...enriched, images, dataSources: { ...enriched.dataSources, taxonomy: 'none' } };
  }

  const base: AnimalLike = {
    id: lineage.species.scientificName,
    commonNameZh: getCommonNameZh(lineage.species.scientificName),
    commonNameEn: scientificName,
    scientificName: lineage.species.scientificName,
  };

  const enriched = await enrichAnimal(base);
  const images = await getAnimalImages(lineage.species.scientificName);

  return {
    ...enriched,
    images,
    thumbnailUrl: images[0],
    dataSources: { ...enriched.dataSources, taxonomy: 'itis' },
  };
};

/** 本地字典是否认识这个名字（用于上游不可用时的降级） */
const getLocalKnownName = (scientificName: string): string | null => {
  const zh = getCommonNameZh(scientificName);
  return zh && zh !== scientificName ? zh : null;
};
