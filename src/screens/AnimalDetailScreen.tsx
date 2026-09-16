// 动物详情页 - 增强版
// 支持图片轮播、收藏、分享功能

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
import { IUCN_STATUS } from '../constants/taxonomy';
import { getAnimalDetail } from '../services/searchService';
import {
  buildLocalAnimal,
  getIucnLabel,
  getTrendLabel,
  isConcerningStatus,
  mergeRemoteAnimal,
} from './animalDetail';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type AnimalDetailRouteProp = RouteProp<RootStackParamList, 'AnimalDetail'>;
type AnimalDetailNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'AnimalDetail'
>;

export const AnimalDetailScreen: React.FC = () => {
  const navigation = useNavigation<AnimalDetailNavigationProp>();
  const route = useRoute<AnimalDetailRouteProp>();

  // 先用路由参数里的数据渲染（识别链路已经带了 ITIS/IUCN 结果），
  // 再异步补齐后端详情；后端不可用时保持本地兜底，不阻塞首屏。
  const [animal, setAnimal] = useState<Animal>(() =>
    buildLocalAnimal(route.params.animal),
  );

  const lookupId = route.params.animal.id || route.params.animal.scientificName;

  useEffect(() => {
    if (!lookupId) {
      return;
    }

    let cancelled = false;

    getAnimalDetail(lookupId)
      .then(remote => {
        if (cancelled || !remote) {
          return;
        }
        setAnimal(prev => mergeRemoteAnimal(prev, remote));
      })
      .catch(error => {
        // eslint-disable-next-line no-console
        console.error(`[AnimalDetail] detail fetch failed for ${lookupId}:`, error);
      });

    return () => {
      cancelled = true;
    };
  }, [lookupId]);

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

  // 受威胁及以上（含 EX/EW）才展示保护状态卡片。
  // 历史上这里只判断 CR/EN/VU，会把「灭绝」当成「不濒危」。
  const showConservationCard =
    isConcerningStatus(animal.conservationStatus?.iucnStatus) &&
    Boolean(animal.conservationStatus);
  const statusLabel = getIucnLabel(animal.conservationStatus?.iucnStatus);
  const trendLabel = getTrendLabel(animal.conservationStatus?.populationTrend);
  const trend = animal.conservationStatus?.populationTrend;
  const trendIcon =
    trend === 'increasing' ? 'arrowUp' : trend === 'decreasing' ? 'arrowDown' : 'minus';
  const trendColor =
    trend === 'increasing'
      ? colors.leaf
      : trend === 'decreasing'
        ? colors.coral
        : colors.sand;

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
              {showConservationCard && animal.conservationStatus && (
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        IUCN_STATUS[animal.conservationStatus.iucnStatus].color,
                    },
                  ]}
                >
                  <Text style={styles.statusBadgeText}>{statusLabel}</Text>
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
                {animal.taxonomy.family?.commonNameZh || '—'}
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
          {showConservationCard && animal.conservationStatus && (
            <Card variant="danger" style={styles.card}>
              <View style={styles.endangeredHeader}>
                <EndangeredBadge
                  status={animal.conservationStatus.iucnStatus}
                  size="medium"
                />
                <View style={styles.trendBadge}>
                  <Icon name={trendIcon} size={14} color={trendColor} />
                  <Text style={[styles.trendText, { color: trendColor }]}>
                    {trendLabel}
                  </Text>
                </View>
              </View>
              <Text style={styles.endangeredText}>
                {animal.commonNameZh}是{statusLabel}物种，
                {animal.conservationStatus.iucnStatus === 'EX' ||
                animal.conservationStatus.iucnStatus === 'EW'
                  ? '野外已难以维系种群。'
                  : '需要重点保护。'}
              </Text>
              {animal.conservationStatus.population && (
                <View style={styles.populationStat}>
                  <Text style={styles.populationNumber}>
                    ~{animal.conservationStatus.population.toLocaleString()}
                  </Text>
                  <Text style={styles.populationLabel}>
                    野生个体
                    {animal.conservationStatus.assessmentYear
                      ? `（${animal.conservationStatus.assessmentYear}年评估）`
                      : ''}
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
