// 简单图标组件（使用 Unicode 符号）
// 后续可以替换为 react-native-vector-icons

import React from 'react';
import { Text, StyleSheet } from 'react-native';

const ICONS: Record<string, string> = {
  search: '🔍',
  camera: '📷',
  image: '🖼️',
  back: '←',
  forward: '→',
  up: '↑',
  down: '↓',
  arrowUp: '↗',
  arrowDown: '↘',
  check: '✓',
  close: '✕',
  warning: '⚠',
  tree: '🌳',
  animal: '🦁',
  panda: '🐼',
  tiger: '🐅',
  bird: '🐦',
  fish: '🐟',
  star: '★',
  starFilled: '★',
  heart: '♡',
  heartFilled: '♥',
  location: '📍',
  info: 'ℹ',
  chevronRight: '›',
  chevronLeft: '‹',
  chevronDown: '⌄',
  chevronUp: '⌃',
  menu: '☰',
  plus: '+',
  minus: '-',
  add: '+',
  time: '⏱',
  share: '↗',
  more: '⋯',
  expand: '⤢',
  list: '☰',
  stats: '📊',
};

interface IconProps {
  name: keyof typeof ICONS;
  size?: number;
  color?: string;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = '#000000',
}) => {
  const icon = ICONS[name] || '?';

  return <Text style={[styles.icon, { fontSize: size, color }]}>{icon}</Text>;
};

const styles = StyleSheet.create({
  icon: {
    textAlign: 'center',
  },
});

export default Icon;
