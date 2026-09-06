import request from 'supertest';
import { app } from '../app';

describe('GET /api/taxonomy/:level/:name', () => {
  it('returns taxonomy tree data', async () => {
    const res = await request(app).get('/api/taxonomy/family/Felidae');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.current.level).toBe('family');
    expect(Array.isArray(res.body.data.children)).toBe(true);
  });
});
