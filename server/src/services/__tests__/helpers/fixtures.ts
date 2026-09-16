/**
 * 真实报文的裁剪切片 —— 全部来自 2026-09-16 对 ITIS / IUCN v4 的实测抓包。
 * 用真实报文而不是手捏结构，才有意义（ITIS 的字段名与直观预期不一致，
 * 例如顶层用 sciName / hierarchyList，单条用 taxonName / rankName）。
 */

/** ITIS searchByScientificName?srchKey=Panthera tigris */
export const ITIS_SEARCH_PANTHERA_TIGRIS = {
  class: 'gov.usgs.itis.itis_service.data.SvcScientificNameList',
  scientificNames: [
    {
      author: '(Linnaeus, 1758)',
      class: 'gov.usgs.itis.itis_service.data.SvcScientificName',
      combinedName: 'Panthera tigris',
      kingdom: 'Animalia',
      tsn: '183805',
      unitName1: 'Panthera',
      unitName2: 'tigris',
      unitName3: null,
    },
    {
      author: '(Linnaeus, 1758)',
      class: 'gov.usgs.itis.itis_service.data.SvcScientificName',
      combinedName: 'Panthera tigris tigris',
      kingdom: 'Animalia',
      tsn: '183806',
      unitName1: 'Panthera',
      unitName2: 'tigris',
      unitName3: 'tigris',
    },
    {
      author: '(Fitzinger, 1868)',
      class: 'gov.usgs.itis.itis_service.data.SvcScientificName',
      combinedName: 'Panthera tigris longipilis',
      kingdom: 'Animalia',
      tsn: '726477',
      unitName1: 'Panthera',
      unitName2: 'tigris',
      unitName3: 'longipilis',
    },
  ],
};

/** ITIS searchByScientificName?srchKey=Felidae（科级条目） */
export const ITIS_SEARCH_FELIDAE = {
  class: 'gov.usgs.itis.itis_service.data.SvcScientificNameList',
  scientificNames: [
    {
      author: 'Fischer de Waldheim, 1817',
      combinedName: 'Felidae',
      kingdom: 'Animalia',
      tsn: '180580',
      unitName1: 'Felidae',
      unitName2: null,
      unitName3: null,
    },
  ],
};

/** ITIS searchByScientificName?srchKey=Animalia（界级条目） */
export const ITIS_SEARCH_ANIMALIA = {
  class: 'gov.usgs.itis.itis_service.data.SvcScientificNameList',
  scientificNames: [
    {
      author: 'Linnaeus, 1758',
      combinedName: 'Animalia',
      kingdom: 'Animalia',
      tsn: '202423',
      unitName1: 'Animalia',
      unitName2: null,
      unitName3: null,
    },
  ],
};

/** ITIS searchByScientificName?srchKey=Panthera（属级条目） */
export const ITIS_SEARCH_PANTHERA_GENUS = {
  class: 'gov.usgs.itis.itis_service.data.SvcScientificNameList',
  scientificNames: [
    {
      author: 'Oken, 1816',
      combinedName: 'Panthera',
      kingdom: 'Animalia',
      tsn: '180592',
      unitName1: 'Panthera',
      unitName2: null,
      unitName3: null,
    },
    {
      author: '(Linnaeus, 1758)',
      combinedName: 'Panthera tigris',
      kingdom: 'Animalia',
      tsn: '183805',
      unitName1: 'Panthera',
      unitName2: 'tigris',
      unitName3: null,
    },
  ],
};

/**
 * ITIS getFullHierarchyFromTSN?tsn=183805 —— 原样保留 16 个冗余中间级，
 * 正是这些（Subkingdom / Infrakingdom / Superclass / Subfamily…）需要被过滤掉。
 */
export const ITIS_HIERARCHY_PANTHERA_TIGRIS = {
  author: '(Linnaeus, 1758)',
  class: 'gov.usgs.itis.itis_service.data.SvcHierarchyRecordList',
  hierarchyList: [
    { author: 'Linnaeus, 1758', parentName: '', parentTsn: '', rankName: 'Kingdom', taxonName: 'Animalia', tsn: '202423' },
    { author: '', parentName: 'Animalia', parentTsn: '202423', rankName: 'Subkingdom', taxonName: 'Bilateria', tsn: '914154' },
    { author: '', parentName: 'Bilateria', parentTsn: '914154', rankName: 'Infrakingdom', taxonName: 'Deuterostomia', tsn: '914156' },
    { author: '', parentName: 'Deuterostomia', parentTsn: '914156', rankName: 'Phylum', taxonName: 'Chordata', tsn: '158852' },
    { author: '', parentName: 'Chordata', parentTsn: '158852', rankName: 'Subphylum', taxonName: 'Vertebrata', tsn: '331030' },
    { author: '', parentName: 'Vertebrata', parentTsn: '331030', rankName: 'Infraphylum', taxonName: 'Gnathostomata', tsn: '914179' },
    { author: '', parentName: 'Gnathostomata', parentTsn: '914179', rankName: 'Superclass', taxonName: 'Tetrapoda', tsn: '914181' },
    { author: '', parentName: 'Tetrapoda', parentTsn: '914181', rankName: 'Class', taxonName: 'Mammalia', tsn: '179913' },
    { author: '', parentName: 'Mammalia', parentTsn: '179913', rankName: 'Subclass', taxonName: 'Theria', tsn: '179916' },
    { author: '', parentName: 'Theria', parentTsn: '179916', rankName: 'Infraclass', taxonName: 'Eutheria', tsn: '179925' },
    { author: '', parentName: 'Eutheria', parentTsn: '179925', rankName: 'Order', taxonName: 'Carnivora', tsn: '180539' },
    { author: '', parentName: 'Carnivora', parentTsn: '180539', rankName: 'Suborder', taxonName: 'Feliformia', tsn: '552304' },
    { author: '', parentName: 'Feliformia', parentTsn: '552304', rankName: 'Family', taxonName: 'Felidae', tsn: '180580' },
    { author: '', parentName: 'Felidae', parentTsn: '180580', rankName: 'Subfamily', taxonName: 'Pantherinae', tsn: '552364' },
    { author: 'Oken, 1816', parentName: 'Pantherinae', parentTsn: '552364', rankName: 'Genus', taxonName: 'Panthera', tsn: '180592' },
    { author: '(Linnaeus, 1758)', parentName: 'Panthera', parentTsn: '180592', rankName: 'Species', taxonName: 'Panthera tigris', tsn: '183805' },
    { author: '(Temminck, 1844)', parentName: 'Panthera tigris', parentTsn: '183805', rankName: 'Subspecies', taxonName: 'Panthera tigris sondaica', tsn: '726476' },
    { author: '(Linnaeus, 1758)', parentName: 'Panthera tigris', parentTsn: '183805', rankName: 'Subspecies', taxonName: 'Panthera tigris tigris', tsn: '183806' },
  ],
  rankName: 'Species',
  sciName: 'Panthera tigris',
  tsn: '183805',
};

/** ITIS getFullHierarchyFromTSN?tsn=180580（猫科，谱系到 Family 为止） */
export const ITIS_HIERARCHY_FELIDAE = {
  class: 'gov.usgs.itis.itis_service.data.SvcHierarchyRecordList',
  hierarchyList: [
    { rankName: 'Kingdom', taxonName: 'Animalia', tsn: '202423', parentTsn: '' },
    { rankName: 'Phylum', taxonName: 'Chordata', tsn: '158852', parentTsn: '914156' },
    { rankName: 'Class', taxonName: 'Mammalia', tsn: '179913', parentTsn: '914181' },
    { rankName: 'Order', taxonName: 'Carnivora', tsn: '180539', parentTsn: '179925' },
    { rankName: 'Family', taxonName: 'Felidae', tsn: '180580', parentTsn: '552304' },
  ],
  rankName: 'Family',
  sciName: 'Felidae',
  tsn: '180580',
};

/** ITIS getFullHierarchyFromTSN?tsn=180592（豹属，谱系到 Genus 为止） */
export const ITIS_HIERARCHY_PANTHERA_GENUS = {
  class: 'gov.usgs.itis.itis_service.data.SvcHierarchyRecordList',
  hierarchyList: [
    { rankName: 'Kingdom', taxonName: 'Animalia', tsn: '202423', parentTsn: '' },
    { rankName: 'Phylum', taxonName: 'Chordata', tsn: '158852', parentTsn: '914156' },
    { rankName: 'Class', taxonName: 'Mammalia', tsn: '179913', parentTsn: '914181' },
    { rankName: 'Order', taxonName: 'Carnivora', tsn: '180539', parentTsn: '179925' },
    { rankName: 'Family', taxonName: 'Felidae', tsn: '180580', parentTsn: '552304' },
    { rankName: 'Genus', taxonName: 'Panthera', tsn: '180592', parentTsn: '552364' },
  ],
  rankName: 'Genus',
  sciName: 'Panthera',
  tsn: '180592',
};

/** ITIS getHierarchyDownFromTSN?tsn=180592 —— 只含直接下级 */
export const ITIS_DOWN_PANTHERA = {
  class: 'gov.usgs.itis.itis_service.data.SvcHierarchyRecordList',
  hierarchyList: [
    { rankName: 'Species', taxonName: 'Panthera onca', tsn: '180593' },
    { rankName: 'Species', taxonName: 'Panthera leo', tsn: '183803' },
    { rankName: 'Species', taxonName: 'Panthera pardus', tsn: '183804' },
    { rankName: 'Species', taxonName: 'Panthera tigris', tsn: '183805' },
    { rankName: 'Species', taxonName: 'Panthera uncia', tsn: '933420' },
  ],
  rankName: 'Genus',
  sciName: 'Panthera',
  tsn: '180592',
};

/** ITIS getHierarchyDownFromTSN?tsn=183805（种之下只有亚种） */
export const ITIS_DOWN_PANTHERA_TIGRIS = {
  class: 'gov.usgs.itis.itis_service.data.SvcHierarchyRecordList',
  hierarchyList: [
    { rankName: 'Subspecies', taxonName: 'Panthera tigris sondaica', tsn: '726476' },
    { rankName: 'Subspecies', taxonName: 'Panthera tigris tigris', tsn: '183806' },
  ],
  rankName: 'Species',
  sciName: 'Panthera tigris',
  tsn: '183805',
};

/** ITIS 查无此物时的响应 */
export const ITIS_SEARCH_EMPTY = {
  class: 'gov.usgs.itis.itis_service.data.SvcScientificNameList',
  scientificNames: [],
};

/** ITIS searchByScientificName?srchKey=Notarealgenus notarealspecies */
export const ITIS_SEARCH_UNKNOWN = {
  class: 'gov.usgs.itis.itis_service.data.SvcScientificNameList',
  scientificNames: [],
};

// ────────────────────────────── IUCN v4 ──────────────────────────────

/** IUCN GET /api/v4/taxa/scientific_name?genus_name=Panthera&species_name=tigris */
export const IUCN_TAXA_BY_NAME_PANTHERA_TIGRIS = {
  taxon: {
    sis_id: 15955,
    scientific_name: 'Panthera tigris',
    kingdom_name: 'ANIMALIA',
    phylum_name: 'CHORDATA',
    class_name: 'MAMMALIA',
    order_name: 'CARNIVORA',
    family_name: 'FELIDAE',
    genus_name: 'Panthera',
    species_name: 'tigris',
    species: true,
    subpopulation: false,
    infrarank: false,
  },
};

/** IUCN GET /api/v4/taxa/sis/15955 —— assessments 里挑 latest */
export const IUCN_TAXON_SIS_15955 = {
  sis_id: 15955,
  taxon: IUCN_TAXA_BY_NAME_PANTHERA_TIGRIS.taxon,
  assessments: [
    {
      assessment_id: 214862019,
      latest: true,
      year_published: '2022',
      red_list_category_code: 'EN',
      taxon_scientific_name: 'Panthera tigris',
      assessment_date: '2021-12-15T00:00:00.000+00:00',
    },
    {
      assessment_id: 100000001,
      latest: false,
      year_published: '2014',
      red_list_category_code: 'EN',
      taxon_scientific_name: 'Panthera tigris',
      assessment_date: '2014-06-20T00:00:00.000+00:00',
    },
  ],
};

/** IUCN GET /api/v4/assessment/214862019 —— 裁剪自实测报文 */
export const IUCN_ASSESSMENT_214862019 = {
  assessment_id: 214862019,
  assessment_date: '2021-12-15T00:00:00.000+00:00',
  year_published: '2022',
  latest: true,
  possibly_extinct: false,
  possibly_extinct_in_the_wild: false,
  sis_taxon_id: 15955,
  red_list_category: { version: '3.1', description: { en: 'Endangered' }, code: 'EN' },
  population_trend: { description: { en: 'Decreasing' }, code: '1' },
  // 区间值：实现必须留空 population，不能取端点假装是总数
  supplementary_info: { population_size: '2608-3905,3140' },
  threats: [
    { code: '5_1_1', description: { en: 'Hunting & trapping terrestrial animals' } },
    { code: '5_1_1', description: { en: 'Hunting & trapping terrestrial animals' } },
    { code: '2_1', description: { en: 'Annual & perennial non-timber crops' } },
  ],
};

/** 未在 IUCN 登记的学名 → 上游 404 */
export const IUCN_NOT_FOUND = { error: 'Not Found' };
