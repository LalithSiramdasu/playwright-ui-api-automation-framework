import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const RUN_ID = '55555555-5555-4555-8555-555555555555';

test('dashboard history deletion preserves runs and reports when saving history fails', async () => {
  const data = mkdtempSync(join(tmpdir(), 'qa-deletion-fail-'));
  const history = join(data, 'runs.json');
  const backup = join(data, 'runs.original.json');
  const reportDir = join(data, 'artifacts', RUN_ID, 'html');
  const report = join(reportDir, 'index.html');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(report, '<h1>Preserve this report</h1>');
  writeFileSync(history, JSON.stringify([{
    id: RUN_ID,
    projectId: 'sample-api',
    environment: 'local',
    suite: 'api',
    browser: 'all',
    status: 'passed',
    startedAt: '2026-11-05T01:00:00.000Z',
    finishedAt: '2026-11-05T01:00:01.000Z',
    cases: [], logs: [], reportAvailable: true,
    counts: { total: 1, passed: 1, failed: 0 },
  }]));

  const child = spawn(process.execPath, ['dashboard/server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, DASHBOARD_DATA_DIR: data, DASHBOARD_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    const base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Dashboard server startup timed out')), 10000);
      const cleanup = () => {
        clearTimeout(timeout);
        child.off('error', fail);
        child.off('exit', exit);
        child.stdout.off('data', onData);
      };
      const fail = (error) => { cleanup(); reject(error); };
      const exit = (code) => fail(Error('Dashboard exited before startup: ' + code));
      const onData = (chunk) => {
        const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) { cleanup(); resolve(match[0]); }
      };
      child.once('error', fail);
      child.once('exit', exit);
      child.stdout.on('data', onData);
    });

    // Replace the saved JSON path with a directory. Atomic rename must now fail.
    renameSync(history, backup);
    mkdirSync(history);
    const deleteRun = () => fetch(base + '/api/runs/' + RUN_ID, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: RUN_ID }),
    });
    const denied = await deleteRun();
    assert.equal(denied.status, 500, 'Failed persistence must fail the delete request');
    assert.equal(existsSync(report), true, 'Report must not be deleted on failed save');
    assert.match(readFileSync(report, 'utf8'), /Preserve this report/);
    const stillListed = await fetch(base + '/api/runs/' + RUN_ID);
    assert.equal(stillListed.status, 200, 'Run must remain in server memory on failed save');
    assert.equal(JSON.parse(readFileSync(backup, 'utf8')).length, 1);

    // Once storage is restored, the same confirmed request should succeed.
    rmSync(history, { recursive: true, force: true });
    renameSync(backup, history);
    const completed = await deleteRun();
    assert.equal(completed.status, 200);
    assert.equal((await completed.json()).deleted, 1);
    assert.equal(existsSync(report), false, 'The report should be removed on committed delete');
    assert.deepEqual(JSON.parse(readFileSync(history, 'utf8')), []);
    const missing = await fetch(base + '/api/runs/' + RUN_ID);
    assert.equal(missing.status, 404);
  } finally {
    if (child.exitCode === null && !child.killed) {
      child.kill();
      await once(child, 'exit');
    }
    rmSync(data, { recursive: true, force: true });
  }
});
