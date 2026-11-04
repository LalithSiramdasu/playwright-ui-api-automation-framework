import { expect, type Page } from '@playwright/test';

/** Shared, app-independent navigation and visible-state assertions. */
export class BaseWebPage {
  constructor(protected readonly page: Page) {}

  async open(path = '/'): Promise<void> {
    // An app-specific test may navigate within its declared origin, never by supplying
    // an untrusted absolute URL through this common Page Object.
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
      throw new Error('Page paths must be origin-relative');
    }
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
  }

  async expectHeading(name: string): Promise<void> {
    await expect(this.page.getByRole('heading', { name, exact: true })).toBeVisible();
  }

  async expectPath(pathname: string): Promise<void> {
    await expect.poll(() => new URL(this.page.url()).pathname).toBe(pathname);
  }
}
