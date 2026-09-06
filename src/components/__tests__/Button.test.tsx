// Button 组件测试

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

// Mock LinearGradient
jest.mock('react-native-linear-gradient', () => {
  const { View } = require('react-native');
  return ({ children, style }: any) => <View style={style}>{children}</View>;
});

describe('Button', () => {
  it('renders title correctly', () => {
    const { getByText } = render(
      <Button title="测试按钮" onPress={() => {}} />,
    );
    expect(getByText('测试按钮')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <Button title="点击我" onPress={onPressMock} />,
    );

    fireEvent.press(getByText('点击我'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <Button title="禁用按钮" onPress={onPressMock} disabled />,
    );

    fireEvent.press(getByText('禁用按钮'));
    expect(onPressMock).not.toHaveBeenCalled();
  });

  it('does not show title when loading', () => {
    const { queryByText } = render(
      <Button title="加载中" onPress={() => {}} loading />,
    );

    // 按钮标题不应该显示（显示 ActivityIndicator 替代）
    expect(queryByText('加载中')).toBeNull();
  });

  it('renders with different variants', () => {
    const variants = ['primary', 'secondary', 'outline', 'ghost'] as const;

    variants.forEach(variant => {
      const { getByText } = render(
        <Button
          title={`${variant} 按钮`}
          onPress={() => {}}
          variant={variant}
        />,
      );
      expect(getByText(`${variant} 按钮`)).toBeTruthy();
    });
  });

  it('renders with different sizes', () => {
    const sizes = ['small', 'medium', 'large'] as const;

    sizes.forEach(size => {
      const { getByText } = render(
        <Button title={`${size} 按钮`} onPress={() => {}} size={size} />,
      );
      expect(getByText(`${size} 按钮`)).toBeTruthy();
    });
  });

  it('renders with icon', () => {
    const { Text } = require('react-native');
    const { getByText, UNSAFE_queryAllByType } = render(
      <Button
        title="带图标"
        onPress={() => {}}
        icon={<Text key="icon">🎯</Text>}
      />,
    );
    expect(getByText('带图标')).toBeTruthy();
    // 验证图标存在
    const textElements = UNSAFE_queryAllByType(Text);
    expect(textElements.length).toBeGreaterThan(1);
  });
});
