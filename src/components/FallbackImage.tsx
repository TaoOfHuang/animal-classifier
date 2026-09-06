// 带错误处理的图片组件，当网络图片加载失败时显示占位图

import React, { useState } from 'react';
import { Image, View, Text, StyleSheet, ImageStyle } from 'react-native';
import { colors } from '../constants/theme';

interface FallbackImageProps {
  uri?: string;
  style?: ImageStyle;
  placeholder?: string;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

export const FallbackImage: React.FC<FallbackImageProps> = ({
  uri,
  style,
  placeholder = '🐾',
  resizeMode = 'cover',
}) => {
  const [hasError, setHasError] = useState(false);

  if (!uri || hasError) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.placeholderText}>{placeholder}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={resizeMode}
      onError={() => setHasError(true)}
    />
  );
};

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.moss,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 40,
  },
});

export default FallbackImage;
