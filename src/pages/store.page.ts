import type { Page, Locator } from '@playwright/test';

/** Page Object for product searching, cart updates, checkout, and logout. */
export class StorePage {
  readonly heading: Locator;
  readonly searchBox: Locator;
  readonly categoryFilter: Locator;
  readonly productCards: Locator;
  readonly cartCount: Locator;
  readonly cartTotal: Locator;
  readonly placeOrderButton: Locator;
  readonly confirmation: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Demo Shop', exact: true });
    this.searchBox = page.getByRole('searchbox', { name: 'Search products' });
    this.categoryFilter = page.getByLabel('Product category');
    this.productCards = page.getByTestId('product-card');
    this.cartCount = page.getByTestId('cart-count');
    this.cartTotal = page.getByTestId('cart-total');
    this.placeOrderButton = page.getByRole('button', { name: 'Place order' });
    this.confirmation = page.getByRole('status');
  }

  product(name: string): Locator {
    return this.productCards.filter({ hasText: name });
  }

  async search(query: string): Promise<void> {
    await this.searchBox.fill(query);
  }

  async filterCategory(category: string): Promise<void> {
    await this.categoryFilter.selectOption({ label: category });
  }

  async addProduct(name: string): Promise<void> {
    await this.product(name).getByRole('button', { name: 'Add to cart' }).click();
  }

  async placeOrder(): Promise<void> {
    await this.placeOrderButton.click();
  }

  async logout(): Promise<void> {
    await this.page.getByRole('button', { name: 'Log out' }).click();
  }
}
