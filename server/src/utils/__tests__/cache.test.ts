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

describe('withCache stale fallback', () => {
  beforeEach(() => {
    clearCache();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('serves the expired value and warns when the loader fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const loader = jest
      .fn()
      .mockResolvedValueOnce('first')
      .mockRejectedValueOnce(new Error('Request timed out after 5000ms'));

    expect(await withCache('itis:stale', 1000, loader)).toBe('first');

    jest.advanceTimersByTime(5000);

    await expect(withCache('itis:stale', 1000, loader)).resolves.toBe('first');
    expect(loader).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('serving stale value expired 4s ago'),
    );
  });

  it('keeps serving stale on repeated failures without dropping the entry', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const loader = jest.fn().mockResolvedValueOnce('first').mockRejectedValue(new Error('boom'));

    await withCache('itis:stale2', 1000, loader);
    jest.advanceTimersByTime(2000);

    await expect(withCache('itis:stale2', 1000, loader)).resolves.toBe('first');
    await expect(withCache('itis:stale2', 1000, loader)).resolves.toBe('first');
    expect(cacheStats()).toMatchObject({ size: 1, stale: 1 });
  });

  it('still rejects when there is no previous value to fall back on', async () => {
    const loader = jest.fn().mockRejectedValueOnce(new Error('boom'));

    await expect(withCache('itis:cold', 1000, loader)).rejects.toThrow('boom');
    expect(cacheStats().size).toBe(0);
  });

  it('rethrows when staleIfError is disabled', async () => {
    const loader = jest.fn().mockResolvedValueOnce('first').mockRejectedValueOnce(new Error('boom'));

    await withCache('itis:nostale', 1000, loader);
    jest.advanceTimersByTime(2000);

    await expect(
      withCache('itis:nostale', 1000, loader, { staleIfError: false }),
    ).rejects.toThrow('boom');
  });

  it('rethrows when the retained value is older than staleMaxMs', async () => {
    const loader = jest.fn().mockResolvedValueOnce('first').mockRejectedValueOnce(new Error('boom'));

    await withCache('itis:ancient', 1000, loader);
    jest.advanceTimersByTime(10_000);

    await expect(
      withCache('itis:ancient', 1000, loader, { staleMaxMs: 5000 }),
    ).rejects.toThrow('boom');
  });

  it('replaces stale with fresh data once the loader recovers', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const loader = jest
      .fn()
      .mockResolvedValueOnce('first')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('third');

    await withCache('itis:recover', 1000, loader);
    jest.advanceTimersByTime(2000);
    await expect(withCache('itis:recover', 1000, loader)).resolves.toBe('first');
    await expect(withCache('itis:recover', 1000, loader)).resolves.toBe('third');

    expect(cacheStats()).toMatchObject({ size: 1, stale: 0 });
  });

  it('reports expired entries as stale instead of dropping them', async () => {
    await withCache('itis:d', 1000, jest.fn().mockResolvedValue('v'));
    expect(cacheStats()).toMatchObject({ size: 1, stale: 0 });

    jest.advanceTimersByTime(1500);

    expect(cacheStats()).toMatchObject({ size: 1, stale: 1 });
    expect(cacheStats().keys).toEqual(['itis:d']);
  });
});
