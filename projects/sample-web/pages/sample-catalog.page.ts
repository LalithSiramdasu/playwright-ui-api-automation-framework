import { expect, type Page } from '@playwright/test';
import { BaseWebPage } from '../../../src/web/pages/base-web-page';

export class SampleCatalogPage extends BaseWebPage {
  constructor(page: Page) { super(page); }

  async expectSeededItems(): Promise<void> {
    await this.expectHeading('Sample catalog');
    await expect(this.page.getByTestId('sample-item')).toHaveCount(2);
    await expect(this.page.getByText('Sample Notebook')).toBeVisible();
  }
}
