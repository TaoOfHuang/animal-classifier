// 识别失败的用户可见文案。
//
// 独立成文件的原因和 cameraError.ts 一样：文案映射是纯函数，可以脱离 React Native
// 渲染环境直接单测，也方便别处（例如以后的结果页重试）复用同一套说法。

export type RecognitionErrorHandling = {
  /** 状态区主标题 */
  title: string;
  /** 一句人话解释，直接展示给用户 */
  message: string;
  /**
   * 是否值得让用户点「重试」。
   * 配额用尽、设备被停用这类失败重试没有意义，硬给重试按钮只会让人反复撞墙。
   */
  canRetry: boolean;
};

/** 我们关心的结构化错误字段（ApiError / DeviceAuthError 都有这几个） */
type ErrorLike = {
  name?: string;
  message?: string;
  status?: number;
  code?: string;
};

const asErrorLike = (error: unknown): ErrorLike => {
  if (typeof error !== 'object' || error === null) {
    return { message: typeof error === 'string' ? error : undefined };
  }
  return error as ErrorLike;
};

/**
 * `fetch` 在 Android 上会把底层 IO 失败统一归一成 `TypeError: Network request failed`，
 * 它**区分不了**「没网 / DNS 失败 / TLS 握手失败 / 明文连接被安全策略拦下」。
 * 排查时真正的线索是目标地址，所以调用方必须把 API_BASE_URL 一起打进日志。
 */
const isNetworkFailure = (error: ErrorLike): boolean =>
  error.name === 'TypeError' ||
  /network request failed/i.test(error.message ?? '');

export const getRecognitionErrorHandling = (
  error: unknown,
): RecognitionErrorHandling => {
  const { name, message, status, code } = asErrorLike(error);

  if (isNetworkFailure({ name, message })) {
    return {
      title: '网络连接失败',
      message:
        '没能连上识别服务。请确认网络可用后重试；如果一直失败，多半是后端地址或证书配置有问题。',
      canRetry: true,
    };
  }

  if (code === 'DEVICE_QUOTA_EXCEEDED' || code === 'GLOBAL_QUOTA_EXCEEDED') {
    return {
      title: '今日识别额度已用完',
      message: '识别次数按天计算，明天会重置。',
      canRetry: false,
    };
  }

  if (code === 'REGISTER_RATE_LIMITED') {
    return {
      title: '设备注册过于频繁',
      message: '服务器在限制短时间内的重复注册，稍等一会儿再试。',
      canRetry: true,
    };
  }

  if (status === 403 || code === 'DEVICE_REVOKED') {
    return {
      title: '设备已被停用',
      message: '这台设备已被服务端停用，无法继续识别。',
      canRetry: false,
    };
  }

  if (status === 401 || name === 'DeviceAuthError') {
    return {
      title: '设备校验失败',
      message: '设备令牌已失效，且自动重新注册没有成功，请稍后重试。',
      canRetry: true,
    };
  }

  if (typeof status === 'number' && status >= 500) {
    return {
      title: '识别服务暂时不可用',
      message: '服务端出错了，请稍后重试。',
      canRetry: true,
    };
  }

  if (typeof status === 'number') {
    return {
      title: `识别失败（HTTP ${status}）`,
      message: message || '服务端返回了未预期的响应，请稍后重试。',
      canRetry: true,
    };
  }

  return {
    title: '识别失败',
    message: message || '发生了未知错误，请重试。',
    canRetry: true,
  };
};
