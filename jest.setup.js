// Jest setup file for React Native

// Import built-in matchers from @testing-library/react-native v12.4+
import '@testing-library/react-native/pure';

// Mock react-native-image-picker
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-linear-gradient
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

// Mock react-native-bootsplash
jest.mock('react-native-bootsplash', () => ({
  hide: jest.fn(),
  show: jest.fn(),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const React = require('react');
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => React.createElement('View', null, children),
    useSafeAreaInsets: () => inset,
  };
});

// Mock react-native-screens
jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
}));

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      setOptions: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
    useFocusEffect: jest.fn(),
    NavigationContainer: ({ children }) =>
      React.createElement('View', null, children),
  };
});

// Mock @react-navigation/native-stack
jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }) => React.createElement('View', null, children),
      Screen: ({ children }) => React.createElement('View', null, children),
    }),
  };
});

// Mock 设备鉴权层：测试统一使用固定令牌，避免每个用例都去走真实的注册网络请求。
// deviceAuth 自身的逻辑由 src/services/__tests__/deviceAuth.test.ts 单独覆盖。
jest.mock('./src/services/deviceAuth', () => {
  class DeviceAuthError extends Error {
    constructor(message, status, code) {
      super(message);
      this.name = 'DeviceAuthError';
      this.status = status;
      this.code = code;
    }
  }

  return {
    DeviceAuthError,
    clearDeviceToken: jest.fn(() => Promise.resolve()),
    getDeviceToken: jest.fn(() => Promise.resolve('test-device-token')),
    registerDevice: jest.fn(() => Promise.resolve('test-device-token')),
    resolveDeviceId: jest.fn(() => Promise.resolve('a1b2c3d4e5f60718')),
    describeDeviceIdSource: jest.fn(() =>
      Promise.resolve({ deviceId: 'a1b2c3d4e5f60718', stable: true }),
    ),
  };
});
