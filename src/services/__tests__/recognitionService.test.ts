import { recognizeAnimal } from '../recognitionService';

describe('recognizeAnimal', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends the image uri to the backend recognition API when base64 is unavailable', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          animal: {
            commonNameZh: '东北虎',
            commonNameEn: 'Siberian Tiger',
            scientificName: 'Panthera tigris altaica',
            images: ['file:///tmp/tiger.jpg'],
          },
          confidence: 0.98,
          timestamp: 123,
        },
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const imageUri = 'file:///tmp/tiger.jpg';

    const result = await recognizeAnimal(imageUri);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/recognize'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ image: imageUri }),
      }),
    );
    expect(result.animal.images[0]).toBe(imageUri);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('sends base64 image data to the backend recognition API', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          animal: {
            commonNameZh: '大熊猫',
            commonNameEn: 'Giant Panda',
            scientificName: 'Ailuropoda melanoleuca',
          },
          confidence: 0.87,
          timestamp: 123,
        },
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await recognizeAnimal('file:///tmp/panda.jpg', {
      base64: 'abc123',
      mimeType: 'image/jpeg',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/recognize'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ image: 'data:image/jpeg;base64,abc123' }),
      }),
    );
    expect(result.animal.commonNameZh).toBe('大熊猫');
    expect(result.confidence).toBe(0.87);
  });
});
