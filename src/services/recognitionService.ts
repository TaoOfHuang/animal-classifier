import { Animal, RecognitionResult } from '../types';
import { requestJson } from './api';
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

/** requestJson 已经解包了信封，这里取 data 的形状 */
type RecognitionPayload = NonNullable<RecognitionApiResponse['data']>;

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

  // 令牌由 api 层统一注入（设备令牌，见 ./deviceAuth）。
  // 401 会由 api 层自动重新注册后重试一次；403/429 直接抛出——配额用尽时
  // 重新注册会重置配额，那是不允许的。
  const data = await requestJson<RecognitionPayload>('/api/recognize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
  });

  if (!data?.animal) {
    throw new Error('Invalid recognition response');
  }

  return {
    ...data,
    animal: {
      ...data.animal,
      taxonomy: data.animal.taxonomy || {},
      images: data.animal.images || [prepared.uri],
    },
    timestamp: data.timestamp || Date.now(),
  } as RecognitionResult;
};
