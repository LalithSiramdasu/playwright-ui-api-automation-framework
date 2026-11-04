import { test as base, expect } from '@playwright/test';
import { TestDataScope } from './test-data.mjs';

/** Test-scoped unique data and LIFO cleanup, automatically finalized on failure. */
export const test = base.extend<{ isolatedData: TestDataScope }>({
  isolatedData: async ({ request }, use, info) => {
    // A real built-in fixture dependency keeps Playwright's fixture resolver compatible.
    void request;
    const scope = new TestDataScope(`${info.project.name}/${info.testId}/${info.retry}`);
    try { await use(scope); }
    finally { await scope.close(); }
  },
});
export { expect };
