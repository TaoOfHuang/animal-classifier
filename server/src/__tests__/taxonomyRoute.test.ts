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

describe('taxonomy routes', () => {
  beforeEach(() => {
    clearCache();
    installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('GET /api/taxonomy/:level/:name returns current/parent/childCount', async () => {
    const res = await request(app).get('/api/taxonomy/family/Felidae');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        current: expect.objectContaining({
          level: 'family',
          scientificName: 'Felidae',
          commonNameZh: '猫科',
        }),
        parent: expect.objectContaining({ level: 'order', scientificName: 'Carnivora' }),
        childCount: expect.any(Number),
      }),
    );
    // 契约已对齐：不再返回 children
    expect(res.body.data.children).toBeUndefined();
  });

  it('GET /api/taxonomy/:level/:name/children returns paginated children', async () => {
    const res = await request(app).get(
      '/api/taxonomy/genus/Panthera/children?limit=10&offset=0',
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        children: expect.any(Array),
        hasMore: expect.any(Boolean),
        total: expect.any(Number),
        childLevel: 'species',
      }),
    );
    expect(res.body.data.children[0]).toEqual(
      expect.objectContaining({ level: 'species', scientificName: 'Panthera onca' }),
    );
  });

  it('GET /api/taxonomy/:level/:name/children honours pagination', async () => {
    const res = await request(app).get(
      '/api/taxonomy/genus/Panthera/children?limit=2&offset=4',
    );

    expect(res.status).toBe(200);
    expect(res.body.data.children).toHaveLength(1);
    expect(res.body.data.total).toBe(5);
    expect(res.body.data.hasMore).toBe(false);
  });

  it('GET /api/taxonomy/search returns results', async () => {
    const res = await request(app).get('/api/taxonomy/search?q=虎');

    expect(res.status).toBe(200);
    expect(res.body.data.results).toEqual(expect.any(Array));
    expect(res.body.data.results[0]).toEqual(
      expect.objectContaining({ scientificName: 'Panthera tigris', commonNameZh: '虎' }),
    );
  });

  it('GET /api/taxonomy/search filters by level', async () => {
    const res = await request(app).get('/api/taxonomy/search?q=虎&level=family');

    expect(res.status).toBe(200);
    expect(
      res.body.data.results.every((node: { level: string }) => node.level === 'family'),
    ).toBe(true);
  });

  it('url-decodes and accepts a chinese name in the path', async () => {
    const res = await request(app).get(
      `/api/taxonomy/species/${encodeURIComponent('东北虎')}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.current.scientificName).toBe('Panthera tigris');
  });

  it('rejects an invalid level with 400', async () => {
    const res = await request(app).get('/api/taxonomy/banana/Felidae');

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'INVALID_TAXONOMY_LEVEL' }),
      }),
    );
  });

  it('rejects an unsupported name with 400 before hitting the upstream', async () => {
    const res = await request(app).get('/api/taxonomy/family/%3Cscript%3E');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TAXONOMY_QUERY');
  });

  it('returns 404 for a name itis does not know', async () => {
    const res = await request(app).get('/api/taxonomy/genus/Notarealgenus');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TAXONOMY_NOT_FOUND');
  });

  it('returns 404 when the name does not belong to the requested level', async () => {
    const res = await request(app).get('/api/taxonomy/family/Panthera');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TAXONOMY_NOT_FOUND');
  });

  it('returns 502 (not fake data) when itis is unreachable', async () => {
    installFetchMock(
      createFetchMock({
        routes: {
          itis: () => mockJsonResponse({}, { ok: false, status: 503 }),
        },
      }),
    );

    const res = await request(app).get('/api/taxonomy/family/Felidae');

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('TAXONOMY_UPSTREAM_FAILED');
  });

  it('degrades the search endpoint to an empty list when itis is unreachable', async () => {
    installFetchMock(
      createFetchMock({
        routes: {
          itis: () => mockJsonResponse({}, { ok: false, status: 503 }),
        },
      }),
    );

    const res = await request(app).get('/api/taxonomy/search?q=Panthera%20tigris');

    expect(res.status).toBe(200);
    expect(res.body.data.results).toEqual([]);
  });
});
