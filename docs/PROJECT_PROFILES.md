# Module 1 — project registry and environment profiles

**Implemented on:** 2026-11-04. This is the first implementation step toward multi-project testing; Module 2 now consumes these profiles for isolated **local-only** execution.

## What this module does

A **profile** describes a website, REST API or hybrid application and its explicitly allowed target origins, environments, supported test categories and optional credential *environment-variable names*. It is data only. The registry does not fetch any website, run API calls, install dependencies, or execute Playwright. The dashboard still defaults to Northline Goods, but Module 2 now routes validated `projectId` and `environment` selections to the correct test root.

The former **Good Form** brand has been changed to **Northline Goods**; its local URLs, login labels, test selectors, API paths and deterministic product data are unchanged. Its project ID is `northline-goods` while the existing source directory remains `demo-app/` to preserve backwards compatibility.

## Registered profiles

| Project ID | Type | Status | Base URLs |
| --- | --- | --- | --- |
| `northline-goods` | hybrid (website + REST API) | configured | `http://127.0.0.1:4173` (local fixture) |
| `sample-api` | REST API | configured | `http://127.0.0.1:4174` (independent local fixture) |
| `starter-api` | REST API | **disabled template** | `https://api.example.test/v1/` (reserved, non-live example domain) |

**Never enable `starter-api` as-is.** Replace its documentation-only URL with an authorized API, update the allowlist and add real project-specific tests in Module 2/4 before execution.

## How to validate

From the repository root:

```bash
npm run projects:validate
npm run test:server
```

Expected validator output:

```text
Validated 3 project profile(s):
- northline-goods | hybrid | configured | local
- sample-api | api | configured | local
- starter-api | api | template disabled | staging
Profiles validated. Use `npm run test:sample-api` to run the independent Module 2 fixture.
```

While `npm run dashboard` is running, you can also inspect the **read-only** endpoint: `http://127.0.0.1:4300/api/projects`. The response intentionally excludes target URLs and credential environment-variable names. It reports `executionMode: "project-aware"`. The server now accepts a selected project, although the graphical project selector is planned for Module 6.

## Profile format

JSON files reside in `projects/<project-id>/project.config.json` and must use `schemaVersion: 1`.

```json
{
  "schemaVersion": 1,
  "id": "sample-web",
  "name": "Sample Web Application",
  "type": "web",
  "enabled": false,
  "allowedHosts": ["staging.example.test"],
  "environments": {
    "staging": {
      "webBaseUrl": "https://staging.example.test/",
      "readOnly": true
    }
  },
  "suites": ["smoke", "ui"],
  "credentialEnv": {
    "username": "SAMPLE_USERNAME",
    "password": "SAMPLE_PASSWORD"
  }
}
```

`SAMPLE_USERNAME` and `SAMPLE_PASSWORD` are **environment-variable names**, not credentials. Never commit real passwords, tokens, cookies, or API keys. Add variable names to `.env.example` if useful; use a local ignored `.env` file or a CI secrets store for values. Module 2 implements separate per-project test directories. Modules 3–5 will implement safer remote target execution, authentication injection, and log redaction.

## Validation rules

- Only `web`, `api` and `hybrid` types; allowed suites must match type.
- Project directory names and profile IDs must match and use safe lowercase identifiers.
- Allowed hosts must be explicit, with no wildcards, paths, embedded credentials or ports.
- Only HTTP(S); unencrypted HTTP is allowed only for localhost/loopback; production requires HTTPS and `readOnly: true`.
- Target URLs cannot contain usernames/passwords, query strings or fragments.
- Unknown keys are rejected rather than ignored, including an accidentally pasted `password` field.
- Disabled templates cannot be selected through the enabled-project lookup function.
- Registry discovery only reads files beneath the checked-in `projects/` directory.
- `readOnly` is a declaration, **not yet an enforcement system**; Module 2/5 will implement runner-side safe operations and explicit authorization.

## Definition of done (Module 1)

- Two differently typed profiles validate and are discoverable.
- Invalid/unsafe configurations fail fast, with automated Node tests covering those cases.
- A read-only dashboard endpoint lists the profiles without credentials or URL disclosure.
- Existing Northline Goods tests and dashboard execution are unchanged.
- GitHub Actions runs `npm run projects:validate`, lint, TypeScript, Node API checks and the Playwright suite.

## Module 2 runner

The local-only project-aware runner and second independent API fixture are implemented. See [PROJECT_RUNNER.md](PROJECT_RUNNER.md). Remote read-only execution remains intentionally disabled until the safety features in Module 5. Module 6 adds the visual project selector.
