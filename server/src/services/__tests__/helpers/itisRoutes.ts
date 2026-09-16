import * as F from './fixtures';

const key = (operation: string, param: string) => `${operation}?${param}`;

export const itisRouteKey = key;

/**
 * ITIS 端点的标准路由表。URL 由 `taxonomyService` 用
 * `${base}/${operation}?${p}=${encodeURIComponent(v)}` 拼出，因此空格是 %20。
 */
export const ITIS_ROUTES: Record<string, () => unknown> = {
  [key('searchByScientificName', 'srchKey=Panthera%20tigris')]: () =>
    F.ITIS_SEARCH_PANTHERA_TIGRIS,
  [key('searchByScientificName', 'srchKey=Panthera%20leo')]: () => F.ITIS_SEARCH_EMPTY,
  [key('searchByScientificName', 'srchKey=Felidae')]: () => F.ITIS_SEARCH_FELIDAE,
  [key('searchByScientificName', 'srchKey=Panthera')]: () => F.ITIS_SEARCH_PANTHERA_GENUS,
  [key('searchByScientificName', 'srchKey=Animalia')]: () => F.ITIS_SEARCH_ANIMALIA,
  [key('searchByScientificName', 'srchKey=Notarealgenus%20notarealspecies')]: () =>
    F.ITIS_SEARCH_UNKNOWN,
  [key('searchByScientificName', 'srchKey=Notarealgenus')]: () => F.ITIS_SEARCH_EMPTY,

  [key('getFullHierarchyFromTSN', 'tsn=183805')]: () => F.ITIS_HIERARCHY_PANTHERA_TIGRIS,
  [key('getFullHierarchyFromTSN', 'tsn=180580')]: () => F.ITIS_HIERARCHY_FELIDAE,
  [key('getFullHierarchyFromTSN', 'tsn=180592')]: () => F.ITIS_HIERARCHY_PANTHERA_GENUS,

  [key('getHierarchyDownFromTSN', 'tsn=180580')]: () => F.ITIS_DOWN_PANTHERA,
  [key('getHierarchyDownFromTSN', 'tsn=180592')]: () => F.ITIS_DOWN_PANTHERA,
  [key('getHierarchyDownFromTSN', 'tsn=183805')]: () => F.ITIS_DOWN_PANTHERA_TIGRIS,
};
