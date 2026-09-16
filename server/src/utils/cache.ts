type Entry = { value: unknown; expiresAt: number };

const store = new Map<string, Entry>();

/**
 * 进程内 TTL 缓存。loader 抛错时不落缓存，避免把失败结果固化。
 */
export const withCache = async <T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> => {
  const hit = store.get(key);
  const now = Date.now();

  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }
  if (hit) {
    store.delete(key);
  }

  const value = await loader();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
};

/** 按 key 前缀失效，返回清除的条目数。 */
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

export const cacheStats = (): { size: number; keys: string[] } => ({
  size: store.size,
  keys: [...store.keys()],
});
