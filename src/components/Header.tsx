// 页面头部组件

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography } from '../constants/theme';
import Icon from './Icon';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  transparent?: boolean;
  dark?: boolean;
  rightElement?: React.ReactNode;
  onBackPress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBack = true,
  transparent = false,
  dark = false,
  rightElement,
  onBackPress,
}) => {
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };

  const textColor = dark ? colors.cream : colors.earthDark;
  const backgroundColor = transparent ? 'transparent' : (dark ? colors.earthDark : colors.ivory);

  return (
    <>
      <StatusBar
        barStyle={dark ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundColor}
        translucent={transparent}
      />
      <View style={[styles.container, { backgroundColor }]}>
        <View style={styles.left}>
          {showBack && (
            <TouchableOpacity
              onPress={handleBack}
              style={[
                styles.backButton,
                transparent && styles.backButtonTransparent,
              ]}
            >
              <Icon
                name="back"
                size={20}
                color={transparent ? colors.white : textColor}
              />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.center}>
          {title && (
            <Text style={[styles.title, { color: textColor }]}>
              {title}
            </Text>
          )}
        </View>
        
        <View style={styles.right}>
          {rightElement}
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg + (StatusBar.currentHeight || 0),
    paddingBottom: spacing.md,
  },
  left: {
    width: 50,
    alignItems: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  right: {
    width: 50,
    alignItems: 'flex-end',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonTransparent: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  title: {
    ...typography.h3,
  },
});

export default Header;
