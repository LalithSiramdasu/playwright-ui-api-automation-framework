# Module 2 — project-aware Playwright execution

**Scope:** A local-only, allowlisted runner that selects a registered application, validates the environment/suite/browser, and runs only its own Playwright tests. This is not yet an arbitrary website scanner and permits only explicitly authorized read-only HTTPS staging execution via CLI; production stays blocked. Module 5 adds an opt-in, reviewed read-only HTTPS staging gate (see SECURE_EXECUTION.md); production remains blocked.

## What is now working

Two enabled, **independent local test targets**:

| ID | App type | Test root | Local target | Notes |
| --- | --- | --- | --- | --- |
| `northline-goods` | Hybrid UI + API | `tests/` (legacy kept unchanged) | `http://127.0.0.1:4173` | All existing browser and API tests |
| `sample-api` | API-only | `projects/sample-api/tests/` | `http://127.0.0.1:4174` | Independent local server and three API tests |
| `starter-api` | API-only | None | Placeholder HTTPS address | Disabled, intentionally unrunnable |

The project ID is only a validated identifier; the runner determines the test directory by **trusted convention**. JSON profiles cannot provide arbitrary paths, startup scripts or Playwright arguments. For Northline the historic root tests remain compatible with `npm test`, while other projects use `projects/<id>/tests/`.

## Run from your terminal

Install dependencies/browsers as usual (`npm ci`, `npx playwright install`). Run:

```bash
# Check project configuration and the Node test layer:
npm run projects:validate
npm run test:server

# Dry-run preflights: no browsers or API servers launched
node scripts/run-project.mjs --project northline-goods --environment local --suite smoke --browser chromium --dry-run
node scripts/run-project.mjs --project sample-api --environment local --suite api --dry-run

# Actually execute independent project suites:
node scripts/run-project.mjs --project northline-goods --environment local --suite smoke --browser chromium
npm run test:sample-api

# The original Northline suite still works:
npm test
```

The runner starts the appropriate **local fixture server automatically**. You do not have to run `demo:start` separately for automated tests. A `--browser` selection is valid for browser-oriented tests; API-only selections require `all` (no browser). The selected profile's test path, API URL and/or web URL come from validated configuration, not arbitrary request input.

### API access through QA Control Center

Existing dashboard clicks that omit a project continue to execute Northline Goods. The API also accepts a selected project and environment:

```json
POST /api/runs
Content-Type: application/json

{"projectId":"sample-api","environment":"local","suite":"api","browser":"all"}
```

The read-only `GET /api/projects` endpoint returns configured projects (no secret names or URLs) and `executionMode: "project-aware"`. New runs store `projectId` and `environment` alongside their results. A **visual project selector and filtered analytics** remain part of Module 6. Previously saved run records predate these attributes and continue to display.

## How isolation works

1. **Registry:** `src/core/project-registry.mjs` validates data-only project profiles.
2. **Preflight:** `src/core/project-runner.mjs` checks project enabled, environment, read-only mode, suite, browser, local hosts and a physically contained test directory with `.spec` tests.
3. **Execution:** `scripts/run-project.mjs` and `dashboard/server.mjs` launch Playwright via `spawn(process.execPath, fixedArgs)` with `shell: false`, setting an allowlisted `QA_PROJECT_ID` and `QA_ENVIRONMENT`.
4. **Playwright config:** `playwright.config.ts` validates the selected profile again, constrains `testDir`, builds only compatible browser/API projects, assigns per-project UI/API base URLs and starts only a known built-in local fixture.
5. **Results:** CLI runs write to namespaced output directories; dashboard runs already have a unique run ID and include project/environment metadata.
6. **Tests:** The API-only Sample API tests cannot execute Northline's storefront assertions, and Northline's test root cannot discover Sample API tests.

## Security limitations and Module 5 dependency

- **Authorized read-only HTTPS staging is available via CLI only (Module 5)** with a reviewed profile, `--allow-remote`, and the exact target hostname in `QA_REMOTE_APPROVAL`. The dashboard blocks remote starts. No production execution is allowed; see [Module 5 safety guide](SECURE_EXECUTION.md).
- The only local startup commands are hardcoded in `playwright.config.ts` for `northline-goods` and `sample-api`. Remote profiles never carry executable startup commands.
- This is a **single-user local runner** bound to `127.0.0.1`; the React frontend is not a hosted test SaaS.
- Profiles cannot discover website business rules automatically. Subsequent modules add reusable Page Object/API adapters for *authorized* external applications.
- Never commit API credentials, tokens or real login passwords. Modules 3–5 add proper per-project authentication/data setup and redaction.

## Acceptance checklist

- [x] Northline tests preserved and selected by default.
- [x] Separate enabled Sample API profile with different URL and test directory.
- [x] Strict preflight rejects malformed, disabled, wrong-browser, missing-directory and remote selections.
- [x] Project resolution and CLI dry-run are tested with Node's test runner.
- [x] Dashboard routes selected runs to the same validated resolver.
- [x] CI invokes both the original suite and Sample API suite independently.
- [ ] Real-user project selector and project-level charts (**Module 6**).
- [x] Authorized read-only HTTPS staging CLI gate and local test-data isolation (**Module 5**); production remains blocked.

**Verify this module's GitHub Actions result before claiming all cross-browser tests passed for the latest commit.**
