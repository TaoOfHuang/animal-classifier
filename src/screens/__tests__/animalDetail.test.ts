// 详情页查询 key 的解析规则
//
// 背景（线上实测）：
//   GET /api/animal/2                        → 404  No animal found for "2"
//   GET /api/animal/Ailuropoda melanoleuca   → 200
//   GET /api/animal/Panthera tigris altaica  → 404（三名亚种名不认）
//   GET /api/animal/Panthera tigris          → 200
//
// 即：接口按**学名（双名法）**查，而 `animal.id` 在首页示例数据里是序号。
// 这里把这两条规则锁住，防止再回退成「拿 id 直接查」。

import {
  buildDetailLookupCandidates,
  toBinomialName,
} from '../animalDetail';

describe('toBinomialName', () => {
  it('三名亚种名收成双名法', () => {
    expect(toBinomialName('Panthera tigris altaica')).toBe('Panthera tigris');
  });

  it('已经是双名法时原样返回', () => {
    expect(toBinomialName('Ailuropoda melanoleuca')).toBe(
      'Ailuropoda melanoleuca',
    );
  });

  it('去掉多余空白', () => {
    expect(toBinomialName('  Canis   lupus  ')).toBe('Canis lupus');
  });

  it('空值和单名都不报错', () => {
    expect(toBinomialName(undefined)).toBe('');
    expect(toBinomialName('')).toBe('');
    expect(toBinomialName('   ')).toBe('');
    expect(toBinomialName('Panthera')).toBe('Panthera');
  });
});

describe('buildDetailLookupCandidates', () => {
  it('识别链路：id 本来就是学名，去重后只留一个候选', () => {
    expect(
      buildDetailLookupCandidates({
        id: 'Panthera tigris',
        scientificName: 'Panthera tigris',
      }),
    ).toEqual(['Panthera tigris']);
  });

  it('首页示例数据：序号 id 排在学名之后，不再被优先使用', () => {
    expect(
      buildDetailLookupCandidates({
        id: '2',
        scientificName: 'Ailuropoda melanoleuca',
      }),
    ).toEqual(['Ailuropoda melanoleuca', '2']);
  });

  it('三名亚种名：双名法排第一，原始亚种名留作兜底', () => {
    expect(
      buildDetailLookupCandidates({
        id: '1',
        scientificName: 'Panthera tigris altaica',
      }),
    ).toEqual(['Panthera tigris', 'Panthera tigris altaica', '1']);
  });

  it('只有 id 时仍然返回它', () => {
    expect(buildDetailLookupCandidates({ id: '2' })).toEqual(['2']);
  });

  it('什么都没有时返回空数组（详情页据此不发请求）', () => {
    expect(buildDetailLookupCandidates({})).toEqual([]);
  });
});
