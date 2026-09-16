// 分类服务测试

import {
  getParentLevel,
  getChildLevel,
  fetchTaxonomyChildren,
  fetchTaxonomyBreadcrumb,
  fetchTaxonomyDetail,
  searchTaxonomy,
  buildTaxonomyPath,
} from '../taxonomyService';
import { setBackendApiEnabled, USE_BACKEND_API_DEFAULT } from '../api';
import { TaxonomyInfo, TaxonomyNode } from '../../types';

describe('taxonomyService', () => {
  const originalFetch = globalThis.fetch;

  // 本文件的历史用例断言的是「本地 mock 分支」的行为。
  // 全局开关 USE_BACKEND_API_DEFAULT 已改为 true，若不显式关掉，
  // 这些用例会真的去请求 http://10.0.2.2:3000，在测试环境里必然超时挂起。
  beforeEach(() => {
    setBackendApiEnabled(false);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  afterAll(() => {
    setBackendApiEnabled(USE_BACKEND_API_DEFAULT);
  });

  describe('getParentLevel', () => {
    it('returns parent level for valid levels', () => {
      expect(getParentLevel('phylum')).toBe('kingdom');
      expect(getParentLevel('class')).toBe('phylum');
      expect(getParentLevel('order')).toBe('class');
      expect(getParentLevel('family')).toBe('order');
      expect(getParentLevel('genus')).toBe('family');
      expect(getParentLevel('species')).toBe('genus');
    });

    it('returns null for kingdom (no parent)', () => {
      expect(getParentLevel('kingdom')).toBeNull();
    });
  });

  describe('getChildLevel', () => {
    it('returns child level for valid levels', () => {
      expect(getChildLevel('kingdom')).toBe('phylum');
      expect(getChildLevel('phylum')).toBe('class');
      expect(getChildLevel('class')).toBe('order');
      expect(getChildLevel('order')).toBe('family');
      expect(getChildLevel('family')).toBe('genus');
      expect(getChildLevel('genus')).toBe('species');
    });

    it('returns null for species (no child)', () => {
      expect(getChildLevel('species')).toBeNull();
    });
  });

  describe('fetchTaxonomyChildren', () => {
    it('returns children for felidae family', async () => {
      const result = await fetchTaxonomyChildren('felidae', 'family');
      expect(result.children.length).toBeGreaterThan(0);
      expect(result.children.every(c => c.level === 'genus')).toBe(true);
    });

    it('returns children for panthera genus', async () => {
      const result = await fetchTaxonomyChildren('panthera', 'genus');
      expect(result.children.length).toBeGreaterThan(0);
      expect(result.children.every(c => c.level === 'species')).toBe(true);
    });

    it('supports pagination', async () => {
      const result1 = await fetchTaxonomyChildren('felidae', 'family', 2, 0);
      const result2 = await fetchTaxonomyChildren('felidae', 'family', 2, 2);

      expect(result1.children.length).toBeLessThanOrEqual(2);
      if (result1.total > 2) {
        expect(result1.children[0]?.id).not.toBe(result2.children[0]?.id);
      }
    });

    it('returns hasMore correctly', async () => {
      const result = await fetchTaxonomyChildren('felidae', 'family', 2, 0);
      if (result.total > 2) {
        expect(result.hasMore).toBe(true);
      }
    });

    it('returns empty for unknown parent', async () => {
      const result = await fetchTaxonomyChildren('unknown', 'order');
      expect(result.children).toEqual([]);
    });
  });

  describe('fetchTaxonomyBreadcrumb', () => {
    it('builds breadcrumb up to current level', async () => {
      const taxonomy: TaxonomyInfo = {
        kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
        phylum: { scientificName: 'Chordata', commonNameZh: '脊索动物门' },
        class: { scientificName: 'Mammalia', commonNameZh: '哺乳纲' },
        order: { scientificName: 'Carnivora', commonNameZh: '食肉目' },
        family: { scientificName: 'Felidae', commonNameZh: '猫科' },
        genus: { scientificName: 'Panthera', commonNameZh: '豹属' },
        species: { scientificName: 'Panthera tigris', commonNameZh: '虎' },
      };

      const breadcrumb = await fetchTaxonomyBreadcrumb(taxonomy, 'family');
      expect(breadcrumb.length).toBe(5); // kingdom to family
      expect(breadcrumb[0].scientificName).toBe('Animalia');
      expect(breadcrumb[4].scientificName).toBe('Felidae');
    });

    it('handles partial taxonomy', async () => {
      const taxonomy: TaxonomyInfo = {
        kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
        phylum: { scientificName: 'Chordata', commonNameZh: '脊索动物门' },
      };

      const breadcrumb = await fetchTaxonomyBreadcrumb(taxonomy, 'class');
      expect(breadcrumb.length).toBe(2);
    });
  });

  describe('fetchTaxonomyDetail', () => {
    it('returns detail for felidae', async () => {
      const result = await fetchTaxonomyDetail('family', 'Felidae');
      expect(result).not.toBeNull();
      expect(result?.current.scientificName).toBe('Felidae');
      expect(result?.current.commonNameZh).toBe('猫科');
    });

    it('includes parent information', async () => {
      const result = await fetchTaxonomyDetail('family', 'Felidae');
      expect(result?.parent).toBeDefined();
      expect(result?.parent?.scientificName).toBe('Carnivora');
    });

    it('includes child count', async () => {
      const result = await fetchTaxonomyDetail('family', 'Felidae');
      expect(result?.childCount).toBeGreaterThan(0);
    });

    it('returns null for unknown taxonomy', async () => {
      const result = await fetchTaxonomyDetail('family', 'Unknown');
      expect(result).toBeNull();
    });
  });

  describe('searchTaxonomy', () => {
    it('searches by scientific name', async () => {
      const results = await searchTaxonomy('Panthera');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.scientificName.includes('Panthera'))).toBe(
        true,
      );
    });

    it('searches by Chinese name', async () => {
      const results = await searchTaxonomy('豹');
      expect(results.length).toBeGreaterThan(0);
    });

    it('searches by English name', async () => {
      const results = await searchTaxonomy('Tiger');
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty for no match', async () => {
      const results = await searchTaxonomy('xyznonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('buildTaxonomyPath', () => {
    it('builds complete path from taxonomy', () => {
      const taxonomy: TaxonomyInfo = {
        kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
        phylum: { scientificName: 'Chordata', commonNameZh: '脊索动物门' },
        class: { scientificName: 'Mammalia', commonNameZh: '哺乳纲' },
        order: { scientificName: 'Carnivora', commonNameZh: '食肉目' },
        family: { scientificName: 'Felidae', commonNameZh: '猫科' },
        genus: { scientificName: 'Panthera', commonNameZh: '豹属' },
        species: { scientificName: 'Panthera tigris', commonNameZh: '虎' },
      };

      const path = buildTaxonomyPath(taxonomy);
      expect(path.length).toBe(7);
      expect(path[0].level).toBe('kingdom');
      expect(path[6].level).toBe('species');
    });

    it('handles partial taxonomy', () => {
      const taxonomy: TaxonomyInfo = {
        kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
        family: { scientificName: 'Felidae', commonNameZh: '猫科' },
      };

      const path = buildTaxonomyPath(taxonomy);
      expect(path.length).toBe(2);
      expect(path[0].level).toBe('kingdom');
      expect(path[1].level).toBe('family');
    });

    it('returns empty array for empty taxonomy', () => {
      const taxonomy: TaxonomyInfo = {};
      const path = buildTaxonomyPath(taxonomy);
      expect(path).toEqual([]);
    });
  });

  // ── 信封解包回归 ──────────────────────────────────────────────────
  // 背景：旧实现把整个响应体当成 payload，于是 `data.children` /
  // `data.results` 恒为 undefined；又因为外层 catch 只 console.warn，
  // 失败会静默退回 mock，表现为「接口明明通了，树却永远是假的」。
  describe('后端 API 模式（信封解包回归）', () => {
    const jsonResponse = (body: unknown, ok = true, status = 200) => ({
      ok,
      status,
      json: async () => body,
    });

    const pantheraNode: TaxonomyNode = {
      id: 'Panthera',
      level: 'genus',
      scientificName: 'Panthera',
      commonNameZh: '豹属',
      commonNameEn: 'Panthera',
      childCount: 5,
    };

    const felidaeNode: TaxonomyNode = {
      id: 'Felidae',
      level: 'family',
      scientificName: 'Felidae',
      commonNameZh: '猫科',
      commonNameEn: 'Felidae',
      childCount: 14,
    };

    const carnivoraNode: TaxonomyNode = {
      id: 'Carnivora',
      level: 'order',
      scientificName: 'Carnivora',
      commonNameZh: '食肉目',
      commonNameEn: 'Carnivora',
      childCount: 16,
    };

    beforeEach(() => {
      setBackendApiEnabled(true);
    });

    it('unwraps {success, data} for fetchTaxonomyChildren', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          data: { children: [pantheraNode], hasMore: false, total: 1 },
        }),
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const result = await fetchTaxonomyChildren('Panthera', 'genus');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/taxonomy/genus/Panthera/children'),
        expect.anything(),
      );
      expect(result.children).toHaveLength(1);
      expect(result.children[0].scientificName).toBe('Panthera');
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('unwraps {success, data} for fetchTaxonomyDetail', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          data: { current: felidaeNode, parent: carnivoraNode, childCount: 14 },
        }),
      ) as unknown as typeof fetch;

      const result = await fetchTaxonomyDetail('family', 'Felidae');

      expect(result?.current.scientificName).toBe('Felidae');
      expect(result?.parent?.scientificName).toBe('Carnivora');
      expect(result?.childCount).toBe(14);
    });

    it('unwraps {success, data} for searchTaxonomy', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue(
        jsonResponse({ success: true, data: { results: [pantheraNode] } }),
      ) as unknown as typeof fetch;

      await expect(searchTaxonomy('Panthera')).resolves.toHaveLength(1);
    });

    it('falls back to local data and logs an error when the envelope is malformed', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      // 缺 success 字段：必须被判为非法响应，而不是被当成 payload 直接用
      globalThis.fetch = jest.fn().mockResolvedValue(
        jsonResponse({ data: { children: [] } }),
      ) as unknown as typeof fetch;

      const result = await fetchTaxonomyChildren('felidae', 'family');

      expect(errorSpy).toHaveBeenCalled();
      expect(result.children.length).toBeGreaterThan(0);
    });
  });
});
