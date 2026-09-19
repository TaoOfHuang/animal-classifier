import {
  getConservationSource,
  warnIfConservationMisconfigured,
} from './services/conservation';

export const getPort = (rawPort: string | undefined): number => {
  if (!rawPort) {
    return 3000;
  }

  const parsed = Number(rawPort);
  const isValidInteger = Number.isInteger(parsed);
  if (!isValidInteger || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }

  return parsed;
};

// ── 通用整数环境变量读取 ────────────────────────────────────────────
// 沿用本文件既有约定：非法值直接抛错（fail fast），不静默退回默认值。
const readIntEnv = (
  name: string,
  fallback: number,
  options: { min?: number; max?: number } = {},
): number => {
  const { min = 0, max = Number.MAX_SAFE_INTEGER } = options;
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid ${name} value: ${raw}`);
  }
  return parsed;
};

// ── 设备令牌鉴权 ────────────────────────────────────────────────────
// 设计见 docs/plans/2026-09-18-device-token-auth.md
export const DEFAULT_DB_PATH = './data/app.sqlite';
export const DEFAULT_DEVICE_DAILY_LIMIT = 20;
export const DEFAULT_GLOBAL_DAILY_LIMIT = 500;
export const DEFAULT_REGISTER_RATE_LIMIT_PER_HOUR = 3;
export const DEFAULT_MAX_DEVICE_COUNT = 2000;

/** SQLite 数据库文件路径。`:memory:` 表示内存库（测试用） */
export const getDbPath = (): string =>
  process.env.DB_PATH?.trim() || DEFAULT_DB_PATH;

/** 单设备每日识别上限。0 = 不限。用于「公平分配」 */
export const getDeviceDailyLimit = (): number =>
  readIntEnv('DEVICE_DAILY_LIMIT', DEFAULT_DEVICE_DAILY_LIMIT);

/**
 * 全局每日识别上限，所有非白名单设备共享。0 = 不限。
 *
 * 这是**唯一不依赖客户端可信度**的机制：无论对方换多少设备、伪造多少身份，
 * 总额就那么点。也是本方案真正的安全边界。
 */
export const getGlobalDailyLimit = (): number =>
  readIntEnv('GLOBAL_DAILY_LIMIT', DEFAULT_GLOBAL_DAILY_LIMIT);

/** 同一 IP 每小时允许的注册次数。0 = 不限。用于抬高「变出新身份」的成本 */
export const getRegisterRateLimitPerHour = (): number =>
  readIntEnv(
    'REGISTER_RATE_LIMIT_PER_HOUR',
    DEFAULT_REGISTER_RATE_LIMIT_PER_HOUR,
  );

/** 设备总数上限。0 = 不限 */
export const getMaxDeviceCount = (): number =>
  readIntEnv('MAX_DEVICE_COUNT', DEFAULT_MAX_DEVICE_COUNT);

/** 管理员设备白名单（不参与全局配额计算），逗号分隔 */
export const getWhitelistDeviceIds = (): string[] =>
  (process.env.WHITELIST_DEVICE_IDS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

/** 管理员令牌，用于 POST /api/auth/revoke。未配置时该端点返回 503 */
export const getAdminToken = (): string | undefined => {
  const raw = process.env.ADMIN_TOKEN?.trim();
  return raw ? raw : undefined;
};

/**
 * 启动期配置自检。
 * - `CONSERVATION_SOURCE` 非法值 → **抛错**（fail fast，避免静默跑在错的实现上）
 * - `iucn_v4` 模式缺 token → **仅告警**，不阻断启动（聚合层会把单个物种的失败降级掉）
 */
export const assertConservationConfig = (): void => {
  getConservationSource();
  warnIfConservationMisconfigured();
};
