import { test, expect } from '@playwright/test';

const runs = [
  { id: '11111111-1111-4111-8111-111111111111', projectId: 'sample-api', environment: 'local', suite: 'api', browser: 'all', status: 'passed', startedAt: '2026-11-04T10:03:00Z', finishedAt: '2026-11-04T10:03:02Z', durationMs: 2000, reportAvailable: true, counts: { total: 2, passed: 2, failed: 0, flaky: 1, retries: 1 } },
  { id: '22222222-2222-4222-8222-222222222222', projectId: 'sample-api', environment: 'local', suite: 'api', browser: 'all', status: 'failed', startedAt: '2026-11-04T10:01:00Z', finishedAt: '2026-11-04T10:01:01Z', durationMs: 1000, reportAvailable: true, counts: { total: 2, passed: 1, failed: 1, flaky: 0, retries: 0 } },
  { id: '33333333-3333-4333-8333-333333333333', projectId: 'northline-goods', environment: 'local', suite: 'smoke', browser: 'chromium', status: 'passed', startedAt: '2026-11-04T10:00:00Z', finishedAt: '2026-11-04T10:00:03Z', durationMs: 3000, counts: { total: 3, passed: 3, failed: 0 } },
];

// The React request contract is exercised with fixtures; persistence and deletion
// are verified separately against the real Node API in tests/server/.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/runs', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ activeId: null, runs }) });
  });
});

test('exports and flaky counters are restricted to selected project and environment', async ({ page }) => {
  await page.goto('/');
  await page.locator('#project-select').selectOption('sample-api');
  await page.getByRole('button', { name: 'Reports' }).click();
  await expect(page.getByText('2 stored run(s) · 1 flaky case(s) · 1 retry attempt(s)')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Export CSV' })).toHaveAttribute('href', /projectId=sample-api&environment=local&format=csv/);
  await expect(page.getByRole('link', { name: 'Export JSON' })).toHaveAttribute('href', /projectId=sample-api&environment=local&format=json/);
  await page.locator('#project-select').selectOption('northline-goods');
  await expect(page.getByText('1 stored run(s) · 0 flaky case(s) · 0 retry attempt(s)')).toBeVisible();
});

test('compare UI calls the project-isolated endpoint and displays changes', async ({ page }) => {
  let path = '';
  await page.route('**/api/runs/*/compare?*', async (route) => {
    path = route.request().url();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ comparison: {
      delta: { passed: 1, failed: -1, flaky: 1, durationMs: 1000 }, resolved: ['api :: inventory'], newlyFailed: [], comparableCases: 2,
    } }) });
  });
  await page.goto('/');
  await page.locator('#project-select').selectOption('sample-api');
  await page.getByRole('button', { name: 'Reports' }).click();
  await page.getByRole('button', { name: 'Compare runs' }).click();
  await expect(page.getByText(/Passes \+1 · Failures -1 · Flaky \+1/)).toBeVisible();
  expect(path).toContain('/api/runs/11111111-1111-4111-8111-111111111111/compare?with=22222222-2222-4222-8222-222222222222');
});

test('history deletion is disabled until an exact confirmation is typed', async ({ page }) => {
  await page.goto('/');
  await page.locator('#project-select').selectOption('sample-api');
  await page.getByRole('button', { name: 'Reports' }).click();
  const clear = page.getByRole('button', { name: 'Delete scoped history' });
  await expect(clear).toBeDisabled();
  await page.getByRole('textbox', { name: 'Confirm history deletion' }).fill('DELETE');
  await expect(clear).toBeDisabled();
  await page.getByRole('textbox', { name: 'Confirm history deletion' }).fill('DELETE HISTORY');
  await expect(clear).toBeEnabled();
});
