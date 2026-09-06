import { getCameraErrorHandling } from '../cameraError';

describe('getCameraErrorHandling', () => {
  it('returns gallery fallback for camera_unavailable', () => {
    const result = getCameraErrorHandling('camera_unavailable');

    expect(result.title).toBe('模拟器相机不可用');
    expect(result.message).toContain('改为从相册选择');
    expect(result.fallbackToGallery).toBe(true);
  });
});
