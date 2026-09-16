import {
  getCommonNameZh,
  getRankLevelOf,
  getRankNameZh,
  getSpeciesNameZh,
  RANK_ZH,
  SPECIES_ZH,
} from '../taxonomyZh';
import { containsCjk, lookupScientificNameByZh, resolveQueryToScientificName, ZH_NAME_INDEX } from '../zhNameIndex';

describe('taxonomyZh', () => {
  it('translates known scientific names', () => {
    expect(getCommonNameZh('Panthera tigris')).toBe('虎');
    expect(getCommonNameZh('Ailuropoda melanoleuca')).toBe('大熊猫');
    expect(getCommonNameZh('Felidae')).toBe('猫科');
    expect(getCommonNameZh('Carnivora')).toBe('食肉目');
    expect(getCommonNameZh('Animalia')).toBe('动物界');
  });

  it('is case insensitive', () => {
    expect(getCommonNameZh('panthera tigris')).toBe('虎');
    expect(getCommonNameZh('FELIDAE')).toBe('猫科');
  });

  it('falls back to the scientific name itself when unknown', () => {
    // 回退学名，而不是返回空串或猜一个中文名
    expect(getCommonNameZh('Notarealgenus notarealspecies')).toBe(
      'Notarealgenus notarealspecies',
    );
    expect(getSpeciesNameZh('Notarealgenus notarealspecies')).toBeUndefined();
    expect(getRankNameZh('Notarealgenus')).toBeUndefined();
  });

  it('returns an empty string for empty input without throwing', () => {
    expect(getCommonNameZh('   ')).toBe('');
  });

  it('labels the level of known higher taxa', () => {
    expect(getRankLevelOf('Felidae')).toBe('family');
    expect(getRankLevelOf('Panthera')).toBe('genus');
    expect(getRankLevelOf('Animalia')).toBe('kingdom');
    expect(getRankLevelOf('Notarealgenus')).toBeUndefined();
  });

  it('covers every hot search animal', () => {
    for (const [scientificName, zh] of [
      ['Ailuropoda melanoleuca', '大熊猫'],
      ['Panthera tigris', '虎'],
      ['Rhinopithecus roxellana', '川金丝猴'],
      ['Panthera uncia', '雪豹'],
      ['Lipotes vexillifer', '白鱀豚'],
      ['Nipponia nippon', '朱鹮'],
      ['Pantholops hodgsonii', '藏羚'],
      ['Acipenser sinensis', '中华鲟'],
    ] as const) {
      expect(SPECIES_ZH[scientificName]).toBe(zh);
    }
  });

  it('does not map the same chinese name to two different taxa', () => {
    const seen = new Map<string, string>();
    for (const [scientificName, zh] of [
      ...Object.entries(SPECIES_ZH),
      ...Object.entries(RANK_ZH),
    ]) {
      const existing = seen.get(zh);
      if (existing && existing !== scientificName) {
        throw new Error(`"${zh}" maps to both ${existing} and ${scientificName}`);
      }
      seen.set(zh, scientificName);
    }
  });
});

describe('zhNameIndex', () => {
  it('maps chinese common names to scientific names', () => {
    expect(lookupScientificNameByZh('东北虎')).toBe('Panthera tigris');
    expect(lookupScientificNameByZh('华南虎')).toBe('Panthera tigris');
    expect(lookupScientificNameByZh('大猫熊')).toBe('Ailuropoda melanoleuca');
    expect(lookupScientificNameByZh('金丝猴')).toBe('Rhinopithecus roxellana');
    expect(lookupScientificNameByZh('猫科')).toBe('Felidae');
  });

  it('returns undefined for an unknown chinese name', () => {
    expect(lookupScientificNameByZh('不存在的动物名')).toBeUndefined();
  });

  it('detects CJK input', () => {
    expect(containsCjk('东北虎')).toBe(true);
    expect(containsCjk('Panthera tigris')).toBe(false);
  });

  it('normalises chinese queries', () => {
    expect(resolveQueryToScientificName('  东北虎 ')).toBe('Panthera tigris');
    expect(resolveQueryToScientificName('“大熊猫”')).toBe('Ailuropoda melanoleuca');
  });

  it('passes latin names through untouched', () => {
    expect(resolveQueryToScientificName('Panthera tigris')).toBe('Panthera tigris');
    expect(resolveQueryToScientificName('  Panthera tigris  ')).toBe('Panthera tigris');
  });

  it('returns null for chinese names it does not know, and for empty input', () => {
    expect(resolveQueryToScientificName('不存在的动物名')).toBeNull();
    expect(resolveQueryToScientificName('   ')).toBeNull();
  });

  it('keeps the alias table pointing at real, indexable species', () => {
    for (const [zh, scientificName] of Object.entries(ZH_NAME_INDEX)) {
      expect(zh.trim()).not.toBe('');
      expect(scientificName.trim()).not.toBe('');
    }
  });
});
