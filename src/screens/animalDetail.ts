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

const DEFAULT_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=800',
  'https://images.unsplash.com/photo-1527118732049-c88155f2107c?w=800',
  'https://images.unsplash.com/photo-1540126034813-121bf29033d2?w=800',
];

// 后端不提供这些叙述性文本，属于本地兜底内容，按科区分以免张冠李戴。
const HABITAT_BY_FAMILY: Record<string, string> = {
  Ursidae:
    '仅分布于中国四川、陕西和甘肃的高山竹林中。栖息地海拔通常在 1,200-3,400 米之间，偏好凉爽湿润的环境，以竹子为主要食物来源。',
  Felidae:
    '主要分布于俄罗斯远东地区、中国东北部及朝鲜北部。栖息于针阔混交林、落叶阔叶林等森林生态系统，偏好有丰富猎物和水源的区域。',
};

const LIFESTYLE_BY_FAMILY: Record<string, string> = {
  Ursidae:
    '大熊猫是独居动物，每天需要花费 12-16 小时进食竹子。虽属于食肉目，但 99% 的食物是竹子。善于爬树，游泳能力也很强。',
  Felidae:
    '独居动物，领地意识强。主要在晨昏活动，善于游泳。以野猪、马鹿、狍子等有蹄类为主要猎物。',
};

const GENERIC_HABITAT = '栖息地信息整理中，可先参考其分类与分布资料。';
const GENERIC_LIFESTYLE = '生活习性信息整理中，可先参考其分类与分布资料。';

/** 本地兜底构造：只在真实数据拿不到时使用 */
export const buildLocalAnimal = (partial: Partial<Animal>): Animal => {
  const family = partial.taxonomy?.family?.scientificName ?? '';
  const commonNameZh = partial.commonNameZh || '未知动物';
  const scientificName = partial.scientificName || '';

  return {
    id: partial.id || scientificName || 'unknown',
    commonNameZh,
    commonNameEn: partial.commonNameEn || 'Unknown Animal',
    scientificName,
    description: partial.description || `${commonNameZh}是一种令人惊叹的动物。`,
    habitat:
      partial.habitat || HABITAT_BY_FAMILY[family] || GENERIC_HABITAT,
    lifestyle:
      partial.lifestyle || LIFESTYLE_BY_FAMILY[family] || GENERIC_LIFESTYLE,
    distribution: partial.distribution || '分布信息整理中。',
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
 * 后端不提供的叙述性字段（habitat / lifestyle / description / distribution）
 * 保留本地兜底，其余一律以后端为准。
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
