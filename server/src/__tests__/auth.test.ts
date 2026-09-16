import request from 'supertest';
import { app } from '../app';
import { recognizeByImage } from '../services/recognitionService';
import { resetDailyCounter } from '../middleware/auth';

jest.mock('../services/recognitionService', () => ({
  recognizeByImage: jest.fn(),
}));

const mockRecognizeByImage = recognizeByImage as jest.MockedFunction<
  typeof recognizeByImage
>;

describe('POST /api/recognize (token-auth mode)', () => {
  const originalToken = process.env.API_TOKEN;
  const originalLimit = process.env.AI_RECOGNIZE_DAILY_LIMIT;
  const TEST_TOKEN = 'test-token-12345';

  beforeEach(() => {
    process.env.API_TOKEN = TEST_TOKEN;
    delete process.env.AI_RECOGNIZE_DAILY_LIMIT;
    mockRecognizeByImage.mockResolvedValue({
      animal: {
        id: 'test',
        commonNameZh: 'test',
        commonNameEn: 'test',
        scientificName: 'test',
        taxonomy: {},
      },
      confidence: 1,
      dataSources: { taxonomy: 'none', conservation: 'none' },
    });
    // Reset the daily counter so each test starts fresh
    resetDailyCounter();
  });

  afterEach(() => {
    jest.clearAllMocks();
    resetDailyCounter();
    if (originalToken !== undefined) {
      process.env.API_TOKEN = originalToken;
    } else {
      delete process.env.API_TOKEN;
    }
    if (originalLimit !== undefined) {
      process.env.AI_RECOGNIZE_DAILY_LIMIT = originalLimit;
    } else {
      delete process.env.AI_RECOGNIZE_DAILY_LIMIT;
    }
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .post('/api/recognize')
      .send({ image: 'data:image/jpeg;base64,xxx' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when token is wrong', async () => {
    const res = await request(app)
      .post('/api/recognize')
      .set('Authorization', 'Bearer wrong-token')
      .send({ image: 'data:image/jpeg;base64,xxx' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 200 when correct token is provided (Authorization header)', async () => {
    const res = await request(app)
      .post('/api/recognize')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({ image: 'data:image/jpeg;base64,xxx' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 200 when correct token is provided (X-API-Token header)', async () => {
    const res = await request(app)
      .post('/api/recognize')
      .set('X-API-Token', TEST_TOKEN)
      .send({ image: 'data:image/jpeg;base64,xxx' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 429 when daily limit is exceeded', async () => {
    process.env.AI_RECOGNIZE_DAILY_LIMIT = '2';

    // First two calls should succeed
    let res = await request(app)
      .post('/api/recognize')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({ image: 'data:image/jpeg;base64,xxx' });
    expect(res.status).toBe(200);

    res = await request(app)
      .post('/api/recognize')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({ image: 'data:image/jpeg;base64,xxx' });
    expect(res.status).toBe(200);

    // Third call should be rate-limited
    res = await request(app)
      .post('/api/recognize')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({ image: 'data:image/jpeg;base64,xxx' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('includes X-Daily-Calls-Remaining header in response', async () => {
    const res = await request(app)
      .post('/api/recognize')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({ image: 'data:image/jpeg;base64,xxx' });

    expect(res.status).toBe(200);
    expect(res.headers['x-daily-calls-remaining']).toBeDefined();
  });
});
