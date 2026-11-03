import { test, expect } from '../../src/fixtures/test';
import { validUser } from '../../src/data/test-data';

test.describe('UI | Accessibility and responsive behavior', () => {
  test('login form supports accessible labels and keyboard navigation @regression @accessibility', async ({
    page,
    loginPage,
  }) => {
    await loginPage.goto();
    await expect(loginPage.email).toBeVisible();
    await expect(loginPage.password).toBeVisible();
    await loginPage.email.focus();
    await page.keyboard.press('Tab');
    await expect(loginPage.password).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(loginPage.signInButton).toBeFocused();
  });

  test('catalog and checkout remain available on a mobile viewport @regression', async ({
    page,
    loginPage,
    storePage,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginPage.goto();
    await loginPage.login(validUser.email, validUser.password);
    await expect(storePage.heading).toBeVisible();
    await expect(storePage.productCards).toHaveCount(3);
    await storePage.addProduct('Notebook');
    await expect(storePage.cartCount).toHaveText('1');
  });
});
