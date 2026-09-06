// 识别处理页面

import React, { useEffect, useState } from 'react';
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
import { RootStackParamList, RecognitionResult, Animal } from '../types';
import {
  colors,
  spacing,
  borderRadius,
  typography,
  gradients,
} from '../constants/theme';
import { recognizeAnimal } from '../services/recognitionService';
import { FallbackImage } from '../components';

type RecognitionRouteProp = RouteProp<RootStackParamList, 'Recognition'>;
type RecognitionNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Recognition'
>;

export const RecognitionScreen: React.FC = () => {
  const navigation = useNavigation<RecognitionNavigationProp>();
  const route = useRoute<RecognitionRouteProp>();
  const { imageUri, imageBase64, imageMimeType } = route.params;

  const [status, setStatus] = useState<'analyzing' | 'identifying' | 'done'>(
    'analyzing',
  );
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    startRecognition();
  }, []);

  const startRecognition = async () => {
    // 模拟进度
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + Math.random() * 20;
      });
    }, 300);

    setStatus('analyzing');

    // 模拟分析阶段
    await new Promise<void>(resolve => setTimeout(resolve, 1000));
    setStatus('identifying');

    // 执行识别
    try {
      const result = await recognizeAnimal(imageUri, {
        base64: imageBase64,
        mimeType: imageMimeType,
      });
      clearInterval(progressInterval);
      setProgress(100);
      setStatus('done');

      // 导航到结果页
      setTimeout(() => {
        navigation.replace('Result', { result, imageUri });
      }, 500);
    } catch (error) {
      console.error('Recognition failed:', error);
      // 处理错误
    }
  };

  const statusText = {
    analyzing: '正在分析图片...',
    identifying: '正在识别动物...',
    done: '识别完成！',
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
        <View style={styles.imageContainer}>
          <FallbackImage
            uri={imageUri}
            style={styles.previewImage}
            resizeMode="cover"
          />

          {/* 扫描动画效果 */}
          {status !== 'done' && <View style={styles.scanLine} />}
        </View>

        {/* 状态信息 */}
        <View style={styles.statusContainer}>
          {status !== 'done' ? (
            <ActivityIndicator size="large" color={colors.amber} />
          ) : (
            <View style={styles.checkIcon}>
              <Text style={styles.checkText}>✓</Text>
            </View>
          )}
          <Text style={styles.statusText}>{statusText[status]}</Text>

          {/* 进度条 */}
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
});

export default RecognitionScreen;
