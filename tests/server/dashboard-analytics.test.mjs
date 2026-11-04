import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeHistory, historyForScope, compareRuns, exportCsv, exportJson } from '../../dashboard/analytics.mjs';

const fixture = (id, projectId, environment, counts, cases = []) => ({
  id, projectId, environment, suite: 'api', browser: 'all', status: 'passed',
  startedAt: '2026-11-04T08:00:00Z', finishedAt: '2026-11-04T08:01:00Z',
  durationMs: 1000, counts, cases,
});
const a = fixture('a', 'sample-api', 'local', { total: 2, passed: 1, failed: 1, skipped: 0, flaky: 0, retries: 0 }, [
  { title: 'health', project: 'api', status: 'passed' },
  { title: 'inventory', project: 'api', status: 'failed' },
]);
const b = fixture('b', 'sample-api', 'local', { total: 2, passed: 2, failed: 0, skipped: 0, flaky: 1, retries: 1 }, [
  { title: 'health', project: 'api', status: 'passed' },
  { title: 'inventory', project: 'api', status: 'flaky' },
]);
const c = fixture('c', 'northline-goods', 'local', { total: 5, passed: 5, failed: 0 });
const d = fixture('d', 'sample-api', 'staging', { total: 2, passed: 2, failed: 0 });

test('Module 7: history and analytics never mix project or environment', () => {
  const local = historyForScope([a, b, c, d], 'sample-api', 'local');
  assert.deepEqual(local.map((run) => run.id), ['a', 'b']);
  assert.deepEqual(historyForScope([a, b, c, d], 'sample-api', 'staging').map((run) => run.id), ['d']);
  const stats = summarizeHistory(local);
  assert.deepEqual(stats.totals, { total: 4, passed: 3, failed: 1, skipped: 0, flaky: 1, retries: 1 });
  assert.equal(stats.passRate, 75);
  assert.equal(stats.bySuite.api.runs, 2);
  assert.equal(stats.byBrowser.all.passed, 3);
});

test('Module 7: compares actual case transitions, flaky outcomes and retry changes', () => {
  const result = compareRuns(a, b);
  assert.deepEqual(result.resolved, ['api :: inventory']);
  assert.deepEqual(result.newlyFailed, []);
  assert.equal(result.delta.flaky, 1);
  assert.equal(result.delta.failed, -1);
  assert.equal(result.comparableCases, 2);
  assert.throws(() => compareRuns(a, d), /same project and environment/);
  assert.throws(() => compareRuns(a, c), /same project and environment/);
  assert.throws(() => compareRuns({ ...a, status: 'running' }, b), /completed/);
});

test('Module 7: JSON/CSV exports contain allowlisted summary fields, not logs, errors or secrets', () => {
  const withSecrets = { ...a, logs: ['Bearer really-secret'], cases: [{ title: 'SECRET', error: 'Bearer really-secret' }] };
  const csv = exportCsv([withSecrets]);
  const json = exportJson([withSecrets]);
  for (const value of [csv, json]) {
    assert.doesNotMatch(value, /really-secret|Bearer|SECRET/);
    assert.match(value, /sample-api/);
  }
  assert.equal(JSON.parse(json).runs[0].failed, 1);
  assert.match(csv, /runId,projectId,environment,suite/);
});

test('Module 7: CSV export neutralizes spreadsheet formula injection', () => {
  const csv = exportCsv([{ ...a, suite: '=1+1', browser: '@cmd', status: '+danger' }]);
  assert.match(csv, /"'=1\+1"/);
  assert.match(csv, /"'@cmd"/);
  assert.match(csv, /"'\+danger"/);
});

test('Module 7: legacy runs are scoped to Northline/local without rewriting history', () => {
  const legacy = { ...a, projectId: undefined, environment: undefined };
  assert.deepEqual(historyForScope([legacy], 'northline-goods', 'local'), [legacy]);
  assert.deepEqual(historyForScope([legacy], 'sample-api', 'local'), []);
});
