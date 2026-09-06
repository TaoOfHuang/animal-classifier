// 物种图鉴 App 主题配置
// 自然森林主题，深绿色+金色为主色调

export const colors = {
  // 主色调 - 大地与森林
  earthDark: '#1a1612',
  earth: '#2d2620',
  bark: '#4a3f35',
  
  // 绿色系 - 苔藓与树叶
  moss: '#3d5a3d',
  mossLight: '#5a7a5a',
  leaf: '#7fa650',
  leafGlow: '#a8d450',
  
  // 中性色 - 沙与象牙
  sand: '#c4b69c',
  cream: '#f5f0e6',
  ivory: '#fdfbf7',
  
  // 强调色
  amber: '#d4a84b',
  amberGlow: '#f0c060',
  coral: '#d85a4a',
  sky: '#6a9ec0',
  
  // 功能色
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
  
  // 濒危等级颜色
  endangered: {
    CR: '#c41e3a', // 极危
    EN: '#d85a4a', // 濒危
    VU: '#e89b4a', // 易危
    NT: '#f0c060', // 近危
    LC: '#7fa650', // 无危
  },
};

export const gradients = {
  forest: ['#1a1612', '#2d3a2d', '#1a1612'],
  golden: ['#d4a84b', '#f0c060'],
  leaf: ['#3d5a3d', '#5a7a5a'],
};

export const fonts = {
  // 使用系统默认字体，React Native 会自动处理
  display: {
    fontFamily: 'System',
    fontWeight: '700' as const,
  },
  heading: {
    fontFamily: 'System',
    fontWeight: '600' as const,
  },
  body: {
    fontFamily: 'System',
    fontWeight: '400' as const,
  },
  caption: {
    fontFamily: 'System',
    fontWeight: '300' as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  full: 9999,
};

export const shadows = {
  soft: {
    shadowColor: colors.earthDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  medium: {
    shadowColor: colors.earthDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  strong: {
    shadowColor: colors.earthDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const typography = {
  h1: {
    fontSize: 32,
    lineHeight: 40,
    ...fonts.display,
  },
  h2: {
    fontSize: 24,
    lineHeight: 32,
    ...fonts.heading,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    ...fonts.heading,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    ...fonts.body,
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    ...fonts.body,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    ...fonts.caption,
  },
  label: {
    fontSize: 10,
    lineHeight: 14,
    ...fonts.caption,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
};

const theme = {
  colors,
  gradients,
  fonts,
  spacing,
  borderRadius,
  shadows,
  typography,
};

export default theme;
