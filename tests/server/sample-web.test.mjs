import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { resolveProjectRun, makePlaywrightArguments } from '../../src/core/project-runner.mjs';

let child;
let base;
before(async () => {
  child = spawn(process.execPath, ['projects/sample-web/server.mjs'], {
    cwd: process.cwd(), env: { ...process.env, SAMPLE_WEB_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Sample website startup timed out')), 10_000);
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Sample website exited: ${code}`)); });
    child.stdout.on('data', (chunk) => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timeout); resolve(match[0]); }
    });
  });
});
after(async () => {
  if (child && child.exitCode === null) { child.kill(); await once(child, 'exit'); }
});

test('Module 3: web-only project resolves to its own site, directory and browsers', () => {
  const selection = resolveProjectRun({ projectId: 'sample-web', environment: 'local', suite: 'smoke' });
  assert.equal(selection.projectType, 'web');
  assert.equal(selection.webBaseUrl, 'http://127.0.0.1:4175/');
  assert.match(selection.testDir.replaceAll('\\', '/'), /projects\/sample-web\/tests$/);
  assert.deepEqual(makePlaywrightArguments(selection), [
    'test', '--grep', '@smoke', '--project=chromium', '--project=firefox', '--project=webkit',
  ]);
  assert.throws(() => resolveProjectRun({ projectId: 'sample-web', environment: 'local', suite: 'api' }), /not enabled/);
});

test('Module 3: fixture has independent health route and a guarded workspace', async () => {
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', service: 'sample-web' });
  const privatePage = await fetch(`${base}/workspace`, { redirect: 'manual' });
  assert.equal(privatePage.status, 302);
  assert.equal(privatePage.headers.get('location'), '/login');
  const login = await fetch(`${base}/login`);
  assert.equal(login.status, 200);
  assert.match(await login.text(), /Sign in to Sample Website/);
});

test('Module 3: invalid login is rejected and valid session grants private access', async () => {
  const invalid = await fetch(`${base}/api/session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-a-user', password: 'bad' }),
  });
  assert.equal(invalid.status, 401);
  const valid = await fetch(`${base}/api/session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tester@example.test', password: 'LocalOnly123!' }),
  });
  assert.equal(valid.status, 200);
  const cookie = valid.headers.get('set-cookie')?.split(';')[0];
  assert.match(cookie ?? '', /^sample_session=/);
  const me = await fetch(`${base}/api/me`, { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), { email: 'tester@example.test' });
  const workspace = await fetch(`${base}/workspace`, { headers: { Cookie: cookie } });
  assert.equal(workspace.status, 200);
  assert.match(await workspace.text(), /Sample workspace/);
  const logout = await fetch(`${base}/api/logout`, { method: 'POST', headers: { Cookie: cookie } });
  assert.equal(logout.status, 200);
  const denied = await fetch(`${base}/api/me`, { headers: { Cookie: cookie } });
  assert.equal(denied.status, 401);
});

test('Module 3: unrecognized URLs and unsupported methods fail clearly', async () => {
  const missing = await fetch(`${base}/unknown`);
  assert.equal(missing.status, 404);
  const unsupported = await fetch(`${base}/api/me`, { method: 'POST' });
  assert.equal(unsupported.status, 405);
});
