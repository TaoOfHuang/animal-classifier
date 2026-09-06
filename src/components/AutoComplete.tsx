// 搜索自动补全组件
// 支持搜索建议、历史记录显示

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  Animated,
} from 'react-native';
import {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
} from '../constants/theme';
import { Icon } from './Icon';
import {
  getSearchSuggestions,
  getSearchHistory,
  addSearchHistory,
  removeSearchHistory,
  clearSearchHistory,
  getHotSearchTerms,
} from '../services/searchService';

interface AutoCompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSearch: (query: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  showHistory?: boolean;
  showHotSearch?: boolean;
}

export const AutoComplete: React.FC<AutoCompleteProps> = ({
  value,
  onChangeText,
  onSearch,
  placeholder = '搜索动物...',
  autoFocus = false,
  showHistory = true,
  showHotSearch = true,
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [hotTerms, setHotTerms] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const dropdownAnim = useRef(new Animated.Value(0)).current;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 加载历史记录和热门搜索
  useEffect(() => {
    if (showHistory) {
      setHistory(getSearchHistory());
    }
    if (showHotSearch) {
      setHotTerms(getHotSearchTerms());
    }
  }, [showHistory, showHotSearch]);

  // 加载搜索建议
  const loadSuggestions = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const results = await getSearchSuggestions(query, 5);
      setSuggestions(results);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 防抖加载建议
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      loadSuggestions(value);
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, loadSuggestions]);

  // 焦点变化动画
  useEffect(() => {
    Animated.timing(dropdownAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isFocused, dropdownAnim]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setHistory(getSearchHistory());
  }, []);

  const handleBlur = useCallback(() => {
    // 延迟关闭，允许用户点击建议项
    setTimeout(() => setIsFocused(false), 200);
  }, []);

  const handleSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;

      addSearchHistory(trimmed);
      setHistory(getSearchHistory());
      onSearch(trimmed);
      Keyboard.dismiss();
      setIsFocused(false);
    },
    [onSearch],
  );

  const handleSelectSuggestion = useCallback(
    (suggestion: string) => {
      onChangeText(suggestion);
      handleSearch(suggestion);
    },
    [onChangeText, handleSearch],
  );

  const handleRemoveHistory = useCallback((item: string) => {
    removeSearchHistory(item);
    setHistory(getSearchHistory());
  }, []);

  const handleClearHistory = useCallback(() => {
    clearSearchHistory();
    setHistory([]);
  }, []);

  const handleClear = useCallback(() => {
    onChangeText('');
    inputRef.current?.focus();
  }, [onChangeText]);

  const showDropdown =
    isFocused &&
    (suggestions.length > 0 ||
      (value.length === 0 && (history.length > 0 || hotTerms.length > 0)));

  const renderSuggestionItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSelectSuggestion(item)}
      activeOpacity={0.7}
    >
      <Icon name="search" size={16} color={colors.sand} />
      <Text style={styles.suggestionText} numberOfLines={1}>
        {item}
      </Text>
      <Icon name="chevronRight" size={14} color={colors.sand} />
    </TouchableOpacity>
  );

  const renderHistoryItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.historyItem}
      onPress={() => handleSelectSuggestion(item)}
      activeOpacity={0.7}
    >
      <Icon name="time" size={16} color={colors.sand} />
      <Text style={styles.historyText} numberOfLines={1}>
        {item}
      </Text>
      <TouchableOpacity
        onPress={() => handleRemoveHistory(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.removeButton}
      >
        <Icon name="close" size={14} color={colors.sand} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderHotSearchItem = (item: string, index: number) => (
    <TouchableOpacity
      key={item}
      style={styles.hotTag}
      onPress={() => handleSelectSuggestion(item)}
      activeOpacity={0.7}
    >
      <Text style={[styles.hotTagText, index < 3 && styles.hotTagTextTop]}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* 搜索输入框 */}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
        ]}
      >
        <Icon
          name="search"
          size={20}
          color={isFocused ? colors.moss : colors.sand}
        />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={() => handleSearch(value)}
          placeholder={placeholder}
          placeholderTextColor={colors.sand}
          returnKeyType="search"
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Icon name="close" size={16} color={colors.bark} />
          </TouchableOpacity>
        )}
      </View>

      {/* 下拉菜单 */}
      {showDropdown && (
        <Animated.View
          style={[
            styles.dropdown,
            {
              opacity: dropdownAnim,
              transform: [
                {
                  translateY: dropdownAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* 搜索建议 */}
          {value.length > 0 && suggestions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>搜索建议</Text>
              <FlatList
                data={suggestions}
                renderItem={renderSuggestionItem}
                keyExtractor={(item, index) => `suggestion-${index}`}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* 搜索历史 */}
          {value.length === 0 && history.length > 0 && showHistory && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>搜索历史</Text>
                <TouchableOpacity onPress={handleClearHistory}>
                  <Text style={styles.clearText}>清空</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={history.slice(0, 5)}
                renderItem={renderHistoryItem}
                keyExtractor={(item, index) => `history-${index}`}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* 热门搜索 */}
          {value.length === 0 && hotTerms.length > 0 && showHotSearch && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>热门搜索</Text>
              <View style={styles.hotTagsContainer}>
                {hotTerms.map((item, index) =>
                  renderHotSearchItem(item, index),
                )}
              </View>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    zIndex: 100,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputContainerFocused: {
    borderColor: colors.moss,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.earthDark,
    padding: 0,
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    ...shadows.medium,
    maxHeight: 350,
    overflow: 'hidden',
  },
  section: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cream,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.bark,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  clearText: {
    ...typography.caption,
    color: colors.moss,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  suggestionText: {
    flex: 1,
    ...typography.body,
    color: colors.earthDark,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  historyText: {
    flex: 1,
    ...typography.body,
    color: colors.bark,
  },
  removeButton: {
    padding: spacing.xs,
  },
  hotTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  hotTag: {
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  hotTagText: {
    ...typography.bodySmall,
    color: colors.bark,
  },
  hotTagTextTop: {
    color: colors.coral,
    fontWeight: '500',
  },
});

export default AutoComplete;
