/** Dependency-free API integration tests, using Node's built-in test runner. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { after, before, test } from 'node:test';

let server;
let baseURL;

before(async () => {
  server = spawn(process.execPath, ['demo-app/server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // The server prints its actual ephemeral port. No hard-coded port collision.
  baseURL = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Demo server startup timed out')), 10_000);
    server.once('error', (error) => { clearTimeout(timeout); reject(error); });
    server.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Server exited: ${code}`)); });
    server.stdout.on('data', (chunk) => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timeout); resolve(match[0]); }
    });
  });
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
});

const json = async (route, init = {}) => {
  const response = await fetch(`${baseURL}${route}`, init);
  return { status: response.status, body: await response.json() };
};
const post = (route, data, headers = {}) => json(route, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(data),
});

test('health endpoint answers OK', async () => {
  assert.deepEqual(await json('/health'), { status: 200, body: { status: 'ok' } });
});

test('catalog is seeded and its filters return deterministic results', async () => {
  const catalog = await json('/api/products');
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.products.length, 3);
  const filtered = await json('/api/products?q=mouse&category=Electronics');
  assert.equal(filtered.body.products[0].name, 'Wireless Mouse');
  assert.equal(filtered.body.products.length, 1);
});

test('login validates missing and incorrect credentials', async () => {
  const missing = await post('/api/auth/login', { email: '' });
  assert.equal(missing.status, 400);
  const wrong = await post('/api/auth/login', { email: 'demo@example.com', password: 'wrong' });
  assert.equal(wrong.status, 401);
});

test('authorized checkout returns computed amount and rejects invalid orders', async () => {
  const denied = await post('/api/orders', { items: [{ productId: 101, quantity: 1 }] });
  assert.equal(denied.status, 401);
  const login = await post('/api/auth/login', { email: 'demo@example.com', password: 'Password123!' });
  assert.equal(login.status, 200);
  assert.equal(typeof login.body.token, 'string');
  const headers = { Authorization: `Bearer ${login.body.token}` };
  const order = await post('/api/orders', {
    items: [{ productId: 101, quantity: 2 }, { productId: 102, quantity: 1 }],
  }, headers);
  assert.equal(order.status, 201);
  assert.equal(order.body.status, 'confirmed');
  assert.equal(order.body.totalPaise, 609700);
  const invalid = await post('/api/orders', { items: [{ productId: 101, quantity: -2 }] }, headers);
  assert.equal(invalid.status, 400);
});

test('invalid JSON is rejected, not treated as a valid login', async () => {
  const response = await fetch(`${baseURL}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid JSON' });
});
