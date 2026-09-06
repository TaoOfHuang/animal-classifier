import { getAiProviderConfig } from '../config/aiProvider';

type RecognitionPayload = {
  image: string;
};

type LocalAiResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type RecognitionData = {
  animal?: {
    id?: string;
    commonNameZh?: string;
    commonNameEn?: string;
    scientificName?: string;
  };
  confidence?: number;
};

const { baseUrl, apiKey, model } = getAiProviderConfig();

const stripCodeFence = (content: string) =>
  content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

const parseRecognitionContent = (content: string): RecognitionData => {
  const parsed = JSON.parse(stripCodeFence(content)) as RecognitionData;
  return parsed;
};

export const recognizeByImage = async (payload: RecognitionPayload) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Inject API key when the provider requires one (e.g. OpenAI, OpenRouter)
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '识别图片中的动物。只返回 JSON，格式为 {"animal":{"commonNameZh":"中文名","commonNameEn":"English name","scientificName":"Scientific name"},"confidence":0.0}。无法确定时也给出最可能的动物。',
            },
            {
              type: 'image_url',
              image_url: { url: payload.image },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed with status ${response.status}`);
  }

  const data = (await response.json()) as LocalAiResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI response did not include recognition content');
  }

  const recognized = parseRecognitionContent(content);
  const animal = recognized.animal || {};

  return {
    animal: {
      id: animal.scientificName || animal.commonNameEn || animal.commonNameZh || 'unknown',
      commonNameZh: animal.commonNameZh || '未知动物',
      commonNameEn: animal.commonNameEn || 'Unknown Animal',
      scientificName: animal.scientificName || 'Unknown species',
    },
    confidence: typeof recognized.confidence === 'number' ? recognized.confidence : 0,
  };
};
