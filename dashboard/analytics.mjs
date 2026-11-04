/** Module 7: scoped, deterministic reporting helpers. No secrets or raw logs in exports. */
const DONE = new Set(['passed', 'failed', 'cancelled', 'interrupted']);

export function runScope(run) {
  return { projectId: run.projectId ?? 'northline-goods', environment: run.environment ?? 'local' };
}

export function historyForScope(runs, projectId, environment) {
  return runs.filter((run) => {
    const scope = runScope(run);
    return scope.projectId === projectId && scope.environment === environment;
  });
}

export function summarizeHistory(runs) {
  const finished = runs.filter((run) => DONE.has(run.status) && run.counts);
  const add = (key) => finished.reduce((sum, run) => sum + (Number(run.counts?.[key]) || 0), 0);
  const bySuite = {};
  const byBrowser = {};
  for (const run of finished) {
    for (const [record, key] of [[bySuite, run.suite], [byBrowser, run.browser]]) {
      if (!record[key]) record[key] = { runs: 0, passed: 0, failed: 0, flaky: 0 };
      record[key].runs++;
      for (const metric of ['passed', 'failed', 'flaky']) record[key][metric] += Number(run.counts?.[metric]) || 0;
    }
  }
  const total = add('total');
  const passed = add('passed');
  return {
    runs: runs.length,
    completedRuns: finished.length,
    totals: { total, passed, failed: add('failed'), skipped: add('skipped'), flaky: add('flaky'), retries: add('retries') },
    passRate: total ? Math.round(100 * passed / total) : null,
    bySuite, byBrowser,
  };
}

export function summaryRow(run) {
  const scope = runScope(run);
  return {
    runId: run.id,
    projectId: scope.projectId,
    environment: scope.environment,
    suite: run.suite,
    browser: run.browser,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt ?? null,
    durationMs: Number(run.durationMs) || 0,
    total: Number(run.counts?.total) || 0,
    passed: Number(run.counts?.passed) || 0,
    failed: Number(run.counts?.failed) || 0,
    skipped: Number(run.counts?.skipped) || 0,
    flaky: Number(run.counts?.flaky) || 0,
    retries: Number(run.counts?.retries) || 0,
  };
}

export function exportJson(runs) {
  return JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), runs: runs.map(summaryRow) }, null, 2);
}

const columns = ['runId', 'projectId', 'environment', 'suite', 'browser', 'status', 'startedAt', 'finishedAt', 'durationMs', 'total', 'passed', 'failed', 'skipped', 'flaky', 'retries'];
function cell(value) {
  let text = value == null ? '' : String(value);
  // Do not let CSV viewers evaluate attacker-controlled values as formulas.
  if (/^[\s]*[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function exportCsv(runs) {
  return [columns.join(','), ...runs.map((run) => {
    const row = summaryRow(run);
    return columns.map((name) => cell(row[name])).join(',');
  })].join('\r\n') + '\r\n';
}

function outcome(run) {
  return (run.cases ?? []).reduce((map, item) => {
    const id = `${item.project ?? ''} :: ${item.title ?? ''}`;
    map.set(id, item.status);
    return map;
  }, new Map());
}

/** Compare older -> newer, avoiding false conclusions when cases differ. */
export function compareRuns(older, newer) {
  const oldScope = runScope(older);
  const newScope = runScope(newer);
  if (oldScope.projectId !== newScope.projectId || oldScope.environment !== newScope.environment) {
    throw new Error('Runs must belong to the same project and environment');
  }
  if (!DONE.has(older.status) || !DONE.has(newer.status) || !older.counts || !newer.counts) {
    throw new Error('Both runs must have completed with test results');
  }
  const oldCases = outcome(older);
  const newCases = outcome(newer);
  const newlyFailed = [];
  const resolved = [];
  for (const [key, status] of newCases) {
    if (status === 'failed' && oldCases.get(key) !== 'failed') newlyFailed.push(key);
    if (status !== 'failed' && oldCases.get(key) === 'failed') resolved.push(key);
  }
  return {
    projectId: oldScope.projectId, environment: oldScope.environment,
    older: summaryRow(older), newer: summaryRow(newer),
    delta: {
      passed: (newer.counts.passed ?? 0) - (older.counts.passed ?? 0),
      failed: (newer.counts.failed ?? 0) - (older.counts.failed ?? 0),
      flaky: (newer.counts.flaky ?? 0) - (older.counts.flaky ?? 0),
      durationMs: (newer.durationMs ?? 0) - (older.durationMs ?? 0),
    },
    newlyFailed, resolved,
    comparableCases: [...newCases.keys()].filter((name) => oldCases.has(name)).length,
  };
}
