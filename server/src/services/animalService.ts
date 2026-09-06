import { fetchJsonWithTimeout } from './externalApiService';

type UnsplashResponse = {
  results?: Array<{
    urls?: {
      regular?: string;
      small?: string;
    };
  }>;
};

type IucnSpeciesResponse = {
  result?: Array<{
    category?: string;
  }>;
};

const getFallbackAnimal = (id: string) => ({
  id,
  commonNameZh: '东北虎',
  commonNameEn: 'Siberian Tiger',
  scientificName: 'Panthera tigris altaica',
  taxonomy: {
    kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
    phylum: { scientificName: 'Chordata', commonNameZh: '脊索动物门' },
    class: { scientificName: 'Mammalia', commonNameZh: '哺乳纲' },
    order: { scientificName: 'Carnivora', commonNameZh: '食肉目' },
    family: { scientificName: 'Felidae', commonNameZh: '猫科' },
    genus: { scientificName: 'Panthera', commonNameZh: '豹属' },
    species: { scientificName: 'Panthera tigris', commonNameZh: '虎' },
  },
  images: [] as string[],
  habitat: '森林与山地',
  lifestyle: '独居',
  distribution: '东北亚',
  conservationStatus: {
    iucnStatus: 'EN',
    population: 500,
    populationTrend: 'stable' as const,
    assessmentYear: 2021,
  },
});

const mapIucnCategory = (category?: string) => {
  const c = String(category || '').toUpperCase();
  if (c === 'CR' || c === 'EN' || c === 'VU' || c === 'NT' || c === 'LC') {
    return c;
  }
  return 'EN';
};

const getIucnStatus = async (scientificName: string): Promise<string> => {
  const token = process.env.IUCN_API_TOKEN;
  if (!token) {
    return 'EN';
  }

  const encoded = encodeURIComponent(scientificName);
  const url = `https://apiv3.iucnredlist.org/api/v3/species/${encoded}?token=${token}`;
  const data = await fetchJsonWithTimeout<IucnSpeciesResponse>(url);
  return mapIucnCategory(data.result?.[0]?.category);
};

const getAnimalImages = async (query: string): Promise<string[]> => {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    return [];
  }

  const encoded = encodeURIComponent(query);
  const url = `https://api.unsplash.com/search/photos?query=${encoded}&per_page=3`;
  const data = await fetchJsonWithTimeout<UnsplashResponse>(url, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
    },
  });

  return (data.results || [])
    .map(item => item.urls?.regular || item.urls?.small || '')
    .filter(Boolean);
};

export const getAnimalById = async (id: string) => {
  const fallback = getFallbackAnimal(id);

  try {
    const [iucnStatus, images] = await Promise.all([
      getIucnStatus(fallback.scientificName),
      getAnimalImages(fallback.commonNameEn),
    ]);

    return {
      ...fallback,
      images,
      conservationStatus: {
        ...fallback.conservationStatus,
        iucnStatus,
      },
    };
  } catch {
    return fallback;
  }
};
