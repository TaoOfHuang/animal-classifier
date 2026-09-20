// 图片选择页面 - 使用 react-native-image-picker

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import {
  launchImageLibrary,
  ImageLibraryOptions,
} from 'react-native-image-picker';
import { RootStackParamList } from '../types';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import { Icon, Button, Header, FallbackImage } from '../components';

type ImagePickerScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ImagePicker'
>;

export const ImagePickerScreen: React.FC = () => {
  const navigation = useNavigation<ImagePickerScreenNavigationProp>();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedBase64, setSelectedBase64] = useState<string | undefined>();
  const [selectedMimeType, setSelectedMimeType] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  // 用 useCallback 固定引用：openImagePicker 依赖它，否则会连锁着每次渲染都重建
  const requestStoragePermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      // Android 13+ (API 33) uses READ_MEDIA_IMAGES
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          {
            title: '相册权限',
            message: '物种图鉴需要访问您的相册来选择动物图片进行识别',
            buttonNeutral: '稍后询问',
            buttonNegative: '取消',
            buttonPositive: '确定',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: '存储权限',
            message: '物种图鉴需要访问您的相册来选择动物图片进行识别',
            buttonNeutral: '稍后询问',
            buttonNegative: '取消',
            buttonPositive: '确定',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.warn(err);
      return false;
    }
  }, []);

  const openImagePicker = useCallback(async () => {
    const hasPermission = await requestStoragePermission();

    if (!hasPermission) {
      Alert.alert('权限不足', '请在设置中允许访问相册');
      return;
    }

    setIsLoading(true);

    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
      selectionLimit: 1,
      includeBase64: true,
    };

    try {
      const result = await launchImageLibrary(options);

      if (result.didCancel) {
        // 用户取消，返回上一页
        if (!selectedImage) {
          navigation.goBack();
        }
        setIsLoading(false);
        return;
      }

      if (result.errorCode) {
        Alert.alert('错误', result.errorMessage || '选择图片失败');
        setIsLoading(false);
        return;
      }

      const asset = result.assets?.[0];
      if (asset?.uri) {
        const uri: string = asset.uri;
        setSelectedImage(uri);
        setSelectedBase64(asset.base64);
        setSelectedMimeType(asset.type);
      }
    } catch (error) {
      // 用户侧只给通用提示，具体异常留在日志里（release 下用
      // `adb logcat | grep ImagePickerScreen` 能看到），否则无从排查。
      console.warn('[ImagePickerScreen] 选择图片失败:', error);
      Alert.alert('错误', '选择图片时发生错误');
    } finally {
      setIsLoading(false);
    }
  }, [requestStoragePermission, navigation, selectedImage]);

  // 页面加载后自动打开一次图片选择器。
  //
  // openImagePicker 已用 useCallback 包裹，但它依赖 selectedImage——用户选完图
  // 这个状态就变，函数引用跟着变，effect 会重跑。所以再加 hasAutoOpened 做
  // 「只执行一次」的守卫，否则选完图会立刻又弹出一次选择器。
  const hasAutoOpened = useRef(false);

  useEffect(() => {
    if (hasAutoOpened.current) return;
    hasAutoOpened.current = true;
    openImagePicker();
  }, [openImagePicker]);;

  const handleConfirm = () => {
    if (selectedImage) {
      navigation.navigate('Recognition', {
        imageUri: selectedImage,
        imageBase64: selectedBase64,
        imageMimeType: selectedMimeType,
      });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.ivory} />

      <Header title="选择图片" />

      <View style={styles.content}>
        {selectedImage ? (
          <>
            <Text style={styles.hint}>已选择图片，点击下方按钮开始识别</Text>
            <View style={styles.previewContainer}>
              <FallbackImage
                uri={selectedImage}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </View>
            <TouchableOpacity
              onPress={openImagePicker}
              style={styles.reselectButton}
            >
              <Icon name="image" size={20} color={colors.moss} />
              <Text style={styles.reselectText}>重新选择</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Icon name="image" size={64} color={colors.sand} />
            <Text style={styles.emptyText}>
              {isLoading ? '正在加载...' : '请选择一张图片'}
            </Text>
            <Button
              title="选择图片"
              onPress={openImagePicker}
              variant="outline"
              icon={<Icon name="image" size={20} color={colors.moss} />}
            />
          </View>
        )}
      </View>

      {/* 底部确认按钮 */}
      {selectedImage && (
        <View style={styles.bottomBar}>
          <Button
            title="开始识别"
            onPress={handleConfirm}
            fullWidth
            icon={<Icon name="search" size={20} color={colors.white} />}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.bark,
    textAlign: 'center',
    marginVertical: spacing.md,
  },
  previewContainer: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.cream,
    marginBottom: spacing.md,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  reselectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginBottom: 100,
  },
  reselectText: {
    ...typography.body,
    color: colors.moss,
    marginLeft: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  emptyText: {
    ...typography.body,
    color: colors.bark,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: 40,
    backgroundColor: colors.ivory,
    borderTopWidth: 1,
    borderTopColor: colors.cream,
  },
});

export default ImagePickerScreen;
