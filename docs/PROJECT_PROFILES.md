# Module 1 — project registry and environment profiles

**Implemented on:** 2026-11-04. This is the first implementation step toward multi-project testing; project-aware execution is scheduled for Module 2.

## What this module does

A **profile** describes a website, REST API or hybrid application and its explicitly allowed target origins, environments, supported test categories and optional credential *environment-variable names*. It is data only. The registry does not fetch any website, run API calls, install dependencies, or execute Playwright. The current dashboard continues to run the existing Northline Goods test suite.

The former **Good Form** brand has been changed to **Northline Goods**; its local URLs, login labels, test selectors, API paths and deterministic product data are unchanged. Its project ID is `northline-goods` while the existing source directory remains `demo-app/` to preserve backwards compatibility.

## Registered profiles

| Project ID | Type | Status | Base URLs |
| --- | --- | --- | --- |
| `northline-goods` | hybrid (website + REST API) | configured | `http://127.0.0.1:4173` (local fixture) |
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
Validated 2 project profile(s):
- northline-goods | hybrid | configured | local
- starter-api | api | template disabled | staging
Profiles validated only; target tests are not executed in Module 1.
```

While `npm run dashboard` is running, you can also inspect the **read-only** endpoint: `http://127.0.0.1:4300/api/projects`. The response intentionally excludes target URLs and credential environment-variable names. It reports `executionMode: "demo-only"` because the dashboard's execution engine has **not** been rewired to select projects yet.

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

`SAMPLE_USERNAME` and `SAMPLE_PASSWORD` are **environment-variable names**, not credentials. Never commit real passwords, tokens, cookies, or API keys. Add variable names to `.env.example` if useful; use a local ignored `.env` file or a CI secrets store for values. Later modules will implement secure injection, log redaction, and separate per-project test directories.

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

## Next step — Module 2

Implement the **project-aware runner**: resolve a validated profile/environment to approved test directories, fail safely on disabled/missing configurations, and run a selected project's own suite without executing another project's tests. Add an authorized second project and preflight error handling. Only then connect a project selector to the dashboard's Run button.
