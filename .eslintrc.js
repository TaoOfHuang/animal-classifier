module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      files: [
        'jest.setup.js',
        '**/__tests__/**/*.{ts,tsx}',
        '**/*.test.{ts,tsx}',
      ],
      env: {
        jest: true,
      },
    },
    {
      files: ['server/**/*.{ts,js}'],
      rules: {
        'eslint-comments/no-unused-disable': 'off',
      },
    },
  ],
  ignorePatterns: ['server/dist/**'],
};
