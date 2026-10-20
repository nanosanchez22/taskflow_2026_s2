import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  outputDir: 'test-results',
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:5175',
    timezoneId: 'America/Montevideo',
    screenshot: { mode: 'only-on-failure', fullPage: true },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/support/start-server.cjs',
      url: 'http://127.0.0.1:3101/api/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'node e2e/support/start-client.mjs',
      url: 'http://127.0.0.1:5175',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
