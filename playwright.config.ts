import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { assessTargetPolicy } from './src/core/execution-policy.cjs';
import { assertOnboardingReady } from './src/core/onboarding-gate.cjs';

/** The Playwright TS loader may run as CommonJS; profile data is read here, while CLI/dashboard use shared preflight. */
function projectFromEnvironment() {
  const id = process.env.QA_PROJECT_ID;
  if (!id) return null;
  if (!/^[a-z][a-z0-9-]{2,39}$/.test(id)) throw Error('Invalid QA_PROJECT_ID');
  const profileFile = join(process.cwd(), 'projects', id, 'project.config.json');
  const profile = JSON.parse(readFileSync(profileFile, 'utf8'));
  if (profile.id !== id || profile.enabled !== true || !['web','api','hybrid'].includes(profile.type)) {
    throw Error(`Invalid or disabled project '${id}'`);
  }
  const environments = Object.keys(profile.environments ?? {});
  const environment = process.env.QA_ENVIRONMENT ?? (environments.length === 1 ? environments[0] : undefined);
  if (!environment || !Object.prototype.hasOwnProperty.call(profile.environments, environment)) {
    throw Error(`Unsupported environment for project '${id}'`);
  }
  const target = profile.environments[environment];
  // Re-check onboarding even when Playwright is invoked directly (without CLI preflight).
  assertOnboardingReady(join(process.cwd(), 'projects', id), profile);
  const policy = assessTargetPolicy(profile, environment, { remoteOptIn: process.env.QA_ALLOW_REMOTE === '1' });
  const suite = process.env.QA_SUITE ?? 'all';
  const browser = process.env.QA_BROWSER ?? 'all';
  if (suite !== 'all' && !profile.suites?.includes(suite)) throw Error('Unsupported suite for this project');
  if (!['all','chromium','firefox','webkit'].includes(browser)) throw Error('Unsupported browser');
  if ((profile.type === 'api' || suite === 'api') && browser !== 'all') throw Error('API suites cannot select a browser');
  return {
    projectId: id,
    projectType: profile.type as 'web' | 'api' | 'hybrid',
    environment,
    webBaseUrl: target.webBaseUrl as string | undefined,
    apiBaseUrl: target.apiBaseUrl as string | undefined,
    testDir: policy.restricted ? `./projects/${id}/tests/safe` : id === 'northline-goods' ? './tests' : `./projects/${id}/tests`,
    remote: policy.remote,
  };
}

const selection = projectFromEnvironment();
const defaultBase = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const uiBase = selection?.webBaseUrl ?? defaultBase;
const apiBase = selection?.apiBaseUrl ?? defaultBase;
const reportPrefix = selection ? `${selection.projectId}/${selection.environment}` : '';

// Local fixtures are explicitly mapped in trusted source code, never from JSON profiles.
const localServers: Record<string, { command: string; url: string }> = {
  'northline-goods': { command: 'npm run demo:start', url: 'http://127.0.0.1:4173/health' },
  'sample-api': { command: 'node projects/sample-api/server.mjs', url: 'http://127.0.0.1:4174/health' },
  'sample-web': { command: 'node projects/sample-web/server.mjs', url: 'http://127.0.0.1:4175/health' },
};
const webServer = selection
  ? !selection.remote ? localServers[selection.projectId] : undefined
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
    // Remote staging may carry credentials in network traces or screenshots.
    trace: selection?.remote ? 'off' : 'on-first-retry',
    screenshot: selection?.remote ? 'off' : 'only-on-failure',
    video: selection?.remote ? 'off' : 'retain-on-failure',
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
