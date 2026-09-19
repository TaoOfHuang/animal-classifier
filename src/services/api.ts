import { API_BASE_URL, DEV_API_BASE_URL, PROD_API_BASE_URL } from './apiConfig';
import { clearDeviceToken, getDeviceToken } from './deviceAuth';

// 地址常量已移到 ./apiConfig（那里不依赖任何模块，避免与 deviceAuth 形成循环依赖）。
// 这里 re-export 是为了不改动既有引用方。
export { API_BASE_URL, DEV_API_BASE_URL, PROD_API_BASE_URL };

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
 * 令牌不再来自编译期常量，而是**运行时向服务端注册换取**。
 *
 * 旧的 `API_TOKEN` 是写死进 bundle 的共享密钥：泄露后影响所有用户，且无法单独
 * 撤销任何一台设备。现在每台设备一个可撤销的令牌，见 ./deviceAuth。
 */
const buildHeaders = async (
  init?: RequestInit,
): Promise<Record<string, string>> => {
  const token = await getDeviceToken();

  return {
    Accept: 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${token}`,
  };
};

/**
 * 带一次自愈机会的请求。
 *
 * ⚠️ **只有 401 允许触发重新注册**：
 *   - 401 凭证无效   → 清掉本地令牌，重新注册一次后重试（本函数处理）
 *   - 403 设备已封禁 → 重试无意义，直接抛出
 *   - 429 配额用尽   → **绝不能重新注册**，否则「换身份重置配额」就成了官方
 *                      支持的绕过路径，单设备限额会彻底形同虚设
 */
const requestWithRecovery = async <T>(
  path: string,
  init: RequestInit | undefined,
  allowReRegister: boolean,
): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: await buildHeaders(init),
  });

  if (response.status === 401 && allowReRegister) {
    await clearDeviceToken();
    return requestWithRecovery<T>(path, init, false);
  }

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
 * 请求后端并**解包 `{success, data}` 信封**。
 *
 * 这是本文件存在的核心原因：此前 5 处调用都把整个响应体当成 payload，
 * 于是 `data.results` / `data.items` 恒为 undefined。因为外层包着 try/catch
 * 且只 `console.warn`，失败会静默退回 mock 数据，肉眼完全看不出问题。
 */
export const requestJson = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => requestWithRecovery<T>(path, init, true);

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
