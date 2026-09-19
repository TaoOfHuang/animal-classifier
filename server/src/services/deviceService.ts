// 设备令牌服务。
//
// 设计见 docs/plans/2026-09-18-device-token-auth.md。
//
// 核心不变式（改动本文件时必须保持）：
//  1. deviceId 是「身份」，token 只是「钥匙」。配额与封禁都挂在 deviceId 上。
//  2. 因此换令牌 ≠ 换身份：重新注册**不得**重置当日用量。
//  3. 封禁检查必须发生在签发令牌之前，否则被封设备重注册即可复活。
//  4. token 只存 sha256，明文绝不落库。

import { createHash, randomBytes } from 'node:crypto';
import {
  getDeviceDailyLimit,
  getGlobalDailyLimit,
  getMaxDeviceCount,
  getRegisterRateLimitPerHour,
  getWhitelistDeviceIds,
} from '../config';
import { getDb } from '../db';
import { logger } from '../utils/logger';

/** deviceId 允许的形态：16~64 位的十六进制（ANDROID_ID 为 16 位，UUID 为 36 位含连字符） */
export const DEVICE_ID_PATTERN = /^[0-9a-fA-F-]{16,64}$/;

const TOKEN_BYTES = 32;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const REGISTER_LOG_RETENTION_MS = 24 * 60 * 60 * 1000;

/** 每日分界按 UTC，与改造前的 getTodayKey 保持一致 */
export const todayKey = (): string => new Date().toISOString().slice(0, 10);

const secondsUntilUtcMidnight = (): number => {
  const now = new Date();
  const nextMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(1, Math.ceil((nextMidnight - now.getTime()) / 1000));
};

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const generateToken = (): string => randomBytes(TOKEN_BYTES).toString('hex');

/** node:sqlite 返回 Record<string, SQLOutputValue>，这里统一收窄 */
const num = (value: unknown): number => Number(value ?? 0);
const isRevoked = (value: unknown): boolean => value !== null && value !== undefined;

type DeviceRow = {
  id: number;
  device_id: string;
  whitelisted: number;
  revoked_at: number | null;
};

export type DeviceIdentity = {
  rowId: number;
  deviceId: string;
  dailyLimit: number;
  whitelisted: boolean;
};

export type AuthOutcome =
  | { kind: 'ok'; device: DeviceIdentity; remaining: number }
  | { kind: 'unauthorized' }
  | { kind: 'revoked' }
  | { kind: 'device_quota_exceeded'; retryAfterSeconds: number }
  | { kind: 'global_quota_exceeded'; retryAfterSeconds: number };

/**
 * 校验设备令牌并**占用一次配额**。
 *
 * 这是请求路径上的唯一入口：返回 ok 就意味着已经记过账，调用方无需再计数。
 * 两种配额耗尽都返回 429（靠 error.code 区分），因为都不可通过重新注册自愈。
 */
export const authenticateAndConsume = (token: string): AuthOutcome => {
  if (!token) {
    return { kind: 'unauthorized' };
  }

  const db = getDb();
  const row = db
    .prepare(
      'SELECT id, device_id, whitelisted, revoked_at FROM devices WHERE token_hash = ?',
    )
    .get(hashToken(token)) as unknown as DeviceRow | undefined;

  if (!row) {
    return { kind: 'unauthorized' };
  }

  // 封禁判定先于配额判定：被封设备不该收到「配额用尽」这种可重试信号
  if (isRevoked(row.revoked_at)) {
    return { kind: 'revoked' };
  }

  const day = todayKey();
  const device: DeviceIdentity = {
    rowId: num(row.id),
    deviceId: String(row.device_id),
    // 配额只以配置为准（不落库），这样改了 DEVICE_DAILY_LIMIT 立即对所有设备生效
    dailyLimit: getDeviceDailyLimit(),
    whitelisted: num(row.whitelisted) === 1,
  };

  // ── 1. 单设备配额 ────────────────────────────────────────────────
  const usedRow = db
    .prepare('SELECT calls FROM usage_daily WHERE device_row_id = ? AND day = ?')
    .get(device.rowId, day) as unknown as { calls: number } | undefined;
  const used = num(usedRow?.calls);

  if (device.dailyLimit > 0 && used >= device.dailyLimit) {
    return {
      kind: 'device_quota_exceeded',
      retryAfterSeconds: secondsUntilUtcMidnight(),
    };
  }

  // ── 2. 全局配额（白名单设备不参与） ──────────────────────────────
  const globalLimit = getGlobalDailyLimit();
  if (globalLimit > 0 && !device.whitelisted) {
    const globalRow = db
      .prepare('SELECT calls FROM global_usage WHERE day = ?')
      .get(day) as unknown as { calls: number } | undefined;
    if (num(globalRow?.calls) >= globalLimit) {
      return {
        kind: 'global_quota_exceeded',
        retryAfterSeconds: secondsUntilUtcMidnight(),
      };
    }
  }

  // ── 3. 记账：两层必须一起成功或一起失败，否则配额会被记漏 ────────
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `INSERT INTO usage_daily (device_row_id, day, calls) VALUES (?, ?, 1)
       ON CONFLICT(device_row_id, day) DO UPDATE SET calls = calls + 1`,
    ).run(device.rowId, day);

    if (!device.whitelisted) {
      db.prepare(
        `INSERT INTO global_usage (day, calls) VALUES (?, 1)
         ON CONFLICT(day) DO UPDATE SET calls = calls + 1`,
      ).run(day);
    }

    db.prepare('UPDATE devices SET last_seen_at = ? WHERE id = ?').run(
      Date.now(),
      device.rowId,
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return {
    kind: 'ok',
    device,
    // -1 表示该设备不限量（dailyLimit = 0）
    remaining:
      device.dailyLimit > 0 ? Math.max(0, device.dailyLimit - used - 1) : -1,
  };
};

export type RegisterOutcome =
  | { kind: 'ok'; token: string; dailyLimit: number; isNewDevice: boolean }
  | { kind: 'invalid_device_id' }
  | { kind: 'register_rate_limited'; retryAfterSeconds: number }
  | { kind: 'too_many_devices' }
  | { kind: 'revoked' };

/**
 * 注册设备并签发令牌。已存在的 deviceId 会轮换令牌并**保留当日用量**。
 *
 * 注意：这是公开端点。它的存在使得「拿到令牌」是零成本的，因此设备令牌
 * 本身不构成安全边界——真正的边界是 GLOBAL_DAILY_LIMIT。详见方案文档第三节。
 */
export const registerDevice = (
  deviceId: string,
  ip: string,
): RegisterOutcome => {
  const normalized = deviceId.trim().toLowerCase();

  if (!DEVICE_ID_PATTERN.test(normalized)) {
    return { kind: 'invalid_device_id' };
  }

  const db = getDb();
  const now = Date.now();

  // ── 注册节流：按 IP。放在最前，避免该端点被用来刷日志或做 DoS ────
  const rateLimit = getRegisterRateLimitPerHour();
  if (rateLimit > 0) {
    const hit = db
      .prepare(
        'SELECT COUNT(*) AS c FROM register_log WHERE ip = ? AND created_at >= ?',
      )
      .get(ip, now - REGISTER_WINDOW_MS) as unknown as { c: number } | undefined;
    if (num(hit?.c) >= rateLimit) {
      logger.warn('device', `✗ register rate limit hit for ip ${ip}`);
      return { kind: 'register_rate_limited', retryAfterSeconds: 3600 };
    }
  }

  const existing = db
    .prepare('SELECT id, revoked_at FROM devices WHERE device_id = ?')
    .get(normalized) as unknown as
    | { id: number; revoked_at: number | null }
    | undefined;

  // ── 封禁检查必须先于签发 ────────────────────────────────────────
  if (existing && isRevoked(existing.revoked_at)) {
    logger.warn(
      'device',
      `✗ rejected re-registration of revoked device ${normalized} from ${ip}`,
    );
    return { kind: 'revoked' };
  }

  const recordAttempt = (): void => {
    db.prepare('INSERT INTO register_log (ip, created_at) VALUES (?, ?)').run(
      ip,
      now,
    );
    // 顺手清理窗口外的记录，避免表无限增长
    db.prepare('DELETE FROM register_log WHERE created_at < ?').run(
      now - REGISTER_LOG_RETENTION_MS,
    );
  };

  if (existing) {
    // 已知设备：换钥匙不换身份 —— 当日用量原样保留
    const token = generateToken();
    db.prepare(
      'UPDATE devices SET token_hash = ?, last_seen_at = ? WHERE id = ?',
    ).run(hashToken(token), now, num(existing.id));
    recordAttempt();

    logger.info('device', `↻ rotated token for known device ${normalized}`);
    return {
      kind: 'ok',
      token,
      dailyLimit: getDeviceDailyLimit(),
      isNewDevice: false,
    };
  }

  // ── 新设备：受设备总数上限约束 ──────────────────────────────────
  const maxDevices = getMaxDeviceCount();
  if (maxDevices > 0) {
    const total = db.prepare('SELECT COUNT(*) AS c FROM devices').get() as unknown as {
      c: number;
    };
    if (num(total.c) >= maxDevices) {
      logger.warn(
        'device',
        `✗ device cap reached (${maxDevices}), rejecting ${normalized}`,
      );
      return { kind: 'too_many_devices' };
    }
  }

  const token = generateToken();
  const whitelisted = getWhitelistDeviceIds().includes(normalized) ? 1 : 0;

  // daily_limit 不落库：配额始终以配置为准，改了 DEVICE_DAILY_LIMIT 立即生效
  db.prepare(
    `INSERT INTO devices (device_id, token_hash, whitelisted, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(normalized, hashToken(token), whitelisted, now, now);

  recordAttempt();
  logger.info(
    'device',
    `+ registered new device ${normalized}${whitelisted ? ' (whitelisted)' : ''}`,
  );

  // 回给客户端的配额值取自当前配置，仅供客户端展示
  return {
    kind: 'ok',
    token,
    dailyLimit: getDeviceDailyLimit(),
    isNewDevice: true,
  };
};

/** 封禁设备。返回 true 表示本次确实改变了状态（幂等） */
export const revokeDevice = (deviceId: string): boolean => {
  const normalized = deviceId.trim().toLowerCase();
  const db = getDb();
  const result = db
    .prepare(
      'UPDATE devices SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL',
    )
    .run(Date.now(), normalized);

  if (num(result.changes) > 0) {
    logger.info('device', `! revoked device ${normalized}`);
    return true;
  }
  return false;
};

/** 当前全局用量，供 /health 或运维排查使用 */
export const getGlobalUsage = (day = todayKey()): number => {
  const row = getDb()
    .prepare('SELECT calls FROM global_usage WHERE day = ?')
    .get(day) as unknown as { calls: number } | undefined;
  return num(row?.calls);
};
