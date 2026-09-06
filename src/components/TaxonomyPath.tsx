// 分类标签组件

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { TaxonomyInfo } from '../types/animal';
import { TAXONOMY_LEVELS } from '../constants/taxonomy';
import { colors, spacing, borderRadius, typography } from '../constants/theme';

interface TaxonomyPathProps {
  taxonomy: TaxonomyInfo;
  showArrows?: boolean;
  compact?: boolean;
}

export const TaxonomyPath: React.FC<TaxonomyPathProps> = ({
  taxonomy,
  showArrows = true,
  compact = false,
}) => {
  const levels = [
    'kingdom',
    'phylum',
    'class',
    'order',
    'family',
    'genus',
    'species',
  ] as const;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {levels.map((level, index) => {
        const item = taxonomy[level];
        if (!item) return null;
        const levelInfo = TAXONOMY_LEVELS[level];

        return (
          <React.Fragment key={level}>
            <View style={[styles.item, compact && styles.itemCompact]}>
              <Text style={styles.levelLabel}>{levelInfo.zh}</Text>
              <Text
                style={[styles.levelValue, compact && styles.levelValueCompact]}
              >
                {item.commonNameZh}
              </Text>
            </View>
            {showArrows && index < levels.length - 1 && (
              <Text style={styles.arrow}>›</Text>
            )}
          </React.Fragment>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  item: {
    backgroundColor: colors.cream,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    minWidth: 70,
  },
  itemCompact: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minWidth: 50,
  },
  levelLabel: {
    ...typography.label,
    color: colors.bark,
    marginBottom: 2,
  },
  levelValue: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.earthDark,
  },
  levelValueCompact: {
    fontSize: 12,
  },
  arrow: {
    fontSize: 16,
    color: colors.sand,
    marginHorizontal: spacing.xs,
  },
});

export default TaxonomyPath;
