module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/database/migrations/**',
    '!src/database/seeds/**',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  globalSetup: '<rootDir>/test/global-setup.ts',
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  setupFiles: ['<rootDir>/test/setup.ts'],
  // The suite shares a single PostgreSQL instance - keep the workers serial
  // so the integration tests cannot interfere with each other.
  maxWorkers: 1,
  testTimeout: 30000,
  // The embedded PostgreSQL server is shut down in `globalTeardown`, which
  // happens right after the run - give it a bit more than the default 1s
  // before Jest complains about the process still being alive.
  openHandlesTimeout: 20000,
};
