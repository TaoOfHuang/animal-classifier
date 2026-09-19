import { logger } from './logger';

type Entry = { value: unknown; expiresAt: number };

const store = new Map<string, Entry>();

/** 旧值最多陈旧多久仍可用于兜底（默认 7 天）。超过则按未命中处理。 */
const DEFAULT_STALE_MAX_MS = 7 * 24 * 60 * 60 * 1000;

export type CacheOptions = {
  /**
   * 上游失败时是否允许用**已过期的旧值**兜底，默认开启。
   *
   * ITIS 这类 SOAP 派生老端点延迟在 2s ~ 20s+ 之间剧烈抖动，一次超时不该让整条
   * 请求降级成 502（前端随即退回 mock，肉眼只看到控制台报错）。分类树本身极稳定，
   * 陈旧的谱系数据远好过没有数据。
   */
  staleIfError?: boolean;
  /** 旧值允许陈旧多久（自 expiresAt 起算），默认 7 天。 */
  staleMaxMs?: number;
};

/**
 * 进程内 TTL 缓存。
 *
 * - loader 成功才写缓存，失败不落缓存（避免把失败结果固化）。
 * - **过期条目不立即删除**：loader 失败时用它兜底，把「上游抖动」挡在 502 之前。
 *
 * 注意：兜底只依赖本进程内存，服务重启后缓存为空，冷启动的第一次调用仍会直连上游。
 */
export const withCache = async <T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> => {
  const { staleIfError = true, staleMaxMs = DEFAULT_STALE_MAX_MS } = options;
  const hit = store.get(key);
  const now = Date.now();

  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }

  try {
    const value = await loader();
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  } catch (error) {
    const staleAge = hit ? Date.now() - hit.expiresAt : Number.POSITIVE_INFINITY;
    const reason = error instanceof Error ? error.message : String(error);

    if (!staleIfError || !hit || staleAge > staleMaxMs) {
      throw error;
    }

    logger.warn(
      'cache',
      `${key} upstream failed (${reason}); serving stale value expired ${Math.round(
        staleAge / 1000,
      )}s ago`,
    );
    return hit.value as T;
  }
};

/** 按 key 前缀失效，返回清除的条目数。硬删除——被清除的 key 不再有旧值可兜底。 */
export const invalidateCache = (prefix: string): number => {
  let removed = 0;
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      removed += 1;
    }
  }
  return removed;
};

export const clearCache = (): void => {
  store.clear();
};

export const cacheStats = (): { size: number; keys: string[]; stale: number } => {
  const now = Date.now();
  const keys = [...store.keys()];
  return {
    size: keys.length,
    keys,
    stale: keys.filter(key => (store.get(key)?.expiresAt ?? 0) <= now).length,
  };
};
