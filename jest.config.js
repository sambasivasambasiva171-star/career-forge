const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

const customJestConfig = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/app', '<rootDir>/lib'],
  testMatch: ['**/tests/**/*.test.ts', '**/*.test.ts'],
}

module.exports = createJestConfig(customJestConfig)
