export type PreparedImage = {
  uri: string;
  mimeType: string;
  fileName: string;
};

const DEFAULT_MIME = 'image/jpeg';

const inferMimeType = (uri: string): string => {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  return DEFAULT_MIME;
};

const inferFileName = (uri: string): string => {
  const parts = uri.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && last.includes('.')) {
    return last;
  }
  return `animal-${Date.now()}.jpg`;
};

export const prepareImageForRecognition = (imageUri: string): PreparedImage => {
  if (!imageUri || !imageUri.trim()) {
    throw new Error('图片地址无效');
  }

  const cleanedUri = imageUri.trim();
  return {
    uri: cleanedUri,
    mimeType: inferMimeType(cleanedUri),
    fileName: inferFileName(cleanedUri),
  };
};
