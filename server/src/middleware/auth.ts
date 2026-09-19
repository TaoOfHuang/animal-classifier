// 设备令牌鉴权中间件。
//
// 取代了原来的「全局共享 token 全等比较 + 全局内存计数」实现。
// 状态码语义见 docs/plans/2026-09-18-device-token-auth.md 第五节：
//
//   401 UNAUTHORIZED           凭证无效     → 客户端可重新注册后自愈
//   403 DEVICE_REVOKED         设备已封禁   → 客户端必须停止重试
//   429 DEVICE_QUOTA_EXCEEDED  单设备配额用尽 → 不可重试，更不可重新注册
//   429 GLOBAL_QUOTA_EXCEEDED  全局配额用尽   → 同上
//
// 区分这四者是为了让客户端能做出正确反应：**只有 401 允许触发重新注册**，
// 否则「换身份重置配额」就成了官方支持的绕过路径。

import { Request, Response, NextFunction } from 'express';
import { ApiErrorBody } from '../types/api';
import { authenticateAndConsume } from '../services/deviceService';
import { logger } from '../utils/logger';

type RequestWithQuota = Request & {
  dailyCallsRemaining?: number;
  deviceId?: string;
};

const extractToken = (req: Request): string => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const legacyHeader = req.headers['x-api-token'];
  if (typeof legacyHeader === 'string') {
    return legacyHeader.trim();
  }

  return '';
};

const reject = (
  res: Response<ApiErrorBody>,
  status: number,
  code: string,
  message: string,
  retryAfterSeconds?: number,
): void => {
  if (retryAfterSeconds !== undefined) {
    res.set('Retry-After', String(retryAfterSeconds));
  }
  res.status(status).json({ success: false, error: { code, message } });
};

export const authMiddleware = (
  req: Request,
  res: Response<ApiErrorBody>,
  next: NextFunction,
): void => {
  const outcome = authenticateAndConsume(extractToken(req));

  switch (outcome.kind) {
    case 'ok': {
      const withQuota = req as RequestWithQuota;
      withQuota.dailyCallsRemaining = outcome.remaining;
      withQuota.deviceId = outcome.device.deviceId;
      next();
      return;
    }

    case 'unauthorized':
      logger.warn(
        'auth',
        `✗ 401 invalid token ${req.method} ${req.path} from ${req.ip}`,
      );
      reject(
        res,
        401,
        'UNAUTHORIZED',
        'Missing or invalid device token. Register via POST /api/auth/device first.',
      );
      return;

    case 'revoked':
      logger.warn(
        'auth',
        `✗ 403 revoked device tried ${req.method} ${req.path} from ${req.ip}`,
      );
      reject(
        res,
        403,
        'DEVICE_REVOKED',
        'This device has been revoked and can no longer use the service.',
      );
      return;

    case 'device_quota_exceeded':
      logger.warn(
        'auth',
        `✗ 429 device quota exhausted ${req.method} ${req.path} from ${req.ip}`,
      );
      reject(
        res,
        429,
        'DEVICE_QUOTA_EXCEEDED',
        'Daily recognition limit reached for this device. Please try again tomorrow.',
        outcome.retryAfterSeconds,
      );
      return;

    case 'global_quota_exceeded':
      logger.warn(
        'auth',
        `✗ 429 global quota exhausted ${req.method} ${req.path} from ${req.ip}`,
      );
      reject(
        res,
        429,
        'GLOBAL_QUOTA_EXCEEDED',
        'Service daily capacity reached. Please try again tomorrow.',
        outcome.retryAfterSeconds,
      );
      return;
  }
};
