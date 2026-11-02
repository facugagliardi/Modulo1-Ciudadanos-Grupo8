import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60000,
  globalTimeout: 360000,
  expect: { timeout: 10000 },
  reporter: [['./reportero.mjs']],
  outputDir: './test-results',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8090',
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
});
