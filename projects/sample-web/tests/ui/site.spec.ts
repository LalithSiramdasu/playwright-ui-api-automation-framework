import { test, expect } from '../../../../src/web/fixtures';
import { establishApiCookieSession } from '../../../../src/web/auth';
import { SampleCatalogPage } from '../../pages/sample-catalog.page';
import { SampleLoginPage } from '../../pages/sample-login.page';

// Deliberately fake credentials for this local fixture, overridable via variables.
const credentials = {
  username: process.env.SAMPLE_WEB_USERNAME ?? 'tester@example.test',
  password: process.env.SAMPLE_WEB_PASSWORD ?? 'LocalOnly123!',
};

test.describe('Sample Website | project-specific UI tests', () => {
  test('sign-in form leads to the sample workspace @smoke @regression', async ({ page }) => {
    const login = new SampleLoginPage(page);
    await login.signIn(credentials);
    await login.expectPath('/workspace');
  });

  test('API cookie login creates a browser session without shared state @smoke @regression', async ({ page }) => {
    const response = await establishApiCookieSession(page, '/api/session', {
      email: credentials.username, password: credentials.password,
    });
    expect(response.status()).toBe(200);
    const catalog = new SampleCatalogPage(page);
    await catalog.open('/catalog');
    await catalog.expectSeededItems();
  });

  test('private pages redirect unauthenticated users to login @negative @regression', async ({ page }) => {
    const catalog = new SampleCatalogPage(page);
    await catalog.open('/catalog');
    await expect(page.getByRole('heading', { name: 'Sign in to Sample Website' })).toBeVisible();
    await catalog.expectPath('/login');
  });

  test('invalid credentials display a meaningful error @negative @regression', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('invalid@example.test');
    await page.getByLabel('Password').fill('incorrect-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toHaveText('Invalid email or password');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('sign out clears the browser session @regression', async ({ page }) => {
    const login = new SampleLoginPage(page);
    await login.signIn(credentials);
    await page.getByRole('button', { name: 'Log out' }).click();
    await login.expectPath('/login');
    await page.goto('/workspace');
    await login.expectPath('/login');
  });

  test('login is keyboard-accessible at mobile viewport @accessibility @regression', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    const email = page.getByLabel('Email');
    await email.focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Password')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeFocused();
  });
});
