// 设备注册与令牌管理。
//
// 设计见 docs/plans/2026-09-18-device-token-auth.md 第八节。
//
// 核心概念：**deviceId 是身份，token 只是钥匙。**
// 服务端把配额与封禁都挂在 deviceId 上，所以：
//   - 只换 token（清缓存）→ 服务端认得出是同一台设备 → 配额与封禁原样保留
//   - 换掉 deviceId       → 服务端只能当成新设备 → 单设备限额被重置
//
// 因此 deviceId 必须取自**系统级稳定标识**，不能是本地随机数。

import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { API_BASE_URL } from './apiConfig';

const TOKEN_STORAGE_KEY = '@animal_classifier:device_token';
const FALLBACK_ID_STORAGE_KEY = '@animal_classifier:fallback_device_id';

/** 与服务端 DEVICE_ID_PATTERN 保持一致 */
const DEVICE_ID_PATTERN = /^[0-9a-f]{16,64}$/;

/** 内存缓存：命中后不再读 AsyncStorage */
let cachedToken: string | null = null;
/** 并发去重：多个请求同时收到 401 时只注册一次 */
let inflightRegistration: Promise<string> | null = null;

export class DeviceAuthError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'DeviceAuthError';
    this.status = status;
    this.code = code;
  }
}

type RegisterApiResponse = {
  success: boolean;
  data?: { token: string; dailyLimit: number };
  error?: { code?: string; message?: string };
};

const normalizeDeviceId = (raw: unknown): string | null => {
  const cleaned = String(raw ?? '')
    .replace(/[^0-9a-fA-F-]/g, '')
    .replace(/-/g, '')
    .toLowerCase();

  return DEVICE_ID_PATTERN.test(cleaned) ? cleaned : null;
};

/**
 * 读取系统级设备标识。
 *
 * Android 8.0+ 上 `getUniqueId()` 返回 ANDROID_ID，其取值是
 * 「应用签名密钥 + 用户 + 设备」三者的哈希，因此：
 *   - 清应用数据 → 不变
 *   - 卸载重装（同签名）→ 不变
 *   - 改签名重打包 → 会变（这正是把攻击成本抬高的地方）
 */
const readSystemDeviceId = async (): Promise<string | null> => {
  try {
    const uniqueId = await DeviceInfo.getUniqueId();
    const normalized = normalizeDeviceId(uniqueId);

    if (!normalized) {
      console.warn(
        '[deviceAuth] 系统设备标识格式不符，将降级为本地随机 ID：',
        uniqueId,
      );
    }
    return normalized;
  } catch (error) {
    // 原生模块未链接、或在非 Android/iOS 环境调用时会走到这里。
    // 注意：不要改用 `await import(...)`——Jest 的 VM 环境不支持动态 import
    // （ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG），会让本模块无法被测试。
    console.warn(
      '[deviceAuth] 无法读取系统设备标识（原生模块可能未链接），将降级为本地随机 ID。' +
        '注意：本地随机 ID 在清应用数据后会变化，届时单设备限额会被绕过。',
      error,
    );
    return null;
  }
};

/** 降级标识：仅当拿不到系统标识时使用，缺点明确（清数据即失效） */
const readFallbackDeviceId = async (): Promise<string> => {
  const stored = normalizeDeviceId(
    await AsyncStorage.getItem(FALLBACK_ID_STORAGE_KEY),
  );
  if (stored) {
    return stored;
  }

  let created = '';
  for (let index = 0; index < 32; index += 1) {
    created += Math.floor(Math.random() * 16).toString(16);
  }
  await AsyncStorage.setItem(FALLBACK_ID_STORAGE_KEY, created);
  return created;
};

/**
 * 解析本次使用的 deviceId。
 *
 * 优先系统标识（稳定，能防住「清数据绕过」）；拿不到时才降级为本地随机 ID，
 * 并打印告警——降级路径下服务端的单设备限额与封禁都可能被绕过，
 * 只剩 GLOBAL_DAILY_LIMIT 这道硬边界。
 */
export const resolveDeviceId = async (): Promise<string> =>
  (await readSystemDeviceId()) ?? readFallbackDeviceId();

/** 供调试页/日志查看当前设备标识是否稳定 */
export const describeDeviceIdSource = async (): Promise<{
  deviceId: string;
  stable: boolean;
}> => {
  const systemId = await readSystemDeviceId();
  if (systemId) {
    return { deviceId: systemId, stable: true };
  }
  return { deviceId: await readFallbackDeviceId(), stable: false };
};

/**
 * 注册设备并换取令牌。
 *
 * 服务端行为（见方案文档第五节）：
 *   - 已封禁设备 → 403，客户端**不应重试**
 *   - 已知设备   → 轮换令牌，但**保留当日用量**
 */
export const registerDevice = async (): Promise<string> => {
  if (inflightRegistration) {
    return inflightRegistration;
  }

  inflightRegistration = (async () => {
    const deviceId = await resolveDeviceId();

    const response = await fetch(`${API_BASE_URL}/api/auth/device`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceId }),
    });

    const body = (await response
      .json()
      .catch(() => undefined)) as RegisterApiResponse | undefined;

    if (!response.ok || !body?.success || !body.data?.token) {
      throw new DeviceAuthError(
        body?.error?.message || `设备注册失败（HTTP ${response.status}）`,
        response.status,
        body?.error?.code,
      );
    }

    cachedToken = body.data.token;
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, body.data.token);
    return body.data.token;
  })();

  try {
    return await inflightRegistration;
  } finally {
    inflightRegistration = null;
  }
};

/** 取当前令牌，本地没有就注册一次 */
export const getDeviceToken = async (): Promise<string> => {
  if (cachedToken) {
    return cachedToken;
  }

  const stored = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  if (stored) {
    cachedToken = stored;
    return stored;
  }

  return registerDevice();
};

/**
 * 清掉本地令牌，下次请求会重新注册。
 *
 * ⚠️ 只应在收到 **401** 时调用。绝不能因 429（配额用尽）调用——
 * 那等于让「换身份重置配额」成为官方支持的绕过路径。
 */
export const clearDeviceToken = async (): Promise<void> => {
  cachedToken = null;
  await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
};

/** 仅供测试：清掉模块级缓存，让下一次调用重新走 AsyncStorage / 注册流程 */
export const __resetDeviceAuthCacheForTest = (): void => {
  cachedToken = null;
  inflightRegistration = null;
};
