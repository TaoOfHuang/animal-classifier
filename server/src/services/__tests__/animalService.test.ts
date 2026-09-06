import { getAnimalById } from '../animalService';

describe('getAnimalById', () => {
  it('returns fallback detail with iucn status when external apis are unavailable', async () => {
    const data = await getAnimalById('1');

    expect(data.id).toBe('1');
    expect(data.taxonomy).toBeTruthy();
    expect(data.conservationStatus?.iucnStatus).toBeTruthy();
    expect(Array.isArray(data.images)).toBe(true);
  });
});
