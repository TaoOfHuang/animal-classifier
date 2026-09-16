import { Router } from 'express';
import { z } from 'zod';
import { getSearchSuggestions, searchAnimals } from '../services/searchService';
import { logger } from '../utils/logger';

export const searchRouter = Router();

const querySchema = z.object({
  q: z.string().trim().max(120).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

searchRouter.get('/search', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_SEARCH_QUERY', message: parsed.error.issues[0].message },
    });
  }

  const { q, limit, offset } = parsed.data;

  if (!q) {
    return res.status(200).json({ success: true, data: { total: 0, items: [], hasMore: false } });
  }

  try {
    const data = await searchAnimals({ q, limit, offset });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    logger.warn(
      'search',
      `search failed for "${q}": ${err instanceof Error ? err.message : String(err)}`,
    );
    return res.status(200).json({ success: true, data: { total: 0, items: [], hasMore: false } });
  }
});

/** GET /api/search/suggestions?q=虎&limit=5 → { suggestions: string[] } */
searchRouter.get('/search/suggestions', async (req, res) => {
  const parsed = z
    .object({
      q: z.string().trim().max(120).default(''),
      limit: z.coerce.number().int().min(1).max(20).default(5),
    })
    .safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_SEARCH_QUERY', message: parsed.error.issues[0].message },
    });
  }

  const { q, limit } = parsed.data;
  const suggestions = await getSearchSuggestions(q, limit);

  return res.status(200).json({ success: true, data: { suggestions } });
});
