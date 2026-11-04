import { defineConfig, devices } from '@playwright/test';

/** Separate dashboard UI checks; not part of Northline's customer-site suite. */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 30_000,
  reporter: [['list']],
  projects: [{ name: 'dashboard-chromium', use: { ...devices['Desktop Chrome'] } }],
  use: { baseURL: 'http://127.0.0.1:4300', screenshot: 'only-on-failure' },
  webServer: {
    command: 'node server.mjs',
    url: 'http://127.0.0.1:4300/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
