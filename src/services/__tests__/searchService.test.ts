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

describe('searchService', () => {
  // 每个测试前重置搜索历史
  beforeEach(() => {
    clearSearchHistory();
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
});
