import { TaxonomyLevel } from '../constants/taxonomy';
import { ConservationStatus } from '../services/conservation/types';

export type AnimalTaxonomyItem = {
  scientificName: string;
  commonNameZh: string;
  commonNameEn?: string;
};

/** 七级分类，各级可能缺失（例如只查到属没查到种） */
export type AnimalTaxonomy = Partial<Record<TaxonomyLevel, AnimalTaxonomyItem>>;

export type AnimalLike = {
  id: string;
  commonNameZh: string;
  commonNameEn?: string;
  scientificName: string;
  taxonomy?: AnimalTaxonomy;
  /** 亚种不进七级枚举，单独挂在这里 */
  subspecies?: AnimalTaxonomyItem[];
  images?: string[];
  thumbnailUrl?: string;
  description?: string;
  habitat?: string;
  lifestyle?: string;
  distribution?: string;
  conservationStatus?: ConservationStatus;
};

/**
 * 数据来自哪里。前端与排查都需要它区分「ITIS 校正过的」和「LLM 随口说的」，
 * 避免把模型幻觉当成权威分类展示。
 */
export type AnimalDataSources = {
  taxonomy: 'itis' | 'llm' | 'none';
  conservation: 'iucn_v4' | 'static' | 'none';
};

export type EnrichedAnimal = AnimalLike & {
  dataSources: AnimalDataSources;
};
