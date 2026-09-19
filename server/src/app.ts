import express from 'express';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { getConservationSource } from './services/conservation';
import { cacheStats, invalidateCache } from './utils/cache';
import { getGlobalDailyLimit } from './config';
import { getGlobalUsage, todayKey } from './services/deviceService';

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
    // 缓存看板：改了上游数据却看不到效果时，用它确认是缓存而非逻辑问题；
    // stale = 已过期但仍被保留的条目（上游抖动时由它们兜底）
    cache: { size: cacheStats().size, stale: cacheStats().stale },
    // 配额看板：limit = 0 表示不限；used 为当日非白名单设备的累计调用数。
    // 想知道「我的 AI 额度今天被吃掉多少」时看这里。
    quota: { date: todayKey(), used: getGlobalUsage(), limit: getGlobalDailyLimit() },
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
