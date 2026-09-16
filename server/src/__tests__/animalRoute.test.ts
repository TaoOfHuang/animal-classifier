import request from 'supertest';
import { app } from '../app';
import { clearCache } from '../utils/cache';
import {
  createFetchMock,
  installFetchMock,
  mockJsonResponse,
} from '../services/__tests__/helpers/httpMock';
import { ITIS_ROUTES } from '../services/__tests__/helpers/itisRoutes';

const originalFetch = global.fetch;

describe('GET /api/animal/:id', () => {
  beforeEach(() => {
    clearCache();
    delete process.env.UNSPLASH_ACCESS_KEY;
    installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns the requested species instead of a hardcoded siberian tiger', async () => {
    const res = await request(app).get('/api/animal/Panthera%20tigris');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        scientificName: 'Panthera tigris',
        commonNameZh: '虎',
        dataSources: expect.objectContaining({ taxonomy: 'itis', conservation: 'static' }),
      }),
    );
    expect(res.body.data.taxonomy.species.scientificName).toBe('Panthera tigris');
    expect(res.body.data.taxonomy.family.scientificName).toBe('Felidae');
    // 濒危信息来自离线数据集
    expect(res.body.data.conservationStatus.iucnStatus).toBe('EN');
  });

  it('accepts a chinese id', async () => {
    const res = await request(app).get(`/api/animal/${encodeURIComponent('东北虎')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.scientificName).toBe('Panthera tigris');
  });

  it('returns 404 for an unknown id instead of fake data', async () => {
    const res = await request(app).get('/api/animal/Notarealgenus%20notarealspecies');

    expect(res.status).toBe(404);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'ANIMAL_NOT_FOUND' }),
      }),
    );
  });

  it('returns 404 for a chinese id the dictionary does not know', async () => {
    const res = await request(app).get(`/api/animal/${encodeURIComponent('不存在的动物名')}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ANIMAL_NOT_FOUND');
  });

  it('degrades to local data when itis is unreachable', async () => {
    installFetchMock(
      createFetchMock({
        routes: {
          itis: () => mockJsonResponse({}, { ok: false, status: 503 }),
        },
      }),
    );

    const res = await request(app).get('/api/animal/Panthera%20tigris');

    expect(res.status).toBe(200);
    expect(res.body.data.commonNameZh).toBe('虎');
    expect(res.body.data.dataSources.taxonomy).toBe('none');
  });

  it('answers 502 rather than 404 when itis is down and the name is unknown', async () => {
    installFetchMock(
      createFetchMock({
        routes: {
          itis: () => mockJsonResponse({}, { ok: false, status: 503 }),
        },
      }),
    );

    const res = await request(app).get('/api/animal/Notarealgenus%20notarealspecies');

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('ANIMAL_UPSTREAM_FAILED');
  });
});
