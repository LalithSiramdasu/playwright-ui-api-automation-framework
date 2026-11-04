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
