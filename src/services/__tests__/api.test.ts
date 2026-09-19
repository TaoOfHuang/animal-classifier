import { ApiError, requestJson } from '../api';
import { clearDeviceToken } from '../deviceAuth';

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response);

describe('requestJson 的错误分层', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('注入设备令牌作为 Bearer header', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse({ success: true, data: { ok: true } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await requestJson('/api/search');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-device-token',
    );
  });

  it('401 时清掉令牌并重试一次（凭证已失效，属于可自愈）', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { success: false, error: { code: 'UNAUTHORIZED' } },
          false,
          401,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { ok: true } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(requestJson<{ ok: boolean }>('/api/search')).resolves.toEqual({
      ok: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(clearDeviceToken).toHaveBeenCalledTimes(1);
  });

  it('连续两次 401 时只重试一次，然后把错误抛出', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'nope' } },
          false,
          401,
        ),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(requestJson('/api/search')).rejects.toBeInstanceOf(ApiError);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(clearDeviceToken).toHaveBeenCalledTimes(1);
  });

  // 这是方案里写死的约束：配额用尽或设备被封禁时若允许重新注册，
  // 「换身份重置配额」就会成为官方支持的绕过路径，单设备限额彻底失效。
  it.each([403, 429])('%i 不触发重新注册', async (status) => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { success: false, error: { code: 'X', message: 'blocked' } },
          false,
          status,
        ),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(requestJson('/api/search')).rejects.toMatchObject({ status });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(clearDeviceToken).not.toHaveBeenCalled();
  });

  it('解包 {success, data} 信封', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ success: true, data: { items: [1, 2] } }),
      ) as unknown as typeof fetch;

    await expect(requestJson('/api/search')).resolves.toEqual({ items: [1, 2] });
  });

  it('信封 success 为 false 时抛错', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ success: false, error: { code: 'BOOM', message: 'bad' } }),
      ) as unknown as typeof fetch;

    await expect(requestJson('/api/search')).rejects.toMatchObject({
      code: 'BOOM',
      message: 'bad',
    });
  });
});
