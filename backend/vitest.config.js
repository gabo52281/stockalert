'use strict';

const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    globalTeardown: './tests/teardown.js',
    fileParallelism: false,
  },
});
