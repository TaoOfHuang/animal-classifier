import { Router } from 'express';
import { searchAnimals } from '../services/searchService';

export const searchRouter = Router();

searchRouter.get('/search', (req, res) => {
  const q = String(req.query.q || '');
  const limit = Number(req.query.limit || 20);
  const offset = Number(req.query.offset || 0);

  const data = searchAnimals({ q, limit, offset });

  res.status(200).json({
    success: true,
    data,
  });
});
