import { test, expect } from '@playwright/test';

test('keyboard user can skip navigation and identify the current dashboard page', async ({ page }) => {
  await page.goto('/');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Test runs' }).click();
  await expect(page.getByRole('button', { name: 'Test runs' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Overview' })).not.toHaveAttribute('aria-current');
});

test('dashboard data outage is announced, disables the runner, and supports retry', async ({ page }) => {
  let offline = true;
  await page.route('**/api/projects', async (route) => {
    if (offline) {
      await route.fulfill({ status: 503, contentType: 'application/json',
        body: JSON.stringify({ error: 'Project discovery unavailable' }) });
    } else {
      await route.continue();
    }
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Dashboard data unavailable: Project discovery unavailable');
  await expect(page.getByRole('button', { name: 'Run selected suite' }).first()).toBeDisabled();
  offline = false;
  await page.getByRole('button', { name: 'Retry dashboard data' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Run selected suite' }).first()).toBeEnabled();
});

test('failed launch error persists during successful background refresh until dismissed', async ({ page }) => {
  let readCount = 0;
  await page.route('**/api/runs', async (route) => {
    if (route.request().method() === 'GET') {
      readCount++;
      await route.continue();
    } else if (route.request().method() === 'POST') {
      await route.fulfill({ status: 503, contentType: 'application/json',
        body: JSON.stringify({ error: 'Runner temporarily unavailable' }) });
    } else {
      await route.continue();
    }
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Run selected suite' }).first()).toBeEnabled();
  await page.getByRole('button', { name: 'Run selected suite' }).first().click();
  await expect(page.getByRole('alert')).toContainText('Runner temporarily unavailable');
  await expect.poll(() => readCount, { timeout: 10000 }).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('alert')).toContainText('Runner temporarily unavailable');
  await page.getByRole('button', { name: 'Dismiss message' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
