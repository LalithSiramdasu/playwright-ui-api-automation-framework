import { expect, type APIResponse, type Page } from '@playwright/test';

/** Authentication data belongs to each target project, never to this helper. */
export interface WebCredentials {
  username: string;
  password: string;
}

export interface FormLoginOptions {
  path: string;
  usernameLabel: string;
  passwordLabel: string;
  submitButtonName: string;
  successHeading: string;
  credentials: WebCredentials;
}

/** For web apps with a conventional, accessible sign-in form. */
export async function signInThroughForm(page: Page, options: FormLoginOptions): Promise<void> {
  await page.goto(options.path);
  await page.getByLabel(options.usernameLabel, { exact: true }).fill(options.credentials.username);
  await page.getByLabel(options.passwordLabel, { exact: true }).fill(options.credentials.password);
  await page.getByRole('button', { name: options.submitButtonName, exact: true }).click();
  await expect(page.getByRole('heading', { name: options.successHeading, exact: true })).toBeVisible();
}

/**
 * Creates a cookie-backed session using the browser context's own request client.
 * Unlike an independent request fixture, context.request propagates Set-Cookie
 * into the browser context. The caller supplies the endpoint/payload contract.
 * Never print the credential data or storage state to the test report.
 */
export async function establishApiCookieSession(
  page: Page,
  endpoint: string,
  payload: Record<string, string>,
): Promise<APIResponse> {
  if (!endpoint.startsWith('/') || endpoint.startsWith('//') || endpoint.includes('\\')) {
    throw new Error('Authentication endpoint must be origin-relative');
  }
  const response = await page.context().request.post(endpoint, { data: payload });
  if (!response.ok()) throw new Error(`Session setup rejected (HTTP ${response.status()})`);
  return response;
}
