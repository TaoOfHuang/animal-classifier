// 分类树节点组件
// 支持展开/收起动画、懒加载子节点、长按预览

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { TaxonomyNode } from '../types';
import { TaxonomyLevel, TAXONOMY_LEVELS } from '../constants/taxonomy';
import {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
} from '../constants/theme';
import { Icon } from './Icon';
import FallbackImage from './FallbackImage';
import { fetchTaxonomyChildren } from '../services/taxonomyService';

// 启用 Android LayoutAnimation
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface TreeNodeProps {
  node: TaxonomyNode;
  depth: number;
  initialExpanded?: boolean;
  isCurrentAnimal?: boolean;
  onNodePress?: (node: TaxonomyNode) => void;
  onNodeNavigate?: (node: TaxonomyNode) => void;
  onLongPress?: (node: TaxonomyNode) => void;
  enableLazyLoad?: boolean;
}

export const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  depth,
  initialExpanded = false,
  isCurrentAnimal = false,
  onNodePress,
  onNodeNavigate,
  onLongPress,
  enableLazyLoad = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(
    initialExpanded || node.isCurrent,
  );
  const [children, setChildren] = useState<TaxonomyNode[]>(node.children || []);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(
    (node.childCount || 0) > (node.children?.length || 0),
  );
  const [loadedCount, setLoadedCount] = useState(node.children?.length || 0);

  const rotateAnim = useRef(
    new Animated.Value(initialExpanded || node.isCurrent ? 1 : 0),
  ).current;
  const heightAnim = useRef(
    new Animated.Value(initialExpanded || node.isCurrent ? 1 : 0),
  ).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const hasChildren = (node.childCount || 0) > 0 || children.length > 0;
  const isSpecies = node.level === 'species';

  // 加载子节点
  const loadChildren = useCallback(async () => {
    if (!enableLazyLoad || isLoading || !hasChildren || isSpecies) return;

    setIsLoading(true);
    try {
      const result = await fetchTaxonomyChildren(
        node.id,
        node.level,
        5, // limit
        loadedCount, // offset
      );

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setChildren(prev => [...prev, ...result.children]);
      setHasMore(result.hasMore);
      setLoadedCount(prev => prev + result.children.length);
    } catch (error) {
      console.error('Failed to load children:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    node.id,
    node.level,
    loadedCount,
    enableLazyLoad,
    isLoading,
    hasChildren,
    isSpecies,
  ]);

  // 初次展开时加载子节点
  useEffect(() => {
    if (isExpanded && children.length === 0 && hasChildren && !isSpecies) {
      loadChildren();
    }
  }, [isExpanded]);

  const handlePress = useCallback(() => {
    if (hasChildren && !isSpecies) {
      const newExpanded = !isExpanded;
      setIsExpanded(newExpanded);

      // 旋转箭头动画
      Animated.parallel([
        Animated.spring(rotateAnim, {
          toValue: newExpanded ? 1 : 0,
          useNativeDriver: true,
          friction: 8,
          tension: 100,
        }),
        Animated.timing(heightAnim, {
          toValue: newExpanded ? 1 : 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();

      // 如果是首次展开且没有子节点，加载子节点
      if (newExpanded && children.length === 0) {
        loadChildren();
      }
    }

    onNodePress?.(node);
  }, [
    isExpanded,
    hasChildren,
    isSpecies,
    children.length,
    rotateAnim,
    heightAnim,
    loadChildren,
    onNodePress,
    node,
  ]);

  const handleNavigate = useCallback(() => {
    onNodeNavigate?.(node);
  }, [node, onNodeNavigate]);

  const handleLongPress = useCallback(() => {
    // 触觉反馈
    onLongPress?.(node);
  }, [node, onLongPress]);

  const handleLoadMore = useCallback(() => {
    loadChildren();
  }, [loadChildren]);

  // 箭头旋转插值
  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const isCurrent = node.isCurrent || isCurrentAnimal;

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={500}
        activeOpacity={0.7}
        style={[
          styles.nodeContainer,
          { marginLeft: depth * 20 },
          isCurrent && styles.nodeContainerCurrent,
        ]}
      >
        {/* 展开/收起箭头 */}
        <View style={styles.expandIcon}>
          {hasChildren && !isSpecies ? (
            <Animated.View style={{ transform: [{ rotate: rotation }] }}>
              <Icon name="chevronRight" size={16} color={colors.bark} />
            </Animated.View>
          ) : (
            <View style={styles.leafDot} />
          )}
        </View>

        {/* 节点图片 */}
        <View style={styles.nodeImage}>
          <FallbackImage
            uri={node.representativeImage}
            style={styles.image}
            resizeMode="cover"
          />
        </View>

        {/* 节点信息 */}
        <View style={styles.nodeInfo}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.nodeName, isCurrent && styles.nodeNameCurrent]}
            >
              {node.commonNameZh}
            </Text>
            {node.childCount && !isSpecies && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{node.childCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.nodeScientific}>
            {node.scientificName}
            {isCurrent && ' · 当前'}
          </Text>
        </View>

        {/* 层级标签 */}
        <View style={[styles.levelTag, isCurrent && styles.levelTagCurrent]}>
          <Text
            style={[
              styles.levelTagText,
              isCurrent && styles.levelTagTextCurrent,
            ]}
          >
            {TAXONOMY_LEVELS[node.level]?.zh || node.level}
          </Text>
        </View>

        {/* 导航按钮 */}
        <TouchableOpacity
          onPress={handleNavigate}
          style={styles.navButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="chevronRight" size={14} color={colors.sand} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* 子节点容器 */}
      {isExpanded && (
        <View style={styles.childrenContainer}>
          {/* 连接线 */}
          <View style={[styles.connectionLine, { left: depth * 20 + 15 }]} />

          {/* 子节点列表 */}
          {children.map((child, index) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onNodePress={onNodePress}
              onNodeNavigate={onNodeNavigate}
              onLongPress={onLongPress}
              enableLazyLoad={enableLazyLoad}
            />
          ))}

          {/* 加载中 */}
          {isLoading && (
            <View
              style={[
                styles.loadingContainer,
                { marginLeft: (depth + 1) * 20 },
              ]}
            >
              <ActivityIndicator size="small" color={colors.moss} />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          )}

          {/* 加载更多按钮 */}
          {hasMore && !isLoading && (
            <TouchableOpacity
              onPress={handleLoadMore}
              style={[styles.loadMoreButton, { marginLeft: (depth + 1) * 20 }]}
              activeOpacity={0.7}
            >
              <Icon name="add" size={14} color={colors.moss} />
              <Text style={styles.loadMoreText}>
                加载更多 ({(node.childCount || 0) - loadedCount} 个)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  nodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    ...shadows.soft,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  nodeContainerCurrent: {
    backgroundColor: '#e8f5e8',
    borderLeftColor: colors.leaf,
  },
  expandIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leafDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.sand,
  },
  nodeImage: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginLeft: spacing.xs,
    marginRight: spacing.sm,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  nodeName: {
    ...typography.body,
    fontWeight: '500',
    color: colors.earthDark,
  },
  nodeNameCurrent: {
    color: colors.moss,
  },
  countBadge: {
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  countText: {
    fontSize: 10,
    color: colors.bark,
    fontWeight: '500',
  },
  nodeScientific: {
    ...typography.caption,
    color: colors.bark,
    fontStyle: 'italic',
  },
  levelTag: {
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  levelTagCurrent: {
    backgroundColor: colors.moss,
  },
  levelTagText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.bark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  levelTagTextCurrent: {
    color: colors.white,
  },
  navButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    borderRadius: borderRadius.sm,
  },
  childrenContainer: {
    position: 'relative',
  },
  connectionLine: {
    position: 'absolute',
    top: 0,
    bottom: spacing.sm,
    width: 2,
    backgroundColor: colors.sand,
    opacity: 0.3,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.bark,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    backgroundColor: colors.cream,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  loadMoreText: {
    ...typography.bodySmall,
    color: colors.moss,
    fontWeight: '500',
  },
});

export default TreeNode;
