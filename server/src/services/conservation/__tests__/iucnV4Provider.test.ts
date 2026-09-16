import { clearCache } from '../../../utils/cache';
import { createFetchMock, installFetchMock, mockJsonResponse } from '../../__tests__/helpers/httpMock';
import * as F from '../../__tests__/helpers/fixtures';
import { iucnV4Provider } from '../iucnV4Provider';
import { IucnNotConfiguredError } from '../types';

const originalFetch = global.fetch;

const IUCN_ROUTES = {
  '/taxa/scientific_name': () => F.IUCN_TAXA_BY_NAME_PANTHERA_TIGRIS,
  '/taxa/sis/15955': () => F.IUCN_TAXON_SIS_15955,
  '/assessment/214862019': () => F.IUCN_ASSESSMENT_214862019,
};

describe('iucnV4Provider', () => {
  const originalToken = process.env.IUCN_API_TOKEN;

  beforeEach(() => {
    clearCache();
    process.env.IUCN_API_TOKEN = 'test-token';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    if (originalToken === undefined) {
      delete process.env.IUCN_API_TOKEN;
    } else {
      process.env.IUCN_API_TOKEN = originalToken;
    }
  });

  it('throws instead of returning fake data when no token is configured', async () => {
    delete process.env.IUCN_API_TOKEN;
    const fetchMock = createFetchMock({ routes: IUCN_ROUTES });
    installFetchMock(fetchMock);

    await expect(iucnV4Provider.lookup('Panthera tigris')).rejects.toBeInstanceOf(
      IucnNotConfiguredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('walks taxa/scientific_name → taxa/sis → assessment and maps the fields', async () => {
    const fetchMock = createFetchMock({ routes: IUCN_ROUTES });
    installFetchMock(fetchMock);

    const status = await iucnV4Provider.lookup('Panthera tigris');

    expect(status).toEqual({
      iucnStatus: 'EN',
      population: undefined,
      populationTrend: 'decreasing',
      assessmentYear: 2022,
      threats: [
        'Hunting & trapping terrestrial animals',
        'Annual & perennial non-timber crops',
      ],
      source: 'iucn_v4',
    });

    const urls = fetchMock.mock.calls.map(call => String(call[0]));
    expect(urls[0]).toContain('genus_name=Panthera&species_name=tigris');
    expect(urls[1]).toContain('/taxa/sis/15955');
    expect(urls[2]).toContain('/assessment/214862019');
  });

  // 实现在两种写法间选了裸 token。注意 Bearer 其实**也能通过**（见 README 第 2 节），
  // 这里锁的是「本实现发出的就是裸 token」这个事实，不是「Bearer 会失败」。
  it('sends the raw token in the Authorization header (no Bearer prefix)', async () => {
    const fetchMock = createFetchMock({ routes: IUCN_ROUTES });
    installFetchMock(fetchMock);

    await iucnV4Provider.lookup('Panthera tigris');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'test-token' }),
      }),
    );
    expect(JSON.stringify(init.headers)).not.toContain('Bearer');
  });

  it('picks the assessment flagged as latest', async () => {
    const fetchMock = createFetchMock({ routes: IUCN_ROUTES });
    installFetchMock(fetchMock);

    await iucnV4Provider.lookup('Panthera tigris');

    expect(String(fetchMock.mock.calls[2][0])).toContain('/assessment/214862019');
    expect(String(fetchMock.mock.calls[2][0])).not.toContain('/assessment/100000001');
  });

  it('normalises a trinomial to the species before querying', async () => {
    const fetchMock = createFetchMock({ routes: IUCN_ROUTES });
    installFetchMock(fetchMock);

    await iucnV4Provider.lookup('Panthera tigris altaica');

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      'genus_name=Panthera&species_name=tigris',
    );
  });

  it('returns null when the species is not registered (upstream 404)', async () => {
    installFetchMock(
      createFetchMock({
        routes: {
          ...IUCN_ROUTES,
          '/taxa/scientific_name': () =>
            mockJsonResponse(F.IUCN_NOT_FOUND, { ok: false, status: 404 }),
        },
      }),
    );

    await expect(iucnV4Provider.lookup('Notarealgenus notarealspecies')).resolves.toBeNull();
  });

  it('returns null when the request is not a binomial', async () => {
    const fetchMock = createFetchMock({ routes: IUCN_ROUTES });
    installFetchMock(fetchMock);

    await expect(iucnV4Provider.lookup('Panthera')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propagates upstream 5xx so the aggregator can degrade', async () => {
    installFetchMock(
      createFetchMock({
        routes: {
          '/taxa/scientific_name': () => mockJsonResponse({}, { ok: false, status: 500 }),
        },
      }),
    );

    await expect(iucnV4Provider.lookup('Panthera tigris')).rejects.toThrow('Request failed: 500');
  });

  // 实测（2026-09-17）：401 = token 存在但无效 / scheme 不被认识；403 = 完全没有可用的
  // Authorization 头。两者都是配置问题，既不是「查无此物」，也不值得重试。
  // 返回 null 会被上层当成「IUCN 没有该物种的数据」，掩盖掉配错 token 这件事。
  // 状态码矩阵见 ../README.md 第 2 节。
  it.each([
    [401, 'token 无效 / scheme 不认识'],
    [403, '完全没有 Authorization 头'],
  ])('surfaces upstream %i (%s) instead of pretending there is no data', async status => {
    const fetchMock = createFetchMock({
      routes: {
        '/taxa/scientific_name': () =>
          mockJsonResponse(
            { error: status === 401 ? 'Unauthorized' : 'Forbidden' },
            { ok: false, status },
          ),
      },
    });
    installFetchMock(fetchMock);

    await expect(iucnV4Provider.lookup('Panthera tigris')).rejects.toThrow(
      `Request failed: ${status}`,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('leaves trend and year undefined when the assessment omits them', async () => {
    installFetchMock(
      createFetchMock({
        routes: {
          ...IUCN_ROUTES,
          '/assessment/214862019': () => ({
            assessment_id: 214862019,
            red_list_category: { code: 'CR' },
          }),
        },
      }),
    );

    const status = await iucnV4Provider.lookup('Panthera tigris');

    expect(status).toEqual({
      iucnStatus: 'CR',
      population: undefined,
      populationTrend: undefined,
      assessmentYear: undefined,
      threats: undefined,
      source: 'iucn_v4',
    });
  });

  it('maps an unknown category code to DD rather than EN', async () => {
    installFetchMock(
      createFetchMock({
        routes: {
          ...IUCN_ROUTES,
          '/assessment/214862019': () => ({
            assessment_id: 214862019,
            red_list_category: { code: 'ZZ' },
          }),
        },
      }),
    );

    await expect(iucnV4Provider.lookup('Panthera tigris')).resolves.toEqual(
      expect.objectContaining({ iucnStatus: 'DD' }),
    );
  });
});
