/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/types/**'],
  coverageReporters: ['text', 'lcov', 'html'],
  // Piso de cobertura (slide 22): si baja de acá, el comando falla y en CI corta el pipeline.
  coverageThreshold: {
    global: {
      lines: 70,
      branches: 40,
    },
  },
  testTimeout: 20000,
};
