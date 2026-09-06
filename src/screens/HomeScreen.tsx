// 首页

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, RecentRecord } from '../types';
import { colors, spacing, borderRadius, typography, gradients } from '../constants/theme';
import { SearchBar, ActionCard, Icon, FallbackImage } from '../components';

// 模拟数据 - 最近识别
const MOCK_RECENT_RECORDS: RecentRecord[] = [
  {
    id: '1',
    animal: {
      id: '1',
      commonNameZh: '东北虎',
      commonNameEn: 'Siberian Tiger',
      scientificName: 'Panthera tigris altaica',
      images: ['https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=200'],
      taxonomy: {
        kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
        phylum: { scientificName: 'Chordata', commonNameZh: '脊索动物门' },
        class: { scientificName: 'Mammalia', commonNameZh: '哺乳纲' },
        order: { scientificName: 'Carnivora', commonNameZh: '食肉目' },
        family: { scientificName: 'Felidae', commonNameZh: '猫科' },
        genus: { scientificName: 'Panthera', commonNameZh: '豹属' },
        species: { scientificName: 'Panthera tigris', commonNameZh: '虎' },
      },
    },
    imageUri: 'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=200',
    timestamp: Date.now(),
    confidence: 0.98,
  },
  {
    id: '2',
    animal: {
      id: '2',
      commonNameZh: '大熊猫',
      commonNameEn: 'Giant Panda',
      scientificName: 'Ailuropoda melanoleuca',
      images: ['https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=200'],
      taxonomy: {
        kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
        phylum: { scientificName: 'Chordata', commonNameZh: '脊索动物门' },
        class: { scientificName: 'Mammalia', commonNameZh: '哺乳纲' },
        order: { scientificName: 'Carnivora', commonNameZh: '食肉目' },
        family: { scientificName: 'Ursidae', commonNameZh: '熊科' },
        genus: { scientificName: 'Ailuropoda', commonNameZh: '大熊猫属' },
        species: { scientificName: 'Ailuropoda melanoleuca', commonNameZh: '大熊猫' },
      },
    },
    imageUri: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=200',
    timestamp: Date.now() - 3600000,
    confidence: 0.95,
  },
  {
    id: '3',
    animal: {
      id: '3',
      commonNameZh: '绿海龟',
      commonNameEn: 'Green Sea Turtle',
      scientificName: 'Chelonia mydas',
      images: ['https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=200'],
      taxonomy: {
        kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
        phylum: { scientificName: 'Chordata', commonNameZh: '脊索动物门' },
        class: { scientificName: 'Reptilia', commonNameZh: '爬行纲' },
        order: { scientificName: 'Testudines', commonNameZh: '龟鳖目' },
        family: { scientificName: 'Cheloniidae', commonNameZh: '海龟科' },
        genus: { scientificName: 'Chelonia', commonNameZh: '海龟属' },
        species: { scientificName: 'Chelonia mydas', commonNameZh: '绿海龟' },
      },
    },
    imageUri: 'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=200',
    timestamp: Date.now() - 7200000,
    confidence: 0.92,
  },
  {
    id: '4',
    animal: {
      id: '4',
      commonNameZh: '灰狼',
      commonNameEn: 'Gray Wolf',
      scientificName: 'Canis lupus',
      images: ['https://images.unsplash.com/photo-1551085254-e96b210db58a?w=200'],
      taxonomy: {
        kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
        phylum: { scientificName: 'Chordata', commonNameZh: '脊索动物门' },
        class: { scientificName: 'Mammalia', commonNameZh: '哺乳纲' },
        order: { scientificName: 'Carnivora', commonNameZh: '食肉目' },
        family: { scientificName: 'Canidae', commonNameZh: '犬科' },
        genus: { scientificName: 'Canis', commonNameZh: '犬属' },
        species: { scientificName: 'Canis lupus', commonNameZh: '狼' },
      },
    },
    imageUri: 'https://images.unsplash.com/photo-1551085254-e96b210db58a?w=200',
    timestamp: Date.now() - 86400000,
    confidence: 0.89,
  },
];

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();

  const handleSearch = () => {
    navigation.navigate('Search');
  };

  const handleCamera = () => {
    navigation.navigate('Camera');
  };

  const handleImagePicker = () => {
    navigation.navigate('ImagePicker');
  };

  const handleRecentItemPress = (record: RecentRecord) => {
    navigation.navigate('AnimalDetail', { animal: record.animal });
  };

  return (
    <LinearGradient
      colors={gradients.forest}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 头部 Logo 和标题 */}
        <View style={styles.header}>
          <LinearGradient
            colors={gradients.golden}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoContainer}
          >
            <Icon name="animal" size={48} color={colors.earthDark} />
          </LinearGradient>
          <Text style={styles.appTitle}>物种图鉴</Text>
          <Text style={styles.appSubtitle}>探 索 生 命 之 树</Text>
        </View>

        {/* 搜索框 */}
        <TouchableOpacity onPress={handleSearch} activeOpacity={0.9}>
          <View pointerEvents="none">
            <SearchBar variant="dark" />
          </View>
        </TouchableOpacity>

        {/* 操作区 */}
        <View style={styles.actionSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIndicator} />
            <Text style={styles.sectionTitle}>开始识别</Text>
          </View>
          <View style={styles.actionCards}>
            <ActionCard
              title="拍照识别"
              description="打开相机拍摄"
              icon="camera"
              onPress={handleCamera}
            />
            <View style={styles.actionSpacer} />
            <ActionCard
              title="相册上传"
              description="选择已有图片"
              icon="image"
              onPress={handleImagePicker}
            />
          </View>
        </View>

        {/* 最近识别 */}
        {MOCK_RECENT_RECORDS.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIndicator} />
              <Text style={styles.sectionTitle}>最近识别</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentList}
            >
              {MOCK_RECENT_RECORDS.map((record) => (
                <TouchableOpacity
                  key={record.id}
                  onPress={() => handleRecentItemPress(record)}
                  style={styles.recentItem}
                  activeOpacity={0.8}
                >
                  <FallbackImage
                    uri={record.imageUri}
                    style={styles.recentImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.recentName} numberOfLines={1}>
                    {record.animal.commonNameZh}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* 底部装饰渐变 */}
      <LinearGradient
        colors={['transparent', 'rgba(61, 90, 61, 0.3)']}
        style={styles.bottomDecoration}
        pointerEvents="none"
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  appTitle: {
    fontFamily: 'System',
    fontSize: 32,
    fontWeight: '700',
    color: colors.cream,
    marginBottom: spacing.sm,
    letterSpacing: 2,
  },
  appSubtitle: {
    fontSize: 14,
    color: colors.sand,
    fontWeight: '300',
    letterSpacing: 4,
  },
  actionSection: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionIndicator: {
    width: 4,
    height: 20,
    backgroundColor: colors.amber,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  sectionTitle: {
    fontFamily: 'System',
    fontSize: 18,
    fontWeight: '600',
    color: colors.cream,
  },
  actionCards: {
    flexDirection: 'row',
  },
  actionSpacer: {
    width: spacing.md,
  },
  recentSection: {
    marginTop: spacing.xl,
  },
  recentList: {
    paddingRight: spacing.lg,
    gap: spacing.md,
  },
  recentItem: {
    width: 100,
    marginRight: spacing.md,
  },
  recentImage: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  recentName: {
    ...typography.caption,
    color: colors.cream,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  bottomDecoration: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
});

export default HomeScreen;
