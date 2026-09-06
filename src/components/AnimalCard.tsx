// 动物卡片组件（用于搜索结果、最近识别等）

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Animal, SearchResult } from '../types/animal';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/theme';
import Icon from './Icon';
import FallbackImage from './FallbackImage';

interface AnimalCardProps {
  animal: Animal | SearchResult;
  onPress?: () => void;
  variant?: 'horizontal' | 'vertical' | 'compact';
  showFamily?: boolean;
}

export const AnimalCard: React.FC<AnimalCardProps> = ({
  animal,
  onPress,
  variant = 'horizontal',
  showFamily = true,
}) => {
  const imageUrl = 'thumbnailUrl' in animal 
    ? animal.thumbnailUrl 
    : (animal as Animal).images?.[0];

  const familyText = 'familyZh' in animal 
    ? `${animal.familyZh} · ${'family' in animal ? animal.family : ''}`
    : (animal as Animal).taxonomy?.family?.commonNameZh;

  if (variant === 'vertical') {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.verticalCard}
      >
        <FallbackImage
          uri={imageUrl}
          style={styles.verticalImage}
          resizeMode="cover"
        />
        <Text style={styles.verticalName} numberOfLines={1}>
          {animal.commonNameZh}
        </Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.compactCard}
      >
        <FallbackImage
          uri={imageUrl}
          style={styles.compactImage}
          resizeMode="cover"
        />
        <View style={styles.compactInfo}>
          <Text style={styles.compactName}>{animal.commonNameZh}</Text>
          <Text style={styles.compactLatin} numberOfLines={1}>
            {animal.scientificName}
          </Text>
        </View>
        <Icon name="chevronRight" size={16} color={colors.sand} />
      </TouchableOpacity>
    );
  }

  // horizontal (default)
  return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.horizontalCard}
      >
        <FallbackImage
          uri={imageUrl}
          style={styles.horizontalImage}
          resizeMode="cover"
        />
        <View style={styles.horizontalInfo}>
        <Text style={styles.horizontalName}>{animal.commonNameZh}</Text>
        <Text style={styles.horizontalLatin} numberOfLines={1}>
          {animal.scientificName}
        </Text>
        {showFamily && familyText && (
          <Text style={styles.horizontalFamily}>{familyText}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Vertical card (用于最近识别)
  verticalCard: {
    width: 100,
  },
  verticalImage: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  verticalName: {
    ...typography.caption,
    color: colors.cream,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // Horizontal card (用于搜索结果)
  horizontalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.soft,
  },
  horizontalImage: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.sm,
    marginRight: spacing.md,
  },
  horizontalInfo: {
    flex: 1,
  },
  horizontalName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.earthDark,
  },
  horizontalLatin: {
    ...typography.bodySmall,
    color: colors.bark,
    fontStyle: 'italic',
  },
  horizontalFamily: {
    ...typography.caption,
    color: colors.moss,
    marginTop: 2,
  },

  // Compact card (用于分类树)
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.soft,
    marginBottom: spacing.sm,
    marginLeft: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  compactImage: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    marginRight: spacing.md,
    backgroundColor: colors.cream,
  },
  compactInfo: {
    flex: 1,
  },
  compactName: {
    ...typography.body,
    fontWeight: '500',
    color: colors.earthDark,
  },
  compactLatin: {
    ...typography.caption,
    color: colors.bark,
  },
});

export default AnimalCard;
