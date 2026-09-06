// 生物分类学相关常量

// 分类等级（中英文）
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

// IUCN 红色名录等级
export const IUCN_STATUS = {
  EX: { en: 'Extinct', zh: '灭绝', color: '#000000' },
  EW: { en: 'Extinct in the Wild', zh: '野外灭绝', color: '#542344' },
  CR: { en: 'Critically Endangered', zh: '极危', color: '#c41e3a' },
  EN: { en: 'Endangered', zh: '濒危', color: '#d85a4a' },
  VU: { en: 'Vulnerable', zh: '易危', color: '#e89b4a' },
  NT: { en: 'Near Threatened', zh: '近危', color: '#f0c060' },
  LC: { en: 'Least Concern', zh: '无危', color: '#7fa650' },
  DD: { en: 'Data Deficient', zh: '数据缺乏', color: '#808080' },
  NE: { en: 'Not Evaluated', zh: '未评估', color: '#ffffff' },
} as const;

export type IUCNStatus = keyof typeof IUCN_STATUS;

// 热门搜索动物
export const HOT_SEARCH_ANIMALS = [
  '大熊猫',
  '东北虎',
  '金丝猴',
  '雪豹',
  '白鳍豚',
  '朱鹮',
  '藏羚羊',
  '中华鲟',
];

// 动物界常见分类
export const COMMON_KINGDOMS = {
  Animalia: '动物界',
};

export const COMMON_PHYLUMS = {
  Chordata: '脊索动物门',
  Arthropoda: '节肢动物门',
  Mollusca: '软体动物门',
};

export const COMMON_CLASSES = {
  Mammalia: '哺乳纲',
  Aves: '鸟纲',
  Reptilia: '爬行纲',
  Amphibia: '两栖纲',
  Actinopterygii: '辐鳍鱼纲',
  Insecta: '昆虫纲',
};
