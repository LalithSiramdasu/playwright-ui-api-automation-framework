# Module 4 — Reusable REST API Automation

**Current status:** Implemented for trusted local fixtures. Module 5 is required before execution against authorized remote staging/production APIs. This module does not import an OpenAPI document or provide full JSON Schema coverage yet.

## What was added

- `src/api/api-client.ts`: a per-test Playwright REST client with `get/post/put/patch/delete`, query parameters, per-request headers, bearer tokens and API keys. The client rejects absolute URLs, protocol-relative URLs, CR/LF in credential headers, and `..` path traversal. Redirect following is disabled so a configured service cannot silently redirect test requests to another origin.
- `src/api/fixtures.ts`: injects an independent `apiClient` for every Playwright test.
- `src/api/json-contract.mjs` and `.d.mts`: small dependency-free **JSON Schema subset** validation for objects, arrays, strings, numbers, integers, booleans, null, required keys, enums and simple bounds. Reports field paths without echoing response values.
- `src/api/expect-response.ts`: verifies HTTP status, JSON Content-Type and the response contract.
- `projects/sample-api/tests/api/auth.spec.ts` and `contracts.spec.ts`: local integration scenarios covering bearer and API-key access, response contracts, query parameters and important 4xx errors.
- Expanded `projects/sample-api/server.mjs`: isolated local service with fake account login, bearer-protected account, API-key-protected metrics and query validation. The existing inventory/health/404 behavior remains compatible.

## Run Module 4 locally

From the repository root on Windows CMD:

```bat
npm ci
npm run projects:validate
npm run test:server
npm run test:sample-api
```

The Sample API runs on **127.0.0.1:4174** only during its Playwright suite; its web server is started automatically. For manual requests, run `node projects/sample-api/server.mjs` in another terminal.

To run only the auth/contract tests:

```bat
node scripts/run-project.mjs --project sample-api --environment local --suite api
```

## Usage from another project's REST tests (after safe onboarding in Modules 5 and 9)

```ts
import { test, expect } from '../../src/api/fixtures';
import { expectJsonResponse } from '../../src/api/expect-response';

test('inventory contract @smoke', async ({ apiClient }) => {
  const response = await apiClient.get('/api/inventory', { params: { limit: 1 } });
  const body = await expectJsonResponse(response, 200, {
    type: 'object', required: ['items'],
    properties: { items: { type: 'array', items: { type: 'object' } } },
  });
  expect(body).toBeDefined();
});
```

The import path above is illustrative and must be adjusted for a specific project's test directory. A real project's endpoints, login strategy and **expected business behavior** are part of its own test adapter. They cannot be inferred from only a URL.

## Security and scope limitations

- The `starter-api` profile stays disabled, and the project runner still rejects remote/read-only targets. Do **not** remove that check to force an external service to run.
- The only embedded credentials are deliberately fake **localhost** fixture credentials. The API key may be overridden by `SAMPLE_API_KEY`; for real targets use environment variables / CI secrets, never hard-code credentials.
- Profile `credentialEnv` fields store variable **names**, not values. `requiredCredential(name)` fails with an environment variable name only.
- The contract validator is intentionally a narrow **subset of JSON Schema**, not Ajv/OpenAPI schema validation. Add a maintained standards-compliant validator later if full `oneOf`, `$ref`, formats, patterns or OpenAPI schemas are required.
- Requests from authored test code still must respect scope and authorization; the helper is not a security sandbox. Full redaction, write controls, rate limits and test-data isolation belong to Module 5.
- Trace files and failed request artifacts may contain authentication headers unless redacted. Use only fake local test credentials until Module 5 controls are in place.

## Definition of done

- [x] Reusable HTTP client, per-test fixture, bearer and API-key auth.
- [x] JSON HTTP status, media-type and documented structural contract checks.
- [x] Positive and negative scenarios against a separate API target.
- [x] Node unit/integration tests for the contract checker and sample fixture.
- [ ] Authorized external service onboarding with production safeguards (**Module 5 / pilot**).
- [ ] Standards-compliant OpenAPI/JSON Schema validation (**later enhancement, if needed**).
