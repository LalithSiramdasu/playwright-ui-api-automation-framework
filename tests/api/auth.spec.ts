import { test, expect } from '../../src/fixtures/test';
import { invalidUser, validUser } from '../../src/data/test-data';

test.describe('API | Authentication', () => {
  test('valid login returns a bearer token @smoke @regression', async ({ shopApi }) => {
    const response = await shopApi.login(validUser);
    expect(response.status()).toBe(200);
    const body: { token: string; user: { email: string } } = await response.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.user.email).toBe(validUser.email);
  });

  test('wrong password is rejected @regression @negative', async ({ shopApi }) => {
    const response = await shopApi.login(invalidUser);
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: 'Invalid email or password' });
  });

  test('missing credentials fail validation @regression @negative', async ({ request }) => {
    const response = await request.post('/api/auth/login', { data: { email: '' } });
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'Email and password are required' });
  });
});
