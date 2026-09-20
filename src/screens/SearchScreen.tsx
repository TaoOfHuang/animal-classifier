// 搜索页面 - 增强版
// 支持自动补全、搜索历史、分页加载

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, SearchResult } from '../types';
import {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
} from '../constants/theme';
import { SearchBar, AnimalCard, Icon } from '../components';
import {
  searchAnimals,
  getSearchHistory,
  addSearchHistory,
  removeSearchHistory,
  clearSearchHistory,
  getHotSearchTerms,
  getAnimalDetail,
} from '../services/searchService';

type SearchScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Search'
>;

export const SearchScreen: React.FC = () => {
  const navigation = useNavigation<SearchScreenNavigationProp>();

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 历史和热门
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [hotTerms, setHotTerms] = useState<string[]>([]);

  // Refs
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSearched = useRef(false);
  // 分页游标：只在 performSearch 内部读写，不参与渲染。
  // 若用 state，每次搜索都会改它 → performSearch 的依赖变化 → 防抖 effect
  // 被重新触发，变成反复重搜。用 ref 后 performSearch 依赖为空、引用恒定。
  const offsetRef = useRef(0);

  // 加载历史记录和热门搜索
  useEffect(() => {
    setSearchHistory(getSearchHistory());
    setHotTerms(getHotSearchTerms());
  }, []);

  // 执行搜索
  const performSearch = useCallback(
    async (query: string, loadMore = false) => {
      if (!query.trim()) {
        setSearchResults([]);
        setTotal(0);
        setHasMore(false);
        return;
      }

      if (loadMore) {
        setIsLoadingMore(true);
      } else {
        setIsSearching(true);
        offsetRef.current = 0;
      }

      try {
        const currentOffset = loadMore ? offsetRef.current : 0;
        const result = await searchAnimals(query, {
          limit: 10,
          offset: currentOffset,
        });

        if (loadMore) {
          setSearchResults(prev => [...prev, ...result.results]);
        } else {
          setSearchResults(result.results);
          hasSearched.current = true;
        }

        setTotal(result.total);
        setHasMore(result.hasMore);
        offsetRef.current = currentOffset + result.results.length;
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
        setIsLoadingMore(false);
      }
    },
    // offset 已改用 ref：依赖为空 → 引用恒定，可以安全放进防抖 effect 的依赖数组
    [],
  );

  // 防抖搜索
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (searchQuery.trim()) {
      debounceRef.current = setTimeout(() => {
        performSearch(searchQuery);
      }, 300);
    } else {
      setSearchResults([]);
      hasSearched.current = false;
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, performSearch]);

  // 取消搜索
  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // 点击标签或历史
  const handleTagPress = useCallback((tag: string) => {
    setSearchQuery(tag);
    addSearchHistory(tag);
    setSearchHistory(getSearchHistory());
    Keyboard.dismiss();
  }, []);

  // 删除历史记录
  const handleRemoveHistory = useCallback((item: string) => {
    removeSearchHistory(item);
    setSearchHistory(getSearchHistory());
  }, []);

  // 清空历史记录
  const handleClearHistory = useCallback(() => {
    clearSearchHistory();
    setSearchHistory([]);
  }, []);

  // 点击搜索结果
  const handleResultPress = useCallback(
    async (result: SearchResult) => {
      // 添加到搜索历史
      addSearchHistory(result.commonNameZh);
      setSearchHistory(getSearchHistory());

      // 获取完整动物数据
      const animal = await getAnimalDetail(result.id);

      if (animal) {
        navigation.navigate('AnimalDetail', { animal });
      } else {
        // 降级处理：使用搜索结果构造基础 Animal 对象
        navigation.navigate('AnimalDetail', {
          animal: {
            id: result.id,
            commonNameZh: result.commonNameZh,
            commonNameEn: result.commonNameEn,
            scientificName: result.scientificName,
            images: [result.thumbnailUrl || ''],
            taxonomy: {
              kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
              phylum: {
                scientificName: 'Chordata',
                commonNameZh: '脊索动物门',
              },
              class: { scientificName: 'Mammalia', commonNameZh: '哺乳动物' },
              order: { scientificName: '未知目', commonNameZh: '未知目' },
              family: {
                scientificName: result.family,
                commonNameZh: result.familyZh,
              },
              genus: {
                scientificName: result.scientificName.split(' ')[0],
                commonNameZh: '',
              },
              species: {
                scientificName: result.scientificName,
                commonNameZh: result.commonNameZh,
              },
            },
          },
        });
      }
    },
    [navigation],
  );

  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && searchQuery.trim()) {
      performSearch(searchQuery, true);
    }
  }, [isLoadingMore, hasMore, searchQuery, performSearch]);

  // 下拉刷新：重置分页游标后重新搜索当前关键词
  const handleRefresh = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsRefreshing(true);
    offsetRef.current = 0;
    try {
      await performSearch(searchQuery);
    } finally {
      setIsRefreshing(false);
    }
  }, [performSearch, searchQuery]);

  // 渲染搜索结果项
  const renderResultItem = useCallback(
    ({ item }: { item: SearchResult }) => (
      <View style={styles.resultItem}>
        <AnimalCard
          animal={item}
          onPress={() => handleResultPress(item)}
          variant="horizontal"
        />
      </View>
    ),
    [handleResultPress],
  );

  // 渲染历史记录项
  const renderHistoryItem = (item: string) => (
    <TouchableOpacity
      key={item}
      style={styles.historyItem}
      onPress={() => handleTagPress(item)}
      activeOpacity={0.7}
    >
      <Icon name="time" size={16} color={colors.sand} />
      <Text style={styles.historyText} numberOfLines={1}>
        {item}
      </Text>
      <TouchableOpacity
        onPress={() => handleRemoveHistory(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icon name="close" size={14} color={colors.sand} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // 列表头部
  const ListHeader = () => (
    <>
      {/* 搜索结果统计 */}
      {searchQuery.trim() && hasSearched.current && !isSearching && (
        <View style={styles.resultHeader}>
          <Text style={styles.resultCount}>
            找到 <Text style={styles.resultCountNum}>{total}</Text> 个结果
          </Text>
        </View>
      )}
    </>
  );

  // 列表底部
  const ListFooter = () => (
    <>
      {isLoadingMore && (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color={colors.moss} />
          <Text style={styles.loadingText}>加载更多...</Text>
        </View>
      )}
      {!hasMore && searchResults.length > 0 && (
        <View style={styles.noMore}>
          <Text style={styles.noMoreText}>已显示全部结果</Text>
        </View>
      )}
    </>
  );

  // 空状态
  const EmptyState = () => {
    if (isSearching) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.moss} />
          <Text style={styles.emptyText}>搜索中...</Text>
        </View>
      );
    }

    if (searchQuery.trim() && hasSearched.current) {
      return (
        <View style={styles.emptyState}>
          <Icon name="search" size={48} color={colors.sand} />
          <Text style={styles.emptyText}>
            未找到 "{searchQuery}" 相关的动物
          </Text>
          <Text style={styles.emptyHint}>请尝试其他关键词</Text>
        </View>
      );
    }

    // 显示历史和热门
    return (
      <View style={styles.defaultContent}>
        {/* 搜索历史 */}
        {searchHistory.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>搜索历史</Text>
              <TouchableOpacity onPress={handleClearHistory}>
                <Text style={styles.clearText}>清空</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.historyList}>
              {searchHistory.slice(0, 10).map(renderHistoryItem)}
            </View>
          </View>
        )}

        {/* 热门搜索 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>热门搜索</Text>
          <View style={styles.tagsContainer}>
            {hotTerms.map((tag, index) => (
              <TouchableOpacity
                key={tag}
                onPress={() => handleTagPress(tag)}
                style={[styles.tag, index < 3 && styles.tagHot]}
                activeOpacity={0.7}
              >
                <Text style={[styles.tagText, index < 3 && styles.tagTextHot]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.ivory} />

      {/* 搜索头部 */}
      <View style={styles.header}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
          showCancel
          onCancel={handleCancel}
          variant="light"
          placeholder="搜索动物名称、学名..."
        />
      </View>

      {/* 搜索结果列表 */}
      {searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          renderItem={renderResultItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.moss}
              colors={[colors.moss]}
            />
          }
        />
      ) : (
        <EmptyState />
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
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.md,
    backgroundColor: colors.ivory,
    ...shadows.soft,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  resultHeader: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cream,
    marginBottom: spacing.md,
  },
  resultCount: {
    ...typography.bodySmall,
    color: colors.bark,
  },
  resultCountNum: {
    fontWeight: '600',
    color: colors.moss,
  },
  resultItem: {
    marginBottom: spacing.md,
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.bark,
  },
  noMore: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  noMoreText: {
    ...typography.caption,
    color: colors.sand,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.bark,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptyHint: {
    ...typography.bodySmall,
    color: colors.sand,
    marginTop: spacing.sm,
  },
  defaultContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.bark,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  clearText: {
    ...typography.caption,
    color: colors.moss,
  },
  historyList: {
    gap: spacing.sm,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.soft,
  },
  historyText: {
    flex: 1,
    ...typography.body,
    color: colors.earthDark,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cream,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tagHot: {
    backgroundColor: '#fff5f5',
    borderColor: colors.coral,
  },
  tagText: {
    ...typography.bodySmall,
    color: colors.earthDark,
  },
  tagTextHot: {
    color: colors.coral,
    fontWeight: '500',
  },
});

export default SearchScreen;
