type CameraErrorCode =
  | 'camera_unavailable'
  | 'permission'
  | 'others'
  | undefined;

export type CameraErrorHandling = {
  title: string;
  message: string;
  fallbackToGallery: boolean;
};

export const getCameraErrorHandling = (
  errorCode: CameraErrorCode,
): CameraErrorHandling => {
  if (errorCode === 'camera_unavailable') {
    return {
      title: '模拟器相机不可用',
      message: '当前设备无法使用相机，你可以改为从相册选择图片进行识别。',
      fallbackToGallery: true,
    };
  }

  if (errorCode === 'permission') {
    return {
      title: '相机权限未授权',
      message: '请在系统设置中开启相机权限后重试。',
      fallbackToGallery: false,
    };
  }

  return {
    title: '拍照失败',
    message: '相机暂时不可用，请稍后重试。',
    fallbackToGallery: false,
  };
};
