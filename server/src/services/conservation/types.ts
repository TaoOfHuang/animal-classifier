import { IUCNStatus } from '../../constants/taxonomy';

export type PopulationTrend = 'increasing' | 'stable' | 'decreasing' | 'unknown';

/**
 * 濒危信息。字段大多可选 —— IUCN 不是每个评估都填全，
 * **缺什么就留空，不要填默认值**，否则前端会把「未知」显示成事实。
 */
export type ConservationStatus = {
  iucnStatus: IUCNStatus;
  population?: number;
  populationTrend?: PopulationTrend;
  assessmentYear?: number;
  threats?: string[];
  source: 'iucn_v4' | 'static';
};

export interface ConservationProvider {
  readonly name: ConservationStatus['source'];
  /** 查不到返回 null；配置缺失/上游异常抛错，由聚合层降级 */
  lookup(scientificName: string): Promise<ConservationStatus | null>;
}

/** 未配置 IUCN token。抛出而非返回假数据，避免把「没配」伪装成「查过了」。 */
export class IucnNotConfiguredError extends Error {
  constructor(message = 'IUCN_API_TOKEN is not configured') {
    super(message);
    this.name = 'IucnNotConfiguredError';
  }
}
