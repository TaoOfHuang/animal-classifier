import { AnimalLike, AnimalDataSources, EnrichedAnimal } from './animal';
import { TaxonomyNode } from './taxonomy';

export type ApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiSuccessBody<T> = {
  success: true;
  data: T;
};

/** GET /api/animal/:id */
export type AnimalDetailResponse = EnrichedAnimal;

/** POST /api/recognize */
export type RecognizeResponse = {
  animal: AnimalLike & { dataSources?: AnimalDataSources };
  confidence: number;
  dataSources: AnimalDataSources;
};

/** GET /api/search */
export type SearchResponse = {
  total: number;
  items: Array<{
    id: string;
    commonNameZh: string;
    commonNameEn: string;
    scientificName: string;
    family: string;
    familyZh: string;
    thumbnailUrl?: string;
  }>;
  hasMore: boolean;
};

/** GET /api/search/suggestions */
export type SuggestionsResponse = {
  suggestions: string[];
};

/** GET /api/taxonomy/:level/:name */
export type TaxonomyDetailResponse = {
  current: TaxonomyNode;
  parent?: TaxonomyNode;
  childCount: number;
};

/** GET /api/taxonomy/:level/:name/children */
export type TaxonomyChildrenResponse = {
  children: TaxonomyNode[];
  hasMore: boolean;
  total: number;
};

/** GET /api/taxonomy/search */
export type TaxonomySearchResponse = {
  results: TaxonomyNode[];
};
