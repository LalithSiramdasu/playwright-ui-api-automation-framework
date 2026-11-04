/** Turn Playwright's JSON reporter format into stable, user-facing run records. */
export function summarizeReport(report) {
  const stats = report?.stats ?? {};
  const cases = [];
  const walk = (suite, parents = []) => {
    const titles = suite.title ? [...parents, suite.title] : parents;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const result = test.results?.at(-1) ?? {};
        const rawStatus = test.status ?? (result.status === 'passed' ? 'expected' : 'unexpected');
        const status = rawStatus === 'expected' ? 'passed' : rawStatus === 'unexpected' ? 'failed' : rawStatus;
        cases.push({
          title: [...titles, spec.title].filter(Boolean).join(' / '),
          project: test.projectName ?? '',
          status,
          durationMs: (test.results ?? []).reduce((total, item) => total + (item.duration ?? 0), 0),
          error: String(result.errors?.[0]?.message ?? result.error?.message ?? '').slice(0, 2500),
          attempts: test.results?.length ?? 0,
          retries: Math.max(0, (test.results?.length ?? 0) - 1),
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, titles);
  };
  for (const suite of report?.suites ?? []) walk(suite);
  const passed = cases.filter((test) => test.status === 'passed' || test.status === 'flaky').length;
  const failed = cases.filter((test) => test.status === 'failed').length;
  const skipped = cases.filter((test) => test.status === 'skipped').length;
  return {
    counts: { total: cases.length, passed, failed, skipped, flaky: cases.filter((test) => test.status === 'flaky').length, retries: cases.reduce((sum, test) => sum + test.retries, 0) },
    durationMs: Number(stats.duration ?? 0),
    cases,
  };
}

export const SUITES = Object.freeze([
  { id: 'all', name: 'Full validation', description: 'All UI projects and API tests', icon: 'layers' },
  { id: 'smoke', name: 'Smoke suite', description: 'Critical-path checks', icon: 'flame' },
  { id: 'regression', name: 'Regression', description: 'Broader behavior coverage', icon: 'shield-check' },
  { id: 'ui', name: 'Browser UI', description: 'Page-object and end-to-end tests', icon: 'monitor' },
  { id: 'api', name: 'REST API', description: 'HTTP contract and negative tests', icon: 'network' },
  { id: 'negative', name: 'Negative paths', description: 'Invalid inputs and rejection cases', icon: 'shield-alert' },
  { id: 'accessibility', name: 'Accessibility', description: 'Keyboard and label smoke checks', icon: 'accessibility' },
]);
