import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { loadRunHistory, saveRunHistory } from '../../dashboard/storage.mjs';

function isolatedHistory(callback) {
  const dir = mkdtempSync(join(tmpdir(), 'qa-history-'));
  const file = join(dir, 'runs.json');
  try { callback(file, dir); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

test('dashboard storage: missing history opens empty without creating files', () => {
  isolatedHistory((file, dir) => {
    assert.deepEqual(loadRunHistory(file), []);
    assert.deepEqual(readdirSync(dir), []);
  });
});

test('dashboard storage: malformed JSON is rejected without destroying original data', () => {
  isolatedHistory((file) => {
    const original = '[{"id":"prior-run"},BROKEN';
    writeFileSync(file, original);
    assert.throws(() => loadRunHistory(file), /unreadable.*preserved/);
    assert.equal(readFileSync(file, 'utf8'), original);
  });
});

test('dashboard storage: invalid top-level and run shapes cannot be silently erased', () => {
  isolatedHistory((file) => {
    for (const content of ['{}', '[null]', '[{"id":"run","logs":"secret"}]']) {
      writeFileSync(file, content);
      assert.throws(() => loadRunHistory(file), /invalid records.*preserved/);
      assert.equal(readFileSync(file, 'utf8'), content);
    }
  });
});

test('dashboard storage: atomic replacement keeps valid records and no temporary files', () => {
  isolatedHistory((file, dir) => {
    writeFileSync(file, JSON.stringify([{ id: 'previous' }]));
    saveRunHistory(file, [{ id: 'new', logs: [], cases: [] }, { id: 'extra' }], 1);
    assert.deepEqual(loadRunHistory(file), [{ id: 'new', logs: [], cases: [] }]);
    assert.deepEqual(readdirSync(dir), ['runs.json']);
  });
});

test('dashboard storage: interrupted/failed save preserves last good history', () => {
  isolatedHistory((file, dir) => {
    saveRunHistory(file, [{ id: 'good' }]);
    const original = readFileSync(file, 'utf8');
    // A directory is not a valid JSON file; rename cannot replace it.
    const impossibleTarget = dir;
    assert.throws(() => saveRunHistory(impossibleTarget, [{ id: 'bad' }]));
    assert.equal(readFileSync(file, 'utf8'), original);
    assert.deepEqual(readdirSync(dir), ['runs.json']);
  });
});

test('dashboard server fails closed when saved history is corrupted', () => {
  isolatedHistory((file) => {
    const original = '{"runs": "not-an-array"}';
    writeFileSync(file, original);
    const child = spawnSync(process.execPath, ['dashboard/server.mjs'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 3000,
      env: { ...process.env, DASHBOARD_DATA_DIR: dirname(file), DASHBOARD_PORT: '0' },
    });
    assert.equal(child.error, undefined, child.stderr);
    assert.notEqual(child.status, 0, 'Server should refuse damaged history');
    assert.match(child.stderr, /invalid records.*preserved/);
    assert.equal(readFileSync(file, 'utf8'), original);
  });
});
