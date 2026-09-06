import { Request, Response, NextFunction } from 'express';
import { ApiErrorBody } from '../types/api';

// ── In-memory daily call counter ────────────────────────────────────
// Key: "YYYY-MM-DD", Value: number of calls made today
const dailyCalls: Record<string, number> = {};

const DEFAULT_DAILY_LIMIT_NUM = 100;

const getTodayKey = (): string => new Date().toISOString().slice(0, 10);

const getDailyCalls = (): number => dailyCalls[getTodayKey()] || 0;

const incrementDailyCalls = (): void => {
  dailyCalls[getTodayKey()] = (dailyCalls[getTodayKey()] || 0) + 1;
};

// ── Public exports ──────────────────────────────────────────────────
const authMiddleware = (
  req: Request,
  res: Response<ApiErrorBody>,
  next: NextFunction,
): void => {
  // Read env vars at request time so tests can override them
  const API_TOKEN = process.env.API_TOKEN;
  const DAILY_LIMIT = Number(process.env.AI_RECOGNIZE_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT_NUM;

  // If no API_TOKEN is configured, skip auth (development / no-token mode)
  if (!API_TOKEN) {
    return next();
  }

  // Token extraction
  const authHeader = req.headers.authorization;
  let token: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    token = req.headers['x-api-token'] as string | null;
  }

  if (!token || token !== API_TOKEN) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid API token.',
      },
    });
    return;
  }

  // ── Daily rate limit ──────────────────────────────────────────────
  const count = getDailyCalls();
  if (count >= DAILY_LIMIT) {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Daily recognition limit reached (${DAILY_LIMIT} calls). Please try again tomorrow.`,
      },
    });
    return;
  }

  // Record this call
  incrementDailyCalls();

  // Attach call info for downstream logging if needed
  (req as Request & { dailyCallsRemaining?: number }).dailyCallsRemaining =
    DAILY_LIMIT - count - 1;

  next();
};

// ── Exposed for testing ─────────────────────────────────────────────
const resetDailyCounter = (): void => {
  Object.keys(dailyCalls).forEach((k) => delete dailyCalls[k]);
};

export { authMiddleware, getDailyCalls, getTodayKey, resetDailyCounter, DEFAULT_DAILY_LIMIT_NUM };
