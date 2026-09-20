// 濒危状态徽章组件

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IUCNStatus, IUCN_STATUS } from '../constants/taxonomy';
import { colors, spacing, borderRadius } from '../constants/theme';

interface EndangeredBadgeProps {
  status: IUCNStatus;
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
}

export const EndangeredBadge: React.FC<EndangeredBadgeProps> = ({
  status,
  size = 'medium',
  showIcon = true,
}) => {
  const statusInfo = IUCN_STATUS[status];
  
  // 只有 CR, EN, VU 才显示为警示风格
  const isEndangered = ['CR', 'EN', 'VU'].includes(status);

  const sizeStyles = {
    small: {
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
      fontSize: 10,
    },
    medium: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      fontSize: 12,
    },
    large: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      fontSize: 14,
    },
  };

  const currentSize = sizeStyles[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: statusInfo.color,
          paddingVertical: currentSize.paddingVertical,
          paddingHorizontal: currentSize.paddingHorizontal,
        },
      ]}
    >
      {showIcon && isEndangered && (
        <Text style={[styles.icon, { fontSize: currentSize.fontSize }]}>⚠</Text>
      )}
      <Text
        style={[
          styles.text,
          { fontSize: currentSize.fontSize },
        ]}
      >
        {statusInfo.zh} ({status})
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },
  icon: {
    color: colors.white,
    marginRight: spacing.xs,
  },
  text: {
    color: colors.white,
    fontWeight: '600',
  },
});

export default EndangeredBadge;
