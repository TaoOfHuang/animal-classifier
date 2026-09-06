// 分类服务测试

import {
  getParentLevel,
  getChildLevel,
  fetchTaxonomyChildren,
  fetchTaxonomyBreadcrumb,
  fetchTaxonomyDetail,
  searchTaxonomy,
  buildTaxonomyPath,
} from '../taxonomyService';
import { TaxonomyInfo } from '../../types';

describe('taxonomyService', () => {
  describe('getParentLevel', () => {
    it('returns parent level for valid levels', () => {
      expect(getParentLevel('phylum')).toBe('kingdom');
      expect(getParentLevel('class')).toBe('phylum');
      expect(getParentLevel('order')).toBe('class');
      expect(getParentLevel('family')).toBe('order');
      expect(getParentLevel('genus')).toBe('family');
      expect(getParentLevel('species')).toBe('genus');
    });

    it('returns null for kingdom (no parent)', () => {
      expect(getParentLevel('kingdom')).toBeNull();
    });
  });

  describe('getChildLevel', () => {
    it('returns child level for valid levels', () => {
      expect(getChildLevel('kingdom')).toBe('phylum');
      expect(getChildLevel('phylum')).toBe('class');
      expect(getChildLevel('class')).toBe('order');
      expect(getChildLevel('order')).toBe('family');
      expect(getChildLevel('family')).toBe('genus');
      expect(getChildLevel('genus')).toBe('species');
    });

    it('returns null for species (no child)', () => {
      expect(getChildLevel('species')).toBeNull();
    });
  });

  describe('fetchTaxonomyChildren', () => {
    it('returns children for felidae family', async () => {
      const result = await fetchTaxonomyChildren('felidae', 'family');
      expect(result.children.length).toBeGreaterThan(0);
      expect(result.children.every(c => c.level === 'genus')).toBe(true);
    });

    it('returns children for panthera genus', async () => {
      const result = await fetchTaxonomyChildren('panthera', 'genus');
      expect(result.children.length).toBeGreaterThan(0);
      expect(result.children.every(c => c.level === 'species')).toBe(true);
    });

    it('supports pagination', async () => {
      const result1 = await fetchTaxonomyChildren('felidae', 'family', 2, 0);
      const result2 = await fetchTaxonomyChildren('felidae', 'family', 2, 2);

      expect(result1.children.length).toBeLessThanOrEqual(2);
      if (result1.total > 2) {
        expect(result1.children[0]?.id).not.toBe(result2.children[0]?.id);
      }
    });

    it('returns hasMore correctly', async () => {
      const result = await fetchTaxonomyChildren('felidae', 'family', 2, 0);
      if (result.total > 2) {
        expect(result.hasMore).toBe(true);
      }
    });

    it('returns empty for unknown parent', async () => {
      const result = await fetchTaxonomyChildren('unknown', 'order');
      expect(result.children).toEqual([]);
    });
  });

  describe('fetchTaxonomyBreadcrumb', () => {
    it('builds breadcrumb up to current level', async () => {
      const taxonomy: TaxonomyInfo = {
        kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
        phylum: { scientificName: 'Chordata', commonNameZh: '脊索动物门' },
        class: { scientificName: 'Mammalia', commonNameZh: '哺乳纲' },
        order: { scientificName: 'Carnivora', commonNameZh: '食肉目' },
        family: { scientificName: 'Felidae', commonNameZh: '猫科' },
        genus: { scientificName: 'Panthera', commonNameZh: '豹属' },
        species: { scientificName: 'Panthera tigris', commonNameZh: '虎' },
      };

      const breadcrumb = await fetchTaxonomyBreadcrumb(taxonomy, 'family');
      expect(breadcrumb.length).toBe(5); // kingdom to family
      expect(breadcrumb[0].scientificName).toBe('Animalia');
      expect(breadcrumb[4].scientificName).toBe('Felidae');
    });

    it('handles partial taxonomy', async () => {
      const taxonomy: TaxonomyInfo = {
        kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
        phylum: { scientificName: 'Chordata', commonNameZh: '脊索动物门' },
      };

      const breadcrumb = await fetchTaxonomyBreadcrumb(taxonomy, 'class');
      expect(breadcrumb.length).toBe(2);
    });
  });

  describe('fetchTaxonomyDetail', () => {
    it('returns detail for felidae', async () => {
      const result = await fetchTaxonomyDetail('family', 'Felidae');
      expect(result).not.toBeNull();
      expect(result?.current.scientificName).toBe('Felidae');
      expect(result?.current.commonNameZh).toBe('猫科');
    });

    it('includes parent information', async () => {
      const result = await fetchTaxonomyDetail('family', 'Felidae');
      expect(result?.parent).toBeDefined();
      expect(result?.parent?.scientificName).toBe('Carnivora');
    });

    it('includes child count', async () => {
      const result = await fetchTaxonomyDetail('family', 'Felidae');
      expect(result?.childCount).toBeGreaterThan(0);
    });

    it('returns null for unknown taxonomy', async () => {
      const result = await fetchTaxonomyDetail('family', 'Unknown');
      expect(result).toBeNull();
    });
  });

  describe('searchTaxonomy', () => {
    it('searches by scientific name', async () => {
      const results = await searchTaxonomy('Panthera');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.scientificName.includes('Panthera'))).toBe(
        true,
      );
    });

    it('searches by Chinese name', async () => {
      const results = await searchTaxonomy('豹');
      expect(results.length).toBeGreaterThan(0);
    });

    it('searches by English name', async () => {
      const results = await searchTaxonomy('Tiger');
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty for no match', async () => {
      const results = await searchTaxonomy('xyznonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('buildTaxonomyPath', () => {
    it('builds complete path from taxonomy', () => {
      const taxonomy: TaxonomyInfo = {
        kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
        phylum: { scientificName: 'Chordata', commonNameZh: '脊索动物门' },
        class: { scientificName: 'Mammalia', commonNameZh: '哺乳纲' },
        order: { scientificName: 'Carnivora', commonNameZh: '食肉目' },
        family: { scientificName: 'Felidae', commonNameZh: '猫科' },
        genus: { scientificName: 'Panthera', commonNameZh: '豹属' },
        species: { scientificName: 'Panthera tigris', commonNameZh: '虎' },
      };

      const path = buildTaxonomyPath(taxonomy);
      expect(path.length).toBe(7);
      expect(path[0].level).toBe('kingdom');
      expect(path[6].level).toBe('species');
    });

    it('handles partial taxonomy', () => {
      const taxonomy: TaxonomyInfo = {
        kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
        family: { scientificName: 'Felidae', commonNameZh: '猫科' },
      };

      const path = buildTaxonomyPath(taxonomy);
      expect(path.length).toBe(2);
      expect(path[0].level).toBe('kingdom');
      expect(path[1].level).toBe('family');
    });

    it('returns empty array for empty taxonomy', () => {
      const taxonomy: TaxonomyInfo = {};
      const path = buildTaxonomyPath(taxonomy);
      expect(path).toEqual([]);
    });
  });
});
