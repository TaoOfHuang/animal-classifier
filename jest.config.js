module.exports = {
  preset: 'react-native',
  // 限定测试发现范围，避免 jest 在未安装 watchman 时爬完整棵树
  // （node_modules 26k+ / server 6.5k 文件），启动开销从分钟级降到秒级。
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      '@react-native|' +
      'react-native|' +
      '@react-navigation|' +
      'react-native-screens|' +
      'react-native-safe-area-context|' +
      'react-native-image-picker|' +
      'react-native-linear-gradient|' +
      '@react-native-async-storage' +
      ')/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // 首个用例需付一次性的 RN + testing-library 模块装载成本（约 6s），
  // 机器有负载时会顶到默认 5000ms 边缘造成假失败，这里留出余量。
  testTimeout: 10000,
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/server/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/**/index.ts',
  ],
};
