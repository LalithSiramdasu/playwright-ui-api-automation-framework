# Verification history and release gate

This file separates evidence from earlier versions, new local checks, and planned checks. Do not reuse earlier pass counts for a different commit.

## Previous verified release — 2026-11-04

Commit [`3aa38a25`](https://github.com/LalithSiramdasu/playwright-ui-api-automation-framework/commit/3aa38a25c2eeff0692745a6ebcd61651e2b55ab7) completed GitHub Actions successfully: [workflow run 41792430740](https://github.com/LalithSiramdasu/playwright-ui-api-automation-framework/actions/runs/41792430740). That release used a separate Experience Lab and USD prices. **Its check counts must not be attributed to newer storefront code.**

## Integrated-state / INR release — local pre-push evidence

| Check | Result |
| --- | --- |
| `node --check demo-app/public/app.js` | Passed |
| `node --check demo-app/server.mjs` | Passed |
| `npm run test:server` | 11 passed, 0 failed |
| Full TypeScript / ESLint | Run in GitHub Actions after publishing |
| Cross-browser Playwright | Run in GitHub Actions after publishing |
| Browser visual inspection in this environment | Blocked by browser network policy; verify locally and in CI |

**Release requirement:** inspect the new push's GitHub Actions run at [Actions](https://github.com/LalithSiramdasu/playwright-ui-api-automation-framework/actions). Only claim browser coverage and current green CI if that specific run succeeds. For personal laptop validation, run:

```bash
npm ci
npx playwright install
npm --prefix dashboard ci
npm run dashboard:build
npm run typecheck
npm run lint
npm run test:server
npm test
```

To see real UI behavior, start `npm run demo:start` and visit `http://127.0.0.1:4173`. The ten states are now part of the actual purchase journey; intentionally delay/intercept requests with Playwright to reproduce fault scenarios. See `tests/ui/states.spec.ts`.

## Historical starter notes — 2026-11-03

At initial assembly, the dependency-free API suite passed **5/5** and Node syntax checks passed, but the complete Playwright suite was not available in that assembly environment. This is a historical note, not a current release result.


## Module 1 / Northline Goods rename — local checks, 2026-11-04

| Check | Evidence |
| --- | --- |
| `npm run projects:validate` | 2 valid profiles (1 local configured + 1 disabled API template) |
| `npm run test:server` | 20 passed, 0 failed: 12 original/dashboard + 8 registry tests |
| `node --check` (new registry/validator, dashboard server, demo app) | Passed |
| Playwright cross-browser suite | Must be checked in GitHub Actions for the new commit |
| Dashboard React build, TypeScript, ESLint | Must be checked in GitHub Actions for the new commit |

These checks exercise profile validation and non-breaking dashboard discovery, **not multi-project test execution**. Module 2 will implement actual project-specific dispatch.

## Module 2 local checks (before GitHub Actions)

- `npm run projects:validate`: 3 profiles validated (2 enabled local, 1 disabled template).
- `npm run test:server`: **31 tests passed**, including project-runner preflight, isolation, dashboard invalid selection and separate API fixture tests.
- CLI `--dry-run`: passed for Northline Chromium smoke and Sample API.
- TypeScript, lint, full Playwright browser and Sample API Playwright suites: pending the Module 2 commit's GitHub Actions run. Do not attribute older CI runs to this code.

## Module 4 pre-push local verification (2026-11-04)

- `node --test tests/server/sample-api.test.mjs tests/server/api-contract.test.mjs`: **10/10 passed** in the local working tree.
- `node --check` on the JSON contract checker and updated sample API server: passed.
- Full TypeScript, lint, dashboard build, all Playwright projects: verify using **this commit's own GitHub Actions run**, not earlier runs.
- The 21 Sample Website tests passed in the user's Windows screenshot before Module 4; rerun CI to demonstrate no regressions.

## Module 5 — local baseline and pre-release checks (2026-11-04)

- Before changes: Node standalone tests 43/43 passed.
- After security policy, data and redaction work: 54/54 standalone tests passed (see local `npm run test:server`).
- `npm run projects:validate` passed for four profiles; Sample API now includes a loopback staging read-only environment.
- CLI `--dry-run` passed for Sample API local and staging.
- Full TS/lint/build/browsers and cross-browser results must be validated **against the Module 5 GitHub commit itself**. Do not use older run counts as proof for this release.

## Module 6 local verification (2026-11-04; before release CI)

- `npm run projects:validate`: passed (4 profiles).
- `npm run test:server`: **57 tests passed**, including new project-scope helpers and updated dashboard metadata checks.
- `node --check` / TypeScript parser check of edited React JSX and new Playwright test sources: passed.
- The React production build, dashboard Chromium E2E checks, TypeScript, ESLint and other Playwright suites require the latest commit's GitHub Actions confirmation. No local browser runner dependencies are installed in this editing environment.
- The screenshot of `6967000` shows an older failed run; later Module 5 commit `966080f` has successful [run 41847006208](https://github.com/LalithSiramdasu/playwright-ui-api-automation-framework/actions/runs/41847006208).

## Module 7 — reporting and analytics (local evidence before GitHub Actions)

- `node --test tests/server/*.test.mjs`: **67 passed, 0 failed**. This includes actual Node API requests against temporary seeded history, scope isolation, export redaction/CSV formula protection, completed-run comparison, deletion origin/confirmation and artifact removal.
- `node scripts/validate-projects.mjs`: 4 project profiles validated (existing configurations unchanged).
- `node --check dashboard/server.mjs` and `node --check dashboard/analytics.mjs`: Passed.
- Added dedicated Chromium dashboard tests for exports, comparisons and deletion UI; new run's GitHub Actions must pass before these are marked verified.
- React Vite build, lint, typecheck and complete cross-browser regression are release gates verified only by the *new* commit's GitHub Actions. Older green runs do not prove Module 7.

## Module 8 — project-aware CI/CD (pre-push local evidence; 2026-11-04)

- Verified starting point: commit `21bf5a1` has [successful CI run 41852089997](https://github.com/LalithSiramdasu/playwright-ui-api-automation-framework/actions/runs/41852089997).
- `node --test tests/server/*.test.mjs`: **76 passed, 0 failed** (including nine new CI selection, authorization and metadata tests).
- `node scripts/validate-projects.mjs`: 4 registered profiles validated.
- `node --check scripts/ci-project.mjs`: passed.
- The new manual/weekly workflow was authored but **not executed by that prior push workflow**. Test it separately with **Actions → Project-aware QA Runs**. The Module 8 push's build/lint/typecheck/regressions require its own GitHub Actions run.

## Module 9 — external QA sandbox pilots (pre-release evidence)

- Confirmed prior Module 8 commit `262c0da` passed GitHub Actions [41853946225](https://github.com/LalithSiramdasu/playwright-ui-api-automation-framework/actions/runs/41853946225).
- Two explicitly QA-focused public sandbox profiles added with eight Playwright cases each, restricted to read-only safe test directories. `staging` is an execution policy label, not a claim that the vendor serves a private staging deployment.
- `npm run projects:validate` and `npm run pilots:validate` pass locally. `node --test tests/server/*.test.mjs`: 86 passing after Module 9 changes.
- `--allow-remote --dry-run` passed for both approved hosts, with exact matching `QA_REMOTE_APPROVAL`; no external requests were made by these checks.
- Full lint, TypeScript, dashboard and existing Playwright regression must be verified on Module 9's own GitHub Actions commit. **The new external tests are NOT run in CI by design**. Live public-sandbox tests and a genuine user-owned/authorized project pilot still require separately captured run evidence.

## Module 10 — offline onboarding (local verification, before CI)

- New offline staging project scaffold and readiness gate added; project profiles default to disabled with TODO-only tests.
- Existing Northline, Sample Website, Sample API and public practice pilots are unchanged. No external HTTP traffic is initiated by the new module.
- Local Node standalone verification results and current commit-specific CI evidence must be recorded after running the module's release checks; older green runs do not verify Module 10.
- Actual business-app validation cannot be claimed until an explicitly authorized real project and meaningful functional assertions are supplied and executed.

## Module 10 local verification — 2026-11-04

- `npm run test:server`: **98 passed, 0 failed** with six built-in profiles.
- Temporary seventh web project created via the `--write` path; `npm run projects:validate` accepted **7 project profiles** and `npm run test:server` still passed **98/98**, proving additions no longer break hard-coded project counts. The temporary project was deleted after testing.
- `npm run pilots:validate`: existing two public practice pilots still pass offline static audits.
- `node --check` on new onboarding/CLI modules: passed.
- Actual external requests performed by Module 10: **none**. No real business target was supplied.
- React build, TypeScript, ESLint and full Playwright tests: **require confirmation from the Module 10 commit's own GitHub Actions run**; older green runs do not verify this release.

## External QA practice pilots — user-provided execution evidence (4–5 November 2026)

- The Internet (Chromium, `pilot-the-internet`, external practice site): two locally executed full runs, **8/8 passed (41.0 s)** and **8/8 passed (38.3 s)**. The supplied HTML report screenshot shows 8 passed, 0 failed, 0 flaky, 0 skipped.
- JSONPlaceholder (`pilot-jsonplaceholder`, external read-only REST API): smoke **2/2 passed (1.3 s)**, full API **8/8 passed (2.3 s)**. The supplied HTML report screenshot shows 8 passed, 0 failed, 0 flaky, 0 skipped.
- These are **16 distinct cases**, with **26 passed case executions across four runs**. The user ran the tests from Windows CMD and cleared temporary remote host approvals. Evidence is the operator-provided console transcripts/screenshots, not archived raw GitHub CI artifacts.
- The test case mappings and limitations are recorded in [External Pilot Execution Evidence](EXTERNAL_PILOT_EXECUTION_EVIDENCE.md). Both remote suites remain **excluded from normal CI**; there is no owner-authorized business-client validation claim.
- The preceding Module 10 release `04c9ca7` completed GitHub Actions successfully in [run 41862170645](https://github.com/LalithSiramdasu/playwright-ui-api-automation-framework/actions/runs/41862170645). The current documentation commit's CI must be checked separately and must not be represented as having rerun external public hosts.
