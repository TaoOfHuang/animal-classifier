// 搜索服务测试

import {
  searchAnimals,
  getSearchSuggestions,
  getSearchHistory,
  addSearchHistory,
  removeSearchHistory,
  clearSearchHistory,
  getHotSearchTerms,
  getAnimalDetail,
  HOT_SEARCH_TERMS,
} from '../searchService';
import { API_TOKEN, setBackendApiEnabled, USE_BACKEND_API_DEFAULT } from '../api';

describe('searchService', () => {
  const originalFetch = globalThis.fetch;

  // 本文件的历史用例断言的是「本地 mock 分支」的行为。
  // 全局开关 USE_BACKEND_API_DEFAULT 已改为 true，若不显式关掉，
  // 这些用例会真的去请求 http://10.0.2.2:3000，在测试环境里必然超时挂起。
  beforeEach(() => {
    // 每个测试前重置搜索历史
    clearSearchHistory();
    setBackendApiEnabled(false);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  afterAll(() => {
    // 不把开关状态泄漏给同文件后续用例
    setBackendApiEnabled(USE_BACKEND_API_DEFAULT);
  });

  describe('searchAnimals', () => {
    it('returns results matching Chinese name', async () => {
      const result = await searchAnimals('熊猫');
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results.some(r => r.commonNameZh.includes('熊猫'))).toBe(
        true,
      );
    });

    it('returns results matching English name', async () => {
      const result = await searchAnimals('tiger');
      expect(result.results.length).toBeGreaterThan(0);
      expect(
        result.results.some(r =>
          r.commonNameEn.toLowerCase().includes('tiger'),
        ),
      ).toBe(true);
    });

    it('returns results matching scientific name', async () => {
      const result = await searchAnimals('panthera');
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('returns empty results for no match', async () => {
      const result = await searchAnimals('xyznonexistent');
      expect(result.results.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it('supports pagination with limit and offset', async () => {
      const result1 = await searchAnimals('', { limit: 3, offset: 0 });
      const result2 = await searchAnimals('', { limit: 3, offset: 3 });

      // 结果应该不同
      if (result1.total > 3) {
        expect(result1.results[0]?.id).not.toBe(result2.results[0]?.id);
      }
    });

    it('filters by family', async () => {
      const result = await searchAnimals('', { family: 'Felidae' });
      expect(result.results.every(r => r.family === 'Felidae')).toBe(true);
    });

    it('returns hasMore correctly', async () => {
      const result = await searchAnimals('', { limit: 2 });
      if (result.total > 2) {
        expect(result.hasMore).toBe(true);
      }
    });
  });

  describe('getSearchSuggestions', () => {
    it('returns empty array for empty query', async () => {
      const suggestions = await getSearchSuggestions('');
      expect(suggestions).toEqual([]);
    });

    it('returns suggestions for partial match', async () => {
      const suggestions = await getSearchSuggestions('熊');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('熊'))).toBe(true);
    });

    it('respects limit parameter', async () => {
      const suggestions = await getSearchSuggestions('a', 2);
      expect(suggestions.length).toBeLessThanOrEqual(2);
    });
  });

  describe('search history', () => {
    it('starts with empty history', () => {
      expect(getSearchHistory()).toEqual([]);
    });

    it('adds search term to history', () => {
      addSearchHistory('大熊猫');
      expect(getSearchHistory()).toContain('大熊猫');
    });

    it('adds new terms at the beginning', () => {
      addSearchHistory('狮子');
      addSearchHistory('老虎');
      const history = getSearchHistory();
      expect(history[0]).toBe('老虎');
      expect(history[1]).toBe('狮子');
    });

    it('removes duplicate entries', () => {
      addSearchHistory('熊猫');
      addSearchHistory('老虎');
      addSearchHistory('熊猫');
      const history = getSearchHistory();
      expect(history.filter(h => h === '熊猫').length).toBe(1);
      expect(history[0]).toBe('熊猫');
    });

    it('ignores empty strings', () => {
      addSearchHistory('');
      addSearchHistory('   ');
      expect(getSearchHistory()).toEqual([]);
    });

    it('removes specific history item', () => {
      addSearchHistory('狮子');
      addSearchHistory('老虎');
      removeSearchHistory('狮子');
      const history = getSearchHistory();
      expect(history).not.toContain('狮子');
      expect(history).toContain('老虎');
    });

    it('clears all history', () => {
      addSearchHistory('狮子');
      addSearchHistory('老虎');
      clearSearchHistory();
      expect(getSearchHistory()).toEqual([]);
    });

    it('limits history size to 20', () => {
      for (let i = 0; i < 25; i++) {
        addSearchHistory(`动物${i}`);
      }
      expect(getSearchHistory().length).toBe(20);
    });
  });

  describe('getHotSearchTerms', () => {
    it('returns predefined hot search terms', () => {
      const terms = getHotSearchTerms();
      expect(terms).toEqual(HOT_SEARCH_TERMS);
      expect(terms.length).toBeGreaterThan(0);
    });
  });

  describe('getAnimalDetail', () => {
    it('returns animal detail for valid id', async () => {
      const animal = await getAnimalDetail('tiger');
      expect(animal).not.toBeNull();
      expect(animal?.commonNameZh).toBe('虎');
    });

    it('returns null for invalid id', async () => {
      const animal = await getAnimalDetail('nonexistent-id');
      expect(animal).toBeNull();
    });

    it('includes taxonomy information', async () => {
      const animal = await getAnimalDetail('giant-panda');
      expect(animal?.taxonomy).toBeDefined();
      expect(animal?.taxonomy.kingdom).toBeDefined();
      expect(animal?.taxonomy.species).toBeDefined();
    });

    it('includes conservation status', async () => {
      const animal = await getAnimalDetail('tiger');
      expect(animal?.conservationStatus).toBeDefined();
      expect(animal?.conservationStatus?.iucnStatus).toBeDefined();
    });
  });

  // ── 信封解包回归 ──────────────────────────────────────────────────
  // 背景：旧实现把整个响应体当成 payload，于是 `data.items` / `data.results`
  // 恒为 undefined；又因为外层 catch 只 console.warn，失败会静默退回 mock，
  // 表现为「接口明明通了，搜索结果却永远是假的」。以下用例锁定解包行为。
  describe('后端 API 模式（信封解包回归）', () => {
    const jsonResponse = (body: unknown, ok = true, status = 200) => ({
      ok,
      status,
      json: async () => body,
    });

    const tigerResult = {
      id: 'Panthera tigris',
      commonNameZh: '虎',
      commonNameEn: 'Tiger',
      scientificName: 'Panthera tigris',
      family: 'Felidae',
      familyZh: '猫科',
    };

    beforeEach(() => {
      setBackendApiEnabled(true);
    });

    it('unwraps {success, data} for searchAnimals', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          data: { items: [tigerResult], total: 1 },
        }),
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const result = await searchAnimals('虎');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/search?'),
        expect.anything(),
      );
      expect(result.results).toHaveLength(1);
      expect(result.results[0].scientificName).toBe('Panthera tigris');
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('unwraps {success, data} for getSearchSuggestions', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue(
        jsonResponse({ success: true, data: { suggestions: ['虎', '雪豹'] } }),
      ) as unknown as typeof fetch;

      await expect(getSearchSuggestions('虎')).resolves.toEqual(['虎', '雪豹']);
    });

    it('unwraps {success, data} for getAnimalDetail', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          data: { ...tigerResult, conservationStatus: { iucnStatus: 'EN' } },
        }),
      ) as unknown as typeof fetch;

      const animal = await getAnimalDetail('Panthera tigris');

      expect(animal?.scientificName).toBe('Panthera tigris');
      expect(animal?.conservationStatus?.iucnStatus).toBe('EN');
    });

    it('sends the configured API token as a bearer header', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse({ success: true, data: { items: [], total: 0 } }),
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await searchAnimals('虎');

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect((init.headers as Record<string, string>).Authorization).toBe(
        `Bearer ${API_TOKEN}`,
      );
    });

    it('falls back to local data and logs an error when the envelope reports failure', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      globalThis.fetch = jest.fn().mockResolvedValue(
        jsonResponse({ success: false, error: { message: 'boom' } }),
      ) as unknown as typeof fetch;

      const result = await searchAnimals('熊猫');

      expect(errorSpy).toHaveBeenCalled();
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('falls back to local data when the request fails with a non-2xx status', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      globalThis.fetch = jest.fn().mockResolvedValue(
        jsonResponse({ success: false, error: { message: 'nope' } }, false, 500),
      ) as unknown as typeof fetch;

      const animal = await getAnimalDetail('tiger');

      expect(animal?.commonNameZh).toBe('虎');
    });
  });
});
