module.exports = {
  testEnvironment: 'node',
  testTimeout: 15000,
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  moduleNameMapper: {
    // uuid v13 is ESM-only; route Jest to a tiny CommonJS shim.
    '^uuid$': '<rootDir>/tests/shims/uuid.js',
  },
};
