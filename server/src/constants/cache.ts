const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// ITIS 分类谱系几乎不变，缓存一天足够。
export const ITIS_TTL_MS = 24 * HOUR;

// IUCN 每年更新 2–3 次（Red List 版本），按官方建议长缓存。
export const IUCN_TTL_MS = 7 * DAY;
