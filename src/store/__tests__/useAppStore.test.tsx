// Store 集成测试

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import {
  AppProvider,
  useAppStore,
  useFavorites,
  useRecentAnimals,
  useSearchHistory,
  useRecognition,
  useAppSettings,
} from '../useAppStore';
import * as storageService from '../../services/storageService';

// Mock storageService
jest.mock('../../services/storageService');

const mockStorageService = storageService as jest.Mocked<typeof storageService>;

// Helper to wrap hooks with provider
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

describe('useAppStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    mockStorageService.getFavorites.mockResolvedValue([]);
    mockStorageService.getRecentAnimals.mockResolvedValue([]);
    mockStorageService.getSearchHistory.mockResolvedValue([]);
    mockStorageService.getAppSettings.mockResolvedValue({
      theme: 'light',
      language: 'zh',
      enableAnimations: true,
      autoPlayImages: true,
      cacheEnabled: true,
    });
  });

  it('throws error when used outside of AppProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAppStore());
    }).toThrow('useAppStore must be used within an AppProvider');

    consoleSpy.mockRestore();
  });

  it('initializes state from storage', async () => {
    mockStorageService.getFavorites.mockResolvedValue(['tiger', 'panda']);
    mockStorageService.getSearchHistory.mockResolvedValue(['狮子', '老虎']);

    const { result } = renderHook(() => useAppStore(), { wrapper });

    await waitFor(() => {
      expect(result.current.state.isInitialized).toBe(true);
    });

    expect(result.current.state.favorites).toEqual(['tiger', 'panda']);
    expect(result.current.state.searchHistory).toEqual(['狮子', '老虎']);
  });
});

describe('useFavorites', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageService.getFavorites.mockResolvedValue([]);
    mockStorageService.getRecentAnimals.mockResolvedValue([]);
    mockStorageService.getSearchHistory.mockResolvedValue([]);
    mockStorageService.getAppSettings.mockResolvedValue({
      theme: 'light',
      language: 'zh',
      enableAnimations: true,
      autoPlayImages: true,
      cacheEnabled: true,
    });
    mockStorageService.addFavorite.mockResolvedValue();
    mockStorageService.removeFavorite.mockResolvedValue();
  });

  it('loads favorites from storage', async () => {
    mockStorageService.getFavorites.mockResolvedValue(['tiger', 'lion']);

    const { result } = renderHook(() => useFavorites(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.favorites).toEqual(['tiger', 'lion']);
  });

  it('toggleFavorite adds new favorite', async () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.toggleFavorite('tiger');
    });

    expect(result.current.favorites).toContain('tiger');
    expect(mockStorageService.addFavorite).toHaveBeenCalledWith('tiger');
  });

  it('toggleFavorite removes existing favorite', async () => {
    mockStorageService.getFavorites.mockResolvedValue(['tiger']);

    const { result } = renderHook(() => useFavorites(), { wrapper });

    await waitFor(() => {
      expect(result.current.favorites).toContain('tiger');
    });

    await act(async () => {
      await result.current.toggleFavorite('tiger');
    });

    expect(result.current.favorites).not.toContain('tiger');
    expect(mockStorageService.removeFavorite).toHaveBeenCalledWith('tiger');
  });

  it('isFavorite returns correct value', async () => {
    mockStorageService.getFavorites.mockResolvedValue(['tiger']);

    const { result } = renderHook(() => useFavorites(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isFavorite('tiger')).toBe(true);
    expect(result.current.isFavorite('lion')).toBe(false);
  });
});

describe('useSearchHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageService.getFavorites.mockResolvedValue([]);
    mockStorageService.getRecentAnimals.mockResolvedValue([]);
    mockStorageService.getSearchHistory.mockResolvedValue([]);
    mockStorageService.getAppSettings.mockResolvedValue({
      theme: 'light',
      language: 'zh',
      enableAnimations: true,
      autoPlayImages: true,
      cacheEnabled: true,
    });
    mockStorageService.addSearchHistory.mockResolvedValue();
    mockStorageService.removeSearchHistory.mockResolvedValue();
    mockStorageService.clearSearchHistory.mockResolvedValue();
  });

  it('loads search history from storage', async () => {
    mockStorageService.getSearchHistory.mockResolvedValue(['熊猫', '老虎']);

    const { result } = renderHook(() => useSearchHistory(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.searchHistory).toEqual(['熊猫', '老虎']);
  });

  it('adds search history', async () => {
    const { result } = renderHook(() => useSearchHistory(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.addSearchHistory('狮子');
    });

    expect(result.current.searchHistory).toContain('狮子');
    expect(mockStorageService.addSearchHistory).toHaveBeenCalledWith('狮子');
  });

  it('removes search history item', async () => {
    mockStorageService.getSearchHistory.mockResolvedValue(['熊猫', '老虎']);

    const { result } = renderHook(() => useSearchHistory(), { wrapper });

    await waitFor(() => {
      expect(result.current.searchHistory).toContain('熊猫');
    });

    await act(async () => {
      await result.current.removeSearchHistory('熊猫');
    });

    expect(result.current.searchHistory).not.toContain('熊猫');
    expect(mockStorageService.removeSearchHistory).toHaveBeenCalledWith('熊猫');
  });

  it('clears all search history', async () => {
    mockStorageService.getSearchHistory.mockResolvedValue(['熊猫', '老虎']);

    const { result } = renderHook(() => useSearchHistory(), { wrapper });

    await waitFor(() => {
      expect(result.current.searchHistory.length).toBe(2);
    });

    await act(async () => {
      await result.current.clearSearchHistory();
    });

    expect(result.current.searchHistory).toEqual([]);
    expect(mockStorageService.clearSearchHistory).toHaveBeenCalled();
  });

  it('ignores empty search queries', async () => {
    const { result } = renderHook(() => useSearchHistory(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.addSearchHistory('');
      await result.current.addSearchHistory('   ');
    });

    expect(result.current.searchHistory).toEqual([]);
    expect(mockStorageService.addSearchHistory).not.toHaveBeenCalled();
  });
});

describe('useRecentAnimals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageService.getFavorites.mockResolvedValue([]);
    mockStorageService.getRecentAnimals.mockResolvedValue([]);
    mockStorageService.getSearchHistory.mockResolvedValue([]);
    mockStorageService.getAppSettings.mockResolvedValue({
      theme: 'light',
      language: 'zh',
      enableAnimations: true,
      autoPlayImages: true,
      cacheEnabled: true,
    });
    mockStorageService.addRecentAnimal.mockResolvedValue();
    mockStorageService.clearRecentAnimals.mockResolvedValue();
  });

  it('adds recent animal', async () => {
    const { result } = renderHook(() => useRecentAnimals(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.addRecentAnimal({
        id: 'tiger',
        commonNameZh: '老虎',
        thumbnailUrl: 'https://example.com/tiger.jpg',
      });
    });

    expect(result.current.recentAnimals.some(a => a.id === 'tiger')).toBe(true);
  });

  it('clears recent animals', async () => {
    mockStorageService.getRecentAnimals.mockResolvedValue([
      { id: 'tiger', commonNameZh: '老虎', timestamp: Date.now() },
    ]);

    const { result } = renderHook(() => useRecentAnimals(), { wrapper });

    await waitFor(() => {
      expect(result.current.recentAnimals.length).toBe(1);
    });

    await act(async () => {
      await result.current.clearRecentAnimals();
    });

    expect(result.current.recentAnimals).toEqual([]);
    expect(mockStorageService.clearRecentAnimals).toHaveBeenCalled();
  });
});

describe('useRecognition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageService.getFavorites.mockResolvedValue([]);
    mockStorageService.getRecentAnimals.mockResolvedValue([]);
    mockStorageService.getSearchHistory.mockResolvedValue([]);
    mockStorageService.getAppSettings.mockResolvedValue({
      theme: 'light',
      language: 'zh',
      enableAnimations: true,
      autoPlayImages: true,
      cacheEnabled: true,
    });
  });

  it('sets recognition image and starts processing', async () => {
    const { result } = renderHook(() => useRecognition(), { wrapper });

    await waitFor(() => {
      expect(result.current.isProcessing).toBe(false);
    });

    act(() => {
      result.current.setRecognitionImage('file:///tmp/image.jpg');
    });

    expect(result.current.imageUri).toBe('file:///tmp/image.jpg');
    expect(result.current.isProcessing).toBe(true);
  });

  it('sets recognition result', async () => {
    const { result } = renderHook(() => useRecognition(), { wrapper });

    await waitFor(() => {
      expect(result.current.isProcessing).toBe(false);
    });

    const mockAnimal = {
      id: 'tiger',
      commonNameZh: '老虎',
      commonNameEn: 'Tiger',
      scientificName: 'Panthera tigris',
      taxonomy: {
        kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
      },
      images: [],
      conservationStatus: { iucnStatus: 'EN' as const },
    };

    act(() => {
      result.current.setRecognitionResult(mockAnimal, 0.95);
    });

    expect(result.current.result).toEqual(mockAnimal);
    expect(result.current.confidence).toBe(0.95);
    expect(result.current.isProcessing).toBe(false);
  });

  it('clears recognition state', async () => {
    const { result } = renderHook(() => useRecognition(), { wrapper });

    // Set some state first
    act(() => {
      result.current.setRecognitionImage('file:///tmp/image.jpg');
    });

    expect(result.current.imageUri).toBe('file:///tmp/image.jpg');

    // Clear it
    act(() => {
      result.current.clearRecognition();
    });

    expect(result.current.imageUri).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.confidence).toBe(0);
    expect(result.current.isProcessing).toBe(false);
  });
});

describe('useAppSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageService.getFavorites.mockResolvedValue([]);
    mockStorageService.getRecentAnimals.mockResolvedValue([]);
    mockStorageService.getSearchHistory.mockResolvedValue([]);
    mockStorageService.getAppSettings.mockResolvedValue({
      theme: 'light',
      language: 'zh',
      enableAnimations: true,
      autoPlayImages: true,
      cacheEnabled: true,
    });
    mockStorageService.updateAppSettings.mockResolvedValue();
  });

  it('loads settings from storage', async () => {
    mockStorageService.getAppSettings.mockResolvedValue({
      theme: 'dark',
      language: 'en',
      enableAnimations: false,
      autoPlayImages: true,
      cacheEnabled: true,
    });

    const { result } = renderHook(() => useAppSettings(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings.theme).toBe('dark');
    expect(result.current.settings.language).toBe('en');
    expect(result.current.settings.enableAnimations).toBe(false);
  });

  it('updates settings', async () => {
    const { result } = renderHook(() => useAppSettings(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.updateSettings({ theme: 'dark' });
    });

    expect(result.current.settings.theme).toBe('dark');
    expect(mockStorageService.updateAppSettings).toHaveBeenCalledWith({
      theme: 'dark',
    });
  });
});
