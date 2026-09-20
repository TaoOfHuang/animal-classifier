// 相机页面 - 使用 react-native-image-picker

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { launchCamera, CameraOptions } from 'react-native-image-picker';
import { RootStackParamList } from '../types';
import { colors, spacing, typography } from '../constants/theme';
import { Icon } from '../components';
import { getCameraErrorHandling } from './cameraError';

type CameraScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Camera'
>;

export const CameraScreen: React.FC = () => {
  const navigation = useNavigation<CameraScreenNavigationProp>();
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: '相机权限',
            message: '物种图鉴需要访问您的相机来拍摄动物照片进行识别',
            buttonNeutral: '稍后询问',
            buttonNegative: '取消',
            buttonPositive: '确定',
          },
        );
        setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
      } catch (err) {
        console.warn(err);
        setHasPermission(false);
      }
    } else {
      setHasPermission(true);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleCapture = async () => {
    if (!hasPermission) {
      Alert.alert('权限不足', '请在设置中允许相机权限');
      return;
    }

    setIsCapturing(true);

    const options: CameraOptions = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
      saveToPhotos: false,
      includeBase64: true,
    };

    try {
      const result = await launchCamera(options);

      if (result.didCancel) {
        setIsCapturing(false);
        return;
      }

      if (result.errorCode) {
        const handling = getCameraErrorHandling(result.errorCode);
        Alert.alert(handling.title, handling.message, [
          handling.fallbackToGallery
            ? {
                text: '去相册',
                onPress: () => navigation.replace('ImagePicker'),
              }
            : { text: '知道了' },
        ]);
        setIsCapturing(false);
        return;
      }

      const asset = result.assets?.[0];
      if (asset?.uri) {
        const uri: string = asset.uri;
        navigation.navigate('Recognition', {
          imageUri: uri,
          imageBase64: asset.base64,
          imageMimeType: asset.type,
        });
      }
    } catch (error) {
      // 用户侧只给通用提示，具体异常留在日志里（release 下用
      // `adb logcat | grep CameraScreen` 能看到），否则这类失败无从排查。
      console.warn('[CameraScreen] 拍照失败:', error);
      Alert.alert('错误', '拍照时发生错误');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* 相机预览区域 */}
      <View style={styles.cameraPreview}>
        {hasPermission === false ? (
          <>
            <Icon name="camera" size={48} color={colors.sand} />
            <Text style={styles.placeholderText}>相机权限未授权</Text>
            <TouchableOpacity
              onPress={requestCameraPermission}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>重新请求权限</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Icon name="camera" size={48} color={colors.sand} />
            <Text style={styles.placeholderText}>点击下方按钮拍照</Text>
            <Text style={styles.placeholderHint}>
              将动物置于画面中央{'\n'}获得最佳识别效果
            </Text>
          </>
        )}
      </View>

      {/* 顶部工具栏 */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Icon name="back" size={20} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.title}>拍照识别</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 底部控制栏 */}
      <View style={styles.bottomBar}>
        <View style={styles.controlsContainer}>
          {/* 相册按钮 */}
          <TouchableOpacity
            onPress={() => navigation.replace('ImagePicker')}
            style={styles.sideButton}
          >
            <Icon name="image" size={24} color={colors.white} />
          </TouchableOpacity>

          {/* 拍照按钮 */}
          <TouchableOpacity
            onPress={handleCapture}
            style={styles.captureButton}
            activeOpacity={0.8}
            disabled={isCapturing || hasPermission === false}
          >
            <View
              style={[styles.captureInner, isCapturing && styles.capturing]}
            />
          </TouchableOpacity>

          {/* 占位 */}
          <View style={styles.sideButton} />
        </View>

        <Text style={styles.hint}>
          {isCapturing ? '正在处理...' : '点击拍摄按钮'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.earthDark,
  },
  cameraPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
  },
  placeholderText: {
    ...typography.h3,
    color: colors.white,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  placeholderHint: {
    ...typography.bodySmall,
    color: colors.sand,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.moss,
    borderRadius: 8,
  },
  retryText: {
    ...typography.body,
    color: colors.white,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.white,
  },
  placeholder: {
    width: 40,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  sideButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xl,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.white,
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.white,
  },
  capturing: {
    backgroundColor: colors.coral,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.sand,
    textAlign: 'center',
  },
});

export default CameraScreen;
