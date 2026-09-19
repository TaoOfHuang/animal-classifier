import { clearCache } from '../../utils/cache';
import {
  fetchLineage,
  getTaxonomyChildren,
  getTaxonomyDetail,
  resolveTaxon,
  searchTaxonomy,
} from '../taxonomyService';
import { createFetchMock, installFetchMock, mockJsonResponse } from './helpers/httpMock';
import { ITIS_ROUTES as itisRoutes, itisRouteKey as routeKey } from './helpers/itisRoutes';
import * as F from './helpers/fixtures';

const originalFetch = global.fetch;

describe('taxonomyService / ITIS', () => {
  beforeEach(() => {
    clearCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('fetchLineage', () => {
    it('maps an itis full hierarchy into exactly seven levels', async () => {
      installFetchMock(createFetchMock({ routes: itisRoutes }));

      const lineage = await fetchLineage('Panthera tigris');

      expect(lineage).not.toBeNull();
      expect(lineage?.kingdom?.scientificName).toBe('Animalia');
      expect(lineage?.phylum?.scientificName).toBe('Chordata');
      expect(lineage?.class?.scientificName).toBe('Mammalia');
      expect(lineage?.order?.scientificName).toBe('Carnivora');
      expect(lineage?.family?.scientificName).toBe('Felidae');
      expect(lineage?.genus?.scientificName).toBe('Panthera');
      expect(lineage?.species?.scientificName).toBe('Panthera tigris');
    });

    it('drops redundant intermediate ranks instead of leaking them', async () => {
      installFetchMock(createFetchMock({ routes: itisRoutes }));

      const lineage = await fetchLineage('Panthera tigris');
      const serialized = JSON.stringify(lineage);

      for (const noise of [
        'Subkingdom',
        'Infrakingdom',
        'Subphylum',
        'Infraphylum',
        'Superclass',
        'Subclass',
        'Suborder',
      ]) {
        expect(lineage).not.toHaveProperty(noise.toLowerCase());
        expect(serialized).not.toContain(noise);
      }

      expect(Object.keys(lineage ?? {})).toEqual(
        expect.arrayContaining([
          'kingdom',
          'phylum',
          'class',
          'order',
          'family',
          'genus',
          'species',
        ]),
      );
    });

    it('keeps subspecies as a side field rather than a taxonomy level', async () => {
      installFetchMock(createFetchMock({ routes: itisRoutes }));

      const lineage = await fetchLineage('Panthera tigris');

      expect(lineage?.subspecies.map(item => item.scientificName)).toEqual([
        'Panthera tigris sondaica',
        'Panthera tigris tigris',
      ]);
      // 亚种不能混进 species 层级
      expect(lineage?.species?.scientificName).toBe('Panthera tigris');
    });

    it('never writes a TSN into parent.scientificName', async () => {
      installFetchMock(createFetchMock({ routes: itisRoutes }));

      const lineage = await fetchLineage('Panthera tigris');

      expect(JSON.stringify(lineage)).not.toMatch(/ITIS TSN/i);
      expect(lineage?.species?.tsn).toBe('183805');
    });

    it('uses the chinese dictionary for common names and falls back to the scientific name', async () => {
      installFetchMock(createFetchMock({ routes: itisRoutes }));

      const lineage = await fetchLineage('Panthera tigris');

      expect(lineage?.species?.commonNameZh).toBe('虎');
      expect(lineage?.family?.commonNameZh).toBe('猫科');
      // 谱系里的 Subfamily 已被丢弃，不会出现无中文名的冗余级
      expect(lineage?.genus?.commonNameZh).toBe('豹属');
    });

    it('decodes the ISO-8859-1 payload itis actually returns', async () => {
      const withAccent = {
        ...F.ITIS_HIERARCHY_PANTHERA_TIGRIS,
        hierarchyList: F.ITIS_HIERARCHY_PANTHERA_TIGRIS.hierarchyList.map(item =>
          item.tsn === '183805'
            ? { ...item, author: 'Müller, 1776' }
            : item,
        ),
      };

      installFetchMock(
        createFetchMock({
          routes: {
            ...itisRoutes,
            [routeKey('getFullHierarchyFromTSN', 'tsn=183805')]: () =>
              mockJsonResponse(withAccent, { charset: 'latin1' }),
          },
        }),
      );

      const lineage = await fetchLineage('Panthera tigris');

      expect(lineage?.species?.scientificName).toBe('Panthera tigris');
    });

    it('returns null when itis has no matching name', async () => {
      installFetchMock(createFetchMock({ routes: itisRoutes }));

      await expect(fetchLineage('Notarealgenus notarealspecies')).resolves.toBeNull();
    });

    it('prefers the exact species match over prefix matches', async () => {
      const fetchMock = createFetchMock({ routes: itisRoutes });
      installFetchMock(fetchMock);

      await fetchLineage('Panthera tigris');

      // 若误取了第一条前缀命中（亚种），tsn 会是 183806
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('getFullHierarchyFromTSN?tsn=183805'),
        expect.anything(),
      );
    });

    it('propagates upstream failures so callers can degrade', async () => {
      installFetchMock(
        createFetchMock({
          routes: {
            [routeKey('searchByScientificName', 'srchKey=Panthera%20tigris')]: () =>
              mockJsonResponse({}, { ok: false, status: 503 }),
          },
        }),
      );

      await expect(fetchLineage('Panthera tigris')).rejects.toThrow('Request failed: 503');
    });

    it('does not retry an itis 4xx, and never reports it as "not found"', async () => {
      const fetchMock = createFetchMock({
        routes: {
          [routeKey('searchByScientificName', 'srchKey=Panthera%20tigris')]: () =>
            mockJsonResponse({}, { ok: false, status: 404 }),
        },
      });
      installFetchMock(fetchMock);

      // 4xx 是配置/入参问题：重试只浪费配额；且「上游挂了」不能伪装成「查无此物」
      await expect(fetchLineage('Panthera tigris')).rejects.toThrow('Request failed: 404');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries a network failure once, then surfaces it', async () => {
      const fetchMock = jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
      installFetchMock(fetchMock as unknown as jest.Mock);

      await expect(fetchLineage('Panthera tigris')).rejects.toThrow(/ENOTFOUND/);
      // ITIS_REQUEST 的 retries: 1 → 首次 + 一次重试
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('turns a hanging itis request into a timeout failure', async () => {
      jest.useFakeTimers();
      try {
        const fetchMock = jest.fn().mockImplementation((_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }),
        );
        installFetchMock(fetchMock as unknown as jest.Mock);

        const pending = fetchLineage('Panthera tigris').catch(err => err as Error);
        // 先把微任务跑干，确保超时定时器已注册，再推进假时钟
        for (let i = 0; i < 20; i += 1) {
          await Promise.resolve();
        }
        await jest.runAllTimersAsync();
        const error = await pending;

        // 超时属于可重试错误：既然约定重试 1 次，就该发两次请求
        // 15000ms 与 ITIS_REQUEST.timeoutMs 绑定（ITIS 前缀检索实测最坏 9.4s，5s 必然踩雷）
        expect((error as Error).message).toMatch(/Request timed out after 15000ms/);
        expect(fetchMock).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('chinese entry point', () => {
    it('resolves a chinese common name before calling itis', async () => {
      const fetchMock = createFetchMock({ routes: itisRoutes });
      installFetchMock(fetchMock);

      const lineage = await fetchLineage('东北虎');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('srchKey=Panthera%20tigris'),
        expect.anything(),
      );
      expect(lineage?.species?.scientificName).toBe('Panthera tigris');
    });

    it('does not ask itis at all when the chinese name is unknown', async () => {
      const fetchMock = createFetchMock({ routes: itisRoutes });
      installFetchMock(fetchMock);

      await expect(fetchLineage('不存在的动物名')).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('resolveTaxon', () => {
    it('anchors on the species TSN even for a subspecies query', async () => {
      installFetchMock(createFetchMock({ routes: itisRoutes }));

      const match = await resolveTaxon('Panthera tigris');

      expect(match?.tsn).toBe('183805');
      expect(match?.scientificName).toBe('Panthera tigris');
    });
  });

  describe('getTaxonomyDetail', () => {
    it('returns current/parent/childCount aligned with the frontend contract', async () => {
      installFetchMock(createFetchMock({ routes: itisRoutes }));

      const detail = await getTaxonomyDetail('family', 'Felidae');

      expect(detail?.current).toEqual(
        expect.objectContaining({
          level: 'family',
          scientificName: 'Felidae',
          commonNameZh: '猫科',
        }),
      );
      expect(detail?.parent).toEqual(
        expect.objectContaining({ level: 'order', scientificName: 'Carnivora' }),
      );
      expect(typeof detail?.childCount).toBe('number');
      expect(detail).not.toHaveProperty('children');
    });

    it('rejects a name that does not belong to the requested level', async () => {
      installFetchMock(createFetchMock({ routes: itisRoutes }));

      // Panthera 是属，不能用 family 访问
      await expect(getTaxonomyDetail('family', 'Panthera')).resolves.toBeNull();
    });

    it('accepts a chinese name', async () => {
      installFetchMock(createFetchMock({ routes: itisRoutes }));

      const detail = await getTaxonomyDetail('species', '东北虎');

      expect(detail?.current.scientificName).toBe('Panthera tigris');
    });
  });

  describe('getTaxonomyChildren', () => {
    it('paginates the direct children returned by itis', async () => {
      installFetchMock(createFetchMock({ routes: itisRoutes }));

      const page = await getTaxonomyChildren('genus', 'Panthera', 2, 0);

      expect(page?.total).toBe(5);
      expect(page?.hasMore).toBe(true);
      expect(page?.children).toHaveLength(2);
      expect(page?.children[0]).toEqual(
        expect.objectContaining({ level: 'species', scientificName: 'Panthera onca' }),
      );
    });

    it('returns the tail page without hasMore', async () => {
      installFetchMock(createFetchMock({ routes: itisRoutes }));

      const page = await getTaxonomyChildren('genus', 'Panthera', 10, 4);

      expect(page?.children).toHaveLength(1);
      expect(page?.hasMore).toBe(false);
    });

    it('returns null for an unknown name', async () => {
      installFetchMock(createFetchMock({ routes: itisRoutes }));

      await expect(getTaxonomyChildren('genus', 'Notarealgenus', 10, 0)).resolves.toBeNull();
    });
  });

  describe('searchTaxonomy', () => {
    it('returns chinese results for a chinese query', async () => {
      installFetchMock(createFetchMock({ routes: itisRoutes }));

      const results = await searchTaxonomy('虎');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toEqual(
        expect.objectContaining({
          scientificName: 'Panthera tigris',
          commonNameZh: '虎',
          level: 'species',
        }),
      );
    });

    it('filters out subspecies noise unless the query itself is a trinomial', async () => {
      installFetchMock(createFetchMock({ routes: itisRoutes }));

      const results = await searchTaxonomy('Panthera tigris');

      expect(results.map(node => node.scientificName)).toEqual(['Panthera tigris']);
    });

    it('returns an empty list for an unknown chinese name without hitting the network', async () => {
      const fetchMock = createFetchMock({ routes: itisRoutes });
      installFetchMock(fetchMock);

      await expect(searchTaxonomy('不存在的动物名')).resolves.toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
