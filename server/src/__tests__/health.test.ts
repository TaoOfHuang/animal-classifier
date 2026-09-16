import request from 'supertest';
import { app } from '../app';
import { clearCache, withCache } from '../utils/cache';

describe('GET /health', () => {
  beforeEach(() => {
    clearCache();
    delete process.env.CONSERVATION_SOURCE;
  });

  it('returns ok status', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('reports the active conservation source', async () => {
    const res = await request(app).get('/health');

    expect(res.body.conservationSource).toBe('static');
  });

  it('reports invalid when CONSERVATION_SOURCE is misconfigured', async () => {
    process.env.CONSERVATION_SOURCE = 'banana';
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.conservationSource).toBe('invalid');
    delete process.env.CONSERVATION_SOURCE;
  });

  it('exposes cache stats', async () => {
    await withCache('itis:down:1', 60_000, async () => 'value');

    const res = await request(app).get('/health');

    expect(res.body.cache.size).toBe(1);
  });
});

describe('POST /health/cache/invalidate', () => {
  beforeEach(() => {
    clearCache();
  });

  it('drops entries matching the prefix', async () => {
    await withCache('itis:down:1', 60_000, async () => 'a');
    await withCache('iucn:taxa:1', 60_000, async () => 'b');

    const res = await request(app).post('/health/cache/invalidate?prefix=itis:');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', removed: 1, size: 1 });
  });

  it('requires a prefix', async () => {
    const res = await request(app).post('/health/cache/invalidate');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CACHE_PREFIX');
  });
});
