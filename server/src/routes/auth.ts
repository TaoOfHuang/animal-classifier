// 设备注册与封禁端点。
//
// POST /api/auth/device  公开：用 deviceId 换取设备令牌
// POST /api/auth/revoke  需管理员令牌：封禁指定设备
//
// 设计见 docs/plans/2026-09-18-device-token-auth.md 第五节。

import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { getAdminToken } from '../config';
import { registerDevice, revokeDevice } from '../services/deviceService';
import { logger } from '../utils/logger';

export const authRouter = Router();

/** 常数时间比较，避免通过响应时间逐字节试探管理员令牌 */
const safeEqual = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
};

const readDeviceId = (body: unknown): string => {
  const record = (body ?? {}) as Record<string, unknown>;
  return typeof record.deviceId === 'string' ? record.deviceId : '';
};

authRouter.post('/auth/device', (req, res) => {
  const deviceId = readDeviceId(req.body);
  const ip = req.ip || 'unknown';
  const outcome = registerDevice(deviceId, ip);

  switch (outcome.kind) {
    case 'ok':
      logger.info(
        'route',
        `→ POST /api/auth/device 200 (${outcome.isNewDevice ? 'new device' : 'known device'})`,
      );
      res.status(200).json({
        success: true,
        data: { token: outcome.token, dailyLimit: outcome.dailyLimit },
      });
      return;

    case 'invalid_device_id':
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DEVICE_ID',
          message:
            'deviceId must be 16-64 characters of hexadecimal (dashes allowed).',
        },
      });
      return;

    case 'register_rate_limited':
      res.set('Retry-After', String(outcome.retryAfterSeconds));
      res.status(429).json({
        success: false,
        error: {
          code: 'REGISTER_RATE_LIMITED',
          message: 'Too many registrations from this address. Please try again later.',
        },
      });
      return;

    case 'too_many_devices':
      res.status(503).json({
        success: false,
        error: {
          code: 'DEVICE_CAP_REACHED',
          message: 'Device registration capacity has been reached.',
        },
      });
      return;

    case 'revoked':
      res.status(403).json({
        success: false,
        error: {
          code: 'DEVICE_REVOKED',
          message: 'This device has been revoked and cannot be registered again.',
        },
      });
      return;
  }
});

authRouter.post('/auth/revoke', (req, res) => {
  const adminToken = getAdminToken();

  // 未配置管理员令牌时直接拒绝，避免出现「无鉴权的封禁接口」
  if (!adminToken) {
    res.status(503).json({
      success: false,
      error: {
        code: 'ADMIN_DISABLED',
        message: 'ADMIN_TOKEN is not configured on the server.',
      },
    });
    return;
  }

  const authHeader = req.headers.authorization;
  const provided =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : String(req.headers['x-admin-token'] || '').trim();

  if (!provided || !safeEqual(provided, adminToken)) {
    logger.warn('auth', `✗ 401 admin token rejected from ${req.ip}`);
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid admin token.' },
    });
    return;
  }

  const deviceId = readDeviceId(req.body);
  if (!deviceId.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_DEVICE_ID', message: 'deviceId is required.' },
    });
    return;
  }

  const changed = revokeDevice(deviceId);
  res.status(200).json({
    success: true,
    data: {
      deviceId: deviceId.trim().toLowerCase(),
      revoked: changed,
      // 幂等：重复封禁仍返回 200，用该字段区分
      alreadyRevoked: !changed,
    },
  });
});
