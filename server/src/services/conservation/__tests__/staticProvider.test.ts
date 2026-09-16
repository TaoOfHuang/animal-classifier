import { staticProvider } from '../staticProvider';

describe('staticProvider', () => {
  it('returns a complete status for a species in the offline dataset', async () => {
    const status = await staticProvider.lookup('Panthera tigris');

    expect(status).toEqual(
      expect.objectContaining({
        iucnStatus: 'EN',
        populationTrend: 'decreasing',
        assessmentYear: 2022,
        source: 'static',
      }),
    );
    expect(status?.threats?.length).toBeGreaterThan(0);
  });

  it('returns null for an unknown species instead of a hardcoded EN', async () => {
    await expect(staticProvider.lookup('Notarealgenus notarealspecies')).resolves.toBeNull();
  });

  it('is case insensitive', async () => {
    await expect(staticProvider.lookup('panthera tigris')).resolves.toEqual(
      expect.objectContaining({ iucnStatus: 'EN' }),
    );
  });

  it('accepts a chinese name', async () => {
    await expect(staticProvider.lookup('大熊猫')).resolves.toEqual(
      expect.objectContaining({ iucnStatus: 'VU', population: 1864, source: 'static' }),
    );
  });

  it('omits population when the dataset has no verifiable number', async () => {
    const status = await staticProvider.lookup('Panthera uncia');

    expect(status?.iucnStatus).toBe('VU');
    // 雪豹只有区间估计值，数据集里刻意不写 population
    expect(status?.population).toBeUndefined();
  });

  it('reports EX/EW/DD correctly (they must not collapse to EN)', async () => {
    await expect(staticProvider.lookup('Elaphurus davidianus')).resolves.toEqual(
      expect.objectContaining({ iucnStatus: 'EW' }),
    );
    await expect(staticProvider.lookup('Natator depressus')).resolves.toEqual(
      expect.objectContaining({ iucnStatus: 'DD' }),
    );
  });

  it('exposes its own name for the dataSources field', () => {
    expect(staticProvider.name).toBe('static');
  });
});
