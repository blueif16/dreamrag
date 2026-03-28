import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/tests/**/*.test.ts?(x)'],
  moduleNameMapper: {
    '^@lit-labs/react$': '<rootDir>/__mocks__/lit-labs-react.js',
    '^@a2ui/lit$': '<rootDir>/__mocks__/lit-labs-react.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@lit-labs|@lit|@a2ui|@copilotkit|@copilotkitnext)/)',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config)
