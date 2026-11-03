import { test, expect } from '../../src/fixtures/test';
import { invalidUser, validUser } from '../../src/data/test-data';

test.describe('UI | Authentication', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('valid user can sign in and log out @smoke @regression', async ({ loginPage, storePage }) => {
    await loginPage.login(validUser.email, validUser.password);
    await expect(storePage.heading).toBeVisible();
    await storePage.logout();
    await expect(loginPage.signInButton).toBeVisible();
  });

  test('invalid credentials show a useful error @regression @negative', async ({ loginPage }) => {
    await loginPage.login(invalidUser.email, invalidUser.password);
    await expect(loginPage.errorMessage).toHaveText('Invalid email or password');
    await expect(loginPage.signInButton).toBeVisible();
  });

  test('required login fields are validated by browser @regression @negative', async ({ loginPage }) => {
    await loginPage.signInButton.click();
    await expect(loginPage.email).toHaveAttribute('required', '');
    await expect(loginPage.password).toHaveAttribute('required', '');
  });
});
