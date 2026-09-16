import { clearCache } from '../../utils/cache';
import { getSearchSuggestions, searchAnimals } from '../searchService';
import { createFetchMock, installFetchMock } from './helpers/httpMock';
import { ITIS_ROUTES } from './helpers/itisRoutes';

const originalFetch = global.fetch;

describe('searchService', () => {
  beforeEach(() => {
    clearCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('searchAnimals', () => {
    it('maps itis hits into search items', async () => {
      installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));

      const page = await searchAnimals({ q: '虎', limit: 10, offset: 0 });

      expect(page.total).toBeGreaterThan(0);
      expect(page.items[0]).toEqual(
        expect.objectContaining({
          commonNameZh: '虎',
          scientificName: 'Panthera tigris',
        }),
      );
      expect(page.hasMore).toBe(false);
    });

    it('fills the family for species results from the itis hierarchy', async () => {
      installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));

      const page = await searchAnimals({ q: '虎', limit: 10, offset: 0 });

      expect(page.items[0]).toEqual(
        expect.objectContaining({ family: 'Felidae', familyZh: '猫科' }),
      );
    });

    it('paginates', async () => {
      installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));

      const first = await searchAnimals({ q: '虎', limit: 1, offset: 0 });

      expect(first.items).toHaveLength(1);
      expect(first.hasMore).toBe(first.total > 1);
    });

    it('returns an empty page for a blank query without touching the network', async () => {
      const fetchMock = createFetchMock({ routes: ITIS_ROUTES });
      installFetchMock(fetchMock);

      await expect(searchAnimals({ q: '   ', limit: 10, offset: 0 })).resolves.toEqual({
        total: 0,
        items: [],
        hasMore: false,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('getSearchSuggestions', () => {
    it('suggests chinese names from the local dictionary', async () => {
      const fetchMock = createFetchMock({ routes: ITIS_ROUTES });
      installFetchMock(fetchMock);

      const suggestions = await getSearchSuggestions('虎', 5);

      expect(suggestions).toContain('虎');
      // 纯本地查表，不该产生网络请求
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('suggests from a latin prefix', async () => {
      installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));

      await expect(getSearchSuggestions('Ailuropoda', 5)).resolves.toContain('大熊猫');
    });

    it('honours the limit and dedupes', async () => {
      installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));

      const suggestions = await getSearchSuggestions('虎', 3);

      expect(suggestions).toHaveLength(3);
      expect(new Set(suggestions).size).toBe(3);
    });

    it('returns an empty list for blank input', async () => {
      installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));

      await expect(getSearchSuggestions('  ')).resolves.toEqual([]);
    });
  });
});
