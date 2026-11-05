import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { isSafeStaticFile } from '../../dashboard/static-boundary.mjs';

const RUN_ID = 'aabbccdd-1111-4222-8333-aabbccddeeff';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'qa-static-boundary-'));
  const artifact = join(root, 'artifacts');
  const run = join(artifact, RUN_ID);
  const html = join(run, 'html');
  mkdirSync(html, { recursive: true });
  const index = join(html, 'index.html');
  writeFileSync(index, '<h1>Local Playwright report</h1>');
  const confidential = join(root, 'local-secret.txt');
  writeFileSync(confidential, 'LOCAL_SECRET_MUST_NOT_BE_SERVED');
  return { root, artifact, run, html, index, confidential, boundaries: [artifact, run, html] };
}

function createSymlinkOrSkip(t, target, link) {
  try {
    symlinkSync(target, link);
    return true;
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP', 'EOPNOTSUPP'].includes(error.code)) {
      t.skip('This Windows/user configuration does not permit symlink creation');
      return false;
    }
    throw error;
  }
}

test('dashboard report path: actual report file remains readable', () => {
  const f = fixture();
  try {
    assert.equal(isSafeStaticFile(f.index, f.boundaries), true);
    assert.equal(isSafeStaticFile(f.html, f.boundaries), false, 'A directory is not a file');
    assert.equal(isSafeStaticFile(join(f.html, 'missing.html'), f.boundaries), false);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('dashboard report path: symlink to a file outside the run is refused', (t) => {
  const f = fixture();
  try {
    const link = join(f.html, 'leak.txt');
    if (!createSymlinkOrSkip(t, f.confidential, link)) return;
    assert.equal(isSafeStaticFile(link, f.boundaries), false);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('dashboard report path: symlinked report HTML directory cannot escape the run', (t) => {
  const f = fixture();
  try {
    const outside = join(f.root, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'index.html'), 'other private report');
    const fakeHtml = join(f.run, 'linked-html');
    if (!createSymlinkOrSkip(t, outside, fakeHtml)) return;
    assert.equal(isSafeStaticFile(join(fakeHtml, 'index.html'), [f.artifact, f.run, fakeHtml]), false);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('dashboard HTTP report endpoint refuses symlink escape while serving real assets', async (t) => {
  const f = fixture();
  const leak = join(f.html, 'leak.txt');
  if (!createSymlinkOrSkip(t, f.confidential, leak)) {
    rmSync(f.root, { recursive: true, force: true });
    return;
  }
  writeFileSync(join(f.root, 'runs.json'), JSON.stringify([{
    id: RUN_ID, projectId: 'northline-goods', environment: 'local',
    suite: 'api', browser: 'all', status: 'passed', logs: [], cases: [],
  }]));
  let server;
  try {
    server = spawn(process.execPath, ['dashboard/server.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, DASHBOARD_DATA_DIR: f.root, DASHBOARD_PORT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const url = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Dashboard startup timed out')), 10000);
      server.once('error', (error) => { clearTimeout(timeout); reject(error); });
      server.once('exit', (code) => { clearTimeout(timeout); reject(Error(`Dashboard exited ${code}`)); });
      server.stdout.on('data', (chunk) => {
        const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) { clearTimeout(timeout); resolve(match[0]); }
      });
    });
    const normal = await fetch(`${url}/reports/${RUN_ID}/index.html`);
    assert.equal(normal.status, 200);
    assert.match(await normal.text(), /Local Playwright report/);
    const rejected = await fetch(`${url}/reports/${RUN_ID}/leak.txt`);
    assert.equal(rejected.status, 403);
    assert.doesNotMatch(await rejected.text(), /LOCAL_SECRET_MUST_NOT_BE_SERVED/);
    const missing = await fetch(`${url}/reports/${RUN_ID}/missing.txt`);
    assert.equal(missing.status, 404);
    assert.equal(readFileSync(f.confidential, 'utf8'), 'LOCAL_SECRET_MUST_NOT_BE_SERVED');
  } finally {
    if (server?.exitCode === null && !server.killed) {
      server.kill();
      await once(server, 'exit');
    }
    rmSync(f.root, { recursive: true, force: true });
  }
});
