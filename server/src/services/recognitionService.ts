import { buildChatCompletionsUrl, getAiProviderConfig } from '../config/aiProvider';
import { logger } from '../utils/logger';
import { enrichAnimal } from './animalService';

type RecognitionPayload = {
  image: string;
};

type LocalAiResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    code?: string;
    message?: string;
  };
};

type RecognitionData = {
  animal?: {
    id?: string;
    commonNameZh?: string;
    commonNameEn?: string;
    scientificName?: string;
  };
  taxonomy?: Record<
    string,
    { scientificName?: string; commonNameZh?: string } | undefined
  >;
  confidence?: number;
};

const TAXONOMY_LEVELS = [
  'kingdom',
  'phylum',
  'class',
  'order',
  'family',
  'genus',
  'species',
] as const;

const { baseUrl, apiKey, model, provider } = getAiProviderConfig();
const chatCompletionsUrl = buildChatCompletionsUrl(baseUrl);
const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 120_000;

logger.info(
  'recognition',
  `config: provider=${provider} url=${chatCompletionsUrl} model=${model} apiKey=${
    apiKey ? `set(${apiKey.length} chars)` : 'not set'
  } timeout=${REQUEST_TIMEOUT_MS}ms`,
);

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
  const startedAt = Date.now();
  const imageSizeKb = Math.round((payload.image.length / 1024) * 10) / 10;
  logger.info(
    'recognition',
    `→ recognize start: image=${imageSizeKb}KB (chars=${payload.image.length})`,
  );

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Inject API key when the provider requires one (e.g. OpenAI, OpenRouter)
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const body = JSON.stringify({
    model,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '识别图片中的动物。当识别为一个有效的动物时，返回 JSON，格式为 {"animal":{"commonNameZh":"中文名","commonNameEn":"English name","scientificName":"Scientific name"},"taxonomy":{"kingdom":{"scientificName":"Animalia","commonNameZh":"动物界"},"phylum":{"scientificName":"...","commonNameZh":"..."},"class":{"scientificName":"...","commonNameZh":"..."},"order":{"scientificName":"...","commonNameZh":"..."},"family":{"scientificName":"...","commonNameZh":"..."},"genus":{"scientificName":"...","commonNameZh":"..."},"species":{"scientificName":"...","commonNameZh":"..."}},"confidence":0.0}。taxonomy 需要给出该动物完整的界门纲目科属种分类，学名使用拉丁学名。无法确定时也可以给出最可能的一两种动物和分类。',
          },
          {
            type: 'image_url',
            image_url: { url: payload.image },
          },
        ],
      },
    ],
  });
  logger.info(
    'recognition',
    `→ POST ${chatCompletionsUrl} (body=${Math.round((body.length / 1024) * 10) / 10}KB)`,
  );

  let response: Response;
  try {
    response = await fetch(chatCompletionsUrl, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    const reason = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    logger.error(
      'recognition',
      `✗ AI request failed after ${elapsed}ms — ${reason} (check AI_BASE_URL reachable / key valid / network)`,
    );
    throw new Error(`AI request failed: ${reason}`);
  }

  const elapsed = Date.now() - startedAt;
  logger.info('recognition', `← AI responded in ${elapsed}ms, status=${response.status}`);

  if (!response.ok) {
    const errorText = (await response.text().catch(() => '')).slice(0, 500);
    logger.error(
      'recognition',
      `✗ AI returned ${response.status}: ${errorText || '(empty body)'}`,
    );
    throw new Error(`AI request failed with status ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as LocalAiResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    logger.error(
      'recognition',
      `✗ AI response missing content: ${JSON.stringify(data).slice(0, 500)}`,
    );
    throw new Error('AI response did not include recognition content');
  }
  logger.info(
    'recognition',
    `← content (${content.length} chars): ${content.slice(0, 200)}${content.length > 200 ? '…' : ''}`,
  );

  let recognized: RecognitionData;
  try {
    recognized = parseRecognitionContent(content);
  } catch (err) {
    logger.error(
      'recognition',
      `✗ JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw new Error('AI response was not valid JSON');
  }

  const animal = recognized.animal || {};
  logger.info(
    'recognition',
    `✓ parsed: animal=${animal.commonNameZh || '未知'} (${
      animal.scientificName || 'n/a'
    }) confidence=${recognized.confidence ?? 'n/a'}`,
  );

  const taxonomy: Record<string, { scientificName: string; commonNameZh: string }> = {};
  for (const level of TAXONOMY_LEVELS) {
    const item = recognized.taxonomy?.[level];
    if (item?.scientificName) {
      taxonomy[level] = {
        scientificName: item.scientificName,
        commonNameZh: item.commonNameZh || item.scientificName,
      };
    }
  }

  const scientificName = animal.scientificName || animal.commonNameEn || animal.commonNameZh || '';

  // LLM 的分类此前从不校验。这里交给 ITIS 校正；ITIS 查不到就保留 LLM 结果，
  // 并由 dataSources.taxonomy 如实标注来源，前端/排查都能分辨。
  const enriched = await enrichAnimal({
    id: scientificName || 'unknown',
    commonNameZh: animal.commonNameZh || '未知动物',
    commonNameEn: animal.commonNameEn || 'Unknown Animal',
    scientificName: scientificName || 'Unknown species',
    taxonomy,
  });

  logger.info(
    'recognition',
    `✓ enriched: taxonomy=${enriched.dataSources.taxonomy} conservation=${enriched.dataSources.conservation} status=${
      enriched.conservationStatus?.iucnStatus ?? 'n/a'
    }`,
  );

  return {
    animal: {
      id: enriched.id,
      commonNameZh: enriched.commonNameZh,
      commonNameEn: enriched.commonNameEn,
      scientificName: enriched.scientificName,
      taxonomy: enriched.taxonomy,
      ...(enriched.subspecies && enriched.subspecies.length > 0
        ? { subspecies: enriched.subspecies }
        : {}),
      ...(enriched.conservationStatus
        ? { conservationStatus: enriched.conservationStatus }
        : {}),
    },
    confidence:
      typeof recognized.confidence === 'number' ? recognized.confidence : 0,
    dataSources: enriched.dataSources,
  };
};
