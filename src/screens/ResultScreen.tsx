// 识别结果页面

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, spacing, borderRadius, typography, gradients } from '../constants/theme';
import { Card, TaxonomyPath, EndangeredBadge, Button, Icon, FallbackImage } from '../components';

type ResultRouteProp = RouteProp<RootStackParamList, 'Result'>;
type ResultNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Result'>;

export const ResultScreen: React.FC = () => {
  const navigation = useNavigation<ResultNavigationProp>();
  const route = useRoute<ResultRouteProp>();
  const { result, imageUri } = route.params;
  const { animal, confidence } = result;

  const handleGoBack = () => {
    navigation.navigate('Home');
  };

  const handleViewDetail = () => {
    navigation.navigate('AnimalDetail', { animal });
  };

  const handleViewTree = () => {
    navigation.navigate('TaxonomyTree', { animal });
  };

  const isEndangered = ['CR', 'EN', 'VU'].includes(
    animal.conservationStatus?.iucnStatus || ''
  );

  const confidencePercent = (confidence * 100).toFixed(1);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero 区域 */}
        <View style={styles.heroContainer}>
          <FallbackImage
            uri={imageUri}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={[
              'rgba(26, 22, 18, 0.4)',
              'transparent',
              'transparent',
              'rgba(26, 22, 18, 0.8)',
            ]}
            locations={[0, 0.3, 0.6, 1]}
            style={styles.heroOverlay}
          />

          {/* 返回按钮 */}
          <TouchableOpacity
            onPress={handleGoBack}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <Icon name="back" size={20} color={colors.white} />
          </TouchableOpacity>

          {/* 识别信息 */}
          <View style={styles.heroInfo}>
            <LinearGradient
              colors={gradients.golden}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.confidenceBadge}
            >
              <Icon name="check" size={14} color={colors.earthDark} />
              <Text style={styles.confidenceText}>
                识别置信度 {confidencePercent}%
              </Text>
            </LinearGradient>
            <Text style={styles.heroNameZh}>{animal.commonNameZh}</Text>
            <Text style={styles.heroNameEn}>{animal.scientificName}</Text>
          </View>
        </View>

        {/* 内容区域 */}
        <View style={styles.content}>
          {/* 分类信息卡片 */}
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>生物分类</Text>
              <TouchableOpacity onPress={handleViewTree} style={styles.viewTreeLink}>
                <Text style={styles.viewTreeText}>查看分类树</Text>
                <Icon name="chevronRight" size={16} color={colors.moss} />
              </TouchableOpacity>
            </View>
            <TaxonomyPath taxonomy={animal.taxonomy} />
          </Card>

          {/* 濒危状态卡片 */}
          {isEndangered && animal.conservationStatus && (
            <Card variant="danger" style={styles.card}>
              <EndangeredBadge
                status={animal.conservationStatus.iucnStatus as any}
                size="medium"
              />
              <Text style={styles.endangeredText}>
                {animal.commonNameZh}是现存{animal.conservationStatus.iucnStatus === 'EN' ? '濒危' : '易危'}物种，
                被列入《世界自然保护联盟》濒危物种红色名录。
              </Text>
              {animal.conservationStatus.population && (
                <View style={styles.populationStat}>
                  <Text style={styles.populationNumber}>
                    ~{animal.conservationStatus.population.toLocaleString()}
                  </Text>
                  <Text style={styles.populationLabel}>
                    野生个体（估计）
                  </Text>
                </View>
              )}
            </Card>
          )}

          {/* 栖息地信息 */}
          {animal.habitat && (
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>栖息地与分布</Text>
              <Text style={styles.cardContent}>{animal.habitat}</Text>
            </Card>
          )}

          {/* 生活习性 */}
          {animal.lifestyle && (
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>生活习性</Text>
              <Text style={styles.cardContent}>{animal.lifestyle}</Text>
            </Card>
          )}
        </View>
      </ScrollView>

      {/* 底部操作栏 */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarRow}>
          <Button
            title="查看详情"
            onPress={handleViewDetail}
            variant="secondary"
            style={styles.bottomBarButton}
            icon={<Icon name="info" size={18} color={colors.earthDark} />}
          />
          <Button
            title="分类树"
            onPress={handleViewTree}
            style={styles.bottomBarButton}
            icon={<Icon name="tree" size={18} color={colors.white} />}
          />
        </View>
      </View>
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
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  confidenceText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.earthDark,
    marginLeft: spacing.xs,
  },
  heroNameZh: {
    fontFamily: 'System',
    fontSize: 36,
    fontWeight: '700',
    color: colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroNameEn: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
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
  cardTitle: {
    fontFamily: 'System',
    fontSize: 18,
    fontWeight: '600',
    color: colors.earthDark,
    marginBottom: spacing.md,
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
  },
  populationNumber: {
    fontFamily: 'System',
    fontSize: 32,
    fontWeight: '700',
    color: colors.coral,
  },
  populationLabel: {
    ...typography.bodySmall,
    color: colors.bark,
    marginLeft: spacing.sm,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: 40,
    backgroundColor: colors.ivory,
  },
  // 「查看详情」与「分类树」并排等宽
  bottomBarRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bottomBarButton: {
    flex: 1,
  },
});

export default ResultScreen;
