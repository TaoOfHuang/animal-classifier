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

describe('search routes', () => {
  beforeEach(() => {
    clearCache();
    installFetchMock(createFetchMock({ routes: ITIS_ROUTES }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('GET /api/search returns paginated results', async () => {
    const res = await request(app).get('/api/search?q=虎&limit=10&offset=0');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items[0]).toEqual(
      expect.objectContaining({
        commonNameZh: '虎',
        scientificName: 'Panthera tigris',
        family: 'Felidae',
        familyZh: '猫科',
      }),
    );
  });

  it('GET /api/search returns an empty page for a blank query', async () => {
    const res = await request(app).get('/api/search?q=');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ total: 0, items: [], hasMore: false });
  });

  it('GET /api/search degrades to an empty page when itis is unreachable', async () => {
    installFetchMock(
      createFetchMock({
        routes: {
          itis: () => mockJsonResponse({}, { ok: false, status: 503 }),
        },
      }),
    );

    const res = await request(app).get('/api/search?q=Panthera%20tigris');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it('GET /api/search/suggestions returns a string array', async () => {
    const res = await request(app).get('/api/search/suggestions?q=虎&limit=5');

    expect(res.status).toBe(200);
    expect(res.body.data.suggestions).toEqual(expect.any(Array));
    expect(res.body.data.suggestions).toContain('虎');
    expect(
      res.body.data.suggestions.every((item: unknown) => typeof item === 'string'),
    ).toBe(true);
  });

  it('GET /api/search/suggestions returns an empty array for a blank query', async () => {
    const res = await request(app).get('/api/search/suggestions?q=');

    expect(res.status).toBe(200);
    expect(res.body.data.suggestions).toEqual([]);
  });
});
