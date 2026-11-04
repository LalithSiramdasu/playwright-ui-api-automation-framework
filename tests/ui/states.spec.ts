import { test, expect } from '../../src/fixtures/test';
import { validUser } from '../../src/data/test-data';

/** The ten conditions are exercised in the real shop, not a preview gallery. */
async function signIn(loginPage: { goto: () => Promise<void>; login: (email: string, password: string) => Promise<void> }) {
  await loginPage.goto();
  await loginPage.login(validUser.email, validUser.password);
}

test.describe('UI | Real shopping experience states', () => {
  test('01 | empty cart offers a useful next step @regression', async ({ loginPage, page, storePage }) => {
    await signIn(loginPage);
    await expect(page.getByText('Your bag is empty.')).toBeVisible();
    await page.getByRole('button', { name: 'Explore the collection' }).click();
    await expect(storePage.searchBox).toBeFocused();
  });

  test('02 | catalog shows skeletons while a real request is pending @regression', async ({ loginPage, page, storePage }) => {
    await page.route('**/api/products', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 450));
      await route.continue();
    });
    await signIn(loginPage);
    await expect(page.locator('.skeleton-row').first()).toBeVisible();
    await expect(storePage.productCards).toHaveCount(3);
    await expect(page.locator('.skeleton-row')).toHaveCount(0);
  });

  test('03 | failed catalog request shows a retry and keeps session @regression @negative', async ({ loginPage, page, storePage }) => {
    let attempts = 0;
    await page.route('**/api/products', async (route) => {
      if (attempts++ === 0) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Service unavailable"}' });
      } else {
        await route.continue();
      }
    });
    await signIn(loginPage);
    await expect(page.getByText('The collection could not be loaded.')).toBeVisible();
    await page.getByRole('button', { name: 'Retry loading products' }).click();
    await expect(storePage.productCards).toHaveCount(3);
  });

  test('04 | real offline signal shows guidance and recovers @regression @negative', async ({ loginPage, page, storePage }) => {
    await signIn(loginPage);
    await expect(storePage.productCards).toHaveCount(3);
    await page.context().setOffline(true);
    await expect(page.getByText('Connection unavailable.')).toBeVisible();
    await page.context().setOffline(false);
    await expect(page.locator('#network-banner')).toBeHidden();
    await expect(storePage.productCards).toHaveCount(3);
  });

  test('05 | slow connection shows an honest wait message @regression', async ({ loginPage, page, storePage }) => {
    await page.route('**/api/products', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
      await route.continue();
    });
    await signIn(loginPage);
    await expect(page.getByText('Still loading the collection.')).toBeVisible();
    await expect(storePage.productCards).toHaveCount(3);
    await expect(page.locator('#slow-notice')).toBeHidden();
  });

  test('06 | no search results provides a working filter reset @regression @negative', async ({ loginPage, page, storePage }) => {
    await signIn(loginPage);
    await storePage.search('does-not-exist');
    await expect(storePage.productCards).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'No matching products' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(storePage.productCards).toHaveCount(3);
  });

  test('07 | clipboard permission denied offers manual copy fallback @regression @negative', async ({ loginPage, page, storePage }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')) },
      });
    });
    await signIn(loginPage);
    await storePage.addProduct('Notebook');
    await storePage.placeOrder();
    await expect(storePage.confirmation).toContainText('Order confirmed');
    await page.getByRole('button', { name: 'Copy reference' }).click();
    await expect(page.getByText('Clipboard permission unavailable.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Order reference for manual copying' })).toBeVisible();
  });

  test('08 | expired session returns to sign-in and preserves cart @regression @negative', async ({ loginPage, page, storePage }) => {
    await signIn(loginPage);
    await storePage.addProduct('Notebook');
    await page.route('**/api/orders', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' });
    });
    await storePage.placeOrder();
    await expect(loginPage.signInButton).toBeVisible();
    await expect(loginPage.errorMessage).toContainText('Your session expired');
    await page.unroute('**/api/orders');
    await loginPage.login(validUser.email, validUser.password);
    await expect(storePage.cartCount).toHaveText('1');
    await expect(storePage.cartTotal).toHaveText('₹899');
  });

  test('09 | invalid form gives field-specific feedback @regression @negative', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.signInButton.click();
    await expect(page.locator('#email-field-error')).toHaveText('Email address is required.');
    await loginPage.email.fill('bad-address');
    await expect(page.locator('#email-field-error')).toHaveText('Enter a complete email address.');
    await loginPage.email.fill(validUser.email);
    await expect(page.locator('#email-field-error')).toBeHidden();
  });

  test('10 | order success displays receipt and real INR totals @regression', async ({ loginPage, page, storePage }) => {
    await signIn(loginPage);
    await storePage.addProduct('Wireless Mouse');
    await expect(storePage.cartTotal).toHaveText('₹2,599');
    await storePage.placeOrder();
    await expect(storePage.confirmation).toContainText('Order confirmed');
    await expect(page.locator('#order-confirmation')).toBeVisible();
    await expect(page.locator('#order-reference')).not.toBeEmpty();
    await expect(storePage.cartTotal).toHaveText('₹0');
  });

  test('checkout failure preserves cart and exposes inline recovery @regression @negative', async ({ loginPage, page, storePage }) => {
    await signIn(loginPage);
    await storePage.addProduct('Notebook');
    await page.route('**/api/orders', async (route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Checkout temporarily unavailable"}' });
    });
    await storePage.placeOrder();
    await expect(storePage.confirmation).toContainText('Could not place order');
    await expect(storePage.confirmation).toContainText('Checkout temporarily unavailable');
    await expect(storePage.cartCount).toHaveText('1');
  });
});
