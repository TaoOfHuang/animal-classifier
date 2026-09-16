export type AiProvider = 'openai' | 'ollama' | 'openrouter' | 'deepseek' | 'bigmodel' | 'custom';

export interface AiProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  provider: AiProvider;
}

const DEFAULT_PROVIDER: AiProvider = 'ollama';
const DEFAULT_BASE_URL = 'http://192.168.5.8:1234';
const DEFAULT_MODEL = 'qwen/qwen3.6-35b-a3b';

export const getAiProviderConfig = (): AiProviderConfig => {
  return {
    baseUrl: process.env.AI_BASE_URL || DEFAULT_BASE_URL,
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || DEFAULT_MODEL,
    provider: (process.env.AI_PROVIDER?.toLowerCase() as AiProvider) || DEFAULT_PROVIDER,
  };
};

// Chat completions path differs across providers: BigModel (Zhipu) uses
// {base}/chat/completions while OpenAI-compatible servers use {base}/v1/chat/completions.
export const buildChatCompletionsUrl = (
  baseUrl: string,
): string => {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${trimmed}/chat/completions`;
};
