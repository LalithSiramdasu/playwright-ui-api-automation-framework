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
- **Next:** Modules 3–5 add reusable external website/API test adapters, secret handling and authorized remote-target policy. Module 6 provides graphical project selection and per-project analytics.

## Module 3 implementation milestone — reusable website automation

- Shared Page Object helpers, accessible form login, browser-context API-cookie sessions and redacted browser diagnostics in `src/web/`.
- An isolated Sample Website profile with a real local server, guarded pages, project-specific Page Objects, and Chromium/Firefox/WebKit UI scenarios.
- A third independent CI test suite; preserve Northline Goods and Sample API isolation. [Website automation guide](WEBSITE_AUTOMATION.md).
- **Next:** Module 4 REST API clients and contract verification; Module 5 approved remote-target safeguards.

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
