import { IUCN_STATUS_CODES } from '../../constants/taxonomy';
import { clearCache } from '../../utils/cache';
import { enrichAnimal, getAnimalById, mapIucnCategory, UpstreamUnavailableError } from '../animalService';
import { setConservationProviderOverride } from '../conservation';
import { ConservationProvider, ConservationStatus } from '../conservation/types';
import { createFetchMock, installFetchMock, mockJsonResponse } from './helpers/httpMock';
import { ITIS_ROUTES } from './helpers/itisRoutes';

const originalFetch = global.fetch;

const providerReturning = (status: ConservationStatus | null): ConservationProvider => ({
  name: status?.source ?? 'static',
  lookup: jest.fn().mockResolvedValue(status),
});

const failingProvider = (message = 'iucn down'): ConservationProvider => ({
  name: 'iucn_v4',
  lookup: jest.fn().mockRejectedValue(new Error(message)),
});

describe('mapIucnCategory', () => {
  it.each(IUCN_STATUS_CODES.map(code => [code, code]))('maps %s to %s', (input, expected) => {
    expect(mapIucnCategory(input)).toBe(expected);
  });

  it('is case insensitive', () => {
    expect(mapIucnCategory('ex')).toBe('EX');
  });

  it('falls back to DD instead of EN for unknown or missing category', () => {
    expect(mapIucnCategory(undefined)).toBe('DD');
    expect(mapIucnCategory(null)).toBe('DD');
    expect(mapIucnCategory('')).toBe('DD');
    expect(mapIucnCategory('WEIRD')).toBe('DD');
  });
});

describe('enrichAnimal', () => {
  beforeEach(() => {
    clearCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setConservationProviderOverride(null);
    jest.restoreAllMocks();
  });

  it('overrides the llm taxonomy with the itis lineage', async () => {
    installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));
    setConservationProviderOverride(providerReturning(null));

    const result = await enrichAnimal({
      id: 'Panthera tigris',
      commonNameZh: '东北虎',
      scientificName: 'Panthera tigris',
      // LLM 把虎归到了熊科 —— 必须被 ITIS 纠正
      taxonomy: { family: { scientificName: 'Ursidae', commonNameZh: '熊科' } },
    });

    expect(result.taxonomy?.family?.scientificName).toBe('Felidae');
    expect(result.taxonomy?.family?.commonNameZh).toBe('猫科');
    expect(result.taxonomy?.species?.scientificName).toBe('Panthera tigris');
    expect(result.dataSources.taxonomy).toBe('itis');
    // LLM 给出的更具体的中文名不该被种级泛称覆盖
    expect(result.commonNameZh).toBe('东北虎');
  });

  it('normalises a subspecies name to the species and keeps subspecies separately', async () => {
    installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));
    setConservationProviderOverride(providerReturning(null));

    const result = await enrichAnimal({
      id: 'Panthera tigris altaica',
      commonNameZh: '东北虎',
      scientificName: 'Panthera tigris altaica',
    });

    expect(result.scientificName).toBe('Panthera tigris');
    expect(result.id).toBe('Panthera tigris');
    expect(result.subspecies?.map(item => item.scientificName)).toEqual([
      'Panthera tigris sondaica',
      'Panthera tigris tigris',
    ]);
  });

  it('keeps the llm taxonomy when itis cannot resolve the name', async () => {
    installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));
    setConservationProviderOverride(providerReturning(null));

    const result = await enrichAnimal({
      id: 'Notarealgenus notarealspecies',
      commonNameZh: '未知动物',
      scientificName: 'Notarealgenus notarealspecies',
      taxonomy: { family: { scientificName: 'Madeupidae', commonNameZh: '虚构科' } },
    });

    expect(result.taxonomy?.family?.scientificName).toBe('Madeupidae');
    expect(result.dataSources.taxonomy).toBe('llm');
    expect(result.scientificName).toBe('Notarealgenus notarealspecies');
  });

  it('leaves conservationStatus undefined when iucn has no data (no fake EN)', async () => {
    installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));
    setConservationProviderOverride(providerReturning(null));

    const result = await enrichAnimal({
      id: 'Panthera tigris',
      commonNameZh: '虎',
      scientificName: 'Panthera tigris',
    });

    expect(result.conservationStatus).toBeUndefined();
    expect(result.dataSources.conservation).toBe('none');
  });

  it('preserves EX instead of degrading it to EN', async () => {
    installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));
    setConservationProviderOverride(
      providerReturning({ iucnStatus: 'EX', source: 'iucn_v4', assessmentYear: 2023 }),
    );

    const result = await enrichAnimal({
      id: 'Panthera tigris',
      commonNameZh: '虎',
      scientificName: 'Panthera tigris',
    });

    expect(result.conservationStatus?.iucnStatus).toBe('EX');
    expect(result.dataSources.conservation).toBe('iucn_v4');
  });

  it('degrades independently: itis success survives an iucn outage', async () => {
    installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));
    setConservationProviderOverride(failingProvider());

    const result = await enrichAnimal({
      id: 'Panthera tigris',
      commonNameZh: '虎',
      scientificName: 'Panthera tigris',
    });

    expect(result.dataSources.taxonomy).toBe('itis');
    expect(result.taxonomy?.family?.scientificName).toBe('Felidae');
    expect(result.conservationStatus).toBeUndefined();
    expect(result.dataSources.conservation).toBe('none');
  });

  it('never throws when both upstreams are down', async () => {
    installFetchMock(
      createFetchMock({
        routes: {
          searchByScientificName: () => mockJsonResponse({}, { ok: false, status: 503 }),
        },
      }),
    );
    setConservationProviderOverride(failingProvider());

    const result = await enrichAnimal({
      id: 'Panthera tigris',
      commonNameZh: '虎',
      scientificName: 'Panthera tigris',
      taxonomy: { family: { scientificName: 'Felidae', commonNameZh: '猫科' } },
    });

    expect(result.dataSources).toEqual({ taxonomy: 'llm', conservation: 'none' });
    expect(result.taxonomy?.family?.scientificName).toBe('Felidae');
  });

  it('does not call upstreams when there is no scientific name', async () => {
    const fetchMock = createFetchMock({ routes: ITIS_ROUTES });
    installFetchMock(fetchMock);
    const provider = providerReturning(null);
    setConservationProviderOverride(provider);

    const result = await enrichAnimal({
      id: 'unknown',
      commonNameZh: '未知动物',
      scientificName: '',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(provider.lookup).not.toHaveBeenCalled();
    expect(result.dataSources.taxonomy).toBe('none');
  });

  it('degrades to the llm taxonomy when itis times out', async () => {
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
      setConservationProviderOverride(providerReturning(null));

      const pending = enrichAnimal({
        id: 'Panthera tigris',
        commonNameZh: '虎',
        scientificName: 'Panthera tigris',
        taxonomy: { family: { scientificName: 'Felidae', commonNameZh: '猫科' } },
      });
      // 先把微任务跑干，确保超时定时器已注册，再推进假时钟
      for (let i = 0; i < 20; i += 1) {
        await Promise.resolve();
      }
      await jest.runAllTimersAsync();
      const result = await pending;

      // 上游超时 ≠ 整个请求失败：LLM 的分类要保住
      expect(result.dataSources.taxonomy).toBe('llm');
      expect(result.taxonomy?.family?.scientificName).toBe('Felidae');
      expect(result.conservationStatus).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the animal usable when iucn rejects the token with a 403', async () => {
    const originalSource = process.env.CONSERVATION_SOURCE;
    const originalToken = process.env.IUCN_API_TOKEN;
    process.env.CONSERVATION_SOURCE = 'iucn_v4';
    process.env.IUCN_API_TOKEN = 'stale-token';

    try {
      installFetchMock(
        createFetchMock({
          routes: {
            ...ITIS_ROUTES,
            '/taxa/scientific_name': () =>
              mockJsonResponse({ error: 'Forbidden' }, { ok: false, status: 403 }),
          },
        }),
      );

      const result = await enrichAnimal({
        id: 'Panthera tigris',
        commonNameZh: '虎',
        scientificName: 'Panthera tigris',
      });

      // token 失效只该让濒危信息缺席，不能连分类一起拖垮
      expect(result.dataSources.taxonomy).toBe('itis');
      expect(result.taxonomy?.family?.scientificName).toBe('Felidae');
      expect(result.conservationStatus).toBeUndefined();
      expect(result.dataSources.conservation).toBe('none');
    } finally {
      if (originalSource === undefined) {
        delete process.env.CONSERVATION_SOURCE;
      } else {
        process.env.CONSERVATION_SOURCE = originalSource;
      }
      if (originalToken === undefined) {
        delete process.env.IUCN_API_TOKEN;
      } else {
        process.env.IUCN_API_TOKEN = originalToken;
      }
      setConservationProviderOverride(null);
    }
  });
});

describe('getAnimalById', () => {
  beforeEach(() => {
    clearCache();
    delete process.env.UNSPLASH_ACCESS_KEY;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setConservationProviderOverride(null);
    jest.restoreAllMocks();
  });

  it('resolves the requested species instead of a hardcoded siberian tiger', async () => {
    installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));

    const animal = await getAnimalById('Panthera tigris');

    expect(animal).not.toBeNull();
    expect(animal?.scientificName).toBe('Panthera tigris');
    expect(animal?.commonNameZh).toBe('虎');
    expect(Object.keys(animal?.taxonomy ?? {})).toEqual(
      expect.arrayContaining(['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species']),
    );
    expect(animal?.dataSources.taxonomy).toBe('itis');
    // 离线数据集里虎是 EN
    expect(animal?.conservationStatus?.iucnStatus).toBe('EN');
    expect(animal?.dataSources.conservation).toBe('static');
    expect(animal?.images).toEqual([]);
  });

  it('accepts a chinese name', async () => {
    installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));

    const animal = await getAnimalById('东北虎');

    expect(animal?.scientificName).toBe('Panthera tigris');
  });

  it('returns null for an unknown species so the route can answer 404', async () => {
    installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));

    await expect(getAnimalById('Notarealgenus notarealspecies')).resolves.toBeNull();
  });

  it('returns null for a chinese name the dictionary does not know', async () => {
    installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));

    await expect(getAnimalById('不存在的动物名')).resolves.toBeNull();
  });

  it('degrades to local data when itis is unreachable, and says so', async () => {
    installFetchMock(
      createFetchMock({
        routes: {
          itis: () => mockJsonResponse({}, { ok: false, status: 503 }),
        },
      }),
    );

    const animal = await getAnimalById('Panthera tigris');

    expect(animal).not.toBeNull();
    expect(animal?.commonNameZh).toBe('虎');
    expect(animal?.dataSources.taxonomy).toBe('none');
    expect(animal?.conservationStatus?.iucnStatus).toBe('EN');
  });

  it('throws UpstreamUnavailableError when itis is down and the name is unknown locally', async () => {
    installFetchMock(
      createFetchMock({
        routes: {
          itis: () => mockJsonResponse({}, { ok: false, status: 503 }),
        },
      }),
    );

    // 上游挂了不等于「没有这个物种」，不能谎报 404
    await expect(getAnimalById('Notarealgenus notarealspecies')).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
  });
});
