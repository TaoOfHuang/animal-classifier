// 应用全局状态管理
// 使用 React Context 实现（后续可迁移到 Zustand）

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { Animal } from '../types';
import * as storageService from '../services/storageService';

// ==================== 类型定义 ====================

interface RecentAnimal {
  id: string;
  commonNameZh: string;
  thumbnailUrl?: string;
  timestamp: number;
}

interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: 'zh' | 'en';
  enableAnimations: boolean;
  autoPlayImages: boolean;
  cacheEnabled: boolean;
}

interface AppState {
  // 收藏
  favorites: string[];
  favoritesLoading: boolean;

  // 最近浏览
  recentAnimals: RecentAnimal[];
  recentLoading: boolean;

  // 搜索历史
  searchHistory: string[];
  searchHistoryLoading: boolean;

  // 当前识别
  currentRecognition: {
    imageUri: string | null;
    result: Animal | null;
    confidence: number;
    isProcessing: boolean;
  };

  // 应用设置
  settings: AppSettings;
  settingsLoading: boolean;

  // 缓存统计
  cacheStats: {
    totalKeys: number;
    totalSize: number;
  };

  // 全局加载状态
  isInitialized: boolean;
}

type AppAction =
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'SET_FAVORITES'; payload: string[] }
  | { type: 'ADD_FAVORITE'; payload: string }
  | { type: 'REMOVE_FAVORITE'; payload: string }
  | { type: 'SET_RECENT_ANIMALS'; payload: RecentAnimal[] }
  | { type: 'ADD_RECENT_ANIMAL'; payload: RecentAnimal }
  | { type: 'CLEAR_RECENT_ANIMALS' }
  | { type: 'SET_SEARCH_HISTORY'; payload: string[] }
  | { type: 'ADD_SEARCH_HISTORY'; payload: string }
  | { type: 'REMOVE_SEARCH_HISTORY'; payload: string }
  | { type: 'CLEAR_SEARCH_HISTORY' }
  | {
      type: 'SET_CURRENT_RECOGNITION';
      payload: Partial<AppState['currentRecognition']>;
    }
  | { type: 'CLEAR_CURRENT_RECOGNITION' }
  | { type: 'SET_SETTINGS'; payload: Partial<AppSettings> }
  | {
      type: 'SET_CACHE_STATS';
      payload: { totalKeys: number; totalSize: number };
    }
  | { type: 'SET_LOADING'; payload: { key: keyof AppState; loading: boolean } };

// ==================== 初始状态 ====================

const initialState: AppState = {
  favorites: [],
  favoritesLoading: true,
  recentAnimals: [],
  recentLoading: true,
  searchHistory: [],
  searchHistoryLoading: true,
  currentRecognition: {
    imageUri: null,
    result: null,
    confidence: 0,
    isProcessing: false,
  },
  settings: {
    theme: 'light',
    language: 'zh',
    enableAnimations: true,
    autoPlayImages: true,
    cacheEnabled: true,
  },
  settingsLoading: true,
  cacheStats: {
    totalKeys: 0,
    totalSize: 0,
  },
  isInitialized: false,
};

// ==================== Reducer ====================

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_INITIALIZED':
      return { ...state, isInitialized: action.payload };

    case 'SET_FAVORITES':
      return { ...state, favorites: action.payload, favoritesLoading: false };

    case 'ADD_FAVORITE':
      if (state.favorites.includes(action.payload)) return state;
      return { ...state, favorites: [action.payload, ...state.favorites] };

    case 'REMOVE_FAVORITE':
      return {
        ...state,
        favorites: state.favorites.filter(id => id !== action.payload),
      };

    case 'SET_RECENT_ANIMALS':
      return { ...state, recentAnimals: action.payload, recentLoading: false };

    case 'ADD_RECENT_ANIMAL':
      const filteredRecent = state.recentAnimals.filter(
        a => a.id !== action.payload.id,
      );
      return {
        ...state,
        recentAnimals: [action.payload, ...filteredRecent].slice(0, 50),
      };

    case 'CLEAR_RECENT_ANIMALS':
      return { ...state, recentAnimals: [] };

    case 'SET_SEARCH_HISTORY':
      return {
        ...state,
        searchHistory: action.payload,
        searchHistoryLoading: false,
      };

    case 'ADD_SEARCH_HISTORY':
      const filteredHistory = state.searchHistory.filter(
        q => q !== action.payload,
      );
      return {
        ...state,
        searchHistory: [action.payload, ...filteredHistory].slice(0, 20),
      };

    case 'REMOVE_SEARCH_HISTORY':
      return {
        ...state,
        searchHistory: state.searchHistory.filter(q => q !== action.payload),
      };

    case 'CLEAR_SEARCH_HISTORY':
      return { ...state, searchHistory: [] };

    case 'SET_CURRENT_RECOGNITION':
      return {
        ...state,
        currentRecognition: { ...state.currentRecognition, ...action.payload },
      };

    case 'CLEAR_CURRENT_RECOGNITION':
      return {
        ...state,
        currentRecognition: initialState.currentRecognition,
      };

    case 'SET_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
        settingsLoading: false,
      };

    case 'SET_CACHE_STATS':
      return { ...state, cacheStats: action.payload };

    default:
      return state;
  }
}

// ==================== Context ====================

interface AppContextValue {
  state: AppState;

  // 收藏操作
  toggleFavorite: (animalId: string) => Promise<void>;
  isFavorite: (animalId: string) => boolean;

  // 最近浏览操作
  addRecentAnimal: (animal: {
    id: string;
    commonNameZh: string;
    thumbnailUrl?: string;
  }) => Promise<void>;
  clearRecentAnimals: () => Promise<void>;

  // 搜索历史操作
  addSearchHistory: (query: string) => Promise<void>;
  removeSearchHistory: (query: string) => Promise<void>;
  clearSearchHistory: () => Promise<void>;

  // 识别操作
  setRecognitionImage: (imageUri: string) => void;
  setRecognitionResult: (result: Animal, confidence: number) => void;
  clearRecognition: () => void;

  // 设置操作
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;

  // 缓存操作
  refreshCacheStats: () => Promise<void>;
  clearAllCache: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

// ==================== Provider ====================

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // 初始化：加载持久化数据
  useEffect(() => {
    const initialize = async () => {
      try {
        const [favorites, recentAnimals, searchHistory, settings] =
          await Promise.all([
            storageService.getFavorites(),
            storageService.getRecentAnimals(),
            storageService.getSearchHistory(),
            storageService.getAppSettings(),
          ]);

        dispatch({ type: 'SET_FAVORITES', payload: favorites });
        dispatch({ type: 'SET_RECENT_ANIMALS', payload: recentAnimals });
        dispatch({ type: 'SET_SEARCH_HISTORY', payload: searchHistory });
        dispatch({ type: 'SET_SETTINGS', payload: settings });
        dispatch({ type: 'SET_INITIALIZED', payload: true });
      } catch (error) {
        console.error('Failed to initialize app state:', error);
        dispatch({ type: 'SET_INITIALIZED', payload: true });
      }
    };

    initialize();
  }, []);

  // 收藏操作
  const toggleFavorite = useCallback(
    async (animalId: string) => {
      const isCurrentlyFavorite = state.favorites.includes(animalId);

      if (isCurrentlyFavorite) {
        dispatch({ type: 'REMOVE_FAVORITE', payload: animalId });
        await storageService.removeFavorite(animalId);
      } else {
        dispatch({ type: 'ADD_FAVORITE', payload: animalId });
        await storageService.addFavorite(animalId);
      }
    },
    [state.favorites],
  );

  const isFavorite = useCallback(
    (animalId: string) => {
      return state.favorites.includes(animalId);
    },
    [state.favorites],
  );

  // 最近浏览操作
  const addRecentAnimal = useCallback(
    async (animal: {
      id: string;
      commonNameZh: string;
      thumbnailUrl?: string;
    }) => {
      const recentAnimal = { ...animal, timestamp: Date.now() };
      dispatch({ type: 'ADD_RECENT_ANIMAL', payload: recentAnimal });
      await storageService.addRecentAnimal(animal);
    },
    [],
  );

  const clearRecentAnimals = useCallback(async () => {
    dispatch({ type: 'CLEAR_RECENT_ANIMALS' });
    await storageService.clearRecentAnimals();
  }, []);

  // 搜索历史操作
  const addSearchHistory = useCallback(async (query: string) => {
    if (!query.trim()) return;
    dispatch({ type: 'ADD_SEARCH_HISTORY', payload: query.trim() });
    await storageService.addSearchHistory(query.trim());
  }, []);

  const removeSearchHistory = useCallback(async (query: string) => {
    dispatch({ type: 'REMOVE_SEARCH_HISTORY', payload: query });
    await storageService.removeSearchHistory(query);
  }, []);

  const clearSearchHistory = useCallback(async () => {
    dispatch({ type: 'CLEAR_SEARCH_HISTORY' });
    await storageService.clearSearchHistory();
  }, []);

  // 识别操作
  const setRecognitionImage = useCallback((imageUri: string) => {
    dispatch({
      type: 'SET_CURRENT_RECOGNITION',
      payload: { imageUri, isProcessing: true },
    });
  }, []);

  const setRecognitionResult = useCallback(
    (result: Animal, confidence: number) => {
      dispatch({
        type: 'SET_CURRENT_RECOGNITION',
        payload: { result, confidence, isProcessing: false },
      });
    },
    [],
  );

  const clearRecognition = useCallback(() => {
    dispatch({ type: 'CLEAR_CURRENT_RECOGNITION' });
  }, []);

  // 设置操作
  const updateSettings = useCallback(async (settings: Partial<AppSettings>) => {
    dispatch({ type: 'SET_SETTINGS', payload: settings });
    await storageService.updateAppSettings(settings);
  }, []);

  // 缓存操作
  const refreshCacheStats = useCallback(async () => {
    const stats = await storageService.getCacheStats();
    dispatch({
      type: 'SET_CACHE_STATS',
      payload: { totalKeys: stats.totalKeys, totalSize: stats.totalSize },
    });
  }, []);

  const clearAllCache = useCallback(async () => {
    await storageService.clearAllCache();
    dispatch({ type: 'CLEAR_RECENT_ANIMALS' });
    dispatch({ type: 'CLEAR_SEARCH_HISTORY' });
    await refreshCacheStats();
  }, [refreshCacheStats]);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      toggleFavorite,
      isFavorite,
      addRecentAnimal,
      clearRecentAnimals,
      addSearchHistory,
      removeSearchHistory,
      clearSearchHistory,
      setRecognitionImage,
      setRecognitionResult,
      clearRecognition,
      updateSettings,
      refreshCacheStats,
      clearAllCache,
    }),
    [
      state,
      toggleFavorite,
      isFavorite,
      addRecentAnimal,
      clearRecentAnimals,
      addSearchHistory,
      removeSearchHistory,
      clearSearchHistory,
      setRecognitionImage,
      setRecognitionResult,
      clearRecognition,
      updateSettings,
      refreshCacheStats,
      clearAllCache,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// ==================== Hook ====================

export const useAppStore = (): AppContextValue => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
};

// 导出便捷 hooks
export const useFavorites = () => {
  const { state, toggleFavorite, isFavorite } = useAppStore();
  return {
    favorites: state.favorites,
    isLoading: state.favoritesLoading,
    toggleFavorite,
    isFavorite,
  };
};

export const useRecentAnimals = () => {
  const { state, addRecentAnimal, clearRecentAnimals } = useAppStore();
  return {
    recentAnimals: state.recentAnimals,
    isLoading: state.recentLoading,
    addRecentAnimal,
    clearRecentAnimals,
  };
};

export const useSearchHistory = () => {
  const { state, addSearchHistory, removeSearchHistory, clearSearchHistory } =
    useAppStore();
  return {
    searchHistory: state.searchHistory,
    isLoading: state.searchHistoryLoading,
    addSearchHistory,
    removeSearchHistory,
    clearSearchHistory,
  };
};

export const useRecognition = () => {
  const { state, setRecognitionImage, setRecognitionResult, clearRecognition } =
    useAppStore();
  return {
    ...state.currentRecognition,
    setRecognitionImage,
    setRecognitionResult,
    clearRecognition,
  };
};

export const useAppSettings = () => {
  const { state, updateSettings } = useAppStore();
  return {
    settings: state.settings,
    isLoading: state.settingsLoading,
    updateSettings,
  };
};

export default {
  AppProvider,
  useAppStore,
  useFavorites,
  useRecentAnimals,
  useSearchHistory,
  useRecognition,
  useAppSettings,
};
