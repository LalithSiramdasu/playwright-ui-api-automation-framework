# Module 9 — Real-world project onboarding pilot and acceptance record

**Implementation status:** Two opt-in external **QA practice** targets are configured and 16 real Playwright assertions are authored. Static registry, policy, and coverage checks run automatically; **the public-site/browser tests are not run in normal CI**. Testing a genuine user-owned application with agreed requirements still requires an authorized target and test credentials. Do not describe that final acceptance as complete until evidence exists.

## Why these targets?

1. **JSONPlaceholder** is a publicly hosted fake REST service specifically offered for testing and prototyping: https://jsonplaceholder.typicode.com. Our adapter tests public GET responses and relationships, not state-changing requests.
2. **The Internet** at https://the-internet.herokuapp.com is a collection of pages deliberately built for web automation practice. Our UI adapter covers navigation, checkbox interaction, dropdown values, table contents, numeric input, and HTTP status pages. It does not submit forms, upload files, run accessibility scans, or click destructive actions.

These are external hosted test sandboxes, **not projects owned by the QA framework developer**. Their availability and data could change; never treat their failures alone as defects in your own product.

## What was implemented

| Profile ID | Kind | Exact HTTPS host | Environment | Safe tests | Execution |
| --- | --- | --- | --- | --- | --- |
| `pilot-jsonplaceholder` | REST API | `jsonplaceholder.typicode.com` | `staging` (framework's restricted testing designation) | 8 / `projects/pilot-jsonplaceholder/tests/safe/api/contracts.spec.ts` | CLI opt-in only |
| `pilot-the-internet` | Browser UI | `the-internet.herokuapp.com` | `staging` (framework's restricted testing designation) | 8 / `projects/pilot-the-internet/tests/safe/ui/site.spec.ts` | CLI opt-in only |

The profile's `staging` label represents the **framework's safe-testing policy**; it does not mean the third-party service is a private staging deployment. Both profiles use exact allowlisted hosts, `readOnly: true`, and `remoteExecution.enabled: true`. They have no stored credentials.

The web pilot uses a browser request guard that aborts non-GET/HEAD traffic and off-origin HTTP(S) requests. The API pilot uses `ReadOnlyApiClient`, which exposes GET only and disables redirects. These are **defense-in-depth checks, not a network sandbox**: only run reviewed tests against permitted targets.

## Quick start on Windows CMD (run each line separately)

First update the checkout and verify dependencies:

```bat
git status
git pull origin main
npm ci
npx playwright install
npm run projects:validate
npm run pilots:validate
npm run test:server
```

If you have uncommitted local edits, review or commit them before `git pull`.

**Pilot 1: API — explicit approval** (eight read-only GET checks):

```bat
set QA_REMOTE_APPROVAL=jsonplaceholder.typicode.com
node scripts/run-project.mjs --project pilot-jsonplaceholder --environment staging --suite api --browser all --allow-remote --dry-run
node scripts/run-project.mjs --project pilot-jsonplaceholder --environment staging --suite api --browser all --allow-remote
set QA_REMOTE_APPROVAL=
```

**Pilot 2: website — explicit approval** (eight browser checks; use Chromium first):

```bat
set QA_REMOTE_APPROVAL=the-internet.herokuapp.com
node scripts/run-project.mjs --project pilot-the-internet --environment staging --suite smoke --browser chromium --allow-remote --dry-run
node scripts/run-project.mjs --project pilot-the-internet --environment staging --suite ui --browser chromium --allow-remote
set QA_REMOTE_APPROVAL=
```

**Do not run these against arbitrary websites**; the hosts above are public services explicitly intended for testing. Use small batches and avoid repeated load tests. If a service returns `429` or is unavailable, stop testing and record it as an environment/service limitation.

### Reports

Results use project-scoped folders:

- `playwright-report/pilot-jsonplaceholder/staging/`
- `playwright-report/pilot-the-internet/staging/`

For example:

```bat
npx playwright show-report playwright-report/pilot-jsonplaceholder/staging
```

In QA Control Center you can select a pilot and view its environment and saved results. **The Run button is disabled for remote pilots** because dashboard requests do not carry the separate CLI approval. Local CLI runs are not automatically imported into the dashboard's JSON history; their Playwright HTML/JUnit artifacts remain on disk. Full cross-system evidence import is future work.

## Requirements-to-test traceability

The machine-readable acceptance matrices live in:

- `projects/pilot-jsonplaceholder/pilot-coverage.json` — PAPI-01 through PAPI-08
- `projects/pilot-the-internet/pilot-coverage.json` — PWEB-01 through PWEB-08

`npm run pilots:validate` confirms each matrix ID matches a real test case in its restricted test directory and the reviewed profile selects the expected host. This static audit **does not perform any HTTP requests**.

## Validation and defect triage

Before a pilot, record the project ID, exact approved host, reason for testing, test environment, which suite will run and business rules/expected outcomes. During the run, note commit SHA, browser, timestamp, total/passed/failed/skipped and report path. Investigate failures before claiming a bug: site unavailability, consent/rate limits, selector drift, actual product behavior, and assertion defects are different categories.

Recommended defect record:

```text
Title:
Project/environment:
Requirement ID / Playwright case:
Observed and expected outcome:
Reproduction steps:
Browser, commit and execution timestamp:
Report/screenshot/trace location (if enabled):
Assessment: app defect / test defect / environment / needs investigation
```

Remote test traces, video and screenshots are disabled by default to avoid collecting third-party data. Never publish raw credentials or sensitive test artifacts.

## Final acceptance: onboarding a genuine authorized project

This remains **pending** until you provide an application you control or have explicit written permission to test. At that stage:

1. Identify the actual requirements and API/OpenAPI contract, staging URL, exact allowed host, test accounts and restrictions.
2. Add `projects/<id>/project.config.json` with an approved HTTPS read-only target; keep secrets in environment variables only.
3. Write project-specific `tests/safe/ui` and/or `tests/safe/api` with at least five meaningful business assertions in each applicable category, then document their requirement IDs.
4. Run approved CLI preflight with `--allow-remote` and a matching `QA_REMOTE_APPROVAL`, then a small smoke suite. Inspect the HTML report and categorize any failures.
5. Verify isolation from Northline Goods and Sample API, and create an authorized CI strategy only after secrets, permission scopes and audit requirements are reviewed. The existing Module 8 CI workflow intentionally **does not run external targets**.
6. Record the full end-to-end outcome, including exact run evidence. A website's URL alone cannot reveal correct business logic, and this framework cannot automatically assert unspecified requirements.

**Current release acceptance:** External pilot *code/configuration and safe preflight* complete; actual end-to-end owner-authorized business-project validation pending. Automated CI confirms that existing local projects and security gates are not broken.
