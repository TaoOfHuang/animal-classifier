import { getTaxonomyTree } from '../taxonomyService';

describe('getTaxonomyTree', () => {
  it('returns fallback structure when external api is unavailable', async () => {
    const result = await getTaxonomyTree('family', 'Felidae');

    expect(result.current.level).toBe('family');
    expect(result.current.scientificName).toBe('Felidae');
    expect(Array.isArray(result.children)).toBe(true);
  });
});
