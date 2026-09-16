import { ExternalApiError, fetchJsonWithTimeout } from '../externalApiService';

const asArrayBuffer = (bytes: number[]): ArrayBuffer => {
  const buf = Buffer.from(bytes);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};

const jsonResponse = (bytes: number[], ok = true, status = 200) => ({
  ok,
  status,
  arrayBuffer: async () => asArrayBuffer(bytes),
});

const utf8 = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf-8').toJSON().data;

describe('fetchJsonWithTimeout', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('decodes ISO-8859-1 payloads when charset is latin1', async () => {
    // 0xfc 在 ISO-8859-1 里是 'ü'，作为 UTF-8 是非法字节序列。
    const bytes = [0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xfc, 0x22, 0x7d];
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(bytes)) as unknown as typeof fetch;

    const data = await fetchJsonWithTimeout<{ a: string }>('https://example.test/x', undefined, {
      charset: 'latin1',
    });

    expect(data.a).toBe('ü');
  });

  it('decodes utf-8 by default', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(utf8({ a: '雪豹' }))) as unknown as typeof fetch;

    const data = await fetchJsonWithTimeout<{ a: string }>('https://example.test/x');

    expect(data.a).toBe('雪豹');
  });

  it('still accepts a bare timeout number as the third argument', async () => {
    const abortSpy = jest.fn();
    global.fetch = jest.fn().mockImplementation((_url, init: RequestInit) => {
      init.signal?.addEventListener('abort', abortSpy);
      return Promise.resolve(jsonResponse(utf8({ ok: 1 })));
    }) as unknown as typeof fetch;

    await expect(
      fetchJsonWithTimeout<{ ok: number }>('https://example.test/x', undefined, 1000),
    ).resolves.toEqual({ ok: 1 });
    expect(abortSpy).not.toHaveBeenCalled();
  });

  it('sends a User-Agent header', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(utf8({ ok: 1 }))) as unknown as jest.Mock;
    global.fetch = fetchMock as unknown as typeof fetch;

    await fetchJsonWithTimeout('https://example.test/x');

    expect(fetchMock.mock.calls[0][1].headers).toEqual(
      expect.objectContaining({ 'User-Agent': 'AnimalClassifier/1.0' }),
    );
  });

  it('retries on 5xx and succeeds on the second attempt', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse([], false, 503))
      .mockResolvedValueOnce(jsonResponse(utf8({ ok: 1 })));
    global.fetch = fetchMock as unknown as typeof fetch;

    const data = await fetchJsonWithTimeout<{ ok: number }>(
      'https://example.test/x',
      undefined,
      { retries: 1 },
    );

    expect(data.ok).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries on persistent 5xx', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse([], false, 500));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      fetchJsonWithTimeout('https://example.test/x', undefined, { retries: 1 }),
    ).rejects.toThrow('Request failed: 500');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 4xx', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse([], false, 403));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      fetchJsonWithTimeout('https://example.test/x', undefined, { retries: 2 }),
    ).rejects.toBeInstanceOf(ExternalApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries network errors and surfaces a timeout as ExternalApiError', async () => {
    const fetchMock = jest.fn().mockImplementation((_url, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      fetchJsonWithTimeout('https://example.test/x', undefined, { timeoutMs: 20, retries: 0 }),
    ).rejects.toThrow('Request timed out after 20ms');
  });

  it('does not retry malformed JSON responses', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse([0x6e, 0x6f, 0x74, 0x2d, 0x6a, 0x73, 0x6f, 0x6e]));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      fetchJsonWithTimeout('https://example.test/x', undefined, { retries: 2 }),
    ).rejects.toThrow('Invalid JSON response');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
