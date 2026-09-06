// 存储服务测试

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  setCache,
  getCache,
  removeCache,
  clearAllCache,
  getSearchHistory,
  addSearchHistory,
  removeSearchHistory,
  clearSearchHistory,
  getFavorites,
  addFavorite,
  removeFavorite,
  isFavorite,
  getRecentAnimals,
  addRecentAnimal,
  clearRecentAnimals,
  cacheAnimal,
  getCachedAnimal,
  getAppSettings,
  updateAppSettings,
} from '../storageService';
import { Animal } from '../../types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  clear: jest.fn(() => Promise.resolve()),
}));

describe('storageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('cache operations', () => {
    describe('setCache', () => {
      it('stores data with timestamp and ttl', async () => {
        await setCache('test-key', { foo: 'bar' }, 3600000);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          'test-key',
          expect.stringContaining('"foo":"bar"'),
        );
      });
    });

    describe('getCache', () => {
      it('returns null for non-existent key', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

        const result = await getCache('non-existent');
        expect(result).toBeNull();
      });

      it('returns data for valid cache entry', async () => {
        const entry = {
          data: { foo: 'bar' },
          timestamp: Date.now(),
          ttl: 3600000, // 1 hour
        };
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          JSON.stringify(entry),
        );

        const result = await getCache('test-key');
        expect(result).toEqual({ foo: 'bar' });
      });

      it('returns null and removes expired cache', async () => {
        const entry = {
          data: { foo: 'bar' },
          timestamp: Date.now() - 7200000, // 2 hours ago
          ttl: 3600000, // 1 hour ttl
        };
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          JSON.stringify(entry),
        );

        const result = await getCache('test-key');
        expect(result).toBeNull();
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('test-key');
      });
    });

    describe('removeCache', () => {
      it('removes cache entry', async () => {
        await removeCache('test-key');
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('test-key');
      });
    });

    describe('clearAllCache', () => {
      it('clears all app cache keys', async () => {
        (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValueOnce([
          '@animal_classifier:favorites',
          '@animal_classifier:search_history',
          '@other_app:data',
        ]);

        await clearAllCache();

        expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
          '@animal_classifier:favorites',
        );
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
          '@animal_classifier:search_history',
        );
        expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith(
          '@other_app:data',
        );
      });
    });
  });

  describe('search history', () => {
    describe('getSearchHistory', () => {
      it('returns empty array when no history', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

        const history = await getSearchHistory();
        expect(history).toEqual([]);
      });

      it('returns stored history', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          '["大熊猫","老虎"]',
        );

        const history = await getSearchHistory();
        expect(history).toEqual(['大熊猫', '老虎']);
      });
    });

    describe('addSearchHistory', () => {
      it('adds new item to beginning of history', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('["老虎"]');

        await addSearchHistory('大熊猫');

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          '@animal_classifier:search_history',
          '["大熊猫","老虎"]',
        );
      });

      it('removes duplicate and moves to front', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          '["老虎","大熊猫","狮子"]',
        );

        await addSearchHistory('大熊猫');

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          '@animal_classifier:search_history',
          '["大熊猫","老虎","狮子"]',
        );
      });
    });

    describe('removeSearchHistory', () => {
      it('removes specific item from history', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          '["大熊猫","老虎","狮子"]',
        );

        await removeSearchHistory('老虎');

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          '@animal_classifier:search_history',
          '["大熊猫","狮子"]',
        );
      });
    });

    describe('clearSearchHistory', () => {
      it('removes search history key', async () => {
        await clearSearchHistory();
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
          '@animal_classifier:search_history',
        );
      });
    });
  });

  describe('favorites', () => {
    describe('getFavorites', () => {
      it('returns empty array when no favorites', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

        const favorites = await getFavorites();
        expect(favorites).toEqual([]);
      });

      it('returns stored favorites', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          '["tiger","panda"]',
        );

        const favorites = await getFavorites();
        expect(favorites).toEqual(['tiger', 'panda']);
      });
    });

    describe('addFavorite', () => {
      it('adds new favorite', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('[]');

        await addFavorite('tiger');

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          '@animal_classifier:favorites',
          '["tiger"]',
        );
      });

      it('does not add duplicate', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('["tiger"]');

        await addFavorite('tiger');

        expect(AsyncStorage.setItem).not.toHaveBeenCalled();
      });
    });

    describe('removeFavorite', () => {
      it('removes favorite', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          '["tiger","panda"]',
        );

        await removeFavorite('tiger');

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          '@animal_classifier:favorites',
          '["panda"]',
        );
      });
    });

    describe('isFavorite', () => {
      it('returns true for favorite', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          '["tiger","panda"]',
        );

        const result = await isFavorite('tiger');
        expect(result).toBe(true);
      });

      it('returns false for non-favorite', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          '["tiger","panda"]',
        );

        const result = await isFavorite('lion');
        expect(result).toBe(false);
      });
    });
  });

  describe('recent animals', () => {
    describe('getRecentAnimals', () => {
      it('returns empty array when no recent animals', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

        const recent = await getRecentAnimals();
        expect(recent).toEqual([]);
      });
    });

    describe('addRecentAnimal', () => {
      it('adds animal with timestamp', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('[]');

        await addRecentAnimal({ id: 'tiger', commonNameZh: '老虎' });

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          '@animal_classifier:recent_animals',
          expect.stringContaining('"id":"tiger"'),
        );
      });

      it('moves existing animal to front', async () => {
        const existing = [
          { id: 'panda', commonNameZh: '大熊猫', timestamp: 1000 },
          { id: 'tiger', commonNameZh: '老虎', timestamp: 500 },
        ];
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          JSON.stringify(existing),
        );

        await addRecentAnimal({ id: 'tiger', commonNameZh: '老虎' });

        const setItemCall = (AsyncStorage.setItem as jest.Mock).mock
          .calls[0][1];
        const saved = JSON.parse(setItemCall);
        expect(saved[0].id).toBe('tiger');
        expect(saved.length).toBe(2);
      });
    });

    describe('clearRecentAnimals', () => {
      it('removes recent animals key', async () => {
        await clearRecentAnimals();
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
          '@animal_classifier:recent_animals',
        );
      });
    });
  });

  describe('animal cache', () => {
    describe('cacheAnimal', () => {
      it('caches animal with correct key', async () => {
        const animal: Animal = {
          id: 'tiger',
          commonNameZh: '老虎',
          commonNameEn: 'Tiger',
          scientificName: 'Panthera tigris',
          taxonomy: {
            kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
          },
          images: [],
          conservationStatus: { iucnStatus: 'EN' },
        };

        await cacheAnimal(animal);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          '@animal_classifier:animal_cache:tiger',
          expect.any(String),
        );
      });
    });

    describe('getCachedAnimal', () => {
      it('returns cached animal', async () => {
        const animal = { id: 'tiger', commonNameZh: '老虎' };
        const entry = {
          data: animal,
          timestamp: Date.now(),
          ttl: 86400000,
        };
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          JSON.stringify(entry),
        );

        const result = await getCachedAnimal('tiger');
        expect(result).toEqual(animal);
      });

      it('returns null for non-cached animal', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

        const result = await getCachedAnimal('nonexistent');
        expect(result).toBeNull();
      });
    });
  });

  describe('app settings', () => {
    describe('getAppSettings', () => {
      it('returns default settings when none stored', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

        const settings = await getAppSettings();
        expect(settings.theme).toBe('light');
        expect(settings.language).toBe('zh');
        expect(settings.enableAnimations).toBe(true);
      });

      it('merges stored settings with defaults', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          '{"theme":"dark"}',
        );

        const settings = await getAppSettings();
        expect(settings.theme).toBe('dark');
        expect(settings.language).toBe('zh'); // default
      });
    });

    describe('updateAppSettings', () => {
      it('updates specific settings', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
          '{"theme":"light"}',
        );

        await updateAppSettings({ theme: 'dark' });

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          '@animal_classifier:settings',
          expect.stringContaining('"theme":"dark"'),
        );
      });
    });
  });
});
