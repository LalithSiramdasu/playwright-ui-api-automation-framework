import { test, expect } from '../../src/fixtures/test';
import { validUser } from '../../src/data/test-data';

test.describe('UI | Products and cart', () => {
  test.beforeEach(async ({ loginPage, storePage }) => {
    await loginPage.goto();
    await loginPage.login(validUser.email, validUser.password);
    await expect(storePage.heading).toBeVisible();
  });

  test('inventory loads with seeded products @smoke @regression', async ({ storePage }) => {
    await expect(storePage.productCards).toHaveCount(3);
    await expect(storePage.product('Wireless Mouse')).toBeVisible();
    await expect(storePage.product('Notebook')).toBeVisible();
  });

  for (const scenario of [
    { query: 'mouse', name: 'Wireless Mouse' },
    { query: 'bottle', name: 'Water Bottle' },
  ]) {
    test(`search finds ${scenario.name} @regression`, async ({ storePage }) => {
      await storePage.search(scenario.query);
      await expect(storePage.productCards).toHaveCount(1);
      await expect(storePage.product(scenario.name)).toBeVisible();
    });
  }

  test('category filtering narrows catalog @regression', async ({ storePage }) => {
    await storePage.filterCategory('Stationery');
    await expect(storePage.productCards).toHaveCount(1);
    await expect(storePage.product('Notebook')).toBeVisible();
  });

  test('cart total uses product prices @regression', async ({ storePage }) => {
    await storePage.addProduct('Wireless Mouse');
    await storePage.addProduct('Notebook');
    await expect(storePage.cartCount).toHaveText('2');
    await expect(storePage.cartTotal).toHaveText('$34.98');
  });

  test('checkout confirms an order and empties cart @smoke @regression', async ({ storePage }) => {
    await storePage.addProduct('Water Bottle');
    await storePage.placeOrder();
    await expect(storePage.confirmation).toContainText('Order confirmed');
    await expect(storePage.cartCount).toHaveText('0');
    await expect(storePage.cartTotal).toHaveText('$0.00');
  });
});
