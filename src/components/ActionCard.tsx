// 操作卡片组件（首页的拍照识别、相册上传）

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import Icon from './Icon';

interface ActionCardProps {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  onPress: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  title,
  description,
  icon,
  onPress,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.container}
    >
      <View style={styles.card}>
        <LinearGradient
          colors={[colors.amber, colors.amberGlow]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconContainer}
        >
          <Icon name={icon} size={28} color={colors.earthDark} />
        </LinearGradient>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.body,
    fontWeight: '500',
    color: colors.cream,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.caption,
    color: colors.sand,
  },
});

export default ActionCard;
