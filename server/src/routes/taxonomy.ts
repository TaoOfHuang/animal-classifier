import { Response, Router } from 'express';
import { z } from 'zod';
import { TaxonomyLevel } from '../constants/taxonomy';
import { isTaxonomyLevel } from '../types/taxonomy';
import {
  getTaxonomyChildren,
  getTaxonomyDetail,
  searchTaxonomy,
} from '../services/taxonomyService';
import { logger } from '../utils/logger';

export const taxonomyRouter = Router();

// 学名 / 通用名 / 中文名都可能经由 URL 传入。放进白名单，避免把任意字符串
// 原样拼进 ITIS 查询串（历史上这里是完全未校验的）。
const NAME_PATTERN = /^[\p{L}\p{N}\s.'’\-()×,，·]+$/u;

const nameSchema = z
  .string()
  .trim()
  .min(1, 'name is required')
  .max(120, 'name is too long')
  .regex(NAME_PATTERN, 'name contains unsupported characters');

const levelSchema = z
  .string()
  .trim()
  .refine(isTaxonomyLevel, { message: 'invalid taxonomy level' });

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const decodeName = (raw: string): string => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const sendError = (
  res: Parameters<Parameters<typeof taxonomyRouter.get>[1]>[1],
  status: number,
  code: string,
  message: string,
) => res.status(status).json({ success: false, error: { code, message } });

/** GET /api/taxonomy/search?q=虎&level=family */
taxonomyRouter.get('/taxonomy/search', async (req, res) => {
  const parsed = z
    .object({
      q: z.string().trim().min(1).max(120),
      level: levelSchema.optional(),
    })
    .safeParse(req.query);

  if (!parsed.success) {
    return sendError(res, 400, 'INVALID_TAXONOMY_QUERY', parsed.error.issues[0].message);
  }

  try {
    const nodes = await searchTaxonomy(parsed.data.q);
    const results = parsed.data.level
      ? nodes.filter(node => node.level === parsed.data.level)
      : nodes;
    return res.status(200).json({ success: true, data: { results } });
  } catch (err) {
    logger.warn(
      'taxonomy',
      `search failed for "${parsed.data.q}": ${err instanceof Error ? err.message : String(err)}`,
    );
    // 检索失败降级为空结果，而不是让前端拿到 500
    return res.status(200).json({ success: true, data: { results: [] } });
  }
});

/** GET /api/taxonomy/:level/:name/children?limit=10&offset=0 */
taxonomyRouter.get('/taxonomy/:level/:name/children', async (req, res) => {
  const levelResult = levelSchema.safeParse(req.params.level);
  const nameResult = nameSchema.safeParse(decodeName(String(req.params.name ?? '')));
  const pageResult = paginationSchema.safeParse(req.query);

  if (!levelResult.success) {
    return sendError(res, 400, 'INVALID_TAXONOMY_LEVEL', 'invalid taxonomy level');
  }
  if (!nameResult.success) {
    return sendError(res, 400, 'INVALID_TAXONOMY_QUERY', nameResult.error.issues[0].message);
  }
  if (!pageResult.success) {
    return sendError(res, 400, 'INVALID_TAXONOMY_QUERY', pageResult.error.issues[0].message);
  }

  const level = levelResult.data as TaxonomyLevel;
  const { limit, offset } = pageResult.data;

  try {
    const page = await getTaxonomyChildren(level, nameResult.data, limit, offset);
    if (!page) {
      return sendError(
        res,
        404,
        'TAXONOMY_NOT_FOUND',
        `No taxonomy node found for ${level}/${nameResult.data}`,
      );
    }
    return res.status(200).json({ success: true, data: page });
  } catch (err) {
    logger.error(
      'taxonomy',
      `children lookup failed for ${level}/${nameResult.data}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return sendError(res, 502, 'TAXONOMY_UPSTREAM_FAILED', 'Taxonomy service unavailable');
  }
});

/** GET /api/taxonomy/:level/:name → { current, parent?, childCount } */
taxonomyRouter.get('/taxonomy/:level/:name', async (req, res) => {
  const levelResult = levelSchema.safeParse(req.params.level);
  const nameResult = nameSchema.safeParse(decodeName(String(req.params.name ?? '')));

  if (!levelResult.success) {
    return sendError(res, 400, 'INVALID_TAXONOMY_LEVEL', 'invalid taxonomy level');
  }
  if (!nameResult.success) {
    return sendError(res, 400, 'INVALID_TAXONOMY_QUERY', nameResult.error.issues[0].message);
  }

  const level = levelResult.data as TaxonomyLevel;

  try {
    const detail = await getTaxonomyDetail(level, nameResult.data);
    if (!detail) {
      return sendError(
        res,
        404,
        'TAXONOMY_NOT_FOUND',
        `No taxonomy node found for ${level}/${nameResult.data}`,
      );
    }
    return res.status(200).json({ success: true, data: detail });
  } catch (err) {
    logger.error(
      'taxonomy',
      `detail lookup failed for ${level}/${nameResult.data}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return sendError(res, 502, 'TAXONOMY_UPSTREAM_FAILED', 'Taxonomy service unavailable');
  }
});
