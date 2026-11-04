# QA Automation Framework — implementation roadmap

**Target:** a technically credible personal QA portfolio project, not a fake production SaaS app. Keep implementation evidence, API schemas, and test outcomes explicit. The GitHub repository uses `main` as the integration branch; apply new changes only after quality checks and review. A feature branch + PR can be adopted later if collaboration grows.

## Release baseline (implemented)

- Playwright + TypeScript UI/API suite, Page Objects and reusable fixtures.
- A functioning local demo shop and REST API; INR displays with integer paise in API objects.
- The ten real shopping UX conditions (empty, loading, error/retry, offline, slow, no results, denied permission fallback, expired session, form validation, success) plus automated browser cases.
- React QA Control Center that launches allowlisted suites locally, persists actual run results and provides logs and HTML reports.
- GitHub Actions for dashboard build, lint, typecheck, standalone API and full Playwright execution.
- Documentation, setup commands, source control and `.gitignore` for local test history.

## P0 — Turn the framework into a multi-project QA tool (next priority)

**Current gap:** The dashboard and Playwright runner execute real tests, but the UI Page Objects, auth, REST endpoints and test data target Good Form. Setting `BASE_URL` changes the host but does not make the test logic compatible with an unrelated application. This is not a zero-code website auditor or a continuous monitoring service.

**Goal:** Select an authorized web or API project, choose its test environment and test suites, execute its own meaningful checks locally or in CI, and inspect genuinely isolated reports. Keep Good Form as a verified reference target.

### M0 — Project profiles and explicit target safety (foundation)
- Define a versioned, validated project profile, e.g. `projects/<project-id>/project.config.json`, with a display name, type (`web`/`api`), dev/staging URL, applicable test suites, and optional API specification reference.
- Keep application credentials in environment variables or local secret stores; profiles store variable *names*, not secret values. Add `.env.example` guidance and redacted logs.
- Validate project IDs, HTTP(S) origins and allowed target hosts. Never accept shell commands, arbitrary filesystem paths or arbitrary Playwright arguments from the browser.
- Design production-target safeguards: read-only checks by default, explicit consent/allowlists, a clear warning before state-changing tests, and low concurrency.
- **Done:** Two distinct sample profiles can be validated and selected without changing source code or leaking credentials.

### M1 — Generic runner and pluggable project test suites (first usable MVP)
- Make the runner choose a validated project profile and isolated test directory, with `PROJECT_ID` and an explicit environment selector.
- Keep the demo-store suite separate as a project-specific adapter; do not force its selectors/products/credentials onto other applications.
- Provide a *limited* generic smoke pack: target reachable, safe page loads, basic browser errors, and optionally documented API health endpoints. Site-specific functional checks must be authored against that product's actual behaviors.
- Offer well-documented Page Object, authenticated browser context, API client and data-fixture templates for custom test flows.
- **Done:** Independently run Good Form and a second authorized app/API with different URLs, login strategy, selectors and assertions. A failure in one run must not affect the other.

### M2 — Multi-project dashboard and honest results
- Add project selector and environment badge to QA Control Center, with allowed suites/browsers per profile and a preflight check explaining missing configuration.
- Tag every run, screenshot, log and report with project/environment/browser/run ID. Scope history and analytics by project; do not mix counts across projects.
- Show clear states for unsupported suite, missing credentials, unavailable target, skipped tests and runner setup errors.
- Add per-project export (JSON/CSV), retention and deletion controls with confirmation.
- **Done:** From the dashboard, execute both reference projects and inspect separate pass/fail history, test-level diagnostics and report links.

### M3 — Real project CI, maintainability and governance
- Add profile-based GitHub Actions workflows (manual dispatch, pull request, scheduled smoke checks where useful), with secrets in GitHub Actions, no hardcoded auth tokens.
- Prefer `npm ci`, reviewed dependency updates, reproducible test data, retries only for transient issues, and artifacts for failures.
- Add explicit scope/rate limits, safe request defaults and audit-friendly execution metadata. Do not run destructive tests against production.
- **Done:** Both projects pass their independent CI suites; a deliberately broken test produces an attributable failure and downloadable evidence.

### M4 — Pilot and release gate
- Pilot on one **separate, user-owned or explicitly authorized** real web app/API alongside Good Form. Define 5–10 meaningful checks for each app and document limitations.
- Validate browser/UI and API paths, negative cases, auth expiry, isolated test data, and a failure/recovery demonstration.
- **Done:** A new project can be registered and tested following documentation, without editing the original Good Form code; project-level reports survive dashboard restart.

### Not automatic or included at this stage
- A URL alone cannot reveal all business rules, correct expected outcomes, login credentials or safe destructive operations. New projects require onboarding and meaningful assertions.
- On-demand and scheduled test execution is not continuous, instantaneous "real-time" monitoring. Persistent monitoring and alerts would be a separate later capability with explicit opt-in.
- The dashboard stays bound to localhost. Hosting it publicly requires authentication, authorization, isolated execution workers, and stronger safeguards.

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
