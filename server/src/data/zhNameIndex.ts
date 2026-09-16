/**
 * 中文名 → 学名 反向索引。
 *
 * 存在原因：ITIS 只认拉丁学名（实测 `srchKey=东北虎` → 0 命中），
 * 而前端搜索全程走中文。所有中文入口必须先经过这里归一化。
 *
 * 索引来源分三部分：
 *   1. `taxonomyZh.ts` 的 SPECIES_ZH / RANK_ZH 反向展开（自动同步，无需手工维护）
 *   2. `ZH_ALIASES` 手工别名表（俗名、旧称、异写）
 *   3. `HOT_ZH_ENTRIES` 前端热门搜索词的显式映射
 *
 * 查不到就返回 undefined —— 上层直接走兜底，绝不用中文去问 ITIS 白跑一次。
 */

import { RANK_ZH, SPECIES_ZH } from './taxonomyZh';

/**
 * 手工别名。键为中文俗名/别名，值为 ITIS 可检索的学名。
 * 亚种一律归并到种（东北虎、华南虎 → Panthera tigris），与前置决策 3 一致。
 */
export const ZH_ALIASES: Record<string, string> = {
  // 虎的亚种与俗称
  东北虎: 'Panthera tigris',
  西伯利亚虎: 'Panthera tigris',
  阿穆尔虎: 'Panthera tigris',
  华南虎: 'Panthera tigris',
  孟加拉虎: 'Panthera tigris',
  印支虎: 'Panthera tigris',
  苏门答腊虎: 'Panthera tigris',
  老虎: 'Panthera tigris',
  大虫: 'Panthera tigris',

  // 大熊猫俗称
  熊猫: 'Ailuropoda melanoleuca',
  猫熊: 'Ailuropoda melanoleuca',
  大猫熊: 'Ailuropoda melanoleuca',

  // 其他常见俗称
  狮子: 'Panthera leo',
  灰狼: 'Canis lupus',
  大象: 'Elephas maximus',
  猫: 'Felis catus',
  家猫: 'Felis catus',
  海龟: 'Chelonia mydas',
  白鳍豚: 'Lipotes vexillifer',
  白鱀豚: 'Lipotes vexillifer',
  金丝猴: 'Rhinopithecus roxellana',
  藏羚羊: 'Pantholops hodgsonii',
  藏羚: 'Pantholops hodgsonii',
  野骆驼: 'Camelus ferus',
  大鲵: 'Andrias davidianus',
  娃娃鱼: 'Andrias davidianus',
  扬子鳄: 'Alligator sinensis',
  麋鹿: 'Elaphurus davidianus',
  四不像: 'Elaphurus davidianus',
  丹顶鹤: 'Grus japonensis',
  蟒蛇: 'Python bivittatus',
  中华白海豚: 'Sousa chinensis',
  江豚: 'Neophocaena asiaeorientalis',
  穿山甲: 'Manis pentadactyla',
  中华鲟: 'Acipenser sinensis',
  北极狐: 'Vulpes lagopus',
  雪兔: 'Lepus timidus',

  // 分类阶元的口语说法
  猫科动物: 'Felidae',
  熊科动物: 'Ursidae',
  犬科动物: 'Canidae',
  鸟类: 'Aves',
  鱼类: 'Actinopterygii',
  昆虫: 'Insecta',
  哺乳动物: 'Mammalia',
  爬行动物: 'Reptilia',
  两栖动物: 'Amphibia',
  动物: 'Animalia',
};

/** 前端热门搜索词的显式映射，避免依赖别名表的巧合 */
export const HOT_ZH_ENTRIES: Record<string, string> = {
  大熊猫: 'Ailuropoda melanoleuca',
  东北虎: 'Panthera tigris',
  金丝猴: 'Rhinopithecus roxellana',
  雪豹: 'Panthera uncia',
  白鳍豚: 'Lipotes vexillifer',
  朱鹮: 'Nipponia nippon',
  藏羚羊: 'Pantholops hodgsonii',
  中华鲟: 'Acipenser sinensis',
};

const buildIndex = (): Record<string, string> => {
  const index: Record<string, string> = {};

  // 1) 种级中文名优先（比属级更具体）
  for (const [scientificName, zh] of Object.entries(SPECIES_ZH)) {
    if (!(zh in index)) {
      index[zh] = scientificName;
    }
  }

  // 2) 属及以上的译名补齐
  for (const [scientificName, zh] of Object.entries(RANK_ZH)) {
    if (!(zh in index)) {
      index[zh] = scientificName;
    }
  }

  // 3) 手工别名与热门词覆盖前两步
  Object.assign(index, ZH_ALIASES, HOT_ZH_ENTRIES);

  return index;
};

export const ZH_NAME_INDEX: Record<string, string> = buildIndex();

/** 中文名 → 学名，未收录返回 undefined */
export const lookupScientificNameByZh = (zhName: string): string | undefined =>
  ZH_NAME_INDEX[zhName.trim()];

const CJK_PATTERN = /[\u4e00-\u9fa5]/;

export const containsCjk = (value: string): boolean => CJK_PATTERN.test(value);

/**
 * 把任意用户输入归一化成 ITIS 可检索的学名。
 * - 中文且命中索引 → 对应学名
 * - 中文但未命中 → null（不要拿中文去问 ITIS）
 * - 非中文（拉丁学名/英文名）→ 去掉首尾空白与包裹引号后原样返回
 */
export const resolveQueryToScientificName = (input: string): string | null => {
  const trimmed = input.trim().replace(/^["'“”]+|["'“”]+$/g, '').trim();
  if (!trimmed) {
    return null;
  }

  if (containsCjk(trimmed)) {
    return lookupScientificNameByZh(trimmed) ?? null;
  }

  return trimmed;
};
