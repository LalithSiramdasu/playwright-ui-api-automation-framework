import { test, expect } from '@playwright/test';

test('operations navigation is deep-linkable, refresh-safe and keyboard-accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Quality, in focus/ })).toBeVisible();
  await page.getByRole('button', { name: 'Test suites' }).click();
  await expect(page).toHaveURL(/#suites$/);
  await expect(page.getByRole('heading', { name: /Test suites/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Test suites' })).toHaveAttribute('aria-current', 'page');
  await expect(page).toHaveTitle(/Test suites · QA Control Center/);
  await page.getByRole('button', { name: 'QA Control Center home' }).click();
  await expect(page).toHaveURL(/#overview$/);
  await expect(page.getByRole('heading', { name: /Quality, in focus/ })).toBeVisible();
});

test('mobile navigation opens, closes with Escape, and links to real report tools', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await expect(page).toHaveURL(/#reports$/);
  await expect(page.getByRole('heading', { name: /Available reports/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Export CSV' })).toHaveAttribute('href', /\/api\/exports\?/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('the QA desk fits narrow phones, tablets, and desktop without page overflow', async ({ page }) => {
  for (const width of [320, 375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await expect(page.locator('#project-select')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Quality, in focus/ })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.document, `Horizontal overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
});

test('run history filters provide a real reset action when there are no matches', async ({ page }) => {
  await page.goto('/#runs');
  await page.getByRole('textbox', { name: 'Search runs' }).fill('nonexistent-run-12345');
  await expect(page.getByText('No matching executions')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByRole('textbox', { name: 'Search runs' })).toHaveValue('');
});
