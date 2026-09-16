import { TAXONOMY_ORDER, TaxonomyLevel } from '../constants/taxonomy';

export type TaxonomyItem = {
  scientificName: string;
  commonNameZh: string;
  tsn?: string;
};

/** ITIS 谱系过滤到七级后的结果 */
export type TaxonomyLineage = {
  kingdom?: TaxonomyItem;
  phylum?: TaxonomyItem;
  class?: TaxonomyItem;
  order?: TaxonomyItem;
  family?: TaxonomyItem;
  genus?: TaxonomyItem;
  species?: TaxonomyItem;
  /** 亚种不进七级枚举，单独挂在这里供展示 */
  subspecies: TaxonomyItem[];
  /** 该谱系锚定到的 ITIS TSN（种级优先） */
  tsn?: string;
};

export type TaxonomyNode = {
  id: string;
  level: TaxonomyLevel;
  scientificName: string;
  commonNameZh: string;
  commonNameEn?: string;
  childCount?: number;
  representativeImage?: string;
};

export const isTaxonomyLevel = (value: string): value is TaxonomyLevel =>
  (TAXONOMY_ORDER as string[]).includes(value);
