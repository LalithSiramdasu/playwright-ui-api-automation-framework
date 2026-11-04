import { test, expect } from '@playwright/test';

test.describe('Sample API | isolated contract tests', () => {
  test('health endpoint identifies the correct independent service @smoke @regression', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', service: 'sample-api' });
  });

  test('inventory returns the expected sample-only shape @smoke @regression', async ({ request }) => {
    const response = await request.get('/api/inventory');
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      items: [{ sku: 'S-001', title: 'Sample Kit', available: true }],
    });
  });

  test('unsupported endpoint gives 404 @negative @regression', async ({ request }) => {
    const response = await request.get('/api/missing');
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });
});
