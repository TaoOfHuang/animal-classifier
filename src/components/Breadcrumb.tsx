// 面包屑导航组件
// 用于显示分类层级路径，支持点击跳转

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { TaxonomyItem } from '../types';
import { TaxonomyLevel, TAXONOMY_LEVELS } from '../constants/taxonomy';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import { Icon } from './Icon';

export interface BreadcrumbItem {
  level: TaxonomyLevel;
  item: TaxonomyItem;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  currentLevel?: TaxonomyLevel;
  onItemPress?: (item: BreadcrumbItem, index: number) => void;
  maxVisible?: number;
  variant?: 'default' | 'compact' | 'pill';
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  currentLevel,
  onItemPress,
  maxVisible = 5,
  variant = 'default',
}) => {
  // 如果项目太多，显示省略号
  const shouldTruncate = items.length > maxVisible;
  const visibleItems = shouldTruncate
    ? [items[0], ...items.slice(-maxVisible + 1)]
    : items;
  const hasEllipsis = shouldTruncate;

  const renderItem = (item: BreadcrumbItem, index: number, isLast: boolean) => {
    const isCurrentLevel = item.level === currentLevel;

    if (variant === 'pill') {
      return (
        <TouchableOpacity
          key={`${item.level}-${index}`}
          style={[styles.pillItem, isCurrentLevel && styles.pillItemActive]}
          onPress={() => onItemPress?.(item, index)}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.pillLevel, isCurrentLevel && styles.pillLevelActive]}
          >
            {TAXONOMY_LEVELS[item.level]?.zh || item.level}
          </Text>
          <Text
            style={[styles.pillName, isCurrentLevel && styles.pillNameActive]}
            numberOfLines={1}
          >
            {item.item.commonNameZh}
          </Text>
        </TouchableOpacity>
      );
    }

    if (variant === 'compact') {
      return (
        <React.Fragment key={`${item.level}-${index}`}>
          <TouchableOpacity
            style={styles.compactItem}
            onPress={() => onItemPress?.(item, index)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.compactText,
                isCurrentLevel && styles.compactTextActive,
              ]}
              numberOfLines={1}
            >
              {item.item.commonNameZh}
            </Text>
          </TouchableOpacity>
          {!isLast && <Text style={styles.compactSeparator}>/</Text>}
        </React.Fragment>
      );
    }

    // Default variant
    return (
      <React.Fragment key={`${item.level}-${index}`}>
        <TouchableOpacity
          style={[
            styles.defaultItem,
            isCurrentLevel && styles.defaultItemActive,
          ]}
          onPress={() => onItemPress?.(item, index)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.levelBadge,
              isCurrentLevel && styles.levelBadgeActive,
            ]}
          >
            <Text
              style={[
                styles.levelText,
                isCurrentLevel && styles.levelTextActive,
              ]}
            >
              {TAXONOMY_LEVELS[item.level]?.zh || item.level}
            </Text>
          </View>
          <View style={styles.nameContainer}>
            <Text
              style={[styles.nameZh, isCurrentLevel && styles.nameZhActive]}
              numberOfLines={1}
            >
              {item.item.commonNameZh}
            </Text>
            <Text style={styles.nameScientific} numberOfLines={1}>
              {item.item.scientificName}
            </Text>
          </View>
        </TouchableOpacity>
        {!isLast && (
          <View style={styles.separator}>
            <Icon name="chevronRight" size={14} color={colors.sand} />
          </View>
        )}
      </React.Fragment>
    );
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        variant === 'pill' && styles.contentPill,
      ]}
    >
      {visibleItems.map((item, index) => {
        // 在第一个元素后插入省略号
        if (hasEllipsis && index === 1) {
          return (
            <React.Fragment key={`ellipsis-${index}`}>
              <View style={styles.ellipsis}>
                <Text style={styles.ellipsisText}>...</Text>
              </View>
              {renderItem(item, index, index === visibleItems.length - 1)}
            </React.Fragment>
          );
        }
        return renderItem(item, index, index === visibleItems.length - 1);
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  contentPill: {
    gap: spacing.sm,
  },

  // Default variant styles
  defaultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    paddingRight: spacing.md,
  },
  defaultItemActive: {
    backgroundColor: '#e8f5e8',
  },
  levelBadge: {
    backgroundColor: colors.sand,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  levelBadgeActive: {
    backgroundColor: colors.moss,
  },
  levelText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  levelTextActive: {
    color: colors.white,
  },
  nameContainer: {
    maxWidth: 100,
  },
  nameZh: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.bark,
  },
  nameZhActive: {
    color: colors.moss,
  },
  nameScientific: {
    fontSize: 10,
    color: colors.sand,
    fontStyle: 'italic',
  },
  separator: {
    paddingHorizontal: spacing.xs,
  },

  // Compact variant styles
  compactItem: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  compactText: {
    ...typography.bodySmall,
    color: colors.bark,
  },
  compactTextActive: {
    color: colors.moss,
    fontWeight: '600',
  },
  compactSeparator: {
    color: colors.sand,
    paddingHorizontal: spacing.xs,
  },

  // Pill variant styles
  pillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  pillItemActive: {
    backgroundColor: colors.moss,
  },
  pillLevel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.sand,
    textTransform: 'uppercase',
  },
  pillLevelActive: {
    color: colors.leafGlow,
  },
  pillName: {
    ...typography.bodySmall,
    color: colors.bark,
    maxWidth: 80,
  },
  pillNameActive: {
    color: colors.white,
  },

  // Ellipsis
  ellipsis: {
    paddingHorizontal: spacing.sm,
  },
  ellipsisText: {
    ...typography.body,
    color: colors.sand,
  },
});

export default Breadcrumb;
