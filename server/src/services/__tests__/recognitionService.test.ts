import { recognizeByImage } from '../recognitionService';

describe('recognizeByImage', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('uses the local vision model to recognize an animal image', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                animal: {
                  commonNameZh: '大熊猫',
                  commonNameEn: 'Giant Panda',
                  scientificName: 'Ailuropoda melanoleuca',
                },
                confidence: 0.87,
              }),
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await recognizeByImage({
      image: 'data:image/jpeg;base64,abc123',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://192.168.5.3:1234/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.model).toBe('qwen/qwen3.6-35b-a3b');
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
});
