import { test, expect } from '@playwright/test';
import { useReadOnlyOrigin } from '../../../../../src/web/remote-readonly';

// This site exists for learning UI automation. No form POSTs, uploads,
// destructive links, or third-party navigation are allowed in this pilot.
test.describe.configure({ mode: 'serial' });
test.beforeEach(async ({ page }, testInfo) => {
  const url = testInfo.project.use.baseURL;
  if (!url) throw Error('Missing configured pilot target URL');
  await useReadOnlyOrigin(page, url);
});

test.describe('External QA Pilot | The Internet website', () => {
  test('PWEB-01 landing page exposes test examples @smoke @regression', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Welcome to the-internet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Checkboxes' })).toBeVisible();
  });

  test('PWEB-02 link navigation loads checkbox screen @smoke @regression', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Checkboxes' }).click();
    await expect(page).toHaveURL(/\/checkboxes$/);
    await expect(page.getByRole('heading', { name: 'Checkboxes' })).toBeVisible();
  });

  test('PWEB-03 checkboxes respond to browser actions @regression', async ({ page }) => {
    await page.goto('/checkboxes');
    const checkboxes = page.locator('input[type="checkbox"]');
    await expect(checkboxes).toHaveCount(2);
    await checkboxes.first().check();
    await expect(checkboxes.first()).toBeChecked();
    await checkboxes.last().uncheck();
    await expect(checkboxes.last()).not.toBeChecked();
  });

  test('PWEB-04 dropdown selection changes its value @regression', async ({ page }) => {
    await page.goto('/dropdown');
    const select = page.locator('#dropdown');
    await select.selectOption('1');
    await expect(select).toHaveValue('1');
    await select.selectOption('2');
    await expect(select).toHaveValue('2');
  });

  test('PWEB-05 table contains sample rows and expected customer @regression', async ({ page }) => {
    await page.goto('/tables');
    const table = page.locator('#table1');
    await expect(table.locator('tbody tr')).toHaveCount(4);
    await expect(table).toContainText('Smith');
    await expect(table).toContainText('Bach');
  });

  test('PWEB-06 numeric input accepts an entered number @regression', async ({ page }) => {
    await page.goto('/inputs');
    const numberInput = page.locator('input[type="number"]');
    await numberInput.fill('42');
    await expect(numberInput).toHaveValue('42');
  });

  test('PWEB-07 successful status route returns HTTP 200 @regression', async ({ page }) => {
    const response = await page.goto('/status_codes/200');
    expect(response?.status()).toBe(200);
    await expect(page.locator('body')).toContainText('200 status code');
  });

  test('PWEB-08 missing status route returns HTTP 404 @negative @regression', async ({ page }) => {
    const response = await page.goto('/status_codes/404');
    expect(response?.status()).toBe(404);
    await expect(page.locator('body')).toContainText('404 status code');
  });
});
