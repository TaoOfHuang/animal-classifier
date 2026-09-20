// 识别处理页面

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import {
  colors,
  spacing,
  borderRadius,
  typography,
  gradients,
} from '../constants/theme';
import { recognizeAnimal } from '../services/recognitionService';
import { API_BASE_URL } from '../services/api';
import { FallbackImage, Button } from '../components';
import {
  getRecognitionErrorHandling,
  RecognitionErrorHandling,
} from './recognitionError';

type RecognitionRouteProp = RouteProp<RootStackParamList, 'Recognition'>;
type RecognitionNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Recognition'
>;

type RecognitionStatus = 'analyzing' | 'identifying' | 'done' | 'error';

export const RecognitionScreen: React.FC = () => {
  const navigation = useNavigation<RecognitionNavigationProp>();
  const route = useRoute<RecognitionRouteProp>();
  const { imageUri, imageBase64, imageMimeType } = route.params;

  const [status, setStatus] = useState<RecognitionStatus>('analyzing');
  const [progress, setProgress] = useState(0);
  const [errorInfo, setErrorInfo] = useState<RecognitionErrorHandling | null>(
    null,
  );

  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * 每次识别自增，用来作废「上一轮」的异步回调。
   * 没有它的话：用户在请求还没回来时点了重试，晚到的旧结果会把新状态覆盖掉
   * （包括把已显示的失败界面顶回 loading）。
   */
  const attemptRef = useRef(0);

  const stopProgressTimer = useCallback(() => {
    if (progressTimer.current !== null) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }, []);

  const startRecognition = useCallback(async () => {
    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;

    stopProgressTimer();
    setErrorInfo(null);
    setProgress(0);
    setStatus('analyzing');

    // 进度条是**模拟**的：识别接口不返回上传进度。
    // 上限固定 90%，剩下 10% 留给请求真正返回，避免「已经 100% 却还在等」。
    progressTimer.current = setInterval(() => {
      if (attemptRef.current !== attempt) {
        return;
      }
      setProgress(prev => Math.min(prev + Math.random() * 20, 90));
    }, 300);

    // 模拟分析阶段
    await new Promise<void>(resolve => setTimeout(resolve, 1000));
    if (attemptRef.current !== attempt) {
      return;
    }
    setStatus('identifying');

    try {
      const result = await recognizeAnimal(imageUri, {
        base64: imageBase64,
        mimeType: imageMimeType,
      });
      if (attemptRef.current !== attempt) {
        return;
      }

      setProgress(100);
      setStatus('done');

      // 留一点时间让用户看到「识别完成」，再进结果页
      doneTimer.current = setTimeout(() => {
        doneTimer.current = null;
        navigation.replace('Result', { result, imageUri });
      }, 500);
    } catch (error) {
      if (attemptRef.current !== attempt) {
        return;
      }

      // ⚠️ 必须把地址一起打出来。Android 上 fetch 只会给出
      // `TypeError: Network request failed`，不给目标地址就几乎无法定位
      // （曾经因为把 https 指向了一个明文端口，排查绕了很久）。
      console.error(
        `Recognition failed (API_BASE_URL=${API_BASE_URL}):`,
        error,
      );

      setErrorInfo(getRecognitionErrorHandling(error));
      setStatus('error');
    } finally {
      if (attemptRef.current === attempt) {
        stopProgressTimer();
      }
    }
  }, [
    stopProgressTimer,
    imageUri,
    imageBase64,
    imageMimeType,
    navigation,
  ]);

  useEffect(() => {
    startRecognition();

    return () => {
      // 离开页面时让在途请求的结果作废，并清掉两个计时器，
      // 否则会出现「组件已卸载还在 setState / 还在导航」的告警。
      attemptRef.current += 1;
      stopProgressTimer();
      if (doneTimer.current !== null) {
        clearTimeout(doneTimer.current);
        doneTimer.current = null;
      }
    };
    // 只在挂载时发起一次；重试走下面按钮的 onPress，重跑不会重新挂载。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isError = status === 'error';
  const isRunning = status === 'analyzing' || status === 'identifying';

  const statusText: Record<RecognitionStatus, string> = {
    analyzing: '正在分析图片...',
    identifying: '正在识别动物...',
    done: '识别完成！',
    error: errorInfo?.title ?? '识别失败',
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* 背景图片 */}
      <FallbackImage
        uri={imageUri}
        style={styles.backgroundImage}
      />
      <View style={styles.overlay} />

      {/* 内容 */}
      <View style={styles.content}>
        {/* 图片预览 */}
        <View style={[styles.imageContainer, isError && styles.imageContainerError]}>
          <FallbackImage
            uri={imageUri}
            style={styles.previewImage}
            resizeMode="cover"
          />

          {/* 扫描动画效果 */}
          {isRunning && <View style={styles.scanLine} />}
        </View>

        {/* 状态信息 */}
        <View style={styles.statusContainer}>
          {status === 'done' ? (
            <View style={styles.checkIcon}>
              <Text style={styles.checkText}>✓</Text>
            </View>
          ) : isError ? (
            <View style={styles.errorIcon}>
              <Text style={styles.errorIconText}>!</Text>
            </View>
          ) : (
            <ActivityIndicator size="large" color={colors.amber} />
          )}
          <Text style={styles.statusText}>{statusText[status]}</Text>

          {/* 进度条：失败后没有意义，直接换成错误详情 */}
          {!isError && (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <LinearGradient
                  colors={gradients.golden}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.progressBar,
                    { width: `${Math.min(progress, 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{Math.round(progress)}%</Text>
            </View>
          )}

          {isError && errorInfo && (
            <View style={styles.errorBlock}>
              <Text style={styles.errorMessage}>{errorInfo.message}</Text>
              <View style={styles.errorActions}>
                {errorInfo.canRetry && (
                  <Button
                    title="重试"
                    variant="secondary"
                    size="small"
                    onPress={startRecognition}
                    style={styles.retryButton}
                  />
                )}
                <Button
                  title="重新选图"
                  variant="outline"
                  size="small"
                  onPress={() => navigation.goBack()}
                  style={styles.backButton}
                  textStyle={styles.backButtonText}
                />
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.earthDark,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 22, 18, 0.7)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  imageContainer: {
    width: 250,
    height: 250,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.amber,
  },
  imageContainerError: {
    borderColor: colors.coral,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.amber,
    top: '50%',
    opacity: 0.8,
  },
  statusContainer: {
    marginTop: spacing.xxl,
    alignItems: 'center',
  },
  checkIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.moss,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    fontSize: 24,
    color: colors.white,
    fontWeight: 'bold',
  },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIconText: {
    fontSize: 24,
    color: colors.white,
    fontWeight: 'bold',
  },
  statusText: {
    ...typography.h3,
    color: colors.cream,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    ...typography.bodySmall,
    color: colors.sand,
    marginLeft: spacing.md,
    width: 40,
    textAlign: 'right',
  },
  errorBlock: {
    alignItems: 'center',
  },
  errorMessage: {
    ...typography.bodySmall,
    color: colors.sand,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: spacing.lg,
  },
  errorActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryButton: {
    marginRight: spacing.md,
  },
  backButton: {
    borderColor: colors.sand,
  },
  backButtonText: {
    color: colors.cream,
  },
});

export default RecognitionScreen;
