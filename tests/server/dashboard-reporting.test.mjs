import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SUITES, summarizeReport } from '../../dashboard/reporting.mjs';

test('dashboard exposes unique allowlisted test suites', () => {
  assert.equal(SUITES.length, 7);
  assert.equal(new Set(SUITES.map((suite) => suite.id)).size, SUITES.length);
});

test('report parser summarizes passed, flaky, failed and skipped cases', () => {
  const report = {
    stats: { duration: 1500 },
    suites: [{ title: 'api.spec.ts', specs: [{ title: 'create order', tests: [
      { projectName: 'api', status: 'expected', results: [{ status: 'passed', duration: 50 }] },
      { projectName: 'api', status: 'unexpected', results: [{ status: 'failed', duration: 30, errors: [{ message: 'Expected 201, got 500' }] }] },
      { projectName: 'api', status: 'flaky', results: [{ status: 'failed', duration: 20 }, { status: 'passed', duration: 40 }] },
      { projectName: 'api', status: 'skipped', results: [] },
    ] }] }],
  };
  const output = summarizeReport(report);
  assert.deepEqual(output.counts, { total: 4, passed: 2, failed: 1, skipped: 1, flaky: 1 });
  assert.equal(output.cases[1].error, 'Expected 201, got 500');
  assert.equal(output.cases[2].durationMs, 60);
  assert.equal(output.durationMs, 1500);
});

test('report parser handles empty or incomplete result files safely', () => {
  assert.deepEqual(summarizeReport(null).counts, { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 });
  assert.equal(summarizeReport({ suites: [{ title: 'empty' }] }).cases.length, 0);
});
