export type AiProvider = 'openai' | 'ollama' | 'openrouter' | 'custom';

export interface AiProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  provider: AiProvider;
}

const DEFAULT_PROVIDER: AiProvider = 'ollama';
const DEFAULT_BASE_URL = 'http://192.168.5.3:1234';
const DEFAULT_MODEL = 'qwen/qwen3.6-35b-a3b';

export const getAiProviderConfig = (): AiProviderConfig => {
  return {
    baseUrl: process.env.AI_BASE_URL || DEFAULT_BASE_URL,
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || DEFAULT_MODEL,
    provider: (process.env.AI_PROVIDER?.toLowerCase() as AiProvider) || DEFAULT_PROVIDER,
  };
};
