import { ITIS_TTL_MS } from '../constants/cache';
import {
  getChildLevel,
  getParentLevel,
  TAXONOMY_ORDER,
  TaxonomyLevel,
} from '../constants/taxonomy';
import { getCommonNameZh, getRankLevelOf } from '../data/taxonomyZh';
import { resolveQueryToScientificName, ZH_NAME_INDEX } from '../data/zhNameIndex';
import { TaxonomyItem, TaxonomyLineage, TaxonomyNode } from '../types/taxonomy';
import { withCache } from '../utils/cache';
import { fetchJsonWithTimeout } from './externalApiService';

const ITIS_BASE = 'https://www.itis.gov/ITISWebService/jsonservice';

// ITIS 是 SOAP 派生的老端点，实测响应为 ISO-8859-1 且响应头如实声明；
// 用 UTF-8 解码含重音字符的报文会抛错，必须显式指定 latin1。
//
// timeoutMs 必须显式给足：externalApiService 的默认 5000ms 对本接口远远不够。
// `searchByScientificName` 是**前缀匹配**，属名/科名单词（如 `Felis`）会命中 80KB 报文、
// 实测 4~10s（最坏 9.44s）；5s 超时下冷启动必然 502 —— 精确表现为
// 5s + 300ms 退避 + 5s = 10.3s 才失败。15s 覆盖实测最坏值并留约 1.6 倍余量。
// 注意：retries: 1 与超时叠加，最坏情况单次上游调用要 30.3s 才放弃（见 DEVELOPMENT.md）。
const ITIS_REQUEST = { charset: 'latin1', retries: 1, timeoutMs: 15000 } as const;

/** ITIS rankName → 七级枚举。其余（Subkingdom / Superclass / Subfamily …）全部丢弃 */
export const RANK_TO_LEVEL: Record<string, TaxonomyLevel> = {
  Kingdom: 'kingdom',
  Phylum: 'phylum',
  Class: 'class',
  Order: 'order',
  Family: 'family',
  Genus: 'genus',
  Species: 'species',
};

export type ItisScientificName = {
  tsn?: string;
  combinedName?: string;
  kingdom?: string;
  unitName1?: string | null;
  unitName2?: string | null;
  unitName3?: string | null;
};

export type ItisHierarchyItem = {
  tsn?: string;
  taxonName?: string;
  rankName?: string;
  parentTsn?: string | null;
  author?: string | null;
};

type ItisSearchResponse = { scientificNames?: ItisScientificName[] };
type ItisHierarchyResponse = { hierarchyList?: ItisHierarchyItem[] };

const itisUrl = (operation: string, params: Record<string, string>): string =>
  `${ITIS_BASE}/${operation}?` +
  Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

const searchItisByName = async (srchKey: string): Promise<ItisScientificName[]> =>
  withCache(`itis:search:${srchKey.toLowerCase()}`, ITIS_TTL_MS, async () => {
    const data = await fetchJsonWithTimeout<ItisSearchResponse>(
      itisUrl('searchByScientificName', { srchKey }),
      undefined,
      ITIS_REQUEST,
    );
    return data.scientificNames ?? [];
  });

/** 完整谱系（Kingdom → Subspecies），含大量冗余中间级 */
export const fetchItisHierarchy = async (tsn: string): Promise<ItisHierarchyItem[]> =>
  withCache(`itis:hier:${tsn}`, ITIS_TTL_MS, async () => {
    const data = await fetchJsonWithTimeout<ItisHierarchyResponse>(
      itisUrl('getFullHierarchyFromTSN', { tsn }),
      undefined,
      ITIS_REQUEST,
    );
    return data.hierarchyList ?? [];
  });

/** 仅直接下级 —— 正好对应分类树懒加载语义 */
export const fetchItisChildren = async (tsn: string): Promise<ItisHierarchyItem[]> =>
  withCache(`itis:down:${tsn}`, ITIS_TTL_MS, async () => {
    const data = await fetchJsonWithTimeout<ItisHierarchyResponse>(
      itisUrl('getHierarchyDownFromTSN', { tsn }),
      undefined,
      ITIS_REQUEST,
    );
    return data.hierarchyList ?? [];
  });

const wordCount = (value?: string): number =>
  value ? value.trim().split(/\s+/).length : Number.MAX_SAFE_INTEGER;

/**
 * 挑 TSN。ITIS 的 searchByScientificName 是**前缀匹配**，
 * 查 `Panthera tigris` 会同时返回种与全部亚种，必须优先取完全匹配项。
 */
export const findTsn = (
  names: ItisScientificName[],
  target: string,
): string | undefined => {
  const wanted = target.trim().toLowerCase();

  const exact = names.find(n => (n.combinedName ?? '').toLowerCase() === wanted);
  if (exact?.tsn) {
    return exact.tsn;
  }

  // 退一步接受「前缀 + 空格」的命中，取词数最少的一条（种优于亚种）
  const prefixed = names
    .filter(n => (n.combinedName ?? '').toLowerCase().startsWith(`${wanted} `))
    .sort((a, b) => wordCount(a.combinedName) - wordCount(b.combinedName));

  return prefixed[0]?.tsn;
};

export type ItisTaxonMatch = {
  /** 归一化后的检索学名（中文已转学名，亚种已归并到种） */
  scientificName: string;
  tsn: string;
  hierarchy: ItisHierarchyItem[];
};

/**
 * 检索候选：亚种（三段学名）在 ITIS 里不一定登记，但它的种一定在。
 * 所以三段名先按原样查，查不到再退回二名法 —— 与「亚种归并到种」的决策一致。
 */
const searchCandidates = (scientificName: string): string[] => {
  const trimmed = scientificName.trim();
  const words = trimmed.split(/\s+/);
  const candidates = [trimmed];

  if (words.length >= 3) {
    candidates.push(`${words[0]} ${words[1]}`);
  }

  return [...new Set(candidates)];
};

/**
 * 把名字（中文或学名）解析成 ITIS 分类单元。
 * - 返回 null 表示「上游可达，但这个名字查不到」或「中文未收录」
 * - 网络/上游异常会向上抛出，由调用方决定降级策略
 */
export const resolveTaxon = async (nameOrZh: string): Promise<ItisTaxonMatch | null> => {
  const scientificName = resolveQueryToScientificName(nameOrZh);
  if (!scientificName) {
    return null;
  }

  for (const candidate of searchCandidates(scientificName)) {
    const names = await searchItisByName(candidate);
    const tsn = findTsn(names, candidate);
    if (!tsn) {
      continue;
    }

    const hierarchy = await fetchItisHierarchy(tsn);
    if (hierarchy.length === 0) {
      continue;
    }

    return { scientificName: candidate, tsn, hierarchy };
  }

  return null;
};

const toItem = (item: ItisHierarchyItem): TaxonomyItem => {
  const scientificName = (item.taxonName ?? '').trim();
  return {
    scientificName,
    commonNameZh: getCommonNameZh(scientificName),
    tsn: item.tsn,
  };
};

export const findHierarchyItem = (
  hierarchy: ItisHierarchyItem[],
  level: TaxonomyLevel,
): ItisHierarchyItem | undefined =>
  hierarchy.find(
    item => RANK_TO_LEVEL[item.rankName ?? ''] === level && Boolean(item.taxonName),
  );

/** 取某分类单元自身的层级（用于校验 URL 里的 level 与名字是否一致） */
export const getAnchorLevel = (
  hierarchy: ItisHierarchyItem[],
  tsn: string,
): TaxonomyLevel | undefined => {
  const anchor = hierarchy.find(item => item.tsn === tsn);
  return anchor ? RANK_TO_LEVEL[anchor.rankName ?? ''] : undefined;
};

const RANK_NAME_TO_LEVEL: Record<string, string> = {
  Kingdom: 'kingdom',
  Phylum: 'phylum',
  Class: 'class',
  Order: 'order',
  Family: 'family',
  Genus: 'genus',
  Species: 'species',
};

export const rankNameToLevel = (rankName?: string): TaxonomyLevel | undefined =>
  rankName ? (RANK_NAME_TO_LEVEL[rankName] as TaxonomyLevel | undefined) : undefined;

const buildLineage = (hierarchy: ItisHierarchyItem[], anchorTsn: string): TaxonomyLineage => {
  // 七级键固定存在（可能为 undefined），保证结构稳定、便于缓存与断言
  const lineage: TaxonomyLineage = {
    kingdom: undefined,
    phylum: undefined,
    class: undefined,
    order: undefined,
    family: undefined,
    genus: undefined,
    species: undefined,
    subspecies: [],
    tsn: anchorTsn,
  };

  for (const item of hierarchy) {
    const level = rankNameToLevel(item.rankName);
    if (!level || !item.taxonName) {
      continue;
    }
    lineage[level] = toItem(item);
  }

  lineage.subspecies = hierarchy
    .filter(item => item.rankName === 'Subspecies' && Boolean(item.taxonName))
    .map(toItem);

  // 锚点优先指向种级 TSN（亚种查询也会归并到这里）
  if (lineage.species?.tsn) {
    lineage.tsn = lineage.species.tsn;
  }

  return lineage;
};

/**
 * 学名（或中文名）→ 七级分类谱系。
 * 查不到返回 null；网络异常抛出，由调用方降级。
 */
export const fetchLineage = async (nameOrZh: string): Promise<TaxonomyLineage | null> => {
  const match = await resolveTaxon(nameOrZh);
  if (!match) {
    return null;
  }

  const lineage = buildLineage(match.hierarchy, match.tsn);
  const hasAnyLevel = TAXONOMY_ORDER.some(level => Boolean(lineage[level]));

  return hasAnyLevel ? lineage : null;
};

const toNode = (item: ItisHierarchyItem, level: TaxonomyLevel): TaxonomyNode => {
  const scientificName = (item.taxonName ?? '').trim();
  return {
    id: item.tsn ?? scientificName,
    level,
    scientificName,
    commonNameZh: getCommonNameZh(scientificName),
    childCount: undefined,
  };
};

export type TaxonomyDetail = {
  current: TaxonomyNode;
  parent?: TaxonomyNode;
  childCount: number;
};

/**
 * 分类层级详情。响应结构与前端期望的 `{current, parent, childCount}` 对齐
 * （历史上返回的是 `{current, parent, children}`，前端拿到的是 undefined）。
 */
export const getTaxonomyDetail = async (
  level: TaxonomyLevel,
  name: string,
): Promise<TaxonomyDetail | null> => {
  const match = await resolveTaxon(name);
  if (!match) {
    return null;
  }

  // 名字必须真的属于所请求的层级，否则会把 "family/Panthera" 悄悄当成 Felidae
  const anchorLevel = getAnchorLevel(match.hierarchy, match.tsn);
  if (anchorLevel && anchorLevel !== level) {
    return null;
  }

  const currentItem = findHierarchyItem(match.hierarchy, level);
  if (!currentItem?.tsn) {
    return null;
  }

  const parentLevel = getParentLevel(level);
  const parentItem = parentLevel
    ? findHierarchyItem(match.hierarchy, parentLevel)
    : undefined;

  const children = await fetchItisChildren(currentItem.tsn);

  return {
    current: toNode(currentItem, level),
    parent: parentItem ? toNode(parentItem, parentLevel as TaxonomyLevel) : undefined,
    childCount: children.filter(child => Boolean(child.taxonName)).length,
  };
};

export type TaxonomyChildrenPage = {
  children: TaxonomyNode[];
  hasMore: boolean;
  total: number;
  childLevel: TaxonomyLevel | null;
};

/** 直接下级分页。上游一次返回全部下级，这里在内存里切片。 */
export const getTaxonomyChildren = async (
  level: TaxonomyLevel,
  name: string,
  limit: number,
  offset: number,
): Promise<TaxonomyChildrenPage | null> => {
  const match = await resolveTaxon(name);
  if (!match) {
    return null;
  }

  const anchorLevel = getAnchorLevel(match.hierarchy, match.tsn);
  if (anchorLevel && anchorLevel !== level) {
    return null;
  }

  const raw = await fetchItisChildren(match.tsn);
  const mapped = raw
    .filter(item => Boolean(item.taxonName))
    .map(item => toNode(item, rankNameToLevel(item.rankName) ?? getChildLevel(level) ?? level));

  return {
    children: mapped.slice(offset, offset + limit),
    hasMore: offset + limit < mapped.length,
    total: mapped.length,
    childLevel: getChildLevel(level),
  };
};

/**
 * 分类检索。中文输入先经字典归一化；本地字典命中会一并返回（中文名可直接展示），
 * 再去 ITIS 取权威结果，按学名去重。
 */
export const searchTaxonomy = async (query: string): Promise<TaxonomyNode[]> => {
  const keyword = query.trim();
  if (!keyword) {
    return [];
  }

  const scientificName = resolveQueryToScientificName(keyword);
  if (!scientificName) {
    return [];
  }

  const results: TaxonomyNode[] = [];
  const seen = new Set<string>();

  const push = (node: TaxonomyNode) => {
    const key = node.scientificName.toLowerCase();
    if (!node.scientificName || seen.has(key)) {
      return;
    }
    seen.add(key);
    results.push(node);
  };

  const names = await searchItisByName(scientificName);
  const queryWords = wordCount(scientificName);

  for (const item of names) {
    const combined = (item.combinedName ?? '').trim();
    if (!combined || !item.tsn) {
      continue;
    }
    // 亚种只在用户明确搜三段学名时才返回，否则结果会被亚种刷屏
    if (wordCount(combined) >= 3 && queryWords < 3) {
      continue;
    }
    push({
      id: item.tsn,
      level: inferLevel(combined),
      scientificName: combined,
      commonNameZh: getCommonNameZh(combined),
    });
  }

  // 中文关键词额外补本地字典命中，保证「搜中文有中文结果」
  if (CJK_PATTERN.test(keyword)) {
    for (const [zh, sci] of Object.entries(ZH_NAME_INDEX)) {
      if (!zh.includes(keyword)) {
        continue;
      }
      push({
        id: sci,
        level: inferLevel(sci),
        scientificName: sci,
        commonNameZh: zh,
      });
    }
  }

  return results;
};

const CJK_PATTERN = /[\u4e00-\u9fa5]/;

/**
 * 从学名推断层级：单名查基础词典，二名法为种，三段名归并到种
 * （亚种不进入七级枚举，与前置决策 3 一致）。
 */
const inferLevel = (name: string): TaxonomyLevel => {
  const words = wordCount(name);
  if (words === 1) {
    return getRankLevelOf(name) ?? 'genus';
  }
  return 'species';
};
