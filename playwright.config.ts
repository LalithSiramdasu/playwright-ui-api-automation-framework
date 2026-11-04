import { defineConfig, devices } from '@playwright/test';
import { resolveProjectRun } from './src/core/project-runner.mjs';

// Legacy `npm test` runs the Northline reference suite as before.
// Module 2 sets QA_PROJECT_ID through the allowlisted project runner to isolate tests.
const selection = process.env.QA_PROJECT_ID
  ? resolveProjectRun({
      projectId: process.env.QA_PROJECT_ID,
      environment: process.env.QA_ENVIRONMENT,
      suite: process.env.QA_SUITE,
      browser: process.env.QA_BROWSER,
    })
  : null;
const defaultBase = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const uiBase = selection?.webBaseUrl ?? defaultBase;
const apiBase = selection?.apiBaseUrl ?? defaultBase;
const reportPrefix = selection ? `${selection.projectId}/${selection.environment}` : '';

// Local fixtures are explicitly mapped in trusted source code, never from JSON profiles.
const localServers: Record<string, { command: string; url: string }> = {
  'northline-goods': { command: 'npm run demo:start', url: 'http://127.0.0.1:4173/health' },
  'sample-api': { command: 'node projects/sample-api/server.mjs', url: 'http://127.0.0.1:4174/health' },
};
const webServer = selection
  ? selection.environment === 'local' ? localServers[selection.projectId] : undefined
  : process.env.BASE_URL ? undefined : {
      command: 'npm run demo:start',
      url: `${defaultBase}/health`,
    };
const projectType = selection?.projectType ?? 'hybrid';

export default defineConfig({
  testDir: selection?.testDir ?? './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  globalTimeout: 60 * 60 * 1000,
  reporter: [
    ['list'],
    ['html', { outputFolder: reportPrefix ? `playwright-report/${reportPrefix}` : 'playwright-report', open: 'never' }],
    ['junit', { outputFile: reportPrefix ? `reports/${reportPrefix}/junit.xml` : 'reports/junit.xml' }],
  ],
  outputDir: reportPrefix ? `test-results/${reportPrefix}` : 'test-results',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    ...(projectType === 'web' ? [] : [{ name: 'api', testMatch: '**/api/**/*.spec.ts', use: { baseURL: apiBase } }]),
    ...(projectType === 'api' ? [] : [
      { name: 'chromium', testMatch: '**/ui/**/*.spec.ts', use: { ...devices['Desktop Chrome'], baseURL: uiBase } },
      { name: 'firefox', testMatch: '**/ui/**/*.spec.ts', use: { ...devices['Desktop Firefox'], baseURL: uiBase } },
      { name: 'webkit', testMatch: '**/ui/**/*.spec.ts', use: { ...devices['Desktop Safari'], baseURL: uiBase } },
    ]),
  ],
  webServer: webServer ? {
    ...webServer,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  } : undefined,
});
