// 搜索框组件

import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import Icon from './Icon';

interface SearchBarProps {
  value?: string;
  onChangeText?: (text: string) => void;
  onSubmit?: (text: string) => void;
  onFocus?: () => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  showCancel?: boolean;
  variant?: 'light' | 'dark';
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value = '',
  onChangeText,
  onSubmit,
  onFocus,
  onCancel,
  placeholder = '搜索动物名称...',
  autoFocus = false,
  showCancel = false,
  variant = 'light',
}) => {
  const [localValue, setLocalValue] = useState(value);

  const handleChangeText = (text: string) => {
    setLocalValue(text);
    onChangeText?.(text);
  };

  const handleSubmit = () => {
    onSubmit?.(localValue);
  };

  const isLight = variant === 'light';

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputContainer,
          isLight ? styles.inputContainerLight : styles.inputContainerDark,
        ]}
      >
        <Icon
          name="search"
          size={20}
          color={isLight ? colors.bark : colors.sand}
        />
        <TextInput
          style={[
            styles.input,
            { color: isLight ? colors.earthDark : colors.cream },
          ]}
          value={localValue}
          onChangeText={handleChangeText}
          onSubmitEditing={handleSubmit}
          onFocus={onFocus}
          placeholder={placeholder}
          placeholderTextColor={isLight ? colors.sand : 'rgba(196, 182, 156, 0.7)'}
          autoFocus={autoFocus}
          returnKeyType="search"
        />
      </View>
      {showCancel && (
        <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
          <Text
            style={[
              styles.cancelText,
              { color: isLight ? colors.moss : colors.sand },
            ]}
          >
            取消
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  inputContainerLight: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.cream,
  },
  inputContainerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  input: {
    flex: 1,
    marginLeft: spacing.md,
    ...typography.body,
    padding: 0,
  },
  cancelButton: {
    marginLeft: spacing.md,
  },
  cancelText: {
    ...typography.body,
    fontWeight: '500',
  },
});

export default SearchBar;
