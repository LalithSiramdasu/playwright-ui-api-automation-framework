# Module 3 — reusable website automation

**Goal:** provide shared browser automation helpers and a second independently runnable website to prove cross-project reuse. This module does **not** perform generic scanning of arbitrary URLs. External websites remain blocked by the Module 2 runner until Module 5 adds explicit authorization and safe-operation controls.

## What is implemented

- `src/web/pages/base-web-page.ts`: an app-agnostic Page Object with relative navigation and heading/path assertions.
- `src/web/auth.ts`: reusable accessible-form login and cookie-backed API session setup. The authentication endpoint, form labels and credentials are supplied by the project; none are hardcoded into the common code.
- `src/web/fixtures.ts`: automatic per-test Playwright diagnostics, including uncaught browser errors, console errors, failed network requests and HTTP 5xx responses. Attachments capture at most 40 events, omit query strings/fragments, and redact common secrets. They are not a full secret-scanning system; use synthetic data until Module 5 hardens secrets policy.
- `projects/sample-web/`: a **separate** local website, profile, server, project-specific Page Objects and UI tests for sign-in, session cookie, sign-out, protected route, catalog, responsive keyboard navigation, invalid login and diagnostics.
- The runner uses a trusted local server mapping on port `4175` and isolates its test directory. API-only Sample API remains on `4174`; Northline Goods remains on `4173`.

## How to run

Install as usual with `npm ci` and `npx playwright install`. From the repository root:

```bash
npm run projects:validate
npm run test:server

# Preflight only (starts no tests or server):
node scripts/run-project.mjs --project sample-web --environment local --suite smoke --browser chromium --dry-run

# Execute a sample project in Chromium:
node scripts/run-project.mjs --project sample-web --environment local --suite smoke --browser chromium

# Run all website test cases in Chromium, Firefox and WebKit:
npm run test:sample-web

# Independently run the existing projects:
npm run test:sample-api
npm test
```

Playwright starts `projects/sample-web/server.mjs` automatically when the selected project is `sample-web`. For manual exploration, execute `npm run sample-web:start` and open `http://127.0.0.1:4175/login`.

The sample website uses fake local credentials `tester@example.test` / `LocalOnly123!`. These are not real account credentials. For this *local sample only*, optional `SAMPLE_WEB_USERNAME` and `SAMPLE_WEB_PASSWORD` overrides are accepted by the browser test; do not store real credentials in public source.

## How to adapt this to a different website

1. First register a **validated profile** with the actual authorized environment, suite list, and only credential environment-variable **names**. Keep profiles non-executable.
2. Under `projects/<id>/pages/`, build Page Objects with selectors grounded in the target application's accessible roles/labels. Compose them with `BaseWebPage` where useful.
3. Under `projects/<id>/tests/ui/`, import `test` / `expect` from `src/web/fixtures.ts` and write meaningful assertions based on *requirements*, not appearance alone.
4. For form authentication, call `signInThroughForm(page, options)`. For an application with cookie auth through an API, use `establishApiCookieSession(page, '/api/session', payload)`; cookies land in the **browser context** because it uses `page.context().request`. Other auth models (OAuth, SSO, MFA, bearer tokens) require explicit project-specific adapters and approvals.
5. Each test gets a new browser context. Avoid reusing one real account for concurrent state-changing tests; provision isolated test users and data (Module 5).
6. Run project preflight, Chromium smoke tests, then full cross-browser tests. Failures get Playwright screenshots/traces as configured plus structured browser diagnostics (if present). Inspect the HTML report or dashboard run.

**Important:** No code here bypasses the Module 2 remote-host restriction. Module 5 must be completed before live staging URLs can be run by the dashboard/CLI, and production must remain explicitly read-only.

## Examples

```ts
import { test, expect } from '../../../../src/web/fixtures';
import { signInThroughForm } from '../../../../src/web/auth';

test('user reaches workspace @smoke', async ({ page }) => {
  await signInThroughForm(page, {
    path: '/login',
    usernameLabel: 'Email',
    passwordLabel: 'Password',
    submitButtonName: 'Sign in',
    successHeading: 'Sample workspace',
    credentials: { username: process.env.SAMPLE_WEB_USERNAME!, password: process.env.SAMPLE_WEB_PASSWORD! },
  });
  await expect(page).toHaveURL(/\/workspace$/);
});
```

The excerpt is an *adaptation template*: don't use non-null environment assertions without a preflight/fixture that verifies the values exist. The bundled Sample Website tests use safe, fake local fallback credentials.

## Module 3 acceptance checks

- [x] Shared code has no Northline-specific selectors or product assertions.
- [x] Sample Website is registered with a separate local URL and test directory.
- [x] Authentication works through a real browser form and through a cookie-backed API request.
- [x] Unauthenticated requests are redirected; sign-out clears the session.
- [x] A deliberately raised browser exception is captured as an artifact, without failing unrelated tests.
- [x] Module 2 still rejects remote/disabled projects and unsupported test/browser combinations.
- [ ] Check the latest commit's GitHub Actions run for the full Northline + Sample API + Sample Website cross-browser suites before marking CI verification complete.

## Next modules

**Module 4:** reusable REST API authentication clients, typed contract/schema tests and negative cases.

**Module 5:** authorized external-target safety, secrets, test accounts, data creation/cleanup, and controlled network access.

**Module 6:** graphical project selection, environment selection and project-filtered dashboard analytics.
