import { type Page } from '@playwright/test';
import { BaseWebPage } from '../../../src/web/pages/base-web-page';
import { signInThroughForm, type WebCredentials } from '../../../src/web/auth';

/** Application-specific locators/options stay inside this project's directory. */
export class SampleLoginPage extends BaseWebPage {
  constructor(page: Page) { super(page); }

  async signIn(credentials: WebCredentials): Promise<void> {
    await signInThroughForm(this.page, {
      path: '/login', usernameLabel: 'Email', passwordLabel: 'Password',
      submitButtonName: 'Sign in', successHeading: 'Sample workspace', credentials,
    });
  }
}
