// 分类树页面 - 优化版
// 支持面包屑导航、懒加载、动画效果

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, TaxonomyNode } from '../types';
import { TaxonomyLevel, TAXONOMY_LEVELS } from '../constants/taxonomy';
import {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
  gradients,
} from '../constants/theme';
import { Icon, Breadcrumb, TreeNode, BreadcrumbItem, FallbackImage } from '../components';
import {
  fetchTaxonomyChildren,
  buildTaxonomyPath,
} from '../services/taxonomyService';

type TaxonomyTreeRouteProp = RouteProp<RootStackParamList, 'TaxonomyTree'>;
type TaxonomyTreeNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'TaxonomyTree'
>;

// 视图模式
type ViewMode = 'tree' | 'list';

export const TaxonomyTreeScreen: React.FC = () => {
  const navigation = useNavigation<TaxonomyTreeNavigationProp>();
  const route = useRoute<TaxonomyTreeRouteProp>();
  const { animal } = route.params;

  // 状态
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [currentLevel, setCurrentLevel] = useState<TaxonomyLevel>('family');
  const [rootNodes, setRootNodes] = useState<TaxonomyNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<TaxonomyNode | null>(null);

  // 构建面包屑路径
  const breadcrumbItems = useMemo((): BreadcrumbItem[] => {
    if (!animal.taxonomy) return [];
    return buildTaxonomyPath(animal.taxonomy).map(({ level, item }) => ({
      level,
      item,
    }));
  }, [animal.taxonomy]);

  // mock 数据未覆盖该科时，用识别结果里的属/种构造兜底子树，
  // 保证任意识别出的动物都能展示自己的分类路径
  const fallbackChildren = useMemo((): TaxonomyNode[] => {
    const genus = animal.taxonomy?.genus;
    const species = animal.taxonomy?.species;
    if (!genus?.scientificName) return [];
    return [
      {
        id: genus.scientificName.toLowerCase(),
        level: 'genus',
        scientificName: genus.scientificName,
        commonNameZh: genus.commonNameZh || genus.scientificName,
        childCount: species ? 1 : 0,
        isCurrent: true,
        children: species?.scientificName
          ? [
              {
                id: species.scientificName.toLowerCase(),
                level: 'species',
                scientificName: species.scientificName,
                commonNameZh: species.commonNameZh || species.scientificName,
              },
            ]
          : undefined,
      },
    ];
  }, [animal.taxonomy]);

  // 加载根节点数据
  const loadRootData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const familyName = animal.taxonomy?.family?.scientificName;
      if (!familyName) {
        setRootNodes([]);
        return;
      }
      const result = await fetchTaxonomyChildren(
        familyName.toLowerCase(),
        'family',
        10,
        0,
        fallbackChildren,
      );

      // 标记当前动物所属的节点
      const markedNodes = result.children.map(node => ({
        ...node,
        isCurrent:
          node.scientificName.toLowerCase() ===
          animal.taxonomy?.genus?.scientificName?.toLowerCase(),
      }));

      setRootNodes(markedNodes);
    } catch (err) {
      setError('加载分类数据失败，请重试');
      console.error('Failed to load taxonomy data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [animal, fallbackChildren]);

  // 初始加载
  useEffect(() => {
    loadRootData();
  }, [loadRootData]);

  // 下拉刷新
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadRootData();
    setIsRefreshing(false);
  }, [loadRootData]);

  // 返回
  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // 面包屑点击
  const handleBreadcrumbPress = useCallback(
    (item: BreadcrumbItem, index: number) => {
      if (!item.item) return;
      setCurrentLevel(item.level);
      // 可以在这里切换显示的分类层级
      Alert.alert(
        item.item.commonNameZh,
        `${TAXONOMY_LEVELS[item.level]?.zh}: ${item.item.scientificName}`,
        [{ text: '确定' }],
      );
    },
    [],
  );

  // 节点点击
  const handleNodePress = useCallback((node: TaxonomyNode) => {
    setSelectedNode(node);
  }, []);

  // 节点导航
  const handleNodeNavigate = useCallback((node: TaxonomyNode) => {
    if (node.level === 'species') {
      // 如果是物种级别，跳转到动物详情页
      // 这里需要根据节点信息构造 Animal 对象或者发起 API 请求
      Alert.alert(
        node.commonNameZh,
        `学名: ${node.scientificName}\n\n即将查看该物种详情...`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '查看',
            onPress: () => {
              // TODO: 导航到动物详情页
              // navigation.navigate('AnimalDetail', { animal: constructedAnimal });
            },
          },
        ],
      );
    } else {
      // 其他层级显示子分类数量信息
      Alert.alert(
        node.commonNameZh,
        `${TAXONOMY_LEVELS[node.level]?.zh}\n学名: ${node.scientificName}\n包含 ${node.childCount || 0} 个下级分类`,
        [{ text: '确定' }],
      );
    }
  }, []);

  // 节点长按预览
  const handleNodeLongPress = useCallback(
    (node: TaxonomyNode) => {
      Alert.alert(
        '快速预览',
        `${node.commonNameZh} (${node.scientificName})\n\n层级: ${TAXONOMY_LEVELS[node.level]?.zh || node.level}\n${node.childCount ? `包含 ${node.childCount} 个下级分类` : ''}`,
        [
          { text: '取消', style: 'cancel' },
          { text: '查看详情', onPress: () => handleNodeNavigate(node) },
        ],
      );
    },
    [handleNodeNavigate],
  );

  // 切换视图模式
  const toggleViewMode = useCallback(() => {
    setViewMode(prev => (prev === 'tree' ? 'list' : 'tree'));
  }, []);

  // 分类层级信息
  const taxonomyLevels = useMemo(
    () => [
      { level: 'class' as TaxonomyLevel, data: animal.taxonomy?.class },
      { level: 'order' as TaxonomyLevel, data: animal.taxonomy?.order },
      { level: 'family' as TaxonomyLevel, data: animal.taxonomy?.family },
    ],
    [animal.taxonomy],
  );

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* 头部 */}
      <LinearGradient colors={gradients.forest} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Icon name="back" size={20} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>生物分类树</Text>
          <TouchableOpacity onPress={toggleViewMode} style={styles.modeButton}>
            <Icon
              name={viewMode === 'tree' ? 'list' : 'tree'}
              size={18}
              color={colors.white}
            />
          </TouchableOpacity>
        </View>

        {/* 当前动物信息卡片 */}
        <View style={styles.currentAnimal}>
          <FallbackImage
            uri={animal.images?.[0]}
            style={styles.currentImage}
            resizeMode="cover"
          />
          <View style={styles.currentInfo}>
            <Text style={styles.currentName}>{animal.commonNameZh}</Text>
            <Text style={styles.currentScientific}>
              {animal.scientificName}
            </Text>
          </View>
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>当前物种</Text>
          </View>
        </View>
      </LinearGradient>

      {/* 面包屑导航 */}
      <View style={styles.breadcrumbContainer}>
        <Breadcrumb
          items={breadcrumbItems}
          currentLevel={currentLevel}
          onItemPress={handleBreadcrumbPress}
          variant="pill"
          maxVisible={4}
        />
      </View>

      {/* 分类树内容 */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.moss]}
            tintColor={colors.moss}
          />
        }
      >
        {/* 上级分类路径 */}
        <View style={styles.pathContainer}>
          {taxonomyLevels.map(({ level, data }, index) => (
            <View key={level}>
              <TouchableOpacity
                style={styles.levelHeader}
                onPress={() =>
                  data && handleBreadcrumbPress({ level, item: data }, index)
                }
                activeOpacity={0.7}
              >
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>
                    {TAXONOMY_LEVELS[level].zh}
                  </Text>
                </View>
                <View style={styles.levelInfo}>
                  <Text style={styles.levelName}>{data?.commonNameZh}</Text>
                  <Text style={styles.levelScientific}>
                    {data?.scientificName}
                  </Text>
                </View>
                <Icon name="chevronRight" size={14} color={colors.sand} />
              </TouchableOpacity>
              {index < taxonomyLevels.length - 1 && (
                <View style={styles.levelLine} />
              )}
            </View>
          ))}
        </View>

        {/* 分隔线 */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>
            {animal.taxonomy?.family?.commonNameZh || '科'}下的分类
          </Text>
          <View style={styles.dividerLine} />
        </View>

        {/* 加载状态 */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.moss} />
            <Text style={styles.loadingText}>正在加载分类数据...</Text>
          </View>
        )}

        {/* 错误状态 */}
        {error && !isLoading && (
          <View style={styles.errorContainer}>
            <Icon name="warning" size={48} color={colors.coral} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={handleRefresh}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>重试</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 分类树 */}
        {!isLoading && !error && (
          <View style={styles.treeContainer}>
            {rootNodes.map(node => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                initialExpanded={node.isCurrent}
                onNodePress={handleNodePress}
                onNodeNavigate={handleNodeNavigate}
                onLongPress={handleNodeLongPress}
                enableLazyLoad={true}
              />
            ))}

            {/* 底部提示 */}
            {rootNodes.length > 0 && (
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  共 {rootNodes.length} 个属 · 点击展开查看下级分类
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* 选中节点的浮动信息卡 */}
      {selectedNode && (
        <TouchableOpacity
          style={styles.floatingCard}
          onPress={() => setSelectedNode(null)}
          activeOpacity={0.9}
        >
          <View style={styles.floatingCardContent}>
            {selectedNode.representativeImage && (
              <FallbackImage
                uri={selectedNode.representativeImage}
                style={styles.floatingImage}
                resizeMode="cover"
              />
            )}
            <View style={styles.floatingInfo}>
              <Text style={styles.floatingName}>
                {selectedNode.commonNameZh}
              </Text>
              <Text style={styles.floatingScientific}>
                {selectedNode.scientificName}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleNodeNavigate(selectedNode)}
              style={styles.floatingAction}
            >
              <Text style={styles.floatingActionText}>详情</Text>
              <Icon name="chevronRight" size={14} color={colors.white} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '600',
    color: colors.cream,
  },
  modeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentAnimal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  currentImage: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.sm,
    marginRight: spacing.md,
  },
  currentInfo: {
    flex: 1,
  },
  currentName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.cream,
  },
  currentScientific: {
    fontSize: 12,
    color: colors.sand,
    fontStyle: 'italic',
  },
  currentBadge: {
    backgroundColor: colors.leaf,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.white,
  },
  breadcrumbContainer: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.cream,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  pathContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.soft,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  levelBadge: {
    backgroundColor: colors.moss,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    marginRight: spacing.md,
    minWidth: 32,
    alignItems: 'center',
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  levelInfo: {
    flex: 1,
  },
  levelName: {
    ...typography.body,
    fontWeight: '500',
    color: colors.earthDark,
  },
  levelScientific: {
    ...typography.caption,
    color: colors.bark,
    fontStyle: 'italic',
  },
  levelLine: {
    width: 2,
    height: 16,
    backgroundColor: colors.moss,
    marginLeft: 15,
    opacity: 0.3,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.sand,
    opacity: 0.3,
  },
  dividerText: {
    ...typography.bodySmall,
    color: colors.bark,
    marginHorizontal: spacing.md,
  },
  treeContainer: {
    marginTop: spacing.sm,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    ...typography.body,
    color: colors.bark,
    marginTop: spacing.md,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  errorText: {
    ...typography.body,
    color: colors.coral,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.moss,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  retryText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  footerText: {
    ...typography.caption,
    color: colors.sand,
  },
  floatingCard: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    ...shadows.medium,
  },
  floatingCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  floatingImage: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    marginRight: spacing.md,
  },
  floatingInfo: {
    flex: 1,
  },
  floatingName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.earthDark,
  },
  floatingScientific: {
    ...typography.caption,
    color: colors.bark,
    fontStyle: 'italic',
  },
  floatingAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.moss,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  floatingActionText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: '500',
  },
});

export default TaxonomyTreeScreen;
