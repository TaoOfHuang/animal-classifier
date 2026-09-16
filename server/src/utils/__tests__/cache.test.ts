import { cacheStats, clearCache, invalidateCache, withCache } from '../cache';

describe('withCache', () => {
  beforeEach(() => {
    clearCache();
    jest.useRealTimers();
  });

  it('returns the cached value without calling the loader twice', async () => {
    const loader = jest.fn().mockResolvedValue('value');

    expect(await withCache('itis:a', 60_000, loader)).toBe('value');
    expect(await withCache('itis:a', 60_000, loader)).toBe('value');

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reloads after the ttl expires', async () => {
    jest.useFakeTimers();
    const loader = jest.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');

    expect(await withCache('itis:b', 1000, loader)).toBe('first');

    jest.advanceTimersByTime(1001);

    expect(await withCache('itis:b', 1000, loader)).toBe('second');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not cache rejected loaders', async () => {
    const loader = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('ok');

    await expect(withCache('itis:c', 60_000, loader)).rejects.toThrow('boom');
    await expect(withCache('itis:c', 60_000, loader)).resolves.toBe('ok');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('invalidates entries by key prefix', async () => {
    const itis = jest.fn().mockResolvedValue('itis');
    const iucn = jest.fn().mockResolvedValue('iucn');

    await withCache('itis:down:180592', 60_000, itis);
    await withCache('iucn:15955', 60_000, iucn);

    expect(cacheStats().size).toBe(2);
    expect(invalidateCache('itis:')).toBe(1);
    expect(cacheStats().size).toBe(1);

    await withCache('itis:down:180592', 60_000, itis);
    await withCache('iucn:15955', 60_000, iucn);

    expect(itis).toHaveBeenCalledTimes(2);
    expect(iucn).toHaveBeenCalledTimes(1);
  });
});
