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
    // 叙述性字段：ITIS / IUCN 都不产出，只能由视觉模型一并写出来
    habitat?: string;
    lifestyle?: string;
    distribution?: string;
  };
  taxonomy?: Record<
    string,
    { scientificName?: string; commonNameZh?: string } | undefined
  >;
  confidence?: number;
};

/**
 * 识别提示词。
 *
 * habitat / lifestyle / distribution 是**新增**的：这三个字段原先前后端都没有产出方，
 * 详情页只能显示本地硬编码兜底（历史上是按「科」硬编码，猫科任何动物都会显示东北虎的
 * 分布，属于张冠李戴，已删除）。ITIS 不提供，IUCN 只提供结构化的栖息地分类编码
 * （见 services/conservation/README.md），所以这里让一次识别把它们一并写出来。
 *
 * 措辞上明确「把握不足就留空、不要编造具体数字/地名/年份」——宁可没有，
 * 也不要让模型幻觉变成 App 里的「事实」。
 */
const RECOGNITION_PROMPT = [
  '识别图片中的动物。当识别为一个有效的动物时，返回 JSON，格式为 ',
  '{"animal":{"commonNameZh":"中文名","commonNameEn":"English name","scientificName":"Scientific name",',
  '"habitat":"栖息地描述","lifestyle":"生活习性描述","distribution":"地理分布描述"},',
  '"taxonomy":{"kingdom":{"scientificName":"Animalia","commonNameZh":"动物界"},',
  '"phylum":{"scientificName":"...","commonNameZh":"..."},"class":{"scientificName":"...","commonNameZh":"..."},',
  '"order":{"scientificName":"...","commonNameZh":"..."},"family":{"scientificName":"...","commonNameZh":"..."},',
  '"genus":{"scientificName":"...","commonNameZh":"..."},"species":{"scientificName":"...","commonNameZh":"..."}},',
  '"confidence":0.0}。',
  'taxonomy 需要给出该动物完整的界门纲目科属种分类，学名使用拉丁学名。',
  'habitat / lifestyle / distribution 各用 1-3 句中文写：',
  'habitat 写典型的栖息环境与海拔/气候偏好；',
  'lifestyle 写活动节律、食性、社会结构等习性；',
  'distribution 写地理分布范围。',
  '这三项只写你有把握的内容，把握不足就填空字符串 ""，',
  '不要编造具体的种群数字、精确地名或年份。',
  '无法确定物种时也可以给出最可能的一两种动物和分类。',
].join('');

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

/** 叙述性文本上限，防止模型写出整篇文章把响应撑爆 */
const MAX_NARRATIVE_CHARS = 600;

/**
 * 规整 LLM 写出的叙述性文本：去首尾空白、截断超长内容。
 * 返回 undefined 表示「模型没写」—— 上层据此让字段整个消失，
 * 而不是塞一个「整理中」之类的假占位。
 */
const cleanNarrative = (value?: string): string | undefined => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.length > MAX_NARRATIVE_CHARS
    ? trimmed.slice(0, MAX_NARRATIVE_CHARS)
    : trimmed;
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
            text: RECOGNITION_PROMPT,
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

  const habitat = cleanNarrative(animal.habitat);
  const lifestyle = cleanNarrative(animal.lifestyle);
  const distribution = cleanNarrative(animal.distribution);

  // LLM 的分类此前从不校验。这里交给 ITIS 校正；ITIS 查不到就保留 LLM 结果，
  // 并由 dataSources.taxonomy 如实标注来源，前端/排查都能分辨。
  const enriched = await enrichAnimal({
    id: scientificName || 'unknown',
    commonNameZh: animal.commonNameZh || '未知动物',
    commonNameEn: animal.commonNameEn || 'Unknown Animal',
    scientificName: scientificName || 'Unknown species',
    taxonomy,
    habitat,
    lifestyle,
    distribution,
  });

  logger.info(
    'recognition',
    `✓ enriched: taxonomy=${enriched.dataSources.taxonomy} conservation=${enriched.dataSources.conservation} narrative=${enriched.dataSources.narrative} status=${
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
      // 模型没写的字段整个不出现，前端据此决定是否渲染那张卡
      ...(enriched.habitat ? { habitat: enriched.habitat } : {}),
      ...(enriched.lifestyle ? { lifestyle: enriched.lifestyle } : {}),
      ...(enriched.distribution ? { distribution: enriched.distribution } : {}),
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
