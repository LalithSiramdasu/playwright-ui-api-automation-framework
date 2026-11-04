# Multi-Project QA Framework — Module-by-Module Implementation Plan

**Status:** Modules 1 and 2 implemented; Module 3 adds independent browser automation and shared website helpers. Modules 4–9 remain planned. The existing Northline Goods UI/API suite and React dashboard are working reference implementations; arbitrary real websites/APIs are **not** yet onboarded.

**Goal:** A single local QA Control Center that selects an authorized target project and environment, runs meaningful project-specific Playwright browser/API suites, and stores independently attributable reports. Preserve Northline Goods as regression coverage.

## Concept: application under test versus test framework

An application under test (AUT) may have a browser frontend, REST API/backend, and database. The **test automation framework** is separate software that drives browsers or sends HTTP requests, checks expected outcomes, and reports findings. It does **not** need its own frontend. Our optional **React QA Control Center** is an operator UI; the Node runner + Playwright + project test suites are the essential automation components.

### Real-company workflow

1. An authorized application is deployed to **dev/staging** and a profile names its allowed hosts and environment. Test credentials are securely injected; profiles contain no secrets.
2. QA defines intended behavior (requirements, API/OpenAPI contracts, selectors, data setup). A generic URL by itself cannot infer correct functional outcomes.
3. A developer PR, manual action, or explicitly configured schedule selects **project + environment + test suite + browser**.
4. The runner validates permissions/configuration and starts the correct project-specific test adapter. Browser tests navigate/click/assert; REST tests send HTTP requests and validate status/schema/data.
5. Tests provision or isolate their data and clean up after themselves; tests that mutate data run on safe test environments.
6. Playwright records actual status, retries, errors, screenshots/traces/videos (when configured), and structured JSON/HTML reports.
7. Dashboard and CI show results scoped to the selected project/environment; QA diagnoses true defects versus environment or script failures and communicates release risk.

A manual test run is not continuous monitoring. Never run unapproved, destructive or high-volume checks against third-party/production services.

## Architecture target

```text
QA Control Center (React, optional operator UI)
       |
       v
Local Node orchestration API (profiles, validation, safe allowlist, run lifecycle)
       |
       v
Project-aware Playwright runner
   |                        |
   v                        v
Browser UI adapter         REST API adapter
(Page Objects, tests)       (auth, clients, schema tests)
   |                        |
   v                        v
Authorized website         Authorized REST API
       \                    /
        -> isolated reports/artifacts -> dashboard history + CI
```

### Proposed layout (incremental migration; not present yet)

```text
projects/
  northline-goods/
    project.config.json
    tests/ui/
    tests/api/
    pages/
    data/
  pilot-web/
    project.config.json
    tests/ui/
    pages/
  pilot-api/
    project.config.json
    tests/api/
src/core/
  profiles/
  runner/
  fixtures/
  security/
dashboard/
  src/
  server.mjs
docs/
  MODULE_IMPLEMENTATION_PLAN.md
```

Project profiles may be JSON or TypeScript, but must be schema-validated and map to pre-approved test directories. Avoid allowing arbitrary user-supplied shell commands, remote scripts, or file paths.

## Module acceptance plan

| Module | Implement | Concrete output / definition of done | Depends on |
| --- | --- | --- | --- |
| **0 — Baseline and invariants** | Record current Playwright/CI results; document stable Northline Goods selectors, endpoint contracts, analytics and trusted CI. | Existing Northline Goods suite and dashboard remain green; baseline commit and checks recorded. | None |
| **1 — Project registry and environments** (implemented) | Versioned, validated profiles: project ID, name, type (web/api/hybrid), dev/staging URL, allowed hosts, supported suites, test directory, environment-variable names. | At least two profiles load correctly; malformed IDs/URLs/secrets rejected; demo starts as before. | 0 |
| **2 — Project-aware execution engine** | Resolve selected project/environment into a safe, fixed test directory and Playwright config; validate browser/suite combinations; fail safely at preflight; keep one local active run. | CLI starts Northline Goods and a second fixture independently; selecting one never executes another's tests. | 1 |
| **3 — Reusable website automation** | Common browser fixtures, auth-state support, Page Object scaffolds, navigation, useful error/console diagnostics; per-project selectors and assertions. | A second authorized website passes its own login/read-only UI smoke tests; Northline Goods unchanged. | 2 |
| **4 — Reusable REST API automation** | Typed request helpers, auth strategies, bearer/API-key injection through secrets, expected status/JSON/schema validation, positive/negative tests and OpenAPI mapping when available. | A second authorized API passes contract and negative cases with correct failure messages; no hardcoded Northline Goods URLs or credentials. | 2 |
| **5 — Data, secrets and safe test environments** | Fixtures with setup/teardown, unique test entities, optional mocking, local .env guidance, log redaction, production read-only mode and explicit mutation approval. | Tests run in isolation and on repeat; credentials excluded from Git/reports; unauthorized/destructive actions blocked. | 3, 4 |
| **6 — Multi-project dashboard UX** | Project/environment selector, supported suite/browser controls, preflight statuses and project-aware actions. | Operator selects a second project and executes its tests from http://127.0.0.1:4300 with no source edits; unsupported settings clearly explained. | 1, 2, 5 |
| **7 — Structured reports and analytics** | Namespace runs by project/environment/branch/commit; searchable cases, accurate skipped/flaky/retried counts, HTML report links, JSON/CSV export and confirmed deletion. | No cross-project mixing; runs survive restart; logs and artifacts remain attributable and safe. | 6 |
| **8 — CI/CD integration** | Parameterized GitHub Actions for selected project/environment; npm ci, bounded timeouts, secrets, pull request and optional scheduled smoke checks, artifact retention. | Both reference targets have independently verifiable green workflows; induced test failure correctly fails CI and includes evidence. | 3-7 |
| **9 — Real-world pilot and handover** | Onboard one separate user-owned/authorized website and one authorized REST API (or one hybrid app); create documented requirements-to-test matrix, setup and troubleshooting guide. | Real project-specific UI/API assertions pass in local runner and CI; operator can onboard next project without modifying Northline Goods code. | 0-8 |

### Implementation sequence

- **Foundation:** Module 0 → 1 → 2. Primary outcome: a project profile can be chosen safely.
- **First practical automation:** Module 3 and 4 → 5. Primary outcome: meaningful external UI and REST checks, not only reachability.
- **Operator experience:** Module 6 → 7. Primary outcome: real per-project reports and history in the dashboard.
- **Team workflow:** Module 8 → 9. Primary outcome: repeatable automated CI checks and a verified authorized external pilot.

## Example project definition (illustration, not executable config yet)

```json
{
  "id": "sample-web",
  "name": "Sample Web App",
  "type": "web",
  "environments": {
    "staging": "https://staging.example.org"
  },
  "allowedHosts": ["staging.example.org"],
  "testDirectory": "projects/sample-web/tests",
  "suites": ["smoke", "ui", "regression"],
  "credentials": {
    "usernameEnv": "SAMPLE_WEB_USERNAME",
    "passwordEnv": "SAMPLE_WEB_PASSWORD"
  }
}
```

This is a *design sketch*: validation/schema, authentication strategy and test discovery must be implemented before accepting this profile. Example domains are placeholders, not test targets.

## What a test can and cannot discover

A basic website smoke check can observe HTTP availability, initial page rendering and console errors. A basic REST check can verify a documented health endpoint, response status and JSON shape. More meaningful assertions—correct login rules, order totals, permissions, database state, and error handling—must come from application requirements, contracts, and test data. Automated testing does not guarantee bug-free software.

## Safety and operational rules

- Only test applications you own or have explicit authorization to test.
- Prefer staging; for production, strictly read-only opt-in checks with rate limits.
- Never store secrets in JSON profiles, screenshots or Git history; redact logs.
- Only local 127.0.0.1 dashboard in current scope. Public hosting requires separate authentication, authorization and sandboxed workers.
- Never accept arbitrary shell arguments, paths, scripts or unrestricted destinations from the dashboard.
- Preserve existing `main` workflow unless project policy changes; commit one verified module at a time, run full quality gates and inspect GitHub Actions.

## Definition of "reusable MVP complete"

A user can choose Northline Goods or another authorized project, select staging and an applicable suite, launch its own browser/API tests, see accurate project-isolated results, reproduce failures, and view the run in CI. The Northline Goods suite must continue to pass.

## Phase start — Module 0 → Module 1

**Completed:** Module 1 registry, Module 2 local project-aware runner and Sample API, Module 3 reusable browser fixtures and independent Sample Website. **Next:** Module 4 generic REST API adapters, then Module 5 authorization and safe remote execution.
