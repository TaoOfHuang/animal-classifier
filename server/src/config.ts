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

export const getDailyLimit = (): number => {
  const raw = process.env.AI_RECOGNIZE_DAILY_LIMIT;
  if (!raw) return 100;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid AI_RECOGNIZE_DAILY_LIMIT value: ${raw}`);
  }
  return parsed;
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
