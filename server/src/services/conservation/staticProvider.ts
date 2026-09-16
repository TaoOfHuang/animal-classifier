import { lookupStaticConservation } from '../../data/conservationDataset';
import { resolveQueryToScientificName } from '../../data/zhNameIndex';
import { ConservationProvider, ConservationStatus } from './types';

/**
 * 离线实现。查不到返回 null（**不是**硬编码 'EN'），
 * 让上层能区分「已知无危」和「我们不知道」。
 */
export const staticProvider: ConservationProvider = {
  name: 'static',

  async lookup(scientificName: string): Promise<ConservationStatus | null> {
    // 兼容中文入参（内部调用方偶尔会传 commonNameZh）
    const normalized = resolveQueryToScientificName(scientificName);
    if (!normalized) {
      return null;
    }

    const entry = lookupStaticConservation(normalized);
    if (!entry) {
      return null;
    }

    return { ...entry, source: 'static' };
  },
};
