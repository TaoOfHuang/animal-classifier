// 搜索服务层
// 提供动物搜索、自动补全、历史记录管理

import { Animal, SearchResult } from '../types';
import { API_BASE_URL } from './api';

// 是否使用后端 API
const USE_BACKEND_API = false;

// 本地搜索历史（内存缓存，后续可持久化到 MMKV）
let searchHistory: string[] = [];
const MAX_HISTORY_SIZE = 20;

// Mock 搜索数据
const MOCK_ANIMALS: SearchResult[] = [
  {
    id: 'giant-panda',
    commonNameZh: '大熊猫',
    commonNameEn: 'Giant Panda',
    scientificName: 'Ailuropoda melanoleuca',
    family: 'Ursidae',
    familyZh: '熊科',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=200',
  },
  {
    id: 'red-panda',
    commonNameZh: '小熊猫',
    commonNameEn: 'Red Panda',
    scientificName: 'Ailurus fulgens',
    family: 'Ailuridae',
    familyZh: '小熊猫科',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1525869916826-972885c91c1e?w=200',
  },
  {
    id: 'tiger',
    commonNameZh: '虎',
    commonNameEn: 'Tiger',
    scientificName: 'Panthera tigris',
    family: 'Felidae',
    familyZh: '猫科',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=200',
  },
  {
    id: 'lion',
    commonNameZh: '狮',
    commonNameEn: 'Lion',
    scientificName: 'Panthera leo',
    family: 'Felidae',
    familyZh: '猫科',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1507666664345-c49223375e33?w=200',
  },
  {
    id: 'leopard',
    commonNameZh: '豹',
    commonNameEn: 'Leopard',
    scientificName: 'Panthera pardus',
    family: 'Felidae',
    familyZh: '猫科',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1456926631375-92c8ce872def?w=200',
  },
  {
    id: 'snow-leopard',
    commonNameZh: '雪豹',
    commonNameEn: 'Snow Leopard',
    scientificName: 'Panthera uncia',
    family: 'Felidae',
    familyZh: '猫科',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=200',
  },
  {
    id: 'cheetah',
    commonNameZh: '猎豹',
    commonNameEn: 'Cheetah',
    scientificName: 'Acinonyx jubatus',
    family: 'Felidae',
    familyZh: '猫科',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1456926631375-92c8ce872def?w=200',
  },
  {
    id: 'wolf',
    commonNameZh: '狼',
    commonNameEn: 'Wolf',
    scientificName: 'Canis lupus',
    family: 'Canidae',
    familyZh: '犬科',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1507666664345-c49223375e33?w=200',
  },
  {
    id: 'elephant',
    commonNameZh: '亚洲象',
    commonNameEn: 'Asian Elephant',
    scientificName: 'Elephas maximus',
    family: 'Elephantidae',
    familyZh: '象科',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?w=200',
  },
  {
    id: 'polar-bear',
    commonNameZh: '北极熊',
    commonNameEn: 'Polar Bear',
    scientificName: 'Ursus maritimus',
    family: 'Ursidae',
    familyZh: '熊科',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1589656966895-2f33e7653819?w=200',
  },
  {
    id: 'brown-bear',
    commonNameZh: '棕熊',
    commonNameEn: 'Brown Bear',
    scientificName: 'Ursus arctos',
    family: 'Ursidae',
    familyZh: '熊科',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1525382455947-f319bc05fb35?w=200',
  },
  {
    id: 'gorilla',
    commonNameZh: '大猩猩',
    commonNameEn: 'Gorilla',
    scientificName: 'Gorilla gorilla',
    family: 'Hominidae',
    familyZh: '人科',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1548247416-ec66f4900b2e?w=200',
  },
];

// 热门搜索词
export const HOT_SEARCH_TERMS = [
  '大熊猫',
  '东北虎',
  '雪豹',
  '狮子',
  '北极熊',
  '大象',
  '猎豹',
  '灰狼',
];

// 延迟模拟网络请求
const delay = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

// 搜索动物
export const searchAnimals = async (
  query: string,
  options?: {
    limit?: number;
    offset?: number;
    family?: string;
  },
): Promise<{
  results: SearchResult[];
  total: number;
  hasMore: boolean;
}> => {
  const { limit = 10, offset = 0, family } = options || {};

  if (USE_BACKEND_API) {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: String(limit),
        offset: String(offset),
      });
      if (family) params.append('family', family);

      const response = await fetch(`${API_BASE_URL}/api/search?${params}`);
      if (!response.ok) throw new Error('API error');
      const data = (await response.json()) as {
        items?: SearchResult[];
        total?: number;
      };
      return {
        results: data.items || [],
        total: data.total || 0,
        hasMore: offset + limit < (data.total || 0),
      };
    } catch (error) {
      console.warn('Failed to search from API, using mock:', error);
    }
  }

  // Mock 搜索
  await delay(200 + Math.random() * 300);

  const lowerQuery = query.toLowerCase();
  let filtered = MOCK_ANIMALS.filter(animal => {
    const matchesQuery =
      animal.commonNameZh.includes(query) ||
      animal.commonNameEn.toLowerCase().includes(lowerQuery) ||
      animal.scientificName.toLowerCase().includes(lowerQuery) ||
      animal.familyZh.includes(query);

    const matchesFamily =
      !family || animal.family.toLowerCase() === family.toLowerCase();

    return matchesQuery && matchesFamily;
  });

  const total = filtered.length;
  const results = filtered.slice(offset, offset + limit);

  return {
    results,
    total,
    hasMore: offset + limit < total,
  };
};

// 获取搜索建议（自动补全）
export const getSearchSuggestions = async (
  query: string,
  limit: number = 5,
): Promise<string[]> => {
  if (!query.trim()) return [];

  if (USE_BACKEND_API) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/search/suggestions?q=${encodeURIComponent(query)}&limit=${limit}`,
      );
      if (!response.ok) throw new Error('API error');
      const data = (await response.json()) as { suggestions?: string[] };
      return data.suggestions || [];
    } catch (error) {
      console.warn('Failed to get suggestions from API:', error);
    }
  }

  // Mock 建议
  await delay(100);

  const lowerQuery = query.toLowerCase();
  const suggestions: string[] = [];

  // 从动物名称中匹配
  for (const animal of MOCK_ANIMALS) {
    if (animal.commonNameZh.includes(query)) {
      suggestions.push(animal.commonNameZh);
    }
    if (animal.commonNameEn.toLowerCase().includes(lowerQuery)) {
      suggestions.push(animal.commonNameEn);
    }
    if (suggestions.length >= limit) break;
  }

  // 从热门搜索中匹配
  for (const term of HOT_SEARCH_TERMS) {
    if (term.includes(query) && !suggestions.includes(term)) {
      suggestions.push(term);
    }
    if (suggestions.length >= limit) break;
  }

  return suggestions.slice(0, limit);
};

// 获取搜索历史
export const getSearchHistory = (): string[] => {
  return [...searchHistory];
};

// 添加搜索历史
export const addSearchHistory = (query: string): void => {
  const trimmed = query.trim();
  if (!trimmed) return;

  // 移除已存在的相同记录
  searchHistory = searchHistory.filter(item => item !== trimmed);

  // 添加到开头
  searchHistory.unshift(trimmed);

  // 限制历史记录数量
  if (searchHistory.length > MAX_HISTORY_SIZE) {
    searchHistory = searchHistory.slice(0, MAX_HISTORY_SIZE);
  }
};

// 删除单条搜索历史
export const removeSearchHistory = (query: string): void => {
  searchHistory = searchHistory.filter(item => item !== query);
};

// 清空搜索历史
export const clearSearchHistory = (): void => {
  searchHistory = [];
};

// 获取热门搜索
export const getHotSearchTerms = (): string[] => {
  return HOT_SEARCH_TERMS;
};

// 获取动物详情
export const getAnimalDetail = async (id: string): Promise<Animal | null> => {
  if (USE_BACKEND_API) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/animal/${id}`);
      if (!response.ok) throw new Error('API error');
      return (await response.json()) as Animal;
    } catch (error) {
      console.warn('Failed to get animal detail from API:', error);
    }
  }

  // Mock 详情
  await delay(300);

  const searchResult = MOCK_ANIMALS.find(a => a.id === id);
  if (!searchResult) return null;

  // 构造完整的 Animal 对象
  return {
    id: searchResult.id,
    commonNameZh: searchResult.commonNameZh,
    commonNameEn: searchResult.commonNameEn,
    scientificName: searchResult.scientificName,
    taxonomy: {
      kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
      phylum: { scientificName: 'Chordata', commonNameZh: '脊索动物门' },
      class: { scientificName: 'Mammalia', commonNameZh: '哺乳纲' },
      order: { scientificName: 'Carnivora', commonNameZh: '食肉目' },
      family: {
        scientificName: searchResult.family,
        commonNameZh: searchResult.familyZh,
      },
      genus: {
        scientificName: searchResult.scientificName.split(' ')[0],
        commonNameZh: '',
      },
      species: {
        scientificName: searchResult.scientificName,
        commonNameZh: searchResult.commonNameZh,
      },
    },
    images: [
      searchResult.thumbnailUrl || '',
      searchResult.thumbnailUrl?.replace('w=200', 'w=400') || '',
    ],
    thumbnailUrl: searchResult.thumbnailUrl,
    description: `${searchResult.commonNameZh}是${searchResult.familyZh}的一种动物。`,
    habitat: '森林、草原',
    lifestyle: '主要在清晨和傍晚活动',
    distribution: '分布于亚洲、非洲等地区',
    conservationStatus: {
      iucnStatus: 'VU',
      population: 5000,
      populationTrend: 'decreasing',
      assessmentYear: 2022,
    },
  };
};

export default {
  searchAnimals,
  getSearchSuggestions,
  getSearchHistory,
  addSearchHistory,
  removeSearchHistory,
  clearSearchHistory,
  getHotSearchTerms,
  getAnimalDetail,
};
