const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

const customJestConfig = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/app', '<rootDir>/lib'],
  testMatch: ['**/tests/**/*.test.ts', '**/*.test.ts'],
  // SWC rewrites the `@/*` path alias for plain `import` statements at
  // compile time, but jest.mock()'s string argument is resolved by Jest's
  // own resolver first and never reaches SWC — without this mapping,
  // jest.mock('@/lib/...') fails with "Cannot find module".
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

module.exports = createJestConfig(customJestConfig)
