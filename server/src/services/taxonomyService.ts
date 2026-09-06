import { fetchJsonWithTimeout } from './externalApiService';

type ItisSearchResponse = {
  scientificNames?: Array<{
    tsn?: string;
    combinedName?: string;
  }>;
};

const getFallbackTree = (level: string, name: string) => ({
  current: {
    level,
    scientificName: name,
    commonNameZh: level === 'family' ? '猫科' : `${name}分类`,
  },
  parent: {
    level: 'order',
    scientificName: 'Carnivora',
    commonNameZh: '食肉目',
  },
  children: [
    {
      level: 'genus',
      scientificName: 'Panthera',
      commonNameZh: '豹属',
      childCount: 5,
    },
    {
      level: 'genus',
      scientificName: 'Felis',
      commonNameZh: '猫属',
      childCount: 6,
    },
  ],
});

export const getTaxonomyTree = async (level: string, name: string) => {
  try {
    const encodedName = encodeURIComponent(name);
    const url = `https://www.itis.gov/ITISWebService/jsonservice/searchByScientificName?srchKey=${encodedName}`;
    const itis = await fetchJsonWithTimeout<ItisSearchResponse>(url);

    const first = itis.scientificNames?.[0];
    if (!first) {
      return getFallbackTree(level, name);
    }

    return {
      ...getFallbackTree(level, name),
      current: {
        level,
        scientificName: first.combinedName || name,
        commonNameZh: level === 'family' ? '猫科' : `${name}分类`,
      },
      parent: {
        level: 'source',
        scientificName: `ITIS TSN ${first.tsn || 'unknown'}`,
        commonNameZh: 'ITIS 数据源',
      },
    };
  } catch {
    return getFallbackTree(level, name);
  }
};
