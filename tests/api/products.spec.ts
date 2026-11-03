import { test, expect } from '../../src/fixtures/test';
import { expectedCatalog } from '../../src/data/test-data';

test.describe('API | Products', () => {
  test('returns seeded product catalog @smoke @regression', async ({ shopApi }) => {
    const response = await shopApi.getProducts();
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ products: expectedCatalog });
  });

  test('filters products by category @regression', async ({ shopApi }) => {
    const response = await shopApi.getProducts({ category: 'Stationery' });
    expect(response.status()).toBe(200);
    const body: { products: Array<{ category: string }> } = await response.json();
    expect(body.products).toHaveLength(1);
    expect(body.products[0].category).toBe('Stationery');
  });

  test('search returns an empty result for unknown products @regression @negative', async ({ shopApi }) => {
    const response = await shopApi.getProducts({ q: 'does-not-exist' });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ products: [] });
  });
});
