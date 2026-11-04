import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test, before, after } from 'node:test';

let child;
let base;
before(async () => {
  child = spawn(process.execPath, ['dashboard/server.mjs'], {
    cwd: process.cwd(), env: { ...process.env, DASHBOARD_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Dashboard server timed out')), 10000);
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => { clearTimeout(timeout); reject(Error(`Server exited ${code}`)); });
    child.stdout.on('data', (chunk) => {
      const result = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
      if (result) { clearTimeout(timeout); resolve(result[0]); }
    });
  });
});
after(async () => {
  if (child?.exitCode === null) { child.kill(); await once(child, 'exit'); }
});
const request = async (path, options = {}) => {
  const response = await fetch(`${base}${path}`, options);
  return { status: response.status, body: await response.json() };
};

test('dashboard health and suite definitions are served from real API', async () => {
  const health = await request('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');
  const suites = await request('/api/suites');
  assert.equal(suites.body.suites.length, 7);
});

test('dashboard never invents a run or a report', async () => {
  const history = await request('/api/runs');
  assert.equal(history.status, 200);
  assert.ok(Array.isArray(history.body.runs));
  const missing = await request('/api/runs/00000000-0000-0000-0000-000000000000');
  assert.equal(missing.status, 404);
  const report = await request('/reports/00000000-0000-0000-0000-000000000000');
  assert.equal(report.status, 404);
});

test('dashboard rejects invalid suites and untrusted origins', async () => {
  const invalid = await request('/api/runs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suite: 'arbitrary command', browser: 'chromium' }),
  });
  assert.equal(invalid.status, 400);
  const origin = await request('/api/runs', {
    method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ suite: 'smoke', browser: 'all' }),
  });
  assert.equal(origin.status, 403);
  const incompatible = await request('/api/runs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suite: 'api', browser: 'webkit' }),
  });
  assert.equal(incompatible.status, 400);
});


test('dashboard lists validated project profiles without exposing URLs or secrets', async () => {
  const response = await request('/api/projects');
  assert.equal(response.status, 200);
  assert.equal(response.body.executionMode, 'project-aware');
  assert.deepEqual(response.body.projects.map((project) => project.id), ['northline-goods', 'sample-api', 'sample-web', 'starter-api']);
  assert.equal(response.body.projects[1].enabled, true);
  assert.equal(response.body.projects[2].enabled, true);
  assert.equal(response.body.projects[2].type, 'web');
  assert.equal(response.body.projects[3].enabled, false);
  assert.equal(JSON.stringify(response.body).includes('STARTER_API_TOKEN'), false);
  assert.equal(JSON.stringify(response.body).includes('api.example.test'), false);
});


test('dashboard project preflight rejects disabled, unknown and unsafe targets before spawning', async () => {
  for (const payload of [
    { projectId: 'starter-api', environment: 'staging', suite: 'api' },
    { projectId: '../sample-api', environment: 'local', suite: 'api' },
    { projectId: 'sample-api', environment: 'production', suite: 'api' },
    { projectId: 'sample-api', environment: 'local', suite: 'ui' },
    { projectId: 'sample-api', environment: 'local', suite: 'api', browser: 'chromium' },
    { projectId: 'sample-api', environment: 'local', suite: 'api', command: 'rm -rf .'}
  ]) {
    const response = await request('/api/runs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(response.status, 400, JSON.stringify(payload));
    assert.equal(typeof response.body.error, 'string');
  }
});
