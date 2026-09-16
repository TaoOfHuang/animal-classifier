export const API_BASE_URL = 'http://10.0.2.2:3000';

// ── API Token ───────────────────────────────────────────────────────
// Set this to the token configured on the server (API_TOKEN env var).
// Leave as empty string to skip token authentication (development only).
export const API_TOKEN = 'animal-classifier-xyz-123';

/**
 * 是否使用后端 API。
 *
 * 之前 `searchService` 与 `taxonomyService` 各有一份私有常量，改一处不生效，
 * 排查时极易误判「后端没通」。现在只有这一处开关。
 */
export const USE_BACKEND_API_DEFAULT = true;

let backendApiEnabled = USE_BACKEND_API_DEFAULT;

export const isBackendApiEnabled = (): boolean => backendApiEnabled;

export const setBackendApiEnabled = (enabled: boolean): void => {
  backendApiEnabled = enabled;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
};

export class ApiError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * 请求后端并**解包 `{success, data}` 信封**。
 *
 * 这是本文件存在的核心原因：此前 5 处调用都把整个响应体当成 payload，
 * 于是 `data.results` / `data.items` 恒为 undefined。因为外层包着 try/catch
 * 且只 `console.warn`，失败会静默退回 mock 数据，肉眼完全看不出问题。
 */
export const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (API_TOKEN) {
    headers.Authorization = `Bearer ${API_TOKEN}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  let body: ApiEnvelope<T> | undefined;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    throw new ApiError(
      body?.error?.message || `Request failed: ${response.status}`,
      response.status,
      body?.error?.code,
    );
  }

  if (!body || body.success !== true) {
    throw new ApiError(
      body?.error?.message || 'Malformed API response: missing success/data envelope',
      response.status,
      body?.error?.code,
    );
  }

  return body.data as T;
};

/**
 * 统一的降级日志。历史实现用 `console.warn` 把真实故障吞掉了，
 * 导致「接口 404 / 信封没解」这类问题在生产里长期隐形。
 */
export const logApiFallback = (scope: string, path: string, error: unknown): void => {
  // eslint-disable-next-line no-console
  console.error(
    `[api] ${scope} failed for ${path}, falling back to local data:`,
    error instanceof Error ? error.message : error,
  );
};
