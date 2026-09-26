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
  /**
   * habitat / lifestyle / distribution 这类**叙述性**字段。
   *
   * ITIS 与 IUCN 都不提供它们（IUCN 的 habitats 结构化分类见 conservation/README.md，
   * 本服务未取用），唯一来源是识别时让视觉模型一并写出来。因此必须单独标注为
   * 'llm'，免得被当成和分类、濒危同级的权威数据。
   */
  narrative: 'llm' | 'none';
};

export type EnrichedAnimal = AnimalLike & {
  dataSources: AnimalDataSources;
};
