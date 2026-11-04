import { test, expect } from '../../../../src/web/fixtures';

test('browser errors are captured without leaking query parameters @regression', async ({ page, browserDiagnostics }) => {
  await page.goto('/diagnostics?token=sensitive-example-should-not-be-logged');
  await expect(page.getByRole('heading', { name: 'Diagnostics fixture' })).toBeVisible();
  await expect.poll(() => browserDiagnostics.events.some((event) => event.type === 'page-error')).toBe(true);
  const captured = JSON.stringify(browserDiagnostics.events);
  expect(captured).toContain('Synthetic page error');
  expect(captured).not.toContain('sensitive-example-should-not-be-logged');
});
