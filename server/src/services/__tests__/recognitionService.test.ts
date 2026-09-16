import { buildChatCompletionsUrl, getAiProviderConfig } from '../../config/aiProvider';
import { clearCache } from '../../utils/cache';
import { setConservationProviderOverride } from '../conservation';
import { ConservationStatus } from '../conservation/types';
import { recognizeByImage } from '../recognitionService';
import { createFetchMock, installFetchMock } from './helpers/httpMock';
import { ITIS_ROUTES } from './helpers/itisRoutes';

const originalFetch = global.fetch;

const { baseUrl } = getAiProviderConfig();
const AI_URL = buildChatCompletionsUrl(baseUrl);

const aiReply = (payload: unknown) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
});

const conservationProvider = (status: ConservationStatus | null) => ({
  name: status?.source ?? 'static',
  lookup: jest.fn().mockResolvedValue(status),
});

describe('recognizeByImage', () => {
  beforeEach(() => {
    clearCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setConservationProviderOverride(null);
    jest.restoreAllMocks();
  });

  const installFetch = (aiPayload: unknown) =>
    installFetchMock(
      createFetchMock({
        routes: {
          [AI_URL]: () => aiReply(aiPayload),
          ...ITIS_ROUTES,
        },
        // 未 mock 的 ITIS 端点一律当作「查不到」，不要抛错打断识别
        fallback: () => ({}),
      }),
    );

  it('uses the local vision model to recognize an animal image', async () => {
    const fetchMock = installFetch({
      animal: {
        commonNameZh: '大熊猫',
        commonNameEn: 'Giant Panda',
        scientificName: 'Ailuropoda melanoleuca',
      },
      confidence: 0.87,
    });

    const result = await recognizeByImage({
      image: 'data:image/jpeg;base64,abc123',
    });

    const { model } = getAiProviderConfig();
    expect(fetchMock).toHaveBeenCalledWith(
      AI_URL,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
    const requestBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(requestBody.model).toBe(model);
    expect(requestBody.messages[0].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'image_url',
          image_url: { url: 'data:image/jpeg;base64,abc123' },
        }),
      ]),
    );
    expect(result.animal.commonNameZh).toBe('大熊猫');
    expect(result.animal.scientificName).toBe('Ailuropoda melanoleuca');
    expect(result.confidence).toBe(0.87);
  });

  it('overrides a wrong llm family with the itis lineage', async () => {
    setConservationProviderOverride(conservationProvider(null));
    installFetch({
      animal: {
        commonNameZh: '虎',
        commonNameEn: 'Tiger',
        scientificName: 'Panthera tigris',
      },
      taxonomy: {
        kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
        phylum: { scientificName: 'Chordata', commonNameZh: '脊索动物门' },
        class: { scientificName: 'Mammalia', commonNameZh: '哺乳纲' },
        // LLM 把虎归到了熊科
        order: { scientificName: 'Carnivora', commonNameZh: '食肉目' },
        family: { scientificName: 'Ursidae', commonNameZh: '熊科' },
        genus: { scientificName: 'Panthera', commonNameZh: '豹属' },
        species: { scientificName: 'Panthera tigris', commonNameZh: '虎' },
      },
      confidence: 0.9,
    });

    const result = await recognizeByImage({ image: 'data:image/jpeg;base64,abc' });

    expect(result.animal.taxonomy?.family?.scientificName).toBe('Felidae');
    expect(result.animal.taxonomy?.family?.commonNameZh).toBe('猫科');
    expect(result.dataSources.taxonomy).toBe('itis');
  });

  it('keeps the llm taxonomy when itis cannot resolve the name', async () => {
    setConservationProviderOverride(conservationProvider(null));
    installFetch({
      animal: {
        commonNameZh: '未知动物',
        commonNameEn: 'Unknown',
        scientificName: 'Notarealgenus notarealspecies',
      },
      taxonomy: { family: { scientificName: 'Madeupidae', commonNameZh: '虚构科' } },
      confidence: 0.4,
    });

    const result = await recognizeByImage({ image: 'data:image/jpeg;base64,abc' });

    expect(result.animal.taxonomy?.family?.scientificName).toBe('Madeupidae');
    expect(result.dataSources.taxonomy).toBe('llm');
  });

  it('reports EX rather than EN for an extinct species', async () => {
    setConservationProviderOverride(
      conservationProvider({ iucnStatus: 'EX', source: 'iucn_v4', assessmentYear: 2024 }),
    );
    installFetch({
      animal: {
        commonNameZh: '白鱀豚',
        commonNameEn: 'Baiji',
        scientificName: 'Lipotes vexillifer',
      },
      confidence: 0.8,
    });

    const result = await recognizeByImage({ image: 'data:image/jpeg;base64,abc' });

    expect(result.animal.conservationStatus?.iucnStatus).toBe('EX');
    expect(result.dataSources.conservation).toBe('iucn_v4');
  });

  it('omits conservationStatus entirely when there is no assessment', async () => {
    setConservationProviderOverride(conservationProvider(null));
    installFetch({
      animal: {
        commonNameZh: '虎',
        commonNameEn: 'Tiger',
        scientificName: 'Panthera tigris',
      },
      confidence: 0.9,
    });

    const result = await recognizeByImage({ image: 'data:image/jpeg;base64,abc' });

    expect(result.animal.conservationStatus).toBeUndefined();
    expect(result.dataSources.conservation).toBe('none');
  });

  it('still returns a result when both itis and iucn are down', async () => {
    setConservationProviderOverride({
      name: 'iucn_v4',
      lookup: jest.fn().mockRejectedValue(new Error('iucn down')),
    });
    installFetchMock(
      createFetchMock({
        routes: {
          [AI_URL]: () =>
            aiReply({
              animal: {
                commonNameZh: '虎',
                commonNameEn: 'Tiger',
                scientificName: 'Panthera tigris',
              },
              taxonomy: { family: { scientificName: 'Felidae', commonNameZh: '猫科' } },
              confidence: 0.9,
            }),
          itis: () => ({ ok: false, status: 503, arrayBuffer: async () => new ArrayBuffer(0) }),
        },
        fallback: () => ({}),
      }),
    );

    const result = await recognizeByImage({ image: 'data:image/jpeg;base64,abc' });

    expect(result.animal.commonNameZh).toBe('虎');
    expect(result.animal.taxonomy?.family?.scientificName).toBe('Felidae');
    expect(result.dataSources).toEqual({ taxonomy: 'llm', conservation: 'none' });
  });
});
