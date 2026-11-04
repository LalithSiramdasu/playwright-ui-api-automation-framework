import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { before, after, test } from 'node:test';

let processHandle;
let baseURL;
before(async () => {
  processHandle = spawn(process.execPath, ['projects/sample-api/server.mjs'], {
    cwd: process.cwd(), env: { ...process.env, SAMPLE_API_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  baseURL = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Sample API did not start')), 10_000);
    processHandle.once('error', (error) => { clearTimeout(timeout); reject(error); });
    processHandle.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Sample API exited ${code}`)); });
    processHandle.stdout.on('data', (chunk) => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timeout); resolve(match[0]); }
    });
  });
});
after(async () => {
  if (processHandle && processHandle.exitCode === null) {
    processHandle.kill();
    await once(processHandle, 'exit');
  }
});

test('Module 2: separate API fixture serves its own health and inventory', async () => {
  const health = await fetch(`${baseURL}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', service: 'sample-api' });
  const items = await fetch(`${baseURL}/api/inventory`);
  assert.equal(items.status, 200);
  assert.equal((await items.json()).items[0].sku, 'S-001');
});

test('Module 2: sample API rejects unknown endpoint and write request', async () => {
  assert.equal((await fetch(`${baseURL}/missing`)).status, 404);
  assert.equal((await fetch(`${baseURL}/api/inventory`, { method: 'POST' })).status, 405);
});

test('Module 4: bearer token login permits a protected account request', async () => {
  const login = await fetch(`${baseURL}/api/auth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'api-tester@example.test', password: 'LocalOnly123!' }),
  });
  assert.equal(login.status, 200);
  const tokenBody = await login.json();
  assert.equal(tokenBody.tokenType, 'Bearer');
  assert.ok(tokenBody.accessToken.length >= 12);
  const account = await fetch(`${baseURL}/api/account`, { headers: { Authorization: `Bearer ${tokenBody.accessToken}` } });
  assert.equal(account.status, 200);
  assert.deepEqual(await account.json(), { accountId: 'sample-account', role: 'tester', active: true });
});

test('Module 4: missing or invalid login tokens return useful errors', async () => {
  const missing = await fetch(`${baseURL}/api/account`);
  assert.equal(missing.status, 401);
  assert.deepEqual(await missing.json(), { error: 'Unauthorized' });
  const invalid = await fetch(`${baseURL}/api/auth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'api-tester@example.test', password: 'wrong' }),
  });
  assert.equal(invalid.status, 401);
  assert.deepEqual(await invalid.json(), { error: 'Invalid credentials' });
});

test('Module 4: local-only API key permits protected metrics and rejects missing key', async () => {
  const denied = await fetch(`${baseURL}/api/metrics`);
  assert.equal(denied.status, 401);
  const allowed = await fetch(`${baseURL}/api/metrics`, { headers: { 'x-api-key': process.env.SAMPLE_API_KEY ?? 'local-demo-key' } });
  assert.equal(allowed.status, 200);
  assert.deepEqual(await allowed.json(), { service: 'sample-api', healthy: true, requestsProcessed: 1 });
});

test('Module 4: query validation, malformed JSON and unsupported method return distinct 4xx', async () => {
  const query = await fetch(`${baseURL}/api/inventory?limit=0`);
  assert.equal(query.status, 400);
  assert.deepEqual(await query.json(), { error: 'limit must be an integer between 1 and 20' });
  const json = await fetch(`${baseURL}/api/auth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(json.status, 400);
  assert.deepEqual(await json.json(), { error: 'Invalid JSON' });
  const method = await fetch(`${baseURL}/api/inventory`, { method: 'POST' });
  assert.equal(method.status, 405);
});
