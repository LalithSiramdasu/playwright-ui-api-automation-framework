import { test as base, expect } from '@playwright/test';
import { ApiClient } from './api-client';

/** Every test gets its own API client; credentials never leak between tests. */
export const test = base.extend<{ apiClient: ApiClient }>({
  apiClient: async ({ request }, use) => { await use(new ApiClient(request)); },
});
export { expect };
