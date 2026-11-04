import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * The Playwright TypeScript config loader sometimes runs under CommonJS.
 * Read validated data-only JSON here rather than importing the Node ESM
 * preflight module (which uses import.meta for safe path resolution).
 * Dashboard and CLI already call resolveProjectRun before launching Playwright.
 */
function projectFromEnvironment() {
  const id = process.env.QA_PROJECT_ID;
  if (!id) return null;
  if (!/^[a-z][a-z0-9-]{2,39}$/.test(id)) throw Error('Invalid QA_PROJECT_ID');
  const profileFile = join(process.cwd(), 'projects', id, 'project.config.json');
  const profile = JSON.parse(readFileSync(profileFile, 'utf8'));
  if (profile.id !== id || profile.enabled !== true || !['web', 'api', 'hybrid'].includes(profile.type)) {
    throw Error(`Invalid or disabled project '${id}'`);
  }
  const environments = Object.keys(profile.environments ?? {});
  const environment = process.env.QA_ENVIRONMENT ?? (environments.length === 1 ? environments[0] : undefined);
  if (!environment || !Object.prototype.hasOwnProperty.call(profile.environments, environment)) {
    throw Error(`Unsupported environment for project '${id}'`);
  }
  const target = profile.environments[environment];
  if (target.readOnly || environment !== 'local') throw Error('Only approved local, writable fixture targets are executable in Module 2');
  const targetUrls = [target.webBaseUrl, target.apiBaseUrl].filter((url: unknown): url is string => typeof url === 'string');
  if (!targetUrls.length || targetUrls.some((url: string) => {
    const parsed = new URL(url);
    return !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname);
  })) throw Error('Remote targets require Module 5 authorization safeguards');
  const suite = process.env.QA_SUITE ?? 'all';
  const browser = process.env.QA_BROWSER ?? 'all';
  if (suite !== 'all' && !profile.suites?.includes(suite)) throw Error('Unsupported suite for this project');
  if (!['all', 'chromium', 'firefox', 'webkit'].includes(browser)) throw Error('Unsupported browser');
  if ((profile.type === 'api' || suite === 'api') && browser !== 'all') throw Error('API suites cannot select a browser');
  return {
    projectId: id,
    projectType: profile.type as 'web' | 'api' | 'hybrid',
    environment,
    webBaseUrl: target.webBaseUrl as string | undefined,
    apiBaseUrl: target.apiBaseUrl as string | undefined,
    testDir: id === 'northline-goods' ? './tests' : `./projects/${id}/tests`,
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
