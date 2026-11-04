# QA Automation Framework — implementation roadmap

**Target:** a technically credible personal QA portfolio project, not a fake production SaaS app. Keep implementation evidence, API schemas, and test outcomes explicit. The GitHub repository uses `main` as the integration branch; apply new changes only after quality checks and review. A feature branch + PR can be adopted later if collaboration grows.

## Release baseline (implemented)

- Playwright + TypeScript UI/API suite, Page Objects and reusable fixtures.
- A functioning local demo shop and REST API; INR displays with integer paise in API objects.
- The ten real shopping UX conditions (empty, loading, error/retry, offline, slow, no results, denied permission fallback, expired session, form validation, success) plus automated browser cases.
- React QA Control Center that launches allowlisted suites locally, persists actual run results and provides logs and HTML reports.
- GitHub Actions for dashboard build, lint, typecheck, standalone API and full Playwright execution.
- Documentation, setup commands, source control and `.gitignore` for local test history.

## Module 2 implementation milestone — local project-aware runner

- Two independently runnable local targets: Northline Goods (hybrid) and an isolated Sample API.
- Validated project/environment/suite/browser preflight with fail-closed remote/read-only behavior.
- Separate Playwright test discovery paths; no arbitrary commands or test-directory values from the dashboard.
- CLI runner and dashboard POST endpoint now honor explicit project selections. Existing dashboard buttons default to Northline Goods.
- Modules 3–5 have added reusable website/API adapters, credential rules and safe staging execution. Module 6 provides graphical project selection and scoped analytics.

## Module 4 implementation milestone — reusable REST API automation

- Shared typed API client and per-test fixtures support REST verbs, query parameters, bearer and API-key authentication.
- A limited, explicitly documented JSON contract validator checks status, Content-Type and response structure.
- Independent Sample API now includes token login and authenticated read-only endpoints with negative scenarios.
- **Next:** Module 5 implements secrets/redaction, target authorization, test data isolation and safe execution policies for external APIs/websites.

## Module 5 milestone — controlled staging and isolated data

- Shared target policy in CLI preflight and Playwright configuration. Remote staging requires reviewed HTTPS profile opt-in, a matching host approval variable and explicit `--allow-remote`; **production remains blocked**.
- Restricted runs discover only dedicated `tests/safe/` cases; the local Sample API exposes a read-only staging simulation. This does not sandbox arbitrary test code.
- Reusable GET-only API client; unique data namespaces with automated teardown, demonstrated against an isolated local entity API.
- Dashboard log/test-error redaction and `.env.*` exclusions. Raw artifacts still need careful handling.
- **Completed next:** Module 6 dashboard project selector and environment/suite availability, preserving fail-closed remote approval. See [Module 5 safe-execution guide](SECURE_EXECUTION.md).

## Module 6 milestone — multi-project dashboard controls

- React dashboard project/environment dropdowns now use validated discovery metadata; disabled project templates cannot be selected.
- Suite and browser options follow the active project profile, and execution requests include the explicit project ID and environment.
- Overview KPIs, trends, recent executions, run history, test-suite counts, and report listings are filtered by project/environment, with Northline/local classification for legacy entries.
- A dedicated Chromium UI test suite checks selection, API payload and scoped analytics; server-side project safety preflight is unchanged.
- **Completed next:** Module 7 adds scoped exports, comparisons, accurate flaky/retry counts, retention cleanup and guarded history deletion.

## Module 7 milestone — reporting, comparisons and history controls

- Backend offers scoped run history/analytics, CSV/JSON summaries with spreadsheet-injection protection, and two-run comparison with case-level regression/resolution signals.
- React Reports view exposes exports, comparison, accurate flaky/retry totals, and guarded single-run or scoped-history deletion.
- Run artifacts are removed when their run is deleted or evicted by the 100-run retention cap; unrelated project history stays intact.
- Node integration tests use an isolated temporary history directory, and dashboard browser tests exercise the controls without deleting real user data.
- **Next:** Module 8 adds project-aware GitHub Actions, reviewed test triggers and artifact-management policies.

## Module 8 milestone — project-aware CI/CD (implemented; verify on current commit)

- Preserves the original push/PR release workflow with full regressions and lockfile installs (`npm ci` for root and dashboard).
- Adds **Project-aware QA Runs** (`.github/workflows/project-tests.yml`): manually select a registered project, environment, suite and browser; invalid combinations fail before dependency installation.
- Adds an explicit **weekly Monday 03:17 UTC** safe check running only the local Sample API staging simulator (no public hosts or production).
- CI dispatch deliberately rejects remote targets and never takes arbitrary scripts, shell arguments or test paths. Separately approved remote staging needs a future review before GitHub-hosted runner execution.
- Adds structured `reports/ci-selection.json` evidence, per-run artifact uploads with 14-day retention and independent test-module coverage.
- CLI preflight and selection unit tests are part of the existing `npm run test:server` CI gate. **Actual manual-dispatch workflow** requires a separately initiated run and must not be reported as passed solely from the main push workflow.
- **Next:** Module 9 onboards an authorized separate application and verifies project-specific UI/API behavior rather than generic uptime alone.

## Module 9 milestone — external QA practice pilots (partially accepted)

- Added two opt-in, exact-host approved public practice targets: JSONPlaceholder REST API and The Internet browser automation examples.
- Each has eight real, requirement-ID-tagged safe tests, versioned coverage manifests and `npm run pilots:validate` for offline traceability checks.
- Dashboard lists both pilots but disables launch; only explicitly approved CLI executions can reach an external target. Scheduled and manual-dispatch CI remain local-only.
- **Pending:** Actual Playwright evidence from the public endpoints and validation of a user-owned or explicitly authorized business application. No external requests are made during normal CI.

## P1 — Reliability and coverage (next)

| Work | Definition of done |
| --- | --- |
| Test data isolation | Each scenario can run in parallel without depending on another test, and resets its own data or stubs |
| API contract validation | Schema assertions cover success/error responses, types, required fields and currency in paise |
| Run reproducibility | Lockfile installs with `npm ci`, deterministic versions where needed, and CI artifact retention policies |
| CI failure diagnostics | Test logs, screenshots, videos and traces are accessible for failed runs with a reproducible issue checklist |
| Stronger accessibility | Automated axe checks plus keyboard and screen-reader spot checks; document known limitations |

## P2 — Operator dashboard experience

| Work | Definition of done |
| --- | --- |
| Clear/retain history | Protected reset action with confirmation and ability to delete one run; no accidental data loss |
| Export results | Download JSON/CSV summaries from real run data, with no secrets in output |
| Compare runs | Trends by browser and suite; failures/retries/flaky outcomes are classified accurately |
| Error resiliency | Better feedback when browser install, server start, test execution or report generation fails |
| Test discovery | Search/filter cases by tag and project from generated metadata; no arbitrary command execution |

## P3 — Deeper quality engineering

| Work | Definition of done |
| --- | --- |
| Security baseline | Input/response boundary tests, safe log redaction, local-only dashboard origin checks and documented threat model |
| Visual regression | Carefully reviewed and deterministic screenshot baselines across desktop/mobile sizes |
| Coverage measurement | Documented functional/API coverage matrix, meaningful gaps and negative-path priorities |
| Performance baseline | Small repeatable load/latency suite, with environment notes and thresholds; not exaggerated as production benchmarking |

## P4 — Optional specialties (separate workstreams)

- **LLM evaluation:** add an isolated evaluation dataset and metrics (e.g. groundedness, hallucination, injection resistance) only when there is a real LLM feature and meaningful evaluation data. Do not claim these exist today.
- **Appium mobile automation:** add a separate Android test target and Appium runner only when device/emulator setup, mobile flows and CI capacity are available; browser emulation is **not** native Appium coverage.
- **Hosted multi-user service:** requires authentication, authorization, isolated workers and safe queueing before any deployment; the current dashboard must stay on localhost.

## Release procedure (every change)

1. Check branch and working tree: `git branch --show-current`, `git status`.
2. Make one coherent change; update implementation, tests, and docs together.
3. Execute `npm run test:server`, `npm run typecheck`, `npm run lint`, and `npm test`.
4. Inspect failures, browser screenshots, and the release diff; do not hide failures with weaker assertions.
5. Commit to `main` only when the intended files are staged. Push and verify GitHub Actions.
6. Record commit SHA, run URL, pass/fail summary, and any environment limitations.

**Honesty rule:** distinguish locally executed checks, GitHub Actions checks, and work that is still planned. A feature is only "verified" once evidence exists for its relevant acceptance criteria.
