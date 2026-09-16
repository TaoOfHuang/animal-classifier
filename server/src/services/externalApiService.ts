const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RETRIES = 1;
const BACKOFF_BASE_MS = 300;

export const USER_AGENT = 'AnimalClassifier/1.0';

export type Charset = 'utf-8' | 'latin1';

export type RequestOptions = {
  timeoutMs?: number;
  charset?: Charset;
  retries?: number;
  headers?: Record<string, string>;
};

/**
 * 上游返回错误状态时抛出。`status` 为 undefined 表示网络层错误（超时 / DNS / 连接失败）。
 * `retriable` 决定是否值得重试：4xx 属于配置或入参问题，重试只浪费配额。
 */
export class ExternalApiError extends Error {
  readonly status?: number;
  readonly retriable: boolean;

  constructor(message: string, status?: number, retriable = false) {
    super(message);
    this.name = 'ExternalApiError';
    this.status = status;
    this.retriable = retriable;
  }
}

// WHATWG 编码标签。ITIS 的 json 端点实际返回 ISO-8859-1（响应头亦如此声明），
// 报文里含重音字符时用 UTF-8 解码会直接抛错。
const CHARSET_LABEL: Record<Charset, string> = {
  'utf-8': 'utf-8',
  latin1: 'iso-8859-1',
};

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const backoffMs = (attempt: number) => BACKOFF_BASE_MS * 3 ** attempt;

// 第三参数历史上是 `timeoutMs: number`，仍接受该形式以保持向后兼容。
const normalizeOptions = (options: RequestOptions | number): RequestOptions =>
  typeof options === 'number' ? { timeoutMs: options } : options;

const requestOnce = async <T>(
  url: string,
  init: RequestInit | undefined,
  options: Required<Pick<RequestOptions, 'timeoutMs' | 'charset'>> &
    Pick<RequestOptions, 'headers'>,
): Promise<T> => {
  const { timeoutMs, charset, headers } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'User-Agent': USER_AGENT,
        ...headers,
        ...(init?.headers as Record<string, string> | undefined),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ExternalApiError(
        `Request failed: ${response.status}`,
        response.status,
        response.status >= 500,
      );
    }

    if (typeof response.arrayBuffer === 'function') {
      const buffer = await response.arrayBuffer();
      const text = new TextDecoder(CHARSET_LABEL[charset]).decode(buffer);
      return JSON.parse(text) as T;
    }

    // 某些测试替身只提供 json()，退回到它（真实 fetch 永远有 arrayBuffer）。
    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof ExternalApiError) {
      throw err;
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ExternalApiError(`Request timed out after ${timeoutMs}ms`, undefined, true);
    }
    if (err instanceof SyntaxError) {
      // 上游返回了非法 JSON —— 重试通常无用。
      throw new ExternalApiError(`Invalid JSON response: ${err.message}`, undefined, false);
    }
    // 网络层错误（DNS / 连接被拒 / socket 中断）值得重试。
    const reason = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw new ExternalApiError(reason, undefined, true);
  } finally {
    clearTimeout(timeoutId);
  }
};

export const fetchJsonWithTimeout = async <T>(
  url: string,
  init?: RequestInit,
  options: RequestOptions | number = {},
): Promise<T> => {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, charset = 'utf-8', retries = DEFAULT_RETRIES, headers } =
    normalizeOptions(options);

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestOnce<T>(url, init, { timeoutMs, charset, headers });
    } catch (err) {
      lastError = err;
      const retriable = err instanceof ExternalApiError && err.retriable;
      if (!retriable || attempt === retries) {
        throw err;
      }
      await sleep(backoffMs(attempt));
    }
  }

  throw lastError;
};
