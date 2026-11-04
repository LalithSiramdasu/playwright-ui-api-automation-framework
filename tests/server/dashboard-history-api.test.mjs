import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { before, after, test } from 'node:test';

const root = mkdtempSync(join(tmpdir(), 'qa-module7-'));
const data = root;
const ids = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
];
const run = (id, projectId, environment, status, passed, failed, caseStatus) => ({
  id, projectId, environment, suite: 'api', browser: 'all', status,
  startedAt: '2026-11-04T10:01:00.000Z', finishedAt: '2026-11-04T10:01:01.000Z',
  durationMs: 1000, counts: { total: 2, passed, failed, skipped: 0, flaky: 0, retries: 0 },
  cases: [{ title: 'inventory', project: 'api', status: caseStatus, error: 'Bearer should-not-export' }],
  logs: ['Bearer should-not-export'], reportAvailable: true,
});
const seeded = [
  run(ids[0], 'sample-api', 'local', 'failed', 1, 1, 'failed'),
  run(ids[1], 'sample-api', 'local', 'passed', 2, 0, 'passed'),
  run(ids[2], 'northline-goods', 'local', 'passed', 2, 0, 'passed'),
];
let server;
let base;
before(async () => {
  mkdirSync(join(data, 'artifacts', ids[0], 'html'), { recursive: true });
  writeFileSync(join(data, 'artifacts', ids[0], 'html', 'index.html'), '<h1>test</h1>');
  writeFileSync(join(data, 'runs.json'), JSON.stringify(seeded));
  server = spawn(process.execPath, ['dashboard/server.mjs'], {
    cwd: process.cwd(), env: { ...process.env, DASHBOARD_PORT: '0', DASHBOARD_DATA_DIR: data }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('dashboard timed out')), 10000);
    server.once('error', reject);
    server.once('exit', (code) => reject(Error(`dashboard exited ${code}`)));
    server.stdout.on('data', (chunk) => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timeout); resolve(match[0]); }
    });
  });
});
after(async () => {
  if (server?.exitCode === null) { server.kill(); await once(server, 'exit'); }
  rmSync(root, { recursive: true, force: true });
});
const json = async (route, options) => {
  const response = await fetch(`${base}${route}`, options);
  return { status: response.status, body: await response.json() };
};
const url = (path, projectId = 'sample-api', environment = 'local') => `${path}?projectId=${projectId}&environment=${environment}`;
const deleteRequest = (route, body, origin = undefined) => json(route, {
  method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body),
});

test('Module 7 API: analytics are scoped and reports count actual stored runs', async () => {
  const scopedHistory = await json(url('/api/runs'));
  assert.equal(scopedHistory.body.runs.length, 2);
  assert.equal((await json('/api/runs?projectId=sample-api')).status, 400);
  const sample = await json(url('/api/analytics'));
  const northline = await json(url('/api/analytics', 'northline-goods'));
  assert.equal(sample.status, 200);
  assert.equal(sample.body.summary.runs, 2);
  assert.equal(sample.body.summary.totals.passed, 3);
  assert.equal(northline.body.summary.runs, 1);
  assert.equal((await json(url('/api/analytics', 'unknown-project'))).status, 400);
});

test('Module 7 API: export is downloadable, scoped, and excludes private messages', async () => {
  const csv = await fetch(`${base}${url('/api/exports')}&format=csv`);
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-disposition'), /attachment/);
  const content = await csv.text();
  assert.match(content, /sample-api/);
  assert.doesNotMatch(content, /northline-goods|should-not-export/);
  const data = await json(`${url('/api/exports')}&format=json`);
  assert.equal(data.status, 200);
  assert.equal(data.body.runs.length, 2);
  assert.equal((await json(`${url('/api/exports')}&format=xml`)).status, 400);
});

test('Module 7 API: comparison disallows mixing projects and returns resolved failure', async () => {
  const result = await json(`/api/runs/${ids[1]}/compare?with=${ids[0]}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.comparison.delta.failed, -1);
  assert.deepEqual(result.body.comparison.resolved, ['api :: inventory']);
  assert.equal((await json(`/api/runs/${ids[2]}/compare?with=${ids[0]}`)).status, 400);
});

test('Module 7 API: deletion requires correct confirmation and trusted origin, then removes artifacts', async () => {
  const denied = await deleteRequest(`/api/runs/${ids[0]}`, { confirm: ids[0] }, 'https://evil.example');
  assert.equal(denied.status, 403);
  assert.equal((await deleteRequest(`/api/runs/${ids[0]}`, { confirm: 'oops' })).status, 400);
  const removed = await deleteRequest(`/api/runs/${ids[0]}`, { confirm: ids[0] });
  assert.deepEqual(removed, { status: 200, body: { deleted: 1 } });
  assert.equal((await json(`/api/runs/${ids[0]}`)).status, 404);
  assert.equal((await fetch(`${base}/reports/${ids[0]}/`)).status, 404);
  assert.ok(!readFileSync(join(data, 'runs.json'), 'utf8').includes(ids[0]));
});

test('Module 7 API: typed scope deletion cannot remove another project', async () => {
  assert.equal((await deleteRequest('/api/history', { projectId: 'sample-api', environment: 'local', confirm: 'DELETE' })).status, 400);
  assert.equal((await deleteRequest('/api/history', { projectId: 'sample-api', environment: 'staging', confirm: 'DELETE HISTORY' })).status, 200);
  const result = await deleteRequest('/api/history', { projectId: 'sample-api', environment: 'local', confirm: 'DELETE HISTORY' });
  assert.equal(result.status, 200);
  assert.equal(result.body.deleted, 1);
  assert.equal((await json(url('/api/analytics', 'northline-goods'))).body.summary.runs, 1);
});
