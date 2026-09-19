import request from 'supertest';
import { app } from '../app';
import { closeDb } from '../db';
import { recognizeByImage } from '../services/recognitionService';

jest.mock('../services/recognitionService', () => ({
  recognizeByImage: jest.fn(),
}));

const mockRecognizeByImage = recognizeByImage as jest.MockedFunction<
  typeof recognizeByImage
>;

const DEVICE_ID = 'a1b2c3d4e5f60718';

describe('POST /api/recognize', () => {
  const savedRateLimit = process.env.REGISTER_RATE_LIMIT_PER_HOUR;
  let token: string;

  beforeEach(async () => {
    closeDb();
    process.env.REGISTER_RATE_LIMIT_PER_HOUR = '0';

    mockRecognizeByImage.mockResolvedValue({
      animal: {
        id: 'Ailuropoda melanoleuca',
        commonNameZh: '大熊猫',
        commonNameEn: 'Giant Panda',
        scientificName: 'Ailuropoda melanoleuca',
        taxonomy: {},
      },
      confidence: 0.87,
      dataSources: { taxonomy: 'llm', conservation: 'static' },
    });

    // 鉴权是强制的（不再有「无 token 模式」），所以先注册一台设备
    const registered = await request(app)
      .post('/api/auth/device')
      .send({ deviceId: DEVICE_ID });
    token = registered.body.data.token as string;
  });

  afterEach(() => {
    jest.clearAllMocks();
    closeDb();
    if (savedRateLimit === undefined) {
      delete process.env.REGISTER_RATE_LIMIT_PER_HOUR;
    } else {
      process.env.REGISTER_RATE_LIMIT_PER_HOUR = savedRateLimit;
    }
  });

  it('returns AI recognition result', async () => {
    const res = await request(app)
      .post('/api/recognize')
      .set('Authorization', `Bearer ${token}`)
      .send({ image: 'base64-or-uri' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.animal.commonNameZh).toBe('大熊猫');
    expect(mockRecognizeByImage).toHaveBeenCalledWith({ image: 'base64-or-uri' });
  });

  it('rejects the request when no device token is provided', async () => {
    const res = await request(app)
      .post('/api/recognize')
      .send({ image: 'base64-or-uri' });

    expect(res.status).toBe(401);
    expect(mockRecognizeByImage).not.toHaveBeenCalled();
  });
});
