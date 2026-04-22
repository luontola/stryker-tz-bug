/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.config.ts',
  },
  mutate: ['src/**/*.ts', '!src/**/*.test.ts'],
  reporters: ['clear-text'],
  coverageAnalysis: 'perTest',
  plugins: ['@stryker-mutator/vitest-runner'],
};

export default config;
