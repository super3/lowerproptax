export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  globalSetup: './tests/setup.js',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/scrapers/**/*.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true
};
