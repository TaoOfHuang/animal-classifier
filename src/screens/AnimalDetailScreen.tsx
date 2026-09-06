// 动物详情页 - 增强版
// 支持图片轮播、收藏、分享功能

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  StatusBar,
  TouchableOpacity,
  Dimensions,
  Share,
  Alert,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Animal } from '../types';
import {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
} from '../constants/theme';
import {
  Card,
  TaxonomyPath,
  EndangeredBadge,
  Icon,
  ImageCarousel,
} from '../components';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type AnimalDetailRouteProp = RouteProp<RootStackParamList, 'AnimalDetail'>;
type AnimalDetailNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'AnimalDetail'
>;

// 模拟完整动物数据
const getMockAnimalData = (animal: Partial<Animal>): Animal => ({
  id: animal.id || 'unknown',
  commonNameZh: animal.commonNameZh || '未知动物',
  commonNameEn: animal.commonNameEn || 'Unknown Animal',
  scientificName: animal.scientificName || '',
  description: `${animal.commonNameZh}是一种令人惊叹的动物。`,
  habitat:
    animal.habitat ||
    (animal.commonNameZh === '大熊猫'
      ? '仅分布于中国四川、陕西和甘肃的高山竹林中。栖息地海拔通常在 1,200-3,400 米之间，偏好凉爽湿润的环境，以竹子为主要食物来源。'
      : '主要分布于俄罗斯远东地区、中国东北部及朝鲜北部。栖息于针阔混交林、落叶阔叶林等森林生态系统，偏好有丰富猎物和水源的区域。'),
  lifestyle:
    animal.lifestyle ||
    (animal.commonNameZh === '大熊猫'
      ? '大熊猫是独居动物，每天需要花费 12-16 小时进食竹子。虽属于食肉目，但 99% 的食物是竹子。善于爬树，游泳能力也很强。'
      : '独居动物，领地意识强。主要在晨昏活动，善于游泳。以野猪、马鹿、狍子等有蹄类为主要猎物。雄虎领地可达 1000 平方公里。'),
  conservationStatus: animal.conservationStatus || {
    iucnStatus: animal.commonNameZh === '大熊猫' ? 'VU' : 'EN',
    population: animal.commonNameZh === '大熊猫' ? 1864 : 500,
    populationTrend: 'increasing',
    assessmentYear: 2021,
  },
  images: animal.images?.length
    ? animal.images
    : [
        'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=800',
        'https://images.unsplash.com/photo-1527118732049-c88155f2107c?w=800',
        'https://images.unsplash.com/photo-1540126034813-121bf29033d2?w=800',
      ],
  taxonomy: animal.taxonomy || {
    kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
    phylum: { scientificName: 'Chordata', commonNameZh: '脊索动物门' },
    class: { scientificName: 'Mammalia', commonNameZh: '哺乳纲' },
    order: { scientificName: 'Carnivora', commonNameZh: '食肉目' },
    family: { scientificName: 'Ursidae', commonNameZh: '熊科' },
    genus: { scientificName: 'Ailuropoda', commonNameZh: '大熊猫属' },
    species: {
      scientificName: animal.scientificName || '',
      commonNameZh: animal.commonNameZh || '',
    },
  },
});

export const AnimalDetailScreen: React.FC = () => {
  const navigation = useNavigation<AnimalDetailNavigationProp>();
  const route = useRoute<AnimalDetailRouteProp>();
  const animal = getMockAnimalData(route.params.animal);

  // 收藏状态
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteScale] = useState(new Animated.Value(1));

  // 查看分类树
  const handleViewTree = useCallback(() => {
    navigation.navigate('TaxonomyTree', { animal });
  }, [navigation, animal]);

  // 返回
  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // 切换收藏
  const handleToggleFavorite = useCallback(() => {
    // 动画效果
    Animated.sequence([
      Animated.timing(favoriteScale, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(favoriteScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setIsFavorite(prev => !prev);
    // TODO: 持久化收藏状态到本地存储
  }, [favoriteScale]);

  // 分享
  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        title: `${animal.commonNameZh} - 物种图鉴`,
        message: `${animal.commonNameZh} (${animal.scientificName})\n\n${animal.description}\n\n#物种图鉴 #动物`,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  }, [animal]);

  // 显示更多选项
  const handleMoreOptions = useCallback(() => {
    Alert.alert('更多操作', undefined, [
      {
        text: '举报错误信息',
        onPress: () =>
          Alert.alert('已收到反馈', '感谢您的反馈，我们会尽快核实。'),
      },
      {
        text: '复制学名',
        onPress: () => Alert.alert('已复制', animal.scientificName),
      },
      { text: '取消', style: 'cancel' },
    ]);
  }, [animal.scientificName]);

  const isEndangered = ['CR', 'EN', 'VU'].includes(
    animal.conservationStatus?.iucnStatus || '',
  );
  const statusLabels: Record<string, string> = {
    CR: '极危',
    EN: '濒危',
    VU: '易危',
    NT: '近危',
    LC: '无危',
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Hero 图片区域 */}
        <View style={styles.heroContainer}>
          <ImageCarousel
            images={animal.images}
            height={320}
            autoPlay={false}
            showFullScreenButton={true}
            showPagination={true}
          />

          {/* 渐变遮罩 */}
          <LinearGradient
            colors={[
              'rgba(26, 22, 18, 0.4)',
              'transparent',
              'transparent',
              'rgba(26, 22, 18, 0.95)',
            ]}
            locations={[0, 0.2, 0.5, 1]}
            style={styles.heroOverlay}
            pointerEvents="none"
          />

          {/* 顶部操作栏 */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={handleGoBack}
              style={styles.iconButton}
              activeOpacity={0.8}
            >
              <Icon name="back" size={20} color={colors.white} />
            </TouchableOpacity>

            <View style={styles.topBarRight}>
              <Animated.View style={{ transform: [{ scale: favoriteScale }] }}>
                <TouchableOpacity
                  onPress={handleToggleFavorite}
                  style={styles.iconButton}
                  activeOpacity={0.8}
                >
                  <Icon
                    name={isFavorite ? 'heartFilled' : 'heart'}
                    size={20}
                    color={isFavorite ? colors.coral : colors.white}
                  />
                </TouchableOpacity>
              </Animated.View>

              <TouchableOpacity
                onPress={handleShare}
                style={styles.iconButton}
                activeOpacity={0.8}
              >
                <Icon name="share" size={20} color={colors.white} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleMoreOptions}
                style={styles.iconButton}
                activeOpacity={0.8}
              >
                <Icon name="more" size={20} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 动物名称 */}
          <View style={styles.heroInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.heroNameZh}>{animal.commonNameZh}</Text>
              {isEndangered && (
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        colors.endangered[
                          animal.conservationStatus
                            ?.iucnStatus as keyof typeof colors.endangered
                        ] || colors.sand,
                    },
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {statusLabels[
                      animal.conservationStatus?.iucnStatus || ''
                    ] || ''}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.heroNameEn}>{animal.commonNameEn}</Text>
            <Text style={styles.heroScientific}>{animal.scientificName}</Text>
          </View>
        </View>

        {/* 内容区域 */}
        <View style={styles.content}>
          {/* 快速信息卡片 */}
          <View style={styles.quickInfo}>
            <View style={styles.quickInfoItem}>
              <Icon name="tree" size={20} color={colors.moss} />
              <Text style={styles.quickInfoLabel}>科</Text>
              <Text style={styles.quickInfoValue}>
                {animal.taxonomy.family?.commonNameZh}
              </Text>
            </View>
            <View style={styles.quickInfoDivider} />
            <View style={styles.quickInfoItem}>
              <Icon name="animal" size={20} color={colors.moss} />
              <Text style={styles.quickInfoLabel}>属</Text>
              <Text style={styles.quickInfoValue}>
                {animal.taxonomy.genus?.commonNameZh || '—'}
              </Text>
            </View>
            {animal.conservationStatus?.population && (
              <>
                <View style={styles.quickInfoDivider} />
                <View style={styles.quickInfoItem}>
                  <Icon name="stats" size={20} color={colors.moss} />
                  <Text style={styles.quickInfoLabel}>种群</Text>
                  <Text style={styles.quickInfoValue}>
                    ~{animal.conservationStatus.population.toLocaleString()}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* 分类信息卡片 */}
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Icon name="tree" size={18} color={colors.moss} />
                <Text style={styles.cardTitle}>生物分类</Text>
              </View>
              <TouchableOpacity
                onPress={handleViewTree}
                style={styles.viewTreeLink}
              >
                <Text style={styles.viewTreeText}>查看分类树</Text>
                <Icon name="chevronRight" size={16} color={colors.moss} />
              </TouchableOpacity>
            </View>
            <TaxonomyPath taxonomy={animal.taxonomy} />
          </Card>

          {/* 濒危状态卡片 */}
          {isEndangered && animal.conservationStatus && (
            <Card variant="danger" style={styles.card}>
              <View style={styles.endangeredHeader}>
                <EndangeredBadge
                  status={animal.conservationStatus.iucnStatus as any}
                  size="medium"
                />
                <View style={styles.trendBadge}>
                  <Icon
                    name={
                      animal.conservationStatus.populationTrend === 'increasing'
                        ? 'arrowUp'
                        : animal.conservationStatus.populationTrend ===
                            'decreasing'
                          ? 'arrowDown'
                          : 'minus'
                    }
                    size={14}
                    color={
                      animal.conservationStatus.populationTrend === 'increasing'
                        ? colors.leaf
                        : animal.conservationStatus.populationTrend ===
                            'decreasing'
                          ? colors.coral
                          : colors.sand
                    }
                  />
                  <Text
                    style={[
                      styles.trendText,
                      {
                        color:
                          animal.conservationStatus.populationTrend ===
                          'increasing'
                            ? colors.leaf
                            : animal.conservationStatus.populationTrend ===
                                'decreasing'
                              ? colors.coral
                              : colors.sand,
                      },
                    ]}
                  >
                    {animal.conservationStatus.populationTrend === 'increasing'
                      ? '种群恢复中'
                      : animal.conservationStatus.populationTrend ===
                          'decreasing'
                        ? '种群下降'
                        : '种群稳定'}
                  </Text>
                </View>
              </View>
              <Text style={styles.endangeredText}>
                {animal.commonNameZh}是
                {statusLabels[animal.conservationStatus.iucnStatus] || ''}物种，
                需要重点保护。
              </Text>
              {animal.conservationStatus.population && (
                <View style={styles.populationStat}>
                  <Text style={styles.populationNumber}>
                    ~{animal.conservationStatus.population.toLocaleString()}
                  </Text>
                  <Text style={styles.populationLabel}>
                    野生个体（{animal.conservationStatus.assessmentYear}年普查）
                  </Text>
                </View>
              )}
            </Card>
          )}

          {/* 栖息地信息 */}
          <Card style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Icon name="location" size={18} color={colors.moss} />
              <Text style={styles.cardTitle}>栖息地与分布</Text>
            </View>
            <Text style={styles.cardContent}>{animal.habitat}</Text>
          </Card>

          {/* 生活习性 */}
          <Card style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Icon name="animal" size={18} color={colors.moss} />
              <Text style={styles.cardTitle}>生活习性</Text>
            </View>
            <Text style={styles.cardContent}>{animal.lifestyle}</Text>
          </Card>

          {/* 底部留白 */}
          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  scrollView: {
    flex: 1,
  },
  heroContainer: {
    height: 320,
    position: 'relative',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBarRight: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroNameZh: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.white,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.white,
  },
  heroNameEn: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: spacing.xs,
  },
  heroScientific: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
    marginTop: 2,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  quickInfo: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.soft,
  },
  quickInfoItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  quickInfoDivider: {
    width: 1,
    backgroundColor: colors.cream,
    marginHorizontal: spacing.sm,
  },
  quickInfoLabel: {
    ...typography.caption,
    color: colors.sand,
  },
  quickInfoValue: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.earthDark,
  },
  card: {
    marginBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.earthDark,
  },
  cardContent: {
    ...typography.bodySmall,
    lineHeight: 24,
    color: colors.bark,
  },
  viewTreeLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewTreeText: {
    ...typography.bodySmall,
    color: colors.moss,
    fontWeight: '500',
  },
  endangeredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '500',
  },
  endangeredText: {
    ...typography.bodySmall,
    color: colors.bark,
    marginTop: spacing.md,
    lineHeight: 22,
  },
  populationStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(216, 90, 74, 0.1)',
  },
  populationNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.coral,
  },
  populationLabel: {
    ...typography.bodySmall,
    color: colors.bark,
    marginLeft: spacing.sm,
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
});

export default AnimalDetailScreen;
