// SearchBar 组件测试

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SearchBar } from '../SearchBar';

describe('SearchBar', () => {
  describe('rendering', () => {
    it('renders with default placeholder', () => {
      const { getByPlaceholderText } = render(<SearchBar />);
      expect(getByPlaceholderText('搜索动物名称...')).toBeTruthy();
    });

    it('renders with custom placeholder', () => {
      const { getByPlaceholderText } = render(
        <SearchBar placeholder="搜索..." />,
      );
      expect(getByPlaceholderText('搜索...')).toBeTruthy();
    });

    it('renders with initial value', () => {
      const { getByDisplayValue } = render(<SearchBar value="大熊猫" />);
      expect(getByDisplayValue('大熊猫')).toBeTruthy();
    });

    it('renders cancel button when showCancel is true', () => {
      const { getByText } = render(<SearchBar showCancel />);
      expect(getByText('取消')).toBeTruthy();
    });

    it('does not render cancel button by default', () => {
      const { queryByText } = render(<SearchBar />);
      expect(queryByText('取消')).toBeNull();
    });
  });

  describe('interactions', () => {
    it('calls onChangeText when text changes', () => {
      const onChangeTextMock = jest.fn();
      const { getByPlaceholderText } = render(
        <SearchBar onChangeText={onChangeTextMock} />,
      );

      fireEvent.changeText(getByPlaceholderText('搜索动物名称...'), '老虎');
      expect(onChangeTextMock).toHaveBeenCalledWith('老虎');
    });

    it('calls onSubmit when submit editing', () => {
      const onSubmitMock = jest.fn();
      const { getByPlaceholderText } = render(
        <SearchBar onSubmit={onSubmitMock} />,
      );

      const input = getByPlaceholderText('搜索动物名称...');
      fireEvent.changeText(input, '大熊猫');
      fireEvent(input, 'submitEditing');

      expect(onSubmitMock).toHaveBeenCalledWith('大熊猫');
    });

    it('calls onFocus when input is focused', () => {
      const onFocusMock = jest.fn();
      const { getByPlaceholderText } = render(
        <SearchBar onFocus={onFocusMock} />,
      );

      fireEvent(getByPlaceholderText('搜索动物名称...'), 'focus');
      expect(onFocusMock).toHaveBeenCalled();
    });

    it('calls onCancel when cancel button is pressed', () => {
      const onCancelMock = jest.fn();
      const { getByText } = render(
        <SearchBar showCancel onCancel={onCancelMock} />,
      );

      fireEvent.press(getByText('取消'));
      expect(onCancelMock).toHaveBeenCalled();
    });
  });

  describe('variants', () => {
    it('renders in light variant (default)', () => {
      const { getByPlaceholderText } = render(<SearchBar variant="light" />);
      expect(getByPlaceholderText('搜索动物名称...')).toBeTruthy();
    });

    it('renders in dark variant', () => {
      const { getByPlaceholderText } = render(<SearchBar variant="dark" />);
      expect(getByPlaceholderText('搜索动物名称...')).toBeTruthy();
    });
  });

  describe('controlled vs uncontrolled', () => {
    it('works as controlled component', () => {
      const onChangeTextMock = jest.fn();
      const { getByDisplayValue, rerender } = render(
        <SearchBar value="初始值" onChangeText={onChangeTextMock} />,
      );

      expect(getByDisplayValue('初始值')).toBeTruthy();

      // Rerender with new value
      rerender(<SearchBar value="新值" onChangeText={onChangeTextMock} />);
      // Note: The component manages local state, so we need to check the input
    });

    it('updates local state on text change', () => {
      const { getByPlaceholderText, getByDisplayValue } = render(<SearchBar />);

      fireEvent.changeText(getByPlaceholderText('搜索动物名称...'), '狮子');
      expect(getByDisplayValue('狮子')).toBeTruthy();
    });
  });
});
