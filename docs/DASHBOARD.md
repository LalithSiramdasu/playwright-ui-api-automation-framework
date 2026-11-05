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

Open **http://127.0.0.1:4300**. Select an **active project** (Northline Goods, Sample Website, or Sample API), an **environment**, a supported **suite**, and where applicable a browser. Then choose **Run selected suite**. Keep the terminal open. When the process finishes, open **Test runs** for test-level results and **Reports** for the HTML report.

The dashboard starts Playwright itself. You do **not** have to start the demo application separately. Playwright's `webServer` configuration manages it.

For frontend development, start the backend with `npm run dashboard:start` in one terminal and the Vite development server with `npm run dashboard:dev` in another. Open **http://127.0.0.1:5173**.

## Architecture

```text
React dashboard (dashboard/src/)
    | GET /api/projects, GET /api/health, GET /api/runs, GET /api/runs/:id
    | GET /api/analytics, GET /api/exports, GET /api/runs/:id/compare
    | POST /api/runs, POST /api/runs/:id/cancel
    | DELETE /api/runs/:id, DELETE /api/history
    v
Node local API (dashboard/server.mjs)
    | profile + environment + allowlisted suite/browser --> Playwright CLI (spawn, no shell)
    | reporter --> JSON + HTML artifacts per run
    v
Northline, Sample Website and Sample API project-specific test suites
```

The backend persists up to 100 recent runs in `dashboard/data/runs.json`, and keeps their reports in `dashboard/data/artifacts/<run-id>/`. These locations are in `.gitignore`. Logs are capped at 350 lines per run; results include test names, per-project status, durations and failures. Running tests is not a simulation.

## Coverage and metrics

- **Tests executed**: number of test cases reported across completed runs.
- **Pass rate**: passed (including flaky passes) divided by all reported test cases across recorded runs.
- **Failures**: cases Playwright marked unexpected.
- **Trend**: historical pass rate for recorded runs with structured results (requires two runs).
- **Case details**: final status, total attempt duration and final error message.
- **Reports**: HTML assets generated for each real run, shown only when the report exists.

Selections: **Full validation, Smoke, Regression, UI, API, Negative, Accessibility**, limited to suites supported by the selected registered project. Browser selection filters to Chromium, Firefox, or WebKit when applicable; API-only projects cannot select a browser. Choose **All applicable browsers** to run compatible browser projects and API checks. Disabled profiles appear as unavailable, rather than being launchable.

### Module 6 — project and environment scope

The selector row appears on every dashboard page. Changing project or environment resets the selected run detail and filters **Overview KPIs, execution trend, recent executions, run history, suite counts, and HTML report links** to that target. The underlying runner continues to enforce strict project, browser and environment preflight; changing the UI cannot override target authorization. Global execution remains one run at a time, even when another project is selected.

Historical runs without explicit project/environment metadata are attributed to **Northline Goods / local** for backward compatibility; this is a legacy classification, not a claim that newer projects ran historically. New runs record both identifiers.

The **Sample API / staging** choice uses the local read-only staging simulation. External approved HTTPS staging requires server-side review and approval, and the dashboard does not grant permission to run unapproved remote targets. Production remains blocked. No URLs or credential variable names are exposed by the project discovery response.

Run browser-level UI tests against the dashboard itself after building the frontend:

```bash
npm run dashboard:build
npm run test:dashboard
```

These additional UI tests check the project/environment dropdowns, supported suite choices, request payload, and isolated analytics using controlled fixtures. They do not fabricate dashboard production results; they use Playwright request interception only inside the test process. Existing test suite results are still real.


## Module 7 — reports, export, comparison and deletion

The **Reports** tab provides scoped CSV/JSON exports containing only summary metadata and counts; it omits raw test errors and execution logs. It also allows comparing two completed runs from the same project/environment and shows flaky cases and total retry attempts for reports captured with the new parser.

To delete one run, confirm in the browser. To clear all history for the selected project/environment, type **DELETE HISTORY**; the backend rejects deletion while any runner is active and removes only matching records and report artifacts. Deleted local history is **not recoverable** from GitHub. The backend saves the updated run index **before** removing report artifacts, so a failed disk write does not erase reports or history. The dashboard retains up to 100 recent run records and cleans up artifacts evicted by the retention cap. If the dashboard restarts while a run is **running or cancelling**, it records that run as **interrupted**, retains its logs and report metadata, and clears the stale active state; completed and cancelled runs remain unchanged. This is recovery of **dashboard history**, not a guarantee that an OS child process was automatically terminated after an abrupt crash.

Details, API endpoints, security limitations and test commands are documented in [Reporting and Analytics](REPORTING_ANALYTICS.md).

## Local history crash-safety (hardening)

The dashboard now writes `dashboard/data/runs.json` via a same-directory temporary file and atomic rename rather than replacing it with an incomplete write. If the saved JSON is malformed or contains invalid run records, startup **stops with an explanatory error without overwriting the file**. This protects existing local test history from accidental loss; it does not automatically reconstruct damaged JSON. No project files or stored reports are removed by this safeguard.

On Windows, **stop the dashboard**, back up `dashboard\\data\\runs.json` outside the repository, inspect/repair the JSON and then restart. Do not delete the history file merely to silence an error; deletion permanently loses recorded run summaries. Continue to keep the dashboard bound to localhost. This module covers individual-process crashes and invalid JSON, **not** simultaneous writes by multiple dashboard processes or a database-level durability guarantee.

## Safety and reliability

- HTTP server listens on **127.0.0.1** only and checks the request host.
- Write endpoints reject non-local web origins, so another website cannot normally trigger runs through a browser.
- The runner only accepts **hard-coded test suite and browser identifiers**, never arbitrary commands or arguments. It uses `spawn` without a shell.
- Only one Playwright process runs at a time. You can cancel active runs.
- Reports and logs are **local**, not uploaded from this dashboard. CI reports use GitHub Actions artifacts separately.
- HTML report assets are restricted to the selected run's artifact directory **after resolving symlinks**. A report file cannot use a link to read a sibling run or arbitrary files from the local disk.
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

`npm run test:server` includes dashboard API input validation, project-scoping helpers, and JSON result parser tests, alongside the existing demo API integration tests. GitHub Actions additionally installs and builds the React dashboard, runs typecheck/lint, installs browsers and executes the complete Playwright suite.

## Accessibility and outage recovery (dashboard hardening)

Keyboard users can press **Tab** on initial load to reach **Skip to main content**, then **Enter** to jump to the main workspace. The active sidebar page is exposed through `aria-current="page"`, and the mobile navigation toggle exposes `aria-expanded`.

The dashboard distinguishes **refresh/data errors** from **user-action errors**. When a required data endpoint is unavailable, it displays an accessible error, disables new test runs rather than relying on stale health status, and offers **Retry dashboard data**. A failed run-launch or other action error is kept visible until the user dismisses it; a successful background poll no longer silently erases that error. These behaviors have dedicated Chromium browser regression tests. They improve local usability but are **not** a WCAG compliance certification or a substitute for manual accessibility auditing.
