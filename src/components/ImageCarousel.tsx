// 图片轮播组件
// 支持自动播放、手势滑动、分页指示器

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Modal,
  StatusBar,
} from 'react-native';
import { colors, spacing, borderRadius } from '../constants/theme';
import { Icon } from './Icon';
import FallbackImage from './FallbackImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ImageCarouselProps {
  images: string[];
  height?: number;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showPagination?: boolean;
  showFullScreenButton?: boolean;
  borderRadius?: number;
  onImagePress?: (index: number) => void;
}

export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  images,
  height = 250,
  autoPlay = true,
  autoPlayInterval = 4000,
  showPagination = true,
  showFullScreenButton = true,
  borderRadius: customBorderRadius,
  onImagePress,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [fullScreenIndex, setFullScreenIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const paginationAnim = useRef(
    images.map(() => new Animated.Value(0)),
  ).current;

  // 更新分页动画
  useEffect(() => {
    paginationAnim.forEach((anim, index) => {
      Animated.spring(anim, {
        toValue: index === activeIndex ? 1 : 0,
        useNativeDriver: true,
        friction: 8,
      }).start();
    });
  }, [activeIndex, paginationAnim]);

  // 自动播放
  useEffect(() => {
    if (!autoPlay || images.length <= 1) return;

    const startAutoPlay = () => {
      autoPlayRef.current = setInterval(() => {
        const nextIndex = (activeIndex + 1) % images.length;
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
        setActiveIndex(nextIndex);
      }, autoPlayInterval);
    };

    startAutoPlay();

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [autoPlay, autoPlayInterval, activeIndex, images.length]);

  // 停止自动播放（用户交互时）
  const stopAutoPlay = useCallback(() => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }
  }, []);

  // 滚动结束时更新索引
  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.x;
      const newIndex = Math.round(offset / SCREEN_WIDTH);
      if (newIndex !== activeIndex) {
        setActiveIndex(newIndex);
      }
    },
    [activeIndex],
  );

  // 开始拖动时停止自动播放
  const handleScrollBegin = useCallback(() => {
    stopAutoPlay();
  }, [stopAutoPlay]);

  // 点击图片
  const handleImagePress = useCallback(
    (index: number) => {
      if (onImagePress) {
        onImagePress(index);
      } else {
        setFullScreenIndex(index);
        setIsFullScreen(true);
        stopAutoPlay();
      }
    },
    [onImagePress, stopAutoPlay],
  );

  // 关闭全屏
  const handleCloseFullScreen = useCallback(() => {
    setIsFullScreen(false);
  }, []);

  // 全屏切换图片
  const handleFullScreenScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.x;
      const newIndex = Math.round(offset / SCREEN_WIDTH);
      setFullScreenIndex(newIndex);
    },
    [],
  );

  const renderImage = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => handleImagePress(index)}
      style={[
        styles.imageContainer,
        { width: SCREEN_WIDTH, height },
        customBorderRadius !== undefined && {
          borderRadius: customBorderRadius,
        },
      ]}
    >
      <FallbackImage
        uri={item}
        style={[
          styles.image,
          customBorderRadius !== undefined && {
            borderRadius: customBorderRadius,
          },
        ]}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  const renderFullScreenImage = ({ item }: { item: string }) => (
    <View style={styles.fullScreenImageContainer}>
      <FallbackImage
        uri={item}
        style={styles.fullScreenImage}
        resizeMode="contain"
      />
    </View>
  );

  const renderPagination = () => (
    <View style={styles.pagination}>
      {images.map((_, index) => {
        const scale = paginationAnim[index].interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.3],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.paginationDot,
              index === activeIndex && styles.paginationDotActive,
              { transform: [{ scale }] },
            ]}
          />
        );
      })}
    </View>
  );

  if (images.length === 0) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Icon name="image" size={48} color={colors.sand} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={images}
        renderItem={renderImage}
        keyExtractor={(_, index) => `carousel-${index}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollBeginDrag={handleScrollBegin}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* 分页指示器 */}
      {showPagination && images.length > 1 && renderPagination()}

      {/* 全屏按钮 */}
      {showFullScreenButton && (
        <TouchableOpacity
          style={styles.fullScreenButton}
          onPress={() => handleImagePress(activeIndex)}
          activeOpacity={0.7}
        >
          <Icon name="expand" size={18} color={colors.white} />
        </TouchableOpacity>
      )}

      {/* 图片计数 */}
      {images.length > 1 && (
        <View style={styles.counter}>
          <Icon name="image" size={12} color={colors.white} />
          <View style={styles.counterText}>
            <View style={styles.counterNumber}>
              <Animated.Text style={styles.counterValue}>
                {activeIndex + 1}
              </Animated.Text>
            </View>
            <View style={styles.counterSeparator} />
            <View style={styles.counterNumber}>
              <Animated.Text style={styles.counterTotal}>
                {images.length}
              </Animated.Text>
            </View>
          </View>
        </View>
      )}

      {/* 全屏模态框 */}
      <Modal
        visible={isFullScreen}
        transparent
        animationType="fade"
        onRequestClose={handleCloseFullScreen}
      >
        <StatusBar barStyle="light-content" backgroundColor="black" />
        <View style={styles.fullScreenContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleCloseFullScreen}
            activeOpacity={0.7}
          >
            <Icon name="close" size={24} color={colors.white} />
          </TouchableOpacity>

          <FlatList
            data={images}
            renderItem={renderFullScreenImage}
            keyExtractor={(_, index) => `fullscreen-${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleFullScreenScroll}
            initialScrollIndex={fullScreenIndex}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
          />

          {/* 全屏分页指示器 */}
          <View style={styles.fullScreenPagination}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.fullScreenDot,
                  index === fullScreenIndex && styles.fullScreenDotActive,
                ]}
              />
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  imageContainer: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
  },
  pagination: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  paginationDotActive: {
    backgroundColor: colors.white,
  },
  fullScreenButton: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  counterText: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterNumber: {
    minWidth: 12,
    alignItems: 'center',
  },
  counterValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  counterSeparator: {
    width: 4,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 2,
  },
  counterTotal: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: spacing.lg,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenImageContainer: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  fullScreenPagination: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fullScreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  fullScreenDotActive: {
    backgroundColor: colors.white,
    width: 24,
  },
});

export default ImageCarousel;
