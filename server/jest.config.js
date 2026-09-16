module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // 只把 *.test.ts 当测试，`__tests__/helpers/` 里的共享替身不会被误当成空套件。
  testMatch: ['**/__tests__/**/*.test.ts'],
};
