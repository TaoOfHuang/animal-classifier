import { Router } from 'express';
import { getAnimalById } from '../services/animalService';
import { logger } from '../utils/logger';
export const animalRouter = Router();

animalRouter.get('/animal/:id', async (req, res) => {
  const id = decodeURIComponent(String(req.params.id || '')).trim();

  if (!id) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ANIMAL_ID', message: 'Animal id is required' },
    });
  }

  try {
    const data = await getAnimalById(id);

    if (!data) {
      // 查不到就是 404 —— 历史上这里恒返回硬编码的东北虎，前端永远看不出错
      return res.status(404).json({
        success: false,
        error: {
          code: 'ANIMAL_NOT_FOUND',
          message: `No animal found for "${id}"`,
        },
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    logger.error(
      'animal',
      `lookup failed for "${id}": ${err instanceof Error ? err.message : String(err)}`,
    );
    return res.status(502).json({
      success: false,
      error: {
        code: 'ANIMAL_UPSTREAM_FAILED',
        message: 'Animal data source unavailable',
      },
    });
  }
});
