import { closeDb, getDb } from '../../db';
import {
  authenticateAndConsume,
  hashToken,
  registerDevice,
  revokeDevice,
  todayKey,
} from '../deviceService';

const DEVICE_A = 'a1b2c3d4e5f60718';
const DEVICE_B = 'b1b2c3d4e5f60718';

const MANAGED_ENV_KEYS = [
  'REGISTER_RATE_LIMIT_PER_HOUR',
  'DEVICE_DAILY_LIMIT',
  'GLOBAL_DAILY_LIMIT',
  'MAX_DEVICE_COUNT',
  'WHITELIST_DEVICE_IDS',
];

const registerOk = (deviceId: string, ip = '10.0.0.1') => {
  const outcome = registerDevice(deviceId, ip);
  if (outcome.kind !== 'ok') {
    throw new Error(`registration failed: ${outcome.kind}`);
  }
  return outcome;
};

describe('deviceService', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    MANAGED_ENV_KEYS.forEach((key) => {
      savedEnv[key] = process.env[key];
    });
    closeDb();
    process.env.REGISTER_RATE_LIMIT_PER_HOUR = '0';
    delete process.env.DEVICE_DAILY_LIMIT;
    delete process.env.GLOBAL_DAILY_LIMIT;
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

  describe('registerDevice', () => {
    it('签发的令牌能通过校验', () => {
      const { token } = registerOk(DEVICE_A);
      expect(authenticateAndConsume(token).kind).toBe('ok');
    });

    it('数据库只存哈希，不存令牌明文', () => {
      const { token } = registerOk(DEVICE_A);
      const row = getDb()
        .prepare('SELECT token_hash FROM devices WHERE device_id = ?')
        .get(DEVICE_A) as unknown as { token_hash: string };

      expect(row.token_hash).toBe(hashToken(token));
      expect(row.token_hash).not.toBe(token);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('deviceId 格式非法时拒绝', () => {
      expect(registerDevice('too-short', '10.0.0.1').kind).toBe(
        'invalid_device_id',
      );
      expect(registerDevice('z'.repeat(20), '10.0.0.1').kind).toBe(
        'invalid_device_id',
      );
      expect(registerDevice('', '10.0.0.1').kind).toBe('invalid_device_id');
    });

    it('同一 IP 超过注册节流阈值时拒绝', () => {
      process.env.REGISTER_RATE_LIMIT_PER_HOUR = '2';

      expect(registerDevice(DEVICE_A, '10.0.0.9').kind).toBe('ok');
      expect(registerDevice(DEVICE_B, '10.0.0.9').kind).toBe('ok');
      expect(registerDevice('c1b2c3d4e5f60718', '10.0.0.9').kind).toBe(
        'register_rate_limited',
      );

      // 换个 IP 不受影响
      expect(registerDevice('c1b2c3d4e5f60718', '10.0.0.10').kind).toBe('ok');
    });

    it('超过设备总数上限时拒绝', () => {
      process.env.MAX_DEVICE_COUNT = '1';
      registerOk(DEVICE_A);
      expect(registerDevice(DEVICE_B, '10.0.0.1').kind).toBe(
        'too_many_devices',
      );
    });

    it('白名单中的 deviceId 会被标记', () => {
      process.env.WHITELIST_DEVICE_IDS = DEVICE_A;
      registerOk(DEVICE_A);
      registerOk(DEVICE_B);

      const rows = getDb()
        .prepare('SELECT device_id, whitelisted FROM devices ORDER BY device_id')
        .all() as unknown as Array<{ device_id: string; whitelisted: number }>;

      const byDevice = Object.fromEntries(
        rows.map((row) => [row.device_id, row.whitelisted]),
      );
      expect(byDevice[DEVICE_A]).toBe(1);
      expect(byDevice[DEVICE_B]).toBe(0);
    });
  });

  describe('核心不变式：换令牌 ≠ 换身份', () => {
    it('同一 deviceId 重新注册不会重置当日用量', () => {
      process.env.DEVICE_DAILY_LIMIT = '3';
      const first = registerOk(DEVICE_A);

      // 先用掉 2 次
      expect(authenticateAndConsume(first.token).kind).toBe('ok');
      expect(authenticateAndConsume(first.token).kind).toBe('ok');

      // 重新注册：拿到新钥匙
      const second = registerOk(DEVICE_A);
      expect(second.token).not.toBe(first.token);
      expect(second.isNewDevice).toBe(false);

      // 旧钥匙立即失效
      expect(authenticateAndConsume(first.token).kind).toBe('unauthorized');

      // 但身份上的用量还在：只剩最后 1 次（而不是重置回 3 次）
      const third = authenticateAndConsume(second.token);
      expect(third.kind).toBe('ok');
      if (third.kind === 'ok') {
        expect(third.remaining).toBe(0);
      }

      expect(authenticateAndConsume(second.token).kind).toBe(
        'device_quota_exceeded',
      );
    });

    it('已封禁设备重新注册被拒绝，不会复活', () => {
      const { token } = registerOk(DEVICE_A);
      revokeDevice(DEVICE_A);

      expect(registerDevice(DEVICE_A, '10.0.0.1').kind).toBe('revoked');
      // 原令牌也已失效
      expect(authenticateAndConsume(token).kind).toBe('revoked');
    });
  });

  describe('authenticateAndConsume', () => {
    it('空令牌或未知令牌返回 unauthorized', () => {
      expect(authenticateAndConsume('').kind).toBe('unauthorized');
      expect(authenticateAndConsume('f'.repeat(64)).kind).toBe('unauthorized');
    });

    it('按设备配额递减 remaining，0 表示不限', () => {
      process.env.DEVICE_DAILY_LIMIT = '5';
      const { token } = registerOk(DEVICE_A);

      const first = authenticateAndConsume(token);
      expect(first.kind).toBe('ok');
      if (first.kind === 'ok') {
        expect(first.remaining).toBe(4);
      }

      // DEVICE_DAILY_LIMIT=0 → 不限，remaining 用 -1 表示
      process.env.DEVICE_DAILY_LIMIT = '0';
      const unlimited = authenticateAndConsume(token);
      expect(unlimited.kind).toBe('ok');
      if (unlimited.kind === 'ok') {
        expect(unlimited.remaining).toBe(-1);
      }
    });

    it('多台设备共享同一个全局额度', () => {
      process.env.GLOBAL_DAILY_LIMIT = '2';
      const tokenA = registerOk(DEVICE_A).token;
      const tokenB = registerOk(DEVICE_B).token;

      expect(authenticateAndConsume(tokenA).kind).toBe('ok');
      expect(authenticateAndConsume(tokenB).kind).toBe('ok');
      expect(authenticateAndConsume(tokenA).kind).toBe(
        'global_quota_exceeded',
      );
    });

    it('白名单设备调用不消耗全局额度', () => {
      process.env.GLOBAL_DAILY_LIMIT = '1';
      process.env.WHITELIST_DEVICE_IDS = DEVICE_A;
      const tokenA = registerOk(DEVICE_A).token;
      const tokenB = registerOk(DEVICE_B).token;

      expect(authenticateAndConsume(tokenA).kind).toBe('ok');
      expect(authenticateAndConsume(tokenA).kind).toBe('ok');

      // 全局额度没被 A 消耗，B 仍可用
      expect(authenticateAndConsume(tokenB).kind).toBe('ok');
    });

    it('全局用量按 UTC 日期记账', () => {
      const { token } = registerOk(DEVICE_A);
      authenticateAndConsume(token);

      const row = getDb()
        .prepare('SELECT calls FROM global_usage WHERE day = ?')
        .get(todayKey()) as unknown as { calls: number };

      expect(row.calls).toBe(1);
    });
  });

  describe('revokeDevice', () => {
    it('首次封禁返回 true，重复封禁返回 false（幂等）', () => {
      registerOk(DEVICE_A);
      expect(revokeDevice(DEVICE_A)).toBe(true);
      expect(revokeDevice(DEVICE_A)).toBe(false);
    });

    it('封禁不存在的设备返回 false', () => {
      expect(revokeDevice('0123456789abcdef')).toBe(false);
    });
  });
});
