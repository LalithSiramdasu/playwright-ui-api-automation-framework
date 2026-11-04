import { test, expect } from '../../src/fixtures/test';
import { validUser } from '../../src/data/test-data';

const specimens = [
  { id: 'empty', name: 'Empty state', heading: 'Nothing here. Yet.' },
  { id: 'loading', name: 'Loading state', heading: 'Curating your collection.' },
  { id: 'error', name: 'Error state', heading: 'This request didn’t complete.' },
  { id: 'offline', name: 'No internet', heading: 'You appear to be offline.' },
  { id: 'slow', name: 'Slow network', heading: 'Still working on it.' },
  { id: 'no-results', name: 'No search results', heading: 'No matches this time.' },
  { id: 'permission', name: 'Permission denied', heading: 'Camera access is off.' },
  { id: 'session', name: 'Session expired', heading: 'Time to sign in again.' },
  { id: 'validation', name: 'Form validation', heading: 'One detail needs attention.' },
  { id: 'success', name: 'Success state', heading: 'Order confirmed.' },
] as const;

test.describe('UI | Ten state library fixtures', () => {
  test.beforeEach(async ({ loginPage, storePage, page }) => {
    await loginPage.goto();
    await loginPage.login(validUser.email, validUser.password);
    await expect(storePage.heading).toBeVisible();
    await page.getByRole('button', { name: /Experience lab/ }).click();
  });

  for (const specimen of specimens) {
    test(`${specimen.id} state has a useful message and recovery action @regression`, async ({ page }) => {
      await page.getByRole('button', { name: specimen.name, exact: true }).click();
      const preview = page.getByTestId('state-view');
      await expect(preview).toBeVisible();
      await expect(preview).toHaveAttribute('data-state', specimen.id);
      await expect(preview.getByRole('heading', { name: specimen.heading })).toBeVisible();
      await expect(preview.getByRole('button')).toBeVisible();
    });
  }

  test('session expired specimen returns to sign in @regression', async ({ page, loginPage }) => {
    await page.getByRole('button', { name: 'Session expired' }).click();
    await page.getByRole('button', { name: 'Sign in again' }).click();
    await expect(loginPage.signInButton).toBeVisible();
    await expect(loginPage.errorMessage).toContainText('Your session expired');
  });
});

test.describe('UI | Real recovery states', () => {
  test('unknown search shows recovery and clears filters @regression @negative', async ({ loginPage, storePage, page }) => {
    await loginPage.goto();
    await loginPage.login(validUser.email, validUser.password);
    await storePage.search('does-not-exist');
    await expect(storePage.productCards).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'No matching products' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(storePage.productCards).toHaveCount(3);
  });

  test('checkout server failure preserves cart and reports a useful message @regression @negative', async ({ loginPage, storePage, page }) => {
    await loginPage.goto();
    await loginPage.login(validUser.email, validUser.password);
    await storePage.addProduct('Notebook');
    await page.route('**/api/orders', async (route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Checkout temporarily unavailable' }) });
    });
    await storePage.placeOrder();
    await expect(storePage.confirmation).toContainText('Could not place order');
    await expect(storePage.confirmation).toContainText('Checkout temporarily unavailable');
    await expect(storePage.cartCount).toHaveText('1');
  });
});
