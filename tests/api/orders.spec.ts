import { test, expect } from '../../src/fixtures/test';
import { validUser } from '../../src/data/test-data';

test.describe('API | Orders', () => {
  test('order creation requires a token @regression @negative', async ({ request }) => {
    const response = await request.post('/api/orders', {
      data: { items: [{ productId: 101, quantity: 1 }] },
    });
    expect(response.status()).toBe(401);
  });

  test('authorized order has calculated total @smoke @regression', async ({ shopApi }) => {
    const auth = await shopApi.login(validUser);
    expect(auth.ok()).toBeTruthy();
    const { token }: { token: string } = await auth.json();
    const response = await shopApi.createOrder(token, [
      { productId: 101, quantity: 2 },
      { productId: 102, quantity: 1 },
    ]);
    expect(response.status()).toBe(201);
    const order: { id: string; totalCents: number; status: string } = await response.json();
    expect(order.id).toEqual(expect.any(String));
    expect(order.totalCents).toBe(6097);
    expect(order.status).toBe('confirmed');
  });

  test('rejects invalid quantities @regression @negative', async ({ shopApi }) => {
    const auth = await shopApi.login(validUser);
    const { token }: { token: string } = await auth.json();
    const response = await shopApi.createOrder(token, [{ productId: 101, quantity: -1 }]);
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid order items' });
  });
});
