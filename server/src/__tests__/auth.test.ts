import request from 'supertest';
import { app } from '../app';
import { closeDb } from '../db';
import { revokeDevice } from '../services/deviceService';
import { recognizeByImage } from '../services/recognitionService';

jest.mock('../services/recognitionService', () => ({
  recognizeByImage: jest.fn(),
}));

const mockRecognizeByImage = recognizeByImage as jest.MockedFunction<
  typeof recognizeByImage
>;

const DEVICE_A = 'a1b2c3d4e5f60718';
const DEVICE_B = 'b1b2c3d4e5f60718';

/** 走真实 HTTP 注册端点换取令牌，保证端到端一致 */
const register = async (deviceId: string): Promise<string> => {
  const res = await request(app).post('/api/auth/device').send({ deviceId });
  expect(res.status).toBe(200);
  return res.body.data.token as string;
};

const recognize = (token?: string) => {
  const req = request(app).post('/api/recognize');
  if (token) {
    req.set('Authorization', `Bearer ${token}`);
  }
  return req.send({ image: 'data:image/jpeg;base64,xxx' });
};

const MANAGED_ENV_KEYS = [
  'REGISTER_RATE_LIMIT_PER_HOUR',
  'DEVICE_DAILY_LIMIT',
  'GLOBAL_DAILY_LIMIT',
  'MAX_DEVICE_COUNT',
  'WHITELIST_DEVICE_IDS',
];

describe('POST /api/recognize —— 设备令牌鉴权', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    MANAGED_ENV_KEYS.forEach((key) => {
      savedEnv[key] = process.env[key];
    });

    // 全新内存库；关掉注册节流，避免用例之间互相干扰（节流单独在 deviceService 测试里覆盖）
    closeDb();
    process.env.REGISTER_RATE_LIMIT_PER_HOUR = '0';
    delete process.env.DEVICE_DAILY_LIMIT;
    delete process.env.GLOBAL_DAILY_LIMIT;
    delete process.env.MAX_DEVICE_COUNT;
    delete process.env.WHITELIST_DEVICE_IDS;

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
  });

  afterEach(() => {
    jest.clearAllMocks();
    closeDb();
    MANAGED_ENV_KEYS.forEach((key) => {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    });
  });

  it('未提供令牌时返回 401', async () => {
    const res = await recognize();

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('令牌伪造（未注册过）时返回 401', async () => {
    const res = await recognize('deadbeef'.repeat(8));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('持合法设备令牌时返回 200，并带上剩余次数', async () => {
    const token = await register(DEVICE_A);
    const res = await recognize(token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers['x-daily-calls-remaining']).toBeDefined();
  });

  it('也支持 X-API-Token 头部传令牌', async () => {
    const token = await register(DEVICE_A);
    const res = await request(app)
      .post('/api/recognize')
      .set('X-API-Token', token)
      .send({ image: 'data:image/jpeg;base64,xxx' });

    expect(res.status).toBe(200);
  });

  it('单设备配额用尽时返回 429 DEVICE_QUOTA_EXCEEDED', async () => {
    process.env.DEVICE_DAILY_LIMIT = '2';
    const token = await register(DEVICE_A);

    expect((await recognize(token)).status).toBe(200);
    expect((await recognize(token)).status).toBe(200);

    const res = await recognize(token);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('DEVICE_QUOTA_EXCEEDED');
    // 该错误不可通过重新注册自愈，必须带 Retry-After
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('全局配额用尽时返回 429 GLOBAL_QUOTA_EXCEEDED', async () => {
    process.env.GLOBAL_DAILY_LIMIT = '2';
    const tokenA = await register(DEVICE_A);
    const tokenB = await register(DEVICE_B);

    // 两台设备的单设备配额（默认 20）都没到，先耗光全局的 2 次
    expect((await recognize(tokenA)).status).toBe(200);
    expect((await recognize(tokenA)).status).toBe(200);

    const res = await recognize(tokenB);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('GLOBAL_QUOTA_EXCEEDED');
  });

  it('设备被封禁后返回 403 DEVICE_REVOKED（而非 401）', async () => {
    const token = await register(DEVICE_A);
    revokeDevice(DEVICE_A);

    const res = await recognize(token);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('DEVICE_REVOKED');
  });

  it('白名单设备不消耗全局配额', async () => {
    process.env.GLOBAL_DAILY_LIMIT = '1';
    process.env.WHITELIST_DEVICE_IDS = DEVICE_A;

    const tokenA = await register(DEVICE_A);
    const tokenB = await register(DEVICE_B);

    // A 在白名单里，调用多少次都不占全局额度
    expect((await recognize(tokenA)).status).toBe(200);
    expect((await recognize(tokenA)).status).toBe(200);

    // 全局额度仍是满的，B 还能正常用
    expect((await recognize(tokenB)).status).toBe(200);
  });
});

describe('POST /api/auth/device —— 注册端点', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    MANAGED_ENV_KEYS.forEach((key) => {
      savedEnv[key] = process.env[key];
    });
    closeDb();
    process.env.REGISTER_RATE_LIMIT_PER_HOUR = '0';
    delete process.env.MAX_DEVICE_COUNT;
    delete process.env.WHITELIST_DEVICE_IDS;
  });

  afterEach(() => {
    closeDb();
    MANAGED_ENV_KEYS.forEach((key) => {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    });
  });

  it('返回令牌与配额', async () => {
    const res = await request(app)
      .post('/api/auth/device')
      .send({ deviceId: DEVICE_A });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.data.dailyLimit).toBeGreaterThan(0);
  });

  it('deviceId 格式非法时返回 400', async () => {
    const res = await request(app)
      .post('/api/auth/device')
      .send({ deviceId: 'too-short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_DEVICE_ID');
  });

  it('已封禁设备重新注册时返回 403，不签发新令牌', async () => {
    await register(DEVICE_A);
    revokeDevice(DEVICE_A);

    const res = await request(app)
      .post('/api/auth/device')
      .send({ deviceId: DEVICE_A });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('DEVICE_REVOKED');
    expect(res.body.data).toBeUndefined();
  });

  it('超过设备总数上限时返回 503', async () => {
    process.env.MAX_DEVICE_COUNT = '1';
    await register(DEVICE_A);

    const res = await request(app)
      .post('/api/auth/device')
      .send({ deviceId: DEVICE_B });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DEVICE_CAP_REACHED');
  });
});

describe('POST /api/auth/revoke —— 封禁端点', () => {
  const savedAdminToken = process.env.ADMIN_TOKEN;

  beforeEach(() => {
    closeDb();
    process.env.REGISTER_RATE_LIMIT_PER_HOUR = '0';
    process.env.ADMIN_TOKEN = 'admin-secret-token';
  });

  afterEach(() => {
    closeDb();
    if (savedAdminToken === undefined) {
      delete process.env.ADMIN_TOKEN;
    } else {
      process.env.ADMIN_TOKEN = savedAdminToken;
    }
  });

  it('未配置 ADMIN_TOKEN 时返回 503，不会变成无鉴权接口', async () => {
    delete process.env.ADMIN_TOKEN;

    const res = await request(app)
      .post('/api/auth/revoke')
      .send({ deviceId: DEVICE_A });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('ADMIN_DISABLED');
  });

  it('管理员令牌错误时返回 401', async () => {
    const res = await request(app)
      .post('/api/auth/revoke')
      .set('Authorization', 'Bearer wrong-admin-token')
      .send({ deviceId: DEVICE_A });

    expect(res.status).toBe(401);
  });

  it('管理员令牌正确时封禁成功，且对同一设备幂等', async () => {
    await register(DEVICE_A);

    const first = await request(app)
      .post('/api/auth/revoke')
      .set('Authorization', 'Bearer admin-secret-token')
      .send({ deviceId: DEVICE_A });
    expect(first.status).toBe(200);
    expect(first.body.data.revoked).toBe(true);

    const second = await request(app)
      .post('/api/auth/revoke')
      .set('Authorization', 'Bearer admin-secret-token')
      .send({ deviceId: DEVICE_A });
    expect(second.status).toBe(200);
    expect(second.body.data.alreadyRevoked).toBe(true);
  });
});
