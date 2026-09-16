/**
 * 共享的外部 API 替身。真实报文切片见 `./fixtures.ts`。
 */

export type MockResponseInit = {
  ok?: boolean;
  status?: number;
  charset?: 'utf-8' | 'latin1';
};

/** 构造一个最小可用的 fetch Response 替身（只提供 arrayBuffer） */
export const mockJsonResponse = (payload: unknown, init: MockResponseInit = {}) => {
  const text = JSON.stringify(payload);
  const buffer = Buffer.from(text, init.charset === 'latin1' ? 'latin1' : 'utf-8');
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    arrayBuffer: async () =>
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };
};

export type RouteHandler = (url: string, init?: RequestInit) => unknown;

export type FetchMockOptions = {
  /** key 为 URL 子串，命中即用它构造响应 */
  routes: Record<string, RouteHandler>;
  /** 未命中任何路由时的兜底响应；不给则抛错（让漏 mock 立刻暴露） */
  fallback?: RouteHandler;
};

/**
 * 按 URL 子串路由的 fetch 替身。返回 jest.Mock，便于断言调用顺序与参数。
 */
export const createFetchMock = ({ routes, fallback }: FetchMockOptions) =>
  jest.fn(async (url: string, init?: RequestInit) => {
    const matched = Object.keys(routes).find(key => url.includes(key));

    if (!matched) {
      if (fallback) {
        return mockJsonResponse(await fallback(url, init));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }

    const result = await routes[matched](url, init);

    // 允许 handler 直接返回一个 Response 形态的对象
    if (result && typeof result === 'object' && 'ok' in (result as object)) {
      return result as ReturnType<typeof mockJsonResponse>;
    }

    return mockJsonResponse(result);
  });

export const installFetchMock = (mock: jest.Mock): jest.Mock => {
  global.fetch = mock as unknown as typeof fetch;
  return mock;
};

export const restoreFetch = (original: typeof fetch): void => {
  global.fetch = original;
};
