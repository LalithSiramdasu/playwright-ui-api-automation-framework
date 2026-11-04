# QA Control Center — React dashboard and Playwright orchestration

This is a **real, local dashboard**, not a static design or mock-up. All execution counts and case outcomes are derived from Playwright's JSON reporter. Fresh installations deliberately show no test history until you run something.

## Quick start (Windows, macOS, Linux)

In the repository root:

```bash
npm install
npx playwright install
npm run dashboard:setup
npm run dashboard
```

Open **http://127.0.0.1:4300**. Select a suite and a browser project, then choose **Run selected suite**. Keep the terminal open. When the process finishes, open **Test runs** for test-level results and **Reports** for the HTML report.

The dashboard starts Playwright itself. You do **not** have to start the demo application separately. Playwright's `webServer` configuration manages it.

For frontend development, start the backend with `npm run dashboard:start` in one terminal and the Vite development server with `npm run dashboard:dev` in another. Open **http://127.0.0.1:5173**.

## Architecture

```text
React dashboard (dashboard/src/)
    | GET /api/health, GET /api/runs, GET /api/runs/:id
    | POST /api/runs, POST /api/runs/:id/cancel
    v
Node local API (dashboard/server.mjs)
    | allowlisted suite/browser --> Playwright CLI (spawn, no shell)
    | reporter --> JSON + HTML artifacts per run
    v
Existing UI / API automation suite, Page Objects, fixtures, demo shop
```

The backend persists up to 100 recent runs in `dashboard/data/runs.json`, and keeps their reports in `dashboard/data/artifacts/<run-id>/`. These locations are in `.gitignore`. Logs are capped at 350 lines per run; results include test names, per-project status, durations and failures. Running tests is not a simulation.

## Coverage and metrics

- **Tests executed**: number of test cases reported across completed runs.
- **Pass rate**: passed (including flaky passes) divided by all reported test cases across recorded runs.
- **Failures**: cases Playwright marked unexpected.
- **Trend**: historical pass rate for recorded runs with structured results (requires two runs).
- **Case details**: final status, total attempt duration and final error message.
- **Reports**: HTML assets generated for each real run, shown only when the report exists.

Selections: **Full validation, Smoke, Regression, UI, API, Negative, Accessibility**. Browser project selection filters to Chromium, Firefox or WebKit; a single-browser selection omits API-only tests. Choose **All applicable projects** to include cross-browser and API tests where applicable.

## Safety and reliability

- HTTP server listens on **127.0.0.1** only and checks the request host.
- Write endpoints reject non-local web origins, so another website cannot normally trigger runs through a browser.
- The runner only accepts **hard-coded test suite and browser identifiers**, never arbitrary commands or arguments. It uses `spawn` without a shell.
- Only one Playwright process runs at a time. You can cancel active runs.
- Reports and logs are **local**, not uploaded from this dashboard. CI reports use GitHub Actions artifacts separately.
- Test history is persisted locally; interrupted sessions are marked interrupted on restart.

This local tool is designed for developer workstations, not exposure on public networks. It is **not a hosted multi-user QA management product**. Do not use it for secrets, production credentials or publicly accessible automation.

## Troubleshooting

| Issue | Resolution |
| --- | --- |
| `Playwright is not installed` | Run `npm install` in repository root |
| `Executable doesn't exist` | Run `npx playwright install` |
| `Dashboard build missing` | Run `npm run dashboard:setup && npm run dashboard:build` |
| Port 4300 in use | Stop the existing server, or set `DASHBOARD_PORT` to another port |
| Run failed, but count empty | Inspect logs; dependencies, browser installation, or server startup likely failed before results were produced |
| HTML report not available | Confirm the run reached Playwright reporter execution; read the run log |

## Validation

`npm run test:server` includes dashboard API input validation and JSON result parser tests, alongside the existing demo API integration tests. GitHub Actions additionally installs and builds the React dashboard, runs typecheck/lint, installs browsers and executes the complete Playwright suite.
