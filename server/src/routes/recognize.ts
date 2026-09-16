import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { recognizeByImage } from '../services/recognitionService';
import { logger } from '../utils/logger';

export const recognizeRouter = Router();

recognizeRouter.post(
  '/recognize',
  (req, _res, next) => {
    const imageSizeKb = Math.round((String(req.body?.image || '').length / 1024) * 10) / 10;
    logger.info('route', `→ POST /api/recognize from ${req.ip} image=${imageSizeKb}KB`);
    next();
  },
  authMiddleware,
  async (req, res, next) => {
    const startedAt = Date.now();
    const image = String(req.body?.image || '');
    try {
      const data = await recognizeByImage({ image });
      const remaining = (req as unknown as Record<string, number>)
        .dailyCallsRemaining;
      res.set('X-Daily-Calls-Remaining', String(remaining ?? ''));
      res.status(200).json({ success: true, data });
      logger.info(
        'route',
        `✓ POST /api/recognize 200 in ${Date.now() - startedAt}ms (${
          data?.animal?.commonNameZh || 'unknown'
        }), daily remaining=${remaining ?? 'n/a'}`,
      );
    } catch (error) {
      logger.error(
        'route',
        `✗ POST /api/recognize failed after ${Date.now() - startedAt}ms: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      next(error);
    }
  },
);
