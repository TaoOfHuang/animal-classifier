import { prepareImageForRecognition } from '../image';

describe('prepareImageForRecognition', () => {
  it('infers png mime type by uri extension', () => {
    const result = prepareImageForRecognition('file:///tmp/photo.png');

    expect(result.mimeType).toBe('image/png');
    expect(result.fileName).toBe('photo.png');
  });

  it('throws when image uri is empty', () => {
    expect(() => prepareImageForRecognition('  ')).toThrow('图片地址无效');
  });
});
