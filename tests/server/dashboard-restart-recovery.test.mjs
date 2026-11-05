import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const ids = [
  '11111111-aaaa-4111-8111-111111111111',
  '22222222-bbbb-4222-8222-222222222222',
  '33333333-cccc-4333-8333-333333333333',
  '44444444-dddd-4444-8444-444444444444',
];
const historical = '2026-11-04T10:01:00.000Z';
const record = (id, status) => ({
  id, status, projectId: 'sample-api', environment: 'local',
  suite: 'api', browser: 'all', startedAt: historical,
  finishedAt: status === 'passed' || status === 'cancelled' ? historical : null,
  counts: status === 'passed' ? { total: 2, passed: 2, failed: 0 } : null,
  cases: [], logs: ['Original execution log'], reportAvailable: false,
});

async function startDashboard(dataDir) {
  const child = spawn(process.execPath, ['dashboard/server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, DASHBOARD_PORT: '0', DASHBOARD_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Dashboard startup timed out')), 10000);
      const cleanup = () => {
        clearTimeout(timeout);
        child.off('error', fail);
        child.off('exit', exit);
        child.stdout.off('data', output);
      };
      const fail = (error) => { cleanup(); reject(error); };
      const exit = (code) => fail(Error('Dashboard exited before startup: ' + code));
      const output = (chunk) => {
        const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) { cleanup(); resolve(match[0]); }
      };
      child.once('error', fail);
      child.once('exit', exit);
      child.stdout.on('data', output);
    });
    return { child, base };
  } catch (error) {
    if (child.exitCode === null) {
      child.kill();
      await once(child, 'exit').catch(() => {});
    }
    throw error;
  }
}

async function stopDashboard(child) {
  if (child.exitCode === null && !child.killed) {
    child.kill();
    await once(child, 'exit');
  }
}

test('dashboard restart resolves running and cancelling runs without altering completed history', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'qa-restart-recovery-'));
  const file = join(dir, 'runs.json');
  writeFileSync(file, JSON.stringify([
    record(ids[0], 'running'),
    record(ids[1], 'cancelling'),
    record(ids[2], 'passed'),
    record(ids[3], 'cancelled'),
  ]));
  try {
    let first = await startDashboard(dir);
    try {
      const response = await fetch(first.base + '/api/runs?projectId=sample-api&environment=local');
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.activeId, null, 'A restarted process must not claim an active run');
      assert.equal(body.runs.length, 4, 'Recovery must not erase any stored runs');
      const byId = new Map(body.runs.map((run) => [run.id, run]));
      for (const id of ids.slice(0, 2)) {
        const recovered = byId.get(id);
        assert.equal(recovered.status, 'interrupted');
        assert.ok(recovered.finishedAt, 'Interrupted run should have a finish timestamp');
      }
      assert.equal(byId.get(ids[2]).status, 'passed');
      assert.equal(byId.get(ids[3]).status, 'cancelled');
      const persisted = JSON.parse(readFileSync(file, 'utf8'));
      for (const run of persisted.slice(0, 2)) {
        assert.equal(run.status, 'interrupted');
        assert.deepEqual(run.logs, ['Original execution log', 'Dashboard restarted before this run finished.']);
      }
      assert.equal(persisted[2].finishedAt, historical);
      assert.equal(persisted[3].finishedAt, historical);
    } finally {
      await stopDashboard(first.child);
    }

    // A second restart must keep resolved states and avoid duplicate interruption logs.
    first = await startDashboard(dir);
    try {
      const response = await fetch(first.base + '/api/runs');
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(body.runs.map((run) => run.status), [
        'interrupted', 'interrupted', 'passed', 'cancelled',
      ]);
      const persisted = JSON.parse(readFileSync(file, 'utf8'));
      assert.equal(persisted[0].logs.filter((line) => line.includes('Dashboard restarted')).length, 1);
      assert.equal(persisted[1].logs.filter((line) => line.includes('Dashboard restarted')).length, 1);
    } finally {
      await stopDashboard(first.child);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
