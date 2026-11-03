import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { StorePage } from '../pages/store.page';
import { ShopApi } from '../services/shop-api';

interface FrameworkFixtures {
  loginPage: LoginPage;
  storePage: StorePage;
  shopApi: ShopApi;
}

/** Dependency-injection fixtures: each test receives fresh page objects and API client. */
export const test = base.extend<FrameworkFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  storePage: async ({ page }, use) => {
    await use(new StorePage(page));
  },
  shopApi: async ({ request }, use) => {
    await use(new ShopApi(request));
  },
});

export { expect };
