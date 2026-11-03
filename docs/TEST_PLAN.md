# Test plan and coverage map

## System under test

Bundled fake-customer **QA Demo Shop** web application and its API. All credentials, product data, and orders are synthetic. The aim is architectural automation practice, not certification of a live storefront.

## Objectives

1. Ensure core customer journeys work (sign-in, browse, search, cart, checkout, logout).
2. Validate API contracts and positive/negative status codes for auth, products, and orders.
3. Detect regressions via repeatable tests, multiple browsers, and CI.
4. Keep tests independent, easy to debug, and runnable without paid external services.

## Coverage matrix

| ID | Feature | Test scenario | Expected result | File | Type |
| --- | --- | --- | --- | --- | --- |
| UI-01 | Auth | Valid sign-in and logout | Shop visible, then sign-in restored | `tests/ui/auth.spec.ts` | UI, smoke, positive |
| UI-02 | Auth | Incorrect credentials | Visible error, login remains | `tests/ui/auth.spec.ts` | UI, negative |
| UI-03 | Auth | Empty required fields | Browser required attributes | `tests/ui/auth.spec.ts` | UI, negative |
| UI-04 | Catalog | Initial inventory | Three products shown | `tests/ui/catalog.spec.ts` | UI, smoke |
| UI-05 | Search | Parameterized inputs | Matching product only | `tests/ui/catalog.spec.ts` | UI, data-driven |
| UI-06 | Category | Stationery filter | Notebook shown | `tests/ui/catalog.spec.ts` | UI, functional |
| UI-07 | Cart | Two items added | Two items; total $34.98 | `tests/ui/catalog.spec.ts` | UI, functional |
| UI-08 | Checkout | Place an order | Confirmation and empty cart | `tests/ui/catalog.spec.ts` | UI, smoke, end-to-end |
| UI-09 | Accessibility | Keyboard tabbing | Focus follows email → password → button | `tests/ui/accessibility.spec.ts` | Basic accessibility |
| UI-10 | Responsive | Mobile viewport | Catalog and cart remain usable | `tests/ui/accessibility.spec.ts` | Responsive |
| API-01 | Auth | Valid login | HTTP 200 + token | `tests/api/auth.spec.ts` | API, smoke |
| API-02 | Auth | Bad password | HTTP 401 | `tests/api/auth.spec.ts` | API, negative |
| API-03 | Auth | Incomplete payload | HTTP 400 | `tests/api/auth.spec.ts` | API, negative |
| API-04 | Products | List catalog | HTTP 200 + seeded products | `tests/api/products.spec.ts` | API, smoke |
| API-05 | Products | Filter by category | One matching item | `tests/api/products.spec.ts` | API, functional |
| API-06 | Products | Nonexistent search | Empty results | `tests/api/products.spec.ts` | API, negative/edge |
| API-07 | Orders | Missing authorization | HTTP 401 | `tests/api/orders.spec.ts` | API, negative |
| API-08 | Orders | Authorized order | HTTP 201 + $60.97 total | `tests/api/orders.spec.ts` | API, smoke |
| API-09 | Orders | Invalid quantity | HTTP 400 | `tests/api/orders.spec.ts` | API, negative |
| IN-01 | Backend | Health / catalog / auth / orders / malformed JSON | Expected statuses and data | `tests/server/demo-api.test.mjs` | Node API integration |

## Execution strategy

- **Commit / PR:** run Node API integration tests, typecheck, lint, then the API suite once, and the UI suite on Chromium, Firefox, and WebKit.
- **Fast smoke locally:** `npm run test:smoke` or `npm run test:chromium`.
- **Broad regression locally:** `npm run test:regression` or `npm test`.
- **Debugging:** run a single test with `--project=chromium`, inspect HTML report, retry traces and failure screenshots.
- **Environment:** default local app port `4173`; use `BASE_URL` only with a compatible deployed copy of the bundled app.

## Risks and limits

The test server has an in-memory token set and order replies; it has no real database or identity provider. This improves deterministic demo behavior but does not model production scale, persistence, auth security, concurrency or payments. Accessibility checks cover only basics, not full conformance. Browser tests require installing Playwright's npm dependencies and browsers.
