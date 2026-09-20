import { ApiError } from '../../services/api';
import { getRecognitionErrorHandling } from '../recognitionError';

describe('getRecognitionErrorHandling', () => {
  it('把 fetch 的 Network request failed 认成网络失败，并允许重试', () => {
    const result = getRecognitionErrorHandling(
      new TypeError('Network request failed'),
    );

    expect(result.title).toBe('网络连接失败');
    expect(result.canRetry).toBe(true);
  });

  it('兼容 ApiError 实例（而不是只认普通对象）', () => {
    const result = getRecognitionErrorHandling(
      new ApiError('Request failed: 500', 500),
    );

    expect(result.title).toBe('识别服务暂时不可用');
    expect(result.canRetry).toBe(true);
  });

  it('单设备配额用尽时不给重试——重试必然再撞一次限额', () => {
    const result = getRecognitionErrorHandling({
      status: 429,
      code: 'DEVICE_QUOTA_EXCEEDED',
    });

    expect(result.title).toBe('今日识别额度已用完');
    expect(result.canRetry).toBe(false);
  });

  it('全局配额用尽走同一套文案', () => {
    const result = getRecognitionErrorHandling({
      status: 429,
      code: 'GLOBAL_QUOTA_EXCEEDED',
    });

    expect(result.title).toBe('今日识别额度已用完');
    expect(result.canRetry).toBe(false);
  });

  it('注册被节流时提示稍后重试', () => {
    const result = getRecognitionErrorHandling({
      status: 429,
      code: 'REGISTER_RATE_LIMITED',
    });

    expect(result.title).toBe('设备注册过于频繁');
    expect(result.canRetry).toBe(true);
  });

  it('设备被封禁（403）不给重试', () => {
    const result = getRecognitionErrorHandling({
      status: 403,
      code: 'DEVICE_REVOKED',
    });

    expect(result.title).toBe('设备已被停用');
    expect(result.canRetry).toBe(false);
  });

  it('401 或设备注册失败都归到设备校验失败', () => {
    expect(getRecognitionErrorHandling({ status: 401 }).title).toBe(
      '设备校验失败',
    );
    expect(
      getRecognitionErrorHandling({
        name: 'DeviceAuthError',
        message: '设备注册失败（HTTP 503）',
      }).title,
    ).toBe('设备校验失败');
  });

  it('其它状态码带上 HTTP 状态，便于对照服务端日志', () => {
    const result = getRecognitionErrorHandling({
      status: 404,
      message: 'Route not found',
    });

    expect(result.title).toBe('识别失败（HTTP 404）');
    expect(result.message).toBe('Route not found');
    expect(result.canRetry).toBe(true);
  });

  it('没有 status 的未知错误也能给出兜底文案', () => {
    const result = getRecognitionErrorHandling(new Error('boom'));

    expect(result.title).toBe('识别失败');
    expect(result.message).toBe('boom');
    expect(result.canRetry).toBe(true);
  });

  it('非 Error 的抛出物（例如字符串）不会让文案函数崩掉', () => {
    const result = getRecognitionErrorHandling('something odd');

    expect(result.title).toBe('识别失败');
    expect(result.message).toBe('something odd');
  });
});
