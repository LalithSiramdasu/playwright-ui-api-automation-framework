import type { Page } from '@playwright/test';
import { isReadOnlyOriginRequest } from './read-only-policy.mjs';

/**
 * Restrict a reviewed public-training browser test to GET/HEAD on one approved
 * HTTPS origin. This is defense-in-depth, not an OS/network sandbox; review
 * test source and do not use it to authorize arbitrary sites.
 */
export async function useReadOnlyOrigin(page: Page, origin: string): Promise<void> {
  const allowed = new URL(origin);
  if (allowed.protocol !== 'https:' || allowed.username || allowed.password) {
    throw new Error('Read-only browser target must be an approved HTTPS origin');
  }
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (!isReadOnlyOriginRequest(allowed.origin, request.url(), request.method())) {
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
}
