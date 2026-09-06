import request from 'supertest';
import { app } from '../app';

describe('GET /api/animal/:id', () => {
  it('returns animal detail data', async () => {
    const res = await request(app).get('/api/animal/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('1');
    expect(res.body.data.taxonomy).toBeTruthy();
  });
});
