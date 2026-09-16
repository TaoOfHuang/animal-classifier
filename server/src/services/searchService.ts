import { TaxonomyLevel } from '../constants/taxonomy';
import { getCommonNameZh } from '../data/taxonomyZh';
import { SPECIES_ZH, RANK_ZH } from '../data/taxonomyZh';
import { TaxonomyNode } from '../types/taxonomy';
import { fetchItisHierarchy, searchTaxonomy } from './taxonomyService';

export type SearchParams = {
  q: string;
  limit: number;
  offset: number;
};

export type AnimalSearchItem = {
  id: string;
  commonNameZh: string;
  commonNameEn: string;
  scientificName: string;
  family: string;
  familyZh: string;
  thumbnailUrl?: string;
  level: TaxonomyLevel;
};

/**
 * 单个搜索项最多补一次谱系调用（ITIS 的 TSN 已经在 node.id 上，
 * 无需再检索一次）。限制条数把冷启动成本封在常数级，且结果走 24h 缓存。
 */
const FAMILY_ENRICH_LIMIT = 10;

const enrichFamily = async (nodes: TaxonomyNode[]): Promise<TaxonomyNode[]> => {
  const targets = nodes.slice(0, FAMILY_ENRICH_LIMIT);
  const resolved = await Promise.allSettled(
    targets.map(async node => {
      // 只有带纯数字 TSN 的结果能直接查谱系；本地字典命中的不是 TSN
      if (!/^\d+$/.test(node.id)) {
        return node;
      }

      const hierarchy = await fetchItisHierarchy(node.id);
      const family = hierarchy.find(item => item.rankName === 'Family' && item.taxonName);
      if (!family?.taxonName) {
        return node;
      }

      return {
        ...node,
        family: family.taxonName.trim(),
        familyZh: getCommonNameZh(family.taxonName),
      };
    }),
  );

  return nodes.map((node, index) => {
    const result = resolved[index];
    return result && result.status === 'fulfilled' ? result.value : node;
  });
};

const toSearchItem = (node: TaxonomyNode & { family?: string; familyZh?: string }): AnimalSearchItem => ({
  id: node.id,
  commonNameZh: node.commonNameZh,
  commonNameEn: node.scientificName,
  scientificName: node.scientificName,
  family: node.family ?? (node.level === 'family' ? node.scientificName : ''),
  familyZh: node.familyZh ?? (node.level === 'family' ? node.commonNameZh : ''),
  level: node.level,
});

/**
 * 动物检索。走 taxonomyService —— 中文输入会先在本地字典里归一化成学名，
 * 再取 ITIS 权威结果；上游不可用时返回空结果而非假数据。
 */
export const searchAnimals = async ({
  q,
  limit,
  offset,
}: SearchParams): Promise<{ total: number; items: AnimalSearchItem[]; hasMore: boolean }> => {
  const keyword = q.trim();
  if (!keyword) {
    return { total: 0, items: [], hasMore: false };
  }

  const nodes = await searchTaxonomy(keyword);
  const enriched = await enrichFamily(nodes);

  const page = enriched.slice(offset, offset + limit);

  return {
    total: enriched.length,
    items: page.map(toSearchItem),
    hasMore: offset + limit < enriched.length,
  };
};

const MAX_SUGGESTIONS = 20;

/**
 * 搜索建议。**纯本地字典，不发网络请求** —— 建议列表在输入过程中被高频调用，
 * 走 ITIS 既慢又浪费配额。
 */
export const getSearchSuggestions = async (
  query: string,
  limit: number = 5,
): Promise<string[]> => {
  const keyword = query.trim();
  if (!keyword) {
    return [];
  }

  const suggestions: string[] = [];
  const seen = new Set<string>();
  const push = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed) || suggestions.length >= MAX_SUGGESTIONS) {
      return;
    }
    seen.add(trimmed);
    suggestions.push(trimmed);
  };

  const isCjk = /[\u4e00-\u9fa5]/.test(keyword);

  if (isCjk) {
    // 中文：中文名包含关键词即命中（种名优先，其次属及以上译名）
    for (const zh of Object.values(SPECIES_ZH)) {
      if (zh.includes(keyword)) {
        push(zh);
      }
    }
    for (const zh of Object.values(RANK_ZH)) {
      if (zh.includes(keyword)) {
        push(zh);
      }
    }
  } else {
    // 拉丁/英文：学名前缀或包含，返回可展示的中文名，否则回退学名
    const lower = keyword.toLowerCase();
    for (const [scientificName, zh] of Object.entries(SPECIES_ZH)) {
      if (scientificName.toLowerCase().includes(lower)) {
        push(zh);
      }
    }
    for (const [scientificName, zh] of Object.entries(RANK_ZH)) {
      if (scientificName.toLowerCase().includes(lower)) {
        push(zh);
      }
    }
  }

  return suggestions.slice(0, limit);
};
