import { logger } from '../../utils/logger';
import { iucnV4Provider } from './iucnV4Provider';
import { staticProvider } from './staticProvider';
import { ConservationProvider, ConservationStatus } from './types';

export const CONSERVATION_SOURCES = ['static', 'iucn_v4'] as const;
export type ConservationSource = (typeof CONSERVATION_SOURCES)[number];

/**
 * 默认走离线数据集。原因见 `docs/plans/2026-09-13-itis-iucn-integration.md`
 * 「前置决策 1」：IUCN ToU 对 mobile app 场景有限制，在线 v4 只作为可切换选项。
 */
export const DEFAULT_CONSERVATION_SOURCE: ConservationSource = 'static';

const PROVIDERS: Record<ConservationSource, ConservationProvider> = {
  static: staticProvider,
  iucn_v4: iucnV4Provider,
};

/** 非法值直接抛错（fail fast），而不是悄悄退回默认值 */
export const getConservationSource = (
  raw: string | undefined = process.env.CONSERVATION_SOURCE,
): ConservationSource => {
  const value = (raw ?? DEFAULT_CONSERVATION_SOURCE).trim();
  if (!(CONSERVATION_SOURCES as readonly string[]).includes(value)) {
    throw new Error(
      `Invalid CONSERVATION_SOURCE: "${raw}" (expected one of ${CONSERVATION_SOURCES.join(' | ')})`,
    );
  }
  return value as ConservationSource;
};

let override: ConservationProvider | null = null;
let cachedSource: ConservationSource | null = null;
let cachedProvider: ConservationProvider | null = null;

export const getConservationProvider = (): ConservationProvider => {
  if (override) {
    return override;
  }

  const source = getConservationSource();
  if (cachedProvider && cachedSource === source) {
    return cachedProvider;
  }

  cachedSource = source;
  cachedProvider = PROVIDERS[source];
  return cachedProvider;
};

/** 仅供测试注入替身 */
export const setConservationProviderOverride = (
  provider: ConservationProvider | null,
): void => {
  override = provider;
  cachedProvider = null;
  cachedSource = null;
};

export const lookupConservation = async (
  scientificName: string,
): Promise<ConservationStatus | null> => getConservationProvider().lookup(scientificName);

/**
 * 启动期自检：`iucn_v4` 模式下缺 token 时给出明确告警。
 * **不阻断启动** —— 聚合层会把单个物种的失败降级掉，整个服务不该因此起不来。
 */
export const warnIfConservationMisconfigured = (): void => {
  const source = getConservationSource();

  if (source === 'iucn_v4' && !(process.env.IUCN_API_TOKEN ?? '').trim()) {
    logger.warn(
      'conservation',
      'CONSERVATION_SOURCE=iucn_v4 但 IUCN_API_TOKEN 为空 —— 所有物种将降级为「无濒危信息」。' +
        '请到 api.iucnredlist.org 申请 token，或改回 CONSERVATION_SOURCE=static。',
    );
    return;
  }

  logger.info('conservation', `data source = ${source}`);
};
