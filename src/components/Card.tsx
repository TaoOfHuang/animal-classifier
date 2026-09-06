// 卡片组件

import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'outlined' | 'glass' | 'danger';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  variant = 'default',
}) => {
  const variantStyles = {
    default: {
      backgroundColor: colors.white,
      ...shadows.soft,
    },
    elevated: {
      backgroundColor: colors.white,
      ...shadows.medium,
    },
    outlined: {
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.cream,
    },
    glass: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    danger: {
      backgroundColor: '#fff5f5',
      borderWidth: 1,
      borderColor: 'rgba(216, 90, 74, 0.2)',
    },
  };

  const cardStyle = [
    styles.card,
    variantStyles[variant],
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={cardStyle}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
});

export default Card;
