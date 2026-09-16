import express from 'express';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { getConservationSource } from './services/conservation';
import { cacheStats, invalidateCache } from './utils/cache';

export const app = express();

app.use(express.json({ limit: '10mb' }));
app.use('/api', apiRouter);

app.get('/health', (_req, res) => {
  let conservationSource: string = 'unknown';
  try {
    conservationSource = getConservationSource();
  } catch {
    conservationSource = 'invalid';
  }

  res.status(200).json({
    status: 'ok',
    conservationSource,
    // 缓存看板：改了上游数据却看不到效果时，用它确认是缓存而非逻辑问题
    cache: { size: cacheStats().size },
  });
});

/** 调试用：按前缀清掉 TTL 缓存，便于验证上游改动是否生效 */
app.post('/health/cache/invalidate', (req, res) => {
  const prefix = typeof req.query.prefix === 'string' ? req.query.prefix.trim() : '';

  if (!prefix) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_CACHE_PREFIX',
        message: 'query param "prefix" is required, e.g. ?prefix=itis:',
      },
    });
    return;
  }

  const removed = invalidateCache(prefix);
  res.status(200).json({ status: 'ok', removed, size: cacheStats().size });
});

app.use(notFoundHandler);
app.use(errorHandler);
