import request from 'supertest';
import { app } from '../app';

describe('Error handler', () => {
  it('returns standard error body for not found route', async () => {
    const res = await request(app).get('/api/not-exists');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
