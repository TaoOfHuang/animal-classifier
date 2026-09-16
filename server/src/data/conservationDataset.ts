/**
 * 离线濒危信息数据集。
 *
 * 为什么需要它：IUCN 的 ToU 明确写明 API 面向教育/研究，且
 * "may need to restrict access if … such as mobile app development"。
 * 因此默认走本文件（`CONSERVATION_SOURCE=static`），在线 v4 仅作为可切换选项，
 * 而不是唯一依赖。
 *
 * 数据来源：IUCN Red List 各物种官方评估页（含评估年份）。
 * 维护规约：
 *   - 只填能查证的字段。查不到就**不写** population / threats，
 *     宁可让前端不显示，也不要编一个数字
 *   - 每次 IUCN Red List 版本更新（每年 2–3 次）后复核本表
 *   - 启用 `CONSERVATION_SOURCE=iucn_v4` 时本表不参与，仅作为降级兜底
 *   - 键为学名（种级），大小写不敏感
 */

import { ConservationStatus } from '../services/conservation/types';

export type ConservationDatasetEntry = Omit<ConservationStatus, 'source'>;

export const CONSERVATION_DATASET: Record<string, ConservationDatasetEntry> = {
  // ── 前端热门物种 ──
  'Ailuropoda melanoleuca': {
    iucnStatus: 'VU',
    population: 1864,
    populationTrend: 'increasing',
    assessmentYear: 2016,
  },
  'Panthera tigris': {
    iucnStatus: 'EN',
    populationTrend: 'decreasing',
    assessmentYear: 2022,
    threats: ['栖息地破坏', '偷猎', '猎物减少'],
  },
  'Rhinopithecus roxellana': {
    iucnStatus: 'EN',
    populationTrend: 'decreasing',
    assessmentYear: 2020,
  },
  'Panthera uncia': {
    iucnStatus: 'VU',
    populationTrend: 'decreasing',
    assessmentYear: 2017,
  },
  'Lipotes vexillifer': {
    iucnStatus: 'CR',
    populationTrend: 'decreasing',
    assessmentYear: 2017,
  },
  'Nipponia nippon': {
    iucnStatus: 'EN',
    populationTrend: 'increasing',
    assessmentYear: 2020,
  },
  'Pantholops hodgsonii': {
    iucnStatus: 'NT',
    populationTrend: 'increasing',
    assessmentYear: 2016,
  },
  'Acipenser sinensis': {
    iucnStatus: 'CR',
    populationTrend: 'decreasing',
    assessmentYear: 2022,
  },

  // ── 猫科 ──
  'Panthera leo': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2016 },
  'Panthera pardus': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2019 },
  'Panthera onca': { iucnStatus: 'NT', populationTrend: 'decreasing', assessmentYear: 2017 },
  'Acinonyx jubatus': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2021 },
  'Neofelis nebulosa': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2021 },
  'Neofelis diardi': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2015 },
  'Felis catus': { iucnStatus: 'LC', populationTrend: 'stable', assessmentYear: 2015 },
  'Felis silvestris': { iucnStatus: 'LC', populationTrend: 'stable', assessmentYear: 2015 },
  'Lynx lynx': { iucnStatus: 'LC', populationTrend: 'stable', assessmentYear: 2015 },
  'Lynx canadensis': { iucnStatus: 'LC', populationTrend: 'stable', assessmentYear: 2014 },
  'Lynx pardinus': { iucnStatus: 'VU', populationTrend: 'increasing', assessmentYear: 2015 },
  'Puma concolor': { iucnStatus: 'LC', populationTrend: 'decreasing', assessmentYear: 2015 },
  'Prionailurus bengalensis': { iucnStatus: 'LC', populationTrend: 'decreasing', assessmentYear: 2015 },

  // ── 熊科 / 小熊猫科 ──
  'Ursus maritimus': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2015 },
  'Ursus arctos': { iucnStatus: 'LC', populationTrend: 'stable', assessmentYear: 2016 },
  'Ursus americanus': { iucnStatus: 'LC', populationTrend: 'stable', assessmentYear: 2016 },
  'Ursus thibetanus': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2016 },
  'Helarctos malayanus': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2017 },
  'Melursus ursinus': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2016 },
  'Tremarctos ornatus': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2016 },
  'Ailurus fulgens': { iucnStatus: 'EN', populationTrend: 'decreasing', assessmentYear: 2015 },

  // ── 犬科 / 鼬科 ──
  'Canis lupus': { iucnStatus: 'LC', populationTrend: 'stable', assessmentYear: 2018 },
  'Canis aureus': { iucnStatus: 'LC', populationTrend: 'increasing', assessmentYear: 2018 },
  'Vulpes vulpes': { iucnStatus: 'LC', populationTrend: 'stable', assessmentYear: 2016 },
  'Vulpes lagopus': { iucnStatus: 'LC', populationTrend: 'decreasing', assessmentYear: 2016 },
  'Cuon alpinus': { iucnStatus: 'EN', populationTrend: 'decreasing', assessmentYear: 2015 },
  'Lycaon pictus': { iucnStatus: 'EN', populationTrend: 'decreasing', assessmentYear: 2012 },
  'Nyctereutes procyonoides': { iucnStatus: 'LC', populationTrend: 'stable', assessmentYear: 2016 },
  'Lutra lutra': { iucnStatus: 'NT', populationTrend: 'decreasing', assessmentYear: 2015 },
  'Aonyx cinereus': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2015 },
  'Meles meles': { iucnStatus: 'LC', populationTrend: 'stable', assessmentYear: 2016 },
  'Mellivora capensis': { iucnStatus: 'LC', populationTrend: 'decreasing', assessmentYear: 2015 },
  'Gulo gulo': { iucnStatus: 'LC', populationTrend: 'decreasing', assessmentYear: 2016 },

  // ── 灵长目 ──
  'Gorilla gorilla': { iucnStatus: 'CR', populationTrend: 'decreasing', assessmentYear: 2016 },
  'Gorilla beringei': { iucnStatus: 'EN', populationTrend: 'increasing', assessmentYear: 2018 },
  'Pan troglodytes': { iucnStatus: 'EN', populationTrend: 'decreasing', assessmentYear: 2016 },
  'Pan paniscus': { iucnStatus: 'EN', populationTrend: 'decreasing', assessmentYear: 2016 },
  'Pongo pygmaeus': { iucnStatus: 'CR', populationTrend: 'decreasing', assessmentYear: 2016 },
  'Pongo abelii': { iucnStatus: 'CR', populationTrend: 'decreasing', assessmentYear: 2017 },
  'Macaca mulatta': { iucnStatus: 'LC', populationTrend: 'stable', assessmentYear: 2015 },
  'Trachypithecus francoisi': { iucnStatus: 'EN', populationTrend: 'decreasing', assessmentYear: 2015 },

  // ── 长鼻目 / 奇蹄目 / 偶蹄目 ──
  'Elephas maximus': { iucnStatus: 'EN', populationTrend: 'decreasing', assessmentYear: 2019 },
  'Loxodonta africana': { iucnStatus: 'EN', populationTrend: 'decreasing', assessmentYear: 2021 },
  'Ceratotherium simum': { iucnStatus: 'NT', populationTrend: 'increasing', assessmentYear: 2020 },
  'Diceros bicornis': { iucnStatus: 'CR', populationTrend: 'increasing', assessmentYear: 2020 },
  'Equus przewalskii': { iucnStatus: 'EN', populationTrend: 'increasing', assessmentYear: 2011 },
  'Bos gaurus': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2016 },
  'Bison bison': { iucnStatus: 'NT', populationTrend: 'stable', assessmentYear: 2016 },
  'Budorcas taxicolor': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2015 },
  'Cervus nippon': { iucnStatus: 'LC', populationTrend: 'decreasing', assessmentYear: 2015 },
  'Cervus elaphus': { iucnStatus: 'LC', populationTrend: 'increasing', assessmentYear: 2015 },
  'Elaphurus davidianus': { iucnStatus: 'EW', populationTrend: 'increasing', assessmentYear: 2016 },
  'Sus scrofa': { iucnStatus: 'LC', populationTrend: 'stable', assessmentYear: 2016 },
  'Camelus ferus': { iucnStatus: 'CR', populationTrend: 'decreasing', assessmentYear: 2020 },
  'Vicugna vicugna': { iucnStatus: 'LC', populationTrend: 'increasing', assessmentYear: 2018 },
  'Giraffa camelopardalis': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2016 },
  'Hippopotamus amphibius': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2016 },
  'Moschus moschiferus': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2015 },

  // ── 穿山甲 ──
  'Manis pentadactyla': { iucnStatus: 'CR', populationTrend: 'decreasing', assessmentYear: 2019 },
  'Manis javanica': { iucnStatus: 'CR', populationTrend: 'decreasing', assessmentYear: 2019 },

  // ── 鲸豚类 ──
  'Tursiops truncatus': { iucnStatus: 'LC', populationTrend: 'stable', assessmentYear: 2019 },
  'Orcinus orca': { iucnStatus: 'DD', assessmentYear: 2017 },
  'Sousa chinensis': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2017 },
  'Neophocaena asiaeorientalis': {
    iucnStatus: 'EN',
    populationTrend: 'decreasing',
    assessmentYear: 2017,
  },
  'Balaenoptera musculus': { iucnStatus: 'EN', populationTrend: 'increasing', assessmentYear: 2018 },
  'Balaenoptera physalus': { iucnStatus: 'VU', populationTrend: 'increasing', assessmentYear: 2018 },
  'Megaptera novaeangliae': {
    iucnStatus: 'LC',
    populationTrend: 'increasing',
    assessmentYear: 2018,
  },
  'Physeter macrocephalus': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2008 },
  'Dugong dugon': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2015 },

  // ── 龟鳖目 / 鳄目 ──
  'Chelonia mydas': { iucnStatus: 'EN', populationTrend: 'decreasing', assessmentYear: 2004 },
  'Caretta caretta': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2015 },
  'Eretmochelys imbricata': { iucnStatus: 'CR', populationTrend: 'decreasing', assessmentYear: 2008 },
  'Lepidochelys olivacea': {
    iucnStatus: 'VU',
    populationTrend: 'decreasing',
    assessmentYear: 2008,
  },
  'Lepidochelys kempii': { iucnStatus: 'CR', populationTrend: 'increasing', assessmentYear: 2019 },
  'Natator depressus': { iucnStatus: 'DD', assessmentYear: 1996 },
  'Dermochelys coriacea': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2013 },
  'Mauremys reevesii': { iucnStatus: 'EN', populationTrend: 'decreasing', assessmentYear: 2011 },
  'Pelodiscus sinensis': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2000 },
  'Alligator sinensis': { iucnStatus: 'CR', populationTrend: 'increasing', assessmentYear: 2017 },
  'Crocodylus niloticus': { iucnStatus: 'LC', populationTrend: 'stable', assessmentYear: 2014 },
  'Crocodylus porosus': { iucnStatus: 'LC', populationTrend: 'stable', assessmentYear: 1996 },

  // ── 蛇类 / 两栖 ──
  'Python bivittatus': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2012 },
  'Andrias davidianus': { iucnStatus: 'CR', populationTrend: 'decreasing', assessmentYear: 2020 },

  // ── 鸟类 ──
  'Aquila chrysaetos': { iucnStatus: 'LC', populationTrend: 'stable', assessmentYear: 2016 },
  'Haliaeetus leucocephalus': {
    iucnStatus: 'LC',
    populationTrend: 'increasing',
    assessmentYear: 2016,
  },
  'Falco peregrinus': { iucnStatus: 'LC', populationTrend: 'stable', assessmentYear: 2016 },
  'Bubo bubo': { iucnStatus: 'LC', populationTrend: 'decreasing', assessmentYear: 2016 },
  'Corvus corax': { iucnStatus: 'LC', populationTrend: 'increasing', assessmentYear: 2017 },
  'Grus japonensis': { iucnStatus: 'EN', populationTrend: 'decreasing', assessmentYear: 2020 },
  'Grus grus': { iucnStatus: 'LC', populationTrend: 'increasing', assessmentYear: 2015 },
  'Ardea cinerea': { iucnStatus: 'LC', populationTrend: 'decreasing', assessmentYear: 2016 },
  'Ciconia boyciana': { iucnStatus: 'EN', populationTrend: 'increasing', assessmentYear: 2018 },
  'Anas platyrhynchos': { iucnStatus: 'LC', populationTrend: 'decreasing', assessmentYear: 2016 },
  'Pavo cristatus': { iucnStatus: 'LC', populationTrend: 'decreasing', assessmentYear: 2016 },
  'Phasianus colchicus': { iucnStatus: 'LC', populationTrend: 'decreasing', assessmentYear: 2016 },
  'Spheniscus demersus': { iucnStatus: 'EN', populationTrend: 'decreasing', assessmentYear: 2020 },
  'Struthio camelus': { iucnStatus: 'LC', populationTrend: 'decreasing', assessmentYear: 2016 },

  // ── 鱼类 ──
  'Acipenser baerii': { iucnStatus: 'EN', populationTrend: 'decreasing', assessmentYear: 2019 },
  'Oncorhynchus mykiss': { iucnStatus: 'LC', assessmentYear: 2020 },
  'Salmo salar': { iucnStatus: 'LC', populationTrend: 'decreasing', assessmentYear: 2014 },
  'Cyprinus carpio': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2008 },
  'Carcharodon carcharias': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2018 },
  'Hippocampus kuda': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2017 },

  // ── 无脊椎 ──
  'Apis mellifera': { iucnStatus: 'DD', assessmentYear: 2020 },
  'Danaus plexippus': { iucnStatus: 'VU', populationTrend: 'decreasing', assessmentYear: 2022 },
};

const DATASET_BY_UPPER: Record<string, ConservationDatasetEntry> = Object.fromEntries(
  Object.entries(CONSERVATION_DATASET).map(([key, value]) => [key.toUpperCase(), value]),
);

export const lookupStaticConservation = (
  scientificName: string,
): ConservationDatasetEntry | undefined => DATASET_BY_UPPER[scientificName.trim().toUpperCase()];
