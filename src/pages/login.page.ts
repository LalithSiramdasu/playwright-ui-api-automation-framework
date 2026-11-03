import type { Page, Locator } from '@playwright/test';

/** Page Object: locators and user actions for the demo application's login page. */
export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly signInButton: Locator;
  readonly errorMessage: Locator;

  constructor(private readonly page: Page) {
    this.email = page.getByLabel('Email address');
    this.password = page.getByLabel('Password');
    this.signInButton = page.getByRole('button', { name: 'Sign in' });
    this.errorMessage = page.getByRole('alert');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async login(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.signInButton.click();
  }
}
