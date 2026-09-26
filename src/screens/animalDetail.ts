// 详情页的数据装配逻辑（与渲染分离，便于单测）
//
// 原则：**不伪造数据**。
// 真实数据（来自识别结果或后端 `/api/animal/:id`）优先；只有缺失时才用本地
// 构造兜底，而兜底里也不再编造 IUCN 等级 —— 没有就交给 UI 不渲染那张卡片。

import { IUCN_STATUS, IUCNStatus } from '../constants/taxonomy';
import { Animal } from '../types';

/** 需要展示保护状态卡片：受威胁（CR/EN/VU）及以上（EX/EW） */
export const CONCERNING_IUCN_STATUSES: IUCNStatus[] = ['EX', 'EW', 'CR', 'EN', 'VU'];

export const isConcerningStatus = (status?: string): boolean =>
  Boolean(status) && (CONCERNING_IUCN_STATUSES as string[]).includes(status as string);

/** IUCN 等级的中文名，未知等级返回空串（不猜） */
export const getIucnLabel = (status?: string): string => {
  if (!status || !(status in IUCN_STATUS)) {
    return '';
  }
  return IUCN_STATUS[status as IUCNStatus].zh;
};

export const getTrendLabel = (trend?: string): string => {
  switch (trend) {
    case 'increasing':
      return '种群恢复中';
    case 'decreasing':
      return '种群下降';
    case 'stable':
      return '种群稳定';
    default:
      // 'unknown' 或缺失：如实说不知道，别默认成「稳定」
      return '趋势未知';
  }
};

/**
 * 详情接口 `/api/animal/:id` 的 key 是**学名（双名法）**。
 *
 * 三名法（亚种）会被直接判 404 —— 线上实测：
 *   GET /api/animal/Panthera tigris          → 200
 *   GET /api/animal/Panthera tigris altaica  → 404
 * 而识别结果与首页示例数据里都可能出现亚种名（如东北虎），
 * 因此查询前先规整成「属 + 种」两个词。
 */
export const toBinomialName = (name?: string): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).join(' ');
};

/**
 * 详情页依次尝试的查询 key。
 *
 * 顺序即优先级：**双名法学名 → 原始学名 → 原始 id**。
 *
 * 为什么要「依次尝试」而不是直接取一个：
 * - `animal.id` 并不可靠。识别链路里它是后端给的学名，但首页示例数据里是
 *   `'1'`~`'4'` 这类序号，直接拿它查会 404（`No animal found for "2"`）。
 * - 所以学名优先，id 只作为最后的兜底。
 */
export const buildDetailLookupCandidates = (animal: Partial<Animal>): string[] => {
  const candidates = [
    toBinomialName(animal.scientificName),
    animal.scientificName?.trim(),
    animal.id?.trim(),
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates)];
};

const DEFAULT_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=800',
  'https://images.unsplash.com/photo-1527118732049-c88155f2107c?w=800',
  'https://images.unsplash.com/photo-1540126034813-121bf29033d2?w=800',
];

// 叙述性文本（habitat / lifestyle / distribution）由识别链路让视觉模型一并产出，
// 见 server/src/services/recognitionService.ts 的 RECOGNITION_PROMPT。
//
// 这里**不做任何按物种或按科的硬编码兜底**。历史上曾按「科」硬编码：
// HABITAT_BY_FAMILY['Felidae'] 写的是东北虎的具体分布（俄罗斯远东 + 中国东北），
// 结果是猫科的任何动物（家猫、狮、豹）都会显示这段文字，属于张冠李戴，已删除。
//
// 模型没写出来时只留一句如实说明 —— 不要「整理中」这种暗示「稍后会有」的假占位。
const GENERIC_HABITAT = '暂无该物种的栖息地资料。';
const GENERIC_LIFESTYLE = '暂无该物种的生活习性资料。';
const GENERIC_DISTRIBUTION = '暂无该物种的分布资料。';

/** 本地兜底构造：只在真实数据拿不到时使用 */
export const buildLocalAnimal = (partial: Partial<Animal>): Animal => {
  const commonNameZh = partial.commonNameZh || '未知动物';
  const scientificName = partial.scientificName || '';

  return {
    id: partial.id || scientificName || 'unknown',
    commonNameZh,
    commonNameEn: partial.commonNameEn || 'Unknown Animal',
    scientificName,
    description: partial.description || `${commonNameZh}是一种令人惊叹的动物。`,
    habitat: partial.habitat || GENERIC_HABITAT,
    lifestyle: partial.lifestyle || GENERIC_LIFESTYLE,
    distribution: partial.distribution || GENERIC_DISTRIBUTION,
    // 没有就留空：详情页据此决定是否渲染濒危卡片
    conservationStatus: partial.conservationStatus,
    images: partial.images?.length ? partial.images : DEFAULT_FALLBACK_IMAGES,
    thumbnailUrl: partial.thumbnailUrl,
    taxonomy:
      partial.taxonomy && Object.keys(partial.taxonomy).length > 0
        ? partial.taxonomy
        : scientificName
          ? { species: { scientificName, commonNameZh } }
          : {},
  };
};

/**
 * 把后端返回的真实数据合并进本地对象。
 *
 * 注意：详情接口 `/api/animal/:id` **不产出**叙述性字段（habitat / lifestyle /
 * description / distribution）—— 它们只可能来自识别链路的视觉模型。因此这里对这几个
 * 字段一律保留本地已有的值，避免详情接口的响应把识别结果里已经拿到的内容冲掉。
 */
export const mergeRemoteAnimal = (local: Animal, remote: Partial<Animal>): Animal => {
  const remoteTaxonomy = remote.taxonomy && Object.keys(remote.taxonomy).length > 0
    ? remote.taxonomy
    : undefined;

  return {
    ...local,
    ...remote,
    id: remote.id || local.id,
    commonNameZh: remote.commonNameZh || local.commonNameZh,
    commonNameEn: remote.commonNameEn || local.commonNameEn,
    scientificName: remote.scientificName || local.scientificName,
    taxonomy: remoteTaxonomy ?? local.taxonomy,
    images: remote.images?.length ? remote.images : local.images,
    description: remote.description || local.description,
    habitat: remote.habitat || local.habitat,
    lifestyle: remote.lifestyle || local.lifestyle,
    distribution: remote.distribution || local.distribution,
    // 后端明确没有濒危数据时保留已有的真实值（可能来自识别结果），但**不伪造**
    conservationStatus: remote.conservationStatus ?? local.conservationStatus,
  };
};
