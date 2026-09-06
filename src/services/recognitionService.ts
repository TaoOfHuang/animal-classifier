import { Animal, RecognitionResult } from '../types';
import { API_BASE_URL, API_TOKEN } from './api';
import { prepareImageForRecognition } from '../utils/image';

const USE_BACKEND_API = true;

type RecognitionImageData = {
  base64?: string;
  mimeType?: string;
};

const mockRecognize = async (imageUri: string): Promise<RecognitionResult> => {
  const mockAnimal: Animal = {
    id: '1',
    commonNameZh: '东北虎',
    commonNameEn: 'Siberian Tiger',
    scientificName: 'Panthera tigris altaica',
    images: [imageUri],
    taxonomy: {
      kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
      phylum: { scientificName: 'Chordata', commonNameZh: '脊索动物' },
      class: { scientificName: 'Mammalia', commonNameZh: '哺乳纲' },
      order: { scientificName: 'Carnivora', commonNameZh: '食肉目' },
      family: { scientificName: 'Felidae', commonNameZh: '猫科' },
      genus: { scientificName: 'Panthera', commonNameZh: '豹属' },
      species: { scientificName: 'Panthera tigris', commonNameZh: '虎' },
    },
    habitat: '主要分布于俄罗斯远东地区、中国东北部及朝鲜北部。',
    lifestyle: '独居动物，领地意识强。主要在晨昏活动，善于游泳。',
    conservationStatus: {
      iucnStatus: 'EN',
      population: 500,
      populationTrend: 'stable',
      assessmentYear: 2021,
    },
  };

  return {
    animal: mockAnimal,
    confidence: 0.985,
    timestamp: Date.now(),
  };
};

type RecognitionApiResponse = {
  success: boolean;
  data?: {
    animal: Partial<Animal>;
    confidence: number;
    timestamp?: number;
  };
  error?: {
    code: string;
    message: string;
  };
};

export const recognizeAnimal = async (
  imageUri: string,
  imageData?: RecognitionImageData,
): Promise<RecognitionResult> => {
  const prepared = prepareImageForRecognition(imageUri);
  const image = imageData?.base64
    ? `data:${imageData.mimeType || prepared.mimeType};base64,${imageData.base64}`
    : prepared.uri;

  if (!USE_BACKEND_API) {
    return mockRecognize(prepared.uri);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Send API token when configured
  if (API_TOKEN) {
    headers['Authorization'] = `Bearer ${API_TOKEN}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/recognize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ image }),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const errorMessage = (errorBody as any)?.error?.message || `Recognition request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  const payload = (await response.json()) as RecognitionApiResponse;
  if (!payload?.success || !payload?.data) {
    throw new Error(payload.error?.message || 'Invalid recognition response');
  }

  return {
    ...payload.data,
    animal: {
      ...payload.data.animal,
      taxonomy: payload.data.animal.taxonomy || {
        kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
        phylum: { scientificName: 'Chordata', commonNameZh: '脊索动物' },
        class: { scientificName: 'Mammalia', commonNameZh: '哺乳纲' },
        order: { scientificName: 'Carnivora', commonNameZh: '食肉目' },
        family: { scientificName: 'Felidae', commonNameZh: '猫科' },
        genus: { scientificName: 'Panthera', commonNameZh: '豹属' },
        species: { scientificName: 'Panthera tigris', commonNameZh: '虎' },
      },
      images: payload.data.animal.images || [prepared.uri],
    },
    timestamp: payload.data.timestamp || Date.now(),
  } as RecognitionResult;
};
