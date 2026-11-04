# Module 8 — Project-aware CI/CD Automation

## What Module 8 adds

The existing `.github/workflows/playwright.yml` remains the full **push/PR release gate**. It builds the React QA dashboard, validates project profiles, runs lint and TypeScript checks, and executes the Northline, Sample API, Sample Website, safe staging and dashboard test suites. Its package installs now use root and dashboard lockfiles with `npm ci`.

The new `.github/workflows/project-tests.yml` is a separate **Project-aware QA Runs** workflow for individual test selections, plus one weekly safe check. It is not a universal website crawler. Project-specific test cases must exist in the repository.

## Manual GitHub workflow

Open **GitHub → Actions → Project-aware QA Runs → Run workflow**, choose the `main` branch and the project/environment/suite/browser. The available projects are `northline-goods`, `sample-api` and `sample-web`. `starter-api` is a disabled template. Unsupported combinations are rejected before dependency installation.

| Example | Project | Environment | Suite | Browser | Result |
| --- | --- | --- | --- | --- | --- |
| E-commerce smoke | `northline-goods` | `local` | `smoke` | `chromium` | Existing Northline UI smoke checks |
| Sample API contract | `sample-api` | `local` | `api` | `all` | API checks without a browser |
| Sample Website cross-browser | `sample-web` | `local` | `all` | `all` | UI tests across Chromium, Firefox and WebKit |
| Safe staging simulation | `sample-api` | `staging` | `api` | `all` | Restricted GET-only local API checks |

This workflow deliberately **does not** pass `--allow-remote` or a remote approval secret. An actual remote staging URL needs explicit app-owner authorization, reviewed read-only tests, private networking controls and a separate CI security review before being enabled.

## Scheduled smoke check

GitHub Actions triggers the weekly job on **Monday at 03:17 UTC** (GitHub may delay scheduled runs). The dispatcher **ignores all project-selection variables** for scheduled events and selects exactly `sample-api / staging / api / all`. That target is `127.0.0.1:4174`, an isolated local Sample API fixture started by Playwright. It checks a read-only simulated staging environment, **not** a real external API or production service. This is not uptime monitoring.

## Local dry-run and execution (Windows CMD)

Run each line separately from the repository root. These settings change only your current terminal session:

```bat
set GITHUB_EVENT_NAME=workflow_dispatch
set QA_CI_PROJECT=sample-api
set QA_CI_ENVIRONMENT=local
set QA_CI_SUITE=api
set QA_CI_BROWSER=all
node scripts/ci-project.mjs --preflight
node scripts/ci-project.mjs --execute
```

Preflight validates the selection and writes `reports/ci-selection.json`, but does not start a server or tests. Execute reruns preflight and launches the existing allowlisted `scripts/run-project.mjs` using `spawnSync` with `shell:false`; the test exit code propagates to CI.

## Safety and reproducibility

- No arbitrary URL, test path, Playwright option, OS command, or credentials are accepted through GitHub workflow inputs. Profiles are reviewed source code.
- `resolveCiSelection()` calls the existing shared `resolveProjectRun()` with remote opt-in **disabled**, so an approved remote profile does not automatically become an approved CI target.
- GitHub job uses `permissions: contents: read`, Node.js 22, `npm ci`, timeout limits and one-at-a-time concurrency. Browser installs are omitted for pure API runs.
- `reports/ci-selection.json` stores project/environment/suite/browser, restricted flag, and GitHub SHA/run ID; it contains **no token/credential value** or target URL. Reports and artifacts have 14-day retention.
- `npm run test:server` tests manual/scheduled resolution, bad selections, disabled projects, metadata sanitization and CLI preflight. It does **not** replace GitHub workflow execution.
- Raw HTML reports and screenshots can contain sensitive data; do not use this public workflow for real remote credentials or private customers. See [secure execution](SECURE_EXECUTION.md).

## Release process and failure diagnosis

1. Push a reviewed change to `main`; the full verification workflow must succeed for that specific SHA.
2. When needed, manually dispatch a scoped project test. Check the selected profile and preflight step first.
3. If tests fail, open the failing step and the `project-qa-<run id>` artifact. The JSON metadata attributes evidence to a project/environment and commit.
4. Distinguish assertion failures from missing browser dependencies, application startup problems and invalid test configurations.
5. Do not bypass a failed preflight, weaken assertions or claim that a manually selected workflow passed until its run actually succeeds.

## Definition of done

Module 8 source and unit tests are complete when the new workflow appears in GitHub, the base push/PR quality suite stays green, and a manually dispatched job successfully runs at least one authorized local target. The weekly job's first actual run is future evidence and is not claimed by unit tests.
