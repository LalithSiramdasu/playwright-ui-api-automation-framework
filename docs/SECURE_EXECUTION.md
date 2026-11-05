# Module 5 — safe environments, secrets and test-data isolation

**Status:** Implemented local testing and opt-in staging gate; **not** a full security sandbox, proof of ownership or approval of production testing. The dashboard remains single-user, local-only, and **cannot start remote runs**. Modules 6–10 retain that restriction: external runs require a separate approved CLI path, not a dashboard consent button.

## What this adds

- A **shared execution policy** called from both CLI/dashboard preflight and Playwright configuration, rather than bypassing policy with a direct Playwright launch.
- A **read-only staging mode** that discovers only `projects/<id>/tests/safe/` and refuses to run the project's mutable local test suite. Only reviewed test source is trusted; Playwright itself is not a sandbox that can stop intentionally malicious test code.
- A **remote HTTPS staging gate**, requiring explicit project-profile opt-in, exact approved host, an operator CLI `--allow-remote` flag, and `QA_REMOTE_APPROVAL` equal to the target hostname. Production and writable remote targets are blocked.
- A **read-only API client** exposing `GET` only, using root-relative paths and no automatic redirects. This is a convenience defense, not a global network interceptor. Do not use direct `request.post` in approved safe suites.
- **Test-scoped unique data** and LIFO cleanup callbacks, including a real local sample-API create/get/delete example. Cleanup runs even on test failures; a failed cleanup causes the test to fail.
- Basic **dashboard log and case-error redaction**, using credential variable values declared in project profiles plus common auth-header patterns. Other tools and raw HTML/JSON artifacts may still contain sensitive information; protect them and do not upload them publicly.
- Ignore `.env.*` (except `.env.example`) and `.auth/` directories in Git to avoid accidental secret/session commits.

## Normal usage: local project and simulated staging

```bash
npm run projects:validate
npm run test:server
npm run test:sample-api                 # full independent local API tests
npm run test:sample-api-staging         # safe GET-only staging simulation on 127.0.0.1
node scripts/run-project.mjs --project sample-api --environment staging --suite api --dry-run
```

The `sample-api` `staging` environment is a **local, read-only demonstration**, not a public server. Only the two safe API specs run for it, while normal local execution runs the broader test suite.

## Registering an authorized HTTPS staging target (future project onboarding)

1. Create a named `projects/<id>/project.config.json` with allowedHosts containing one exact staging hostname, a `staging` environment with HTTPS base URL and `readOnly: true`, and `remoteExecution: {"enabled": true}`. Do **not** enable production or add credentials to the profile. Project profiles are human-reviewed code changes, not user-entered arbitrary destinations.
2. Add **reviewed, read-only** tests under `projects/<id>/tests/safe/api/` (or `safe/ui/` for a website). Never place destructive tests there. Use `ReadOnlyApiClient` for API smoke tests. A URL cannot tell you what outcomes are correct; assertions must be written against the actual product requirements.
3. Obtain permission from the service owner. On Windows CMD, set the approval *only for that terminal*:

```bat
set QA_REMOTE_APPROVAL=staging.example.org
node scripts/run-project.mjs --project approved-api --environment staging --suite smoke --allow-remote --dry-run
node scripts/run-project.mjs --project approved-api --environment staging --suite smoke --allow-remote
set QA_REMOTE_APPROVAL=
```

Replace the placeholder host/project with **your real authorized target**. Without both the CLI flag and matching variable, execution is rejected. Dashboard remote actions do not carry this flag and will be rejected.

**Important limits:** This policy cannot stop trusted test code from importing a lower-level HTTP/browser client, following links to third-party sites, or performing an unintended mutation. Treat every test file in a remote safe suite as reviewed executable code. For higher-risk environments, add sandboxed workers, network egress restrictions, service identity/approval, and an audit trail before deployment. Production is blocked outright in this module. Domain names may resolve to different addresses over time; explicit network egress policy remains a future hardening step.

## Credentials and artifacts

- Declare *variable names* in `credentialEnv`; set values only through OS environment or a private local `.env.local` **loaded by your own secure workflow**. Node scripts do not automatically load `.env.local`.
- Never check secrets, auth cookies, bearer tokens, credentials or real customer test data into Git.
- Do not print credentials or raw authentication responses in test failures. Avoid screenshots/traces in environments with sensitive data. For explicit remote runs, Playwright tracing, screenshots and videos are disabled by default.
- Dashboard redacts known secret values in its recorded logs/test-error summaries. **Raw** HTML, JSON and JUnit reports are not guaranteed redacted. The dashboard is bound to localhost, and remote CI runs are not configured by default.
- Keep staging permissions scoped and low-privilege. Be careful with test data cleanup—only delete entities created by your own tests.

## Data fixture example

```ts
import { test, expect } from '../../src/core/test-data-fixture';

test('creates isolated data', async ({ isolatedData }) => {
  const name = isolatedData.unique('order');
  // Create a record with name through your project's approved local test API.
  isolatedData.onCleanup(async () => {
    // Delete only that record through the project's teardown API.
  });
  expect(name).toContain('qa-');
});
```

See the working example in `projects/sample-api/tests/api/data-isolation.spec.ts` and the read-only staging tests in `projects/sample-api/tests/safe/api/health.spec.ts`.

## Module 5 acceptance checks

- The normal Northline Goods, Sample API and Sample Website suites continue to pass.
- `npm run test:sample-api-staging` runs only restricted safe checks (no mutation tests).
- Node policy tests reject unauthorized hosts, disabled remote access, writable remote environments, production targets, wrong approvals, unknown properties and missing safe specs.
- Test data lifecycle (unique IDs, cleanup on failure, test records) and redaction are validated.
- All changes are pushed to `main` only after review, and GitHub Actions confirms the commit-specific outcome.
