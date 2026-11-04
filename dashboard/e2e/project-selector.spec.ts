import { test, expect } from '@playwright/test';

test('shows only enabled projects and supported suites for each selection', async ({ page }) => {
  await page.goto('/');
  const projects = page.locator('#project-select');
  await expect(projects).toBeVisible();
  await expect(projects.locator('option[value="starter-api"]')).toBeDisabled();

  await projects.selectOption('sample-api');
  await expect(page.locator('#environment-select')).toHaveValue('local');
  await expect(page.locator('#suite-select').locator('option')).toHaveCount(5);
  await expect(page.locator('#suite-select').locator('option[value="ui"]')).toHaveCount(0);
  await expect(page.locator('#browser-select')).toBeDisabled();

  await page.locator('#environment-select').selectOption('staging');
  await expect(page.getByText('Read-only tests')).toBeVisible();
  await page.getByRole('button', { name: 'Test runs' }).click();
  await expect(page.locator('#project-select')).toHaveValue('sample-api');
  await expect(page.locator('#environment-select')).toHaveValue('staging');

  await projects.selectOption('sample-web');
  await expect(page.locator('#environment-select')).toHaveValue('local');
  await expect(page.locator('#suite-select').locator('option[value="api"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Overview' }).click();
  await expect(page.locator('#browser-select')).toBeEnabled();
});

test('sends the selected project and environment to the real runner API route', async ({ page }) => {
  let payload: Record<string, string> | undefined;
  await page.route('**/api/runs', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    payload = route.request().postDataJSON();
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ run: { id: '11111111-1111-1111-1111-111111111111', projectId: 'sample-api', environment: 'local', suite: 'api', browser: 'all', status: 'running' } }),
    });
  });
  // This isolates the UI request contract; the real runner is covered by Node and project tests.
  await page.goto('/');
  await page.locator('#project-select').selectOption('sample-api');
  await page.locator('#suite-select').selectOption('api');
  await page.getByRole('button', { name: 'Run selected suite' }).first().click();
  await expect.poll(() => payload).toEqual({ projectId: 'sample-api', environment: 'local', suite: 'api', browser: 'all' });
});

test('overview and run history never mix results from independent projects', async ({ page }) => {
  await page.route('**/api/runs', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      activeId: null,
      runs: [
        { id: 'northline-legacy', suite: 'smoke', browser: 'chromium', status: 'passed', startedAt: '2026-11-04T12:00:00Z', finishedAt: '2026-11-04T12:00:03Z', durationMs: 3000, counts: { total: 3, passed: 3, failed: 0 } },
        { id: 'api-local', projectId: 'sample-api', environment: 'local', suite: 'api', browser: 'all', status: 'passed', startedAt: '2026-11-04T12:01:00Z', finishedAt: '2026-11-04T12:01:02Z', durationMs: 2000, counts: { total: 2, passed: 1, failed: 1 } },
        { id: 'api-staging', projectId: 'sample-api', environment: 'staging', suite: 'api', browser: 'all', status: 'passed', startedAt: '2026-11-04T12:02:00Z', finishedAt: '2026-11-04T12:02:01Z', durationMs: 1000, counts: { total: 2, passed: 2, failed: 0 } },
      ],
    }) });
  });
  await page.goto('/');
  await expect(page.getByText('3', { exact: true }).first()).toBeVisible();
  await page.locator('#project-select').selectOption('sample-api');
  await expect(page.getByText('50%', { exact: true })).toBeVisible();
  await page.locator('#environment-select').selectOption('staging');
  await expect(page.getByText('100%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Test runs' }).click();
  await expect(page.getByText('1 executions for Independent Sample API / staging')).toBeVisible();
});
