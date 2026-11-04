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
