// 本地存储服务
// 使用 AsyncStorage 实现（后续可替换为 MMKV）
// 提供统一的缓存接口

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animal, TaxonomyNode } from '../types';

// 缓存键前缀
const CACHE_KEYS = {
  SEARCH_HISTORY: '@animal_classifier:search_history',
  FAVORITES: '@animal_classifier:favorites',
  RECENT_ANIMALS: '@animal_classifier:recent_animals',
  ANIMAL_CACHE: '@animal_classifier:animal_cache:',
  TAXONOMY_CACHE: '@animal_classifier:taxonomy_cache:',
  APP_SETTINGS: '@animal_classifier:settings',
};

// 缓存过期时间（毫秒）
const CACHE_TTL = {
  ANIMAL: 24 * 60 * 60 * 1000, // 24小时
  TAXONOMY: 7 * 24 * 60 * 60 * 1000, // 7天
  SEARCH: 30 * 24 * 60 * 60 * 1000, // 30天
};

// 缓存数据结构
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// 检查缓存是否过期
const isCacheValid = <T>(entry: CacheEntry<T> | null): boolean => {
  if (!entry) return false;
  return Date.now() - entry.timestamp < entry.ttl;
};

// === 通用缓存方法 ===

export const setCache = async <T>(
  key: string,
  data: T,
  ttl: number,
): Promise<void> => {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.error('Failed to set cache:', error);
  }
};

export const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    const value = await AsyncStorage.getItem(key);
    if (!value) return null;

    const entry: CacheEntry<T> = JSON.parse(value);
    if (!isCacheValid(entry)) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.error('Failed to get cache:', error);
    return null;
  }
};

export const removeCache = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to remove cache:', error);
  }
};

export const clearAllCache = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith('@animal_classifier:'));
    // 逐个删除，因为某些版本可能不支持 multiRemove
    for (const key of cacheKeys) {
      await AsyncStorage.removeItem(key);
    }
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
};

// === 搜索历史 ===

export const getSearchHistory = async (): Promise<string[]> => {
  try {
    const value = await AsyncStorage.getItem(CACHE_KEYS.SEARCH_HISTORY);
    return value ? JSON.parse(value) : [];
  } catch (error) {
    console.error('Failed to get search history:', error);
    return [];
  }
};

export const addSearchHistory = async (query: string): Promise<void> => {
  try {
    const history = await getSearchHistory();
    const filtered = history.filter(item => item !== query);
    const updated = [query, ...filtered].slice(0, 20);
    await AsyncStorage.setItem(
      CACHE_KEYS.SEARCH_HISTORY,
      JSON.stringify(updated),
    );
  } catch (error) {
    console.error('Failed to add search history:', error);
  }
};

export const removeSearchHistory = async (query: string): Promise<void> => {
  try {
    const history = await getSearchHistory();
    const updated = history.filter(item => item !== query);
    await AsyncStorage.setItem(
      CACHE_KEYS.SEARCH_HISTORY,
      JSON.stringify(updated),
    );
  } catch (error) {
    console.error('Failed to remove search history:', error);
  }
};

export const clearSearchHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CACHE_KEYS.SEARCH_HISTORY);
  } catch (error) {
    console.error('Failed to clear search history:', error);
  }
};

// === 收藏功能 ===

export const getFavorites = async (): Promise<string[]> => {
  try {
    const value = await AsyncStorage.getItem(CACHE_KEYS.FAVORITES);
    return value ? JSON.parse(value) : [];
  } catch (error) {
    console.error('Failed to get favorites:', error);
    return [];
  }
};

export const addFavorite = async (animalId: string): Promise<void> => {
  try {
    const favorites = await getFavorites();
    if (!favorites.includes(animalId)) {
      favorites.unshift(animalId);
      await AsyncStorage.setItem(
        CACHE_KEYS.FAVORITES,
        JSON.stringify(favorites),
      );
    }
  } catch (error) {
    console.error('Failed to add favorite:', error);
  }
};

export const removeFavorite = async (animalId: string): Promise<void> => {
  try {
    const favorites = await getFavorites();
    const updated = favorites.filter(id => id !== animalId);
    await AsyncStorage.setItem(CACHE_KEYS.FAVORITES, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to remove favorite:', error);
  }
};

export const isFavorite = async (animalId: string): Promise<boolean> => {
  const favorites = await getFavorites();
  return favorites.includes(animalId);
};

// === 最近浏览 ===

interface RecentAnimal {
  id: string;
  commonNameZh: string;
  thumbnailUrl?: string;
  timestamp: number;
}

export const getRecentAnimals = async (): Promise<RecentAnimal[]> => {
  try {
    const value = await AsyncStorage.getItem(CACHE_KEYS.RECENT_ANIMALS);
    return value ? JSON.parse(value) : [];
  } catch (error) {
    console.error('Failed to get recent animals:', error);
    return [];
  }
};

export const addRecentAnimal = async (animal: {
  id: string;
  commonNameZh: string;
  thumbnailUrl?: string;
}): Promise<void> => {
  try {
    const recent = await getRecentAnimals();
    const filtered = recent.filter(item => item.id !== animal.id);
    const updated: RecentAnimal[] = [
      { ...animal, timestamp: Date.now() },
      ...filtered,
    ].slice(0, 50);
    await AsyncStorage.setItem(
      CACHE_KEYS.RECENT_ANIMALS,
      JSON.stringify(updated),
    );
  } catch (error) {
    console.error('Failed to add recent animal:', error);
  }
};

export const clearRecentAnimals = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CACHE_KEYS.RECENT_ANIMALS);
  } catch (error) {
    console.error('Failed to clear recent animals:', error);
  }
};

// === 动物数据缓存 ===

export const cacheAnimal = async (animal: Animal): Promise<void> => {
  const key = `${CACHE_KEYS.ANIMAL_CACHE}${animal.id}`;
  await setCache(key, animal, CACHE_TTL.ANIMAL);
};

export const getCachedAnimal = async (
  animalId: string,
): Promise<Animal | null> => {
  const key = `${CACHE_KEYS.ANIMAL_CACHE}${animalId}`;
  return getCache<Animal>(key);
};

// === 分类数据缓存 ===

export const cacheTaxonomy = async (
  key: string,
  nodes: TaxonomyNode[],
): Promise<void> => {
  const cacheKey = `${CACHE_KEYS.TAXONOMY_CACHE}${key}`;
  await setCache(cacheKey, nodes, CACHE_TTL.TAXONOMY);
};

export const getCachedTaxonomy = async (
  key: string,
): Promise<TaxonomyNode[] | null> => {
  const cacheKey = `${CACHE_KEYS.TAXONOMY_CACHE}${key}`;
  return getCache<TaxonomyNode[]>(cacheKey);
};

// === 应用设置 ===

interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: 'zh' | 'en';
  enableAnimations: boolean;
  autoPlayImages: boolean;
  cacheEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  language: 'zh',
  enableAnimations: true,
  autoPlayImages: true,
  cacheEnabled: true,
};

export const getAppSettings = async (): Promise<AppSettings> => {
  try {
    const value = await AsyncStorage.getItem(CACHE_KEYS.APP_SETTINGS);
    return value
      ? { ...DEFAULT_SETTINGS, ...JSON.parse(value) }
      : DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Failed to get settings:', error);
    return DEFAULT_SETTINGS;
  }
};

export const updateAppSettings = async (
  settings: Partial<AppSettings>,
): Promise<void> => {
  try {
    const current = await getAppSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(
      CACHE_KEYS.APP_SETTINGS,
      JSON.stringify(updated),
    );
  } catch (error) {
    console.error('Failed to update settings:', error);
  }
};

// === 缓存统计 ===

export const getCacheStats = async (): Promise<{
  totalKeys: number;
  totalSize: number;
  favorites: number;
  recentAnimals: number;
  searchHistory: number;
}> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith('@animal_classifier:'));

    const favorites = await getFavorites();
    const recentAnimals = await getRecentAnimals();
    const searchHistory = await getSearchHistory();

    // 估算缓存大小（简单估算）
    let totalSize = 0;
    for (const key of cacheKeys) {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        totalSize += value.length;
      }
    }

    return {
      totalKeys: cacheKeys.length,
      totalSize,
      favorites: favorites.length,
      recentAnimals: recentAnimals.length,
      searchHistory: searchHistory.length,
    };
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return {
      totalKeys: 0,
      totalSize: 0,
      favorites: 0,
      recentAnimals: 0,
      searchHistory: 0,
    };
  }
};

export default {
  // 通用缓存
  setCache,
  getCache,
  removeCache,
  clearAllCache,
  // 搜索历史
  getSearchHistory,
  addSearchHistory,
  removeSearchHistory,
  clearSearchHistory,
  // 收藏
  getFavorites,
  addFavorite,
  removeFavorite,
  isFavorite,
  // 最近浏览
  getRecentAnimals,
  addRecentAnimal,
  clearRecentAnimals,
  // 数据缓存
  cacheAnimal,
  getCachedAnimal,
  cacheTaxonomy,
  getCachedTaxonomy,
  // 设置
  getAppSettings,
  updateAppSettings,
  // 统计
  getCacheStats,
};
