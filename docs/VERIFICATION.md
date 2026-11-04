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
