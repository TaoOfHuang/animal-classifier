"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnimalById = void 0;
const externalApiService_1 = require("./externalApiService");
const getFallbackAnimal = (id) => ({
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
    images: [],
    habitat: '森林与山地',
    lifestyle: '独居',
    distribution: '东北亚',
    conservationStatus: {
        iucnStatus: 'EN',
        population: 500,
        populationTrend: 'stable',
        assessmentYear: 2021,
    },
});
const mapIucnCategory = (category) => {
    const c = String(category || '').toUpperCase();
    if (c === 'CR' || c === 'EN' || c === 'VU' || c === 'NT' || c === 'LC') {
        return c;
    }
    return 'EN';
};
const getIucnStatus = async (scientificName) => {
    const token = process.env.IUCN_API_TOKEN;
    if (!token) {
        return 'EN';
    }
    const encoded = encodeURIComponent(scientificName);
    const url = `https://apiv3.iucnredlist.org/api/v3/species/${encoded}?token=${token}`;
    const data = await (0, externalApiService_1.fetchJsonWithTimeout)(url);
    return mapIucnCategory(data.result?.[0]?.category);
};
const getAnimalImages = async (query) => {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!accessKey) {
        return [];
    }
    const encoded = encodeURIComponent(query);
    const url = `https://api.unsplash.com/search/photos?query=${encoded}&per_page=3`;
    const data = await (0, externalApiService_1.fetchJsonWithTimeout)(url, {
        headers: {
            Authorization: `Client-ID ${accessKey}`,
        },
    });
    return (data.results || [])
        .map(item => item.urls?.regular || item.urls?.small || '')
        .filter(Boolean);
};
const getAnimalById = async (id) => {
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
    }
    catch {
        return fallback;
    }
};
exports.getAnimalById = getAnimalById;
