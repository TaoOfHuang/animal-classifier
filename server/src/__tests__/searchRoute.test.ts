import request from 'supertest';
import { app } from '../app';

describe('GET /api/search', () => {
  it('returns paginated search result', async () => {
    const res = await request(app).get('/api/search?q=虎&limit=10&offset=0');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });
});
