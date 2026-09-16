/**
 * 分类学常量 —— 与前端 `src/constants/taxonomy.ts` 保持同源。
 * 前端负责展示，服务端负责校验与派生，两边枚举必须一致，避免出现
 * 「前端认识 EX、服务端把它兜底成 EN」这类静默错配。
 */

export const TAXONOMY_LEVELS = {
  kingdom: { en: 'Kingdom', zh: '界' },
  phylum: { en: 'Phylum', zh: '门' },
  class: { en: 'Class', zh: '纲' },
  order: { en: 'Order', zh: '目' },
  family: { en: 'Family', zh: '科' },
  genus: { en: 'Genus', zh: '属' },
  species: { en: 'Species', zh: '种' },
} as const;

export type TaxonomyLevel = keyof typeof TAXONOMY_LEVELS;

export const TAXONOMY_ORDER: TaxonomyLevel[] = [
  'kingdom',
  'phylum',
  'class',
  'order',
  'family',
  'genus',
  'species',
];

export const getParentLevel = (level: TaxonomyLevel): TaxonomyLevel | null => {
  const index = TAXONOMY_ORDER.indexOf(level);
  return index > 0 ? TAXONOMY_ORDER[index - 1] : null;
};

export const getChildLevel = (level: TaxonomyLevel): TaxonomyLevel | null => {
  const index = TAXONOMY_ORDER.indexOf(level);
  return index >= 0 && index < TAXONOMY_ORDER.length - 1
    ? TAXONOMY_ORDER[index + 1]
    : null;
};

export const IUCN_STATUS = {
  EX: { en: 'Extinct', zh: '灭绝' },
  EW: { en: 'Extinct in the Wild', zh: '野外灭绝' },
  CR: { en: 'Critically Endangered', zh: '极危' },
  EN: { en: 'Endangered', zh: '濒危' },
  VU: { en: 'Vulnerable', zh: '易危' },
  NT: { en: 'Near Threatened', zh: '近危' },
  LC: { en: 'Least Concern', zh: '无危' },
  DD: { en: 'Data Deficient', zh: '数据缺乏' },
  NE: { en: 'Not Evaluated', zh: '未评估' },
} as const;

export type IUCNStatus = keyof typeof IUCN_STATUS;

export const IUCN_STATUS_CODES = Object.keys(IUCN_STATUS) as IUCNStatus[];

export const isIucnStatus = (value: string): value is IUCNStatus =>
  (IUCN_STATUS_CODES as string[]).includes(value);

/**
 * IUCN 未评估/数据不足时的取值。绝不能用 'EN' 兜底 —— 那会把
 * 「不知道」渲染成「濒危」。
 */
export const IUCN_UNKNOWN_STATUS: IUCNStatus = 'DD';

/**
 * 把上游给的任意分类码归一化成九级枚举之一。
 * 认不出（缺失、拼写异常、上游新增了未同步的码）一律回到 `DD`（数据缺乏）。
 */
export const normalizeIucnStatus = (raw?: string | null): IUCNStatus => {
  const code = String(raw ?? '')
    .trim()
    .toUpperCase();
  return isIucnStatus(code) ? code : IUCN_UNKNOWN_STATUS;
};
