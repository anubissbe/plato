/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Mock execa and other ESM modules
    '^execa$': '<rootDir>/src/__mocks__/execa.ts',
    '^fs/promises$': '<rootDir>/src/__mocks__/fs/promises.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(ink-testing-library)/)',
  ],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: {
          module: 'commonjs',
          target: 'es2022',
          lib: ['es2022'],
          moduleResolution: 'node',
          allowImportingTsExtensions: false,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          jsx: 'react-jsx',
        },
      },
    ],
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/src/**/__tests__/**/*.test.tsx',
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.test.tsx',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
    '!src/cli.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts', 'jest-extended/all'],
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
};
