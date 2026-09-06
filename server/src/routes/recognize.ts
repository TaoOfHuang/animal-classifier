import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { recognizeByImage } from '../services/recognitionService';

export const recognizeRouter = Router();

recognizeRouter.post(
  '/recognize',
  authMiddleware,
  async (req, res, next) => {
    const image = String(req.body?.image || '');
    try {
      const data = await recognizeByImage({ image });
      const remaining = (req as unknown as Record<string, number>)
        .dailyCallsRemaining;
      res.set('X-Daily-Calls-Remaining', String(remaining ?? ''));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);
