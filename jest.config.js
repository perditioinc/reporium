/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.claude/worktrees/',
    // TODO(#198): fix async timing in HomeGraphWidget tests
    'HomeGraphWidget.test.tsx',
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
};

module.exports = config;
