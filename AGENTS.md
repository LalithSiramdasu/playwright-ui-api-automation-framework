# Project design and automation guardrails

This is a learning-focused, local QA automation framework. Treat its frontend as an actual UI test fixture with stable contracts, not as a marketing mockup.

## Visual system

- Brand: **Northline Goods**, a compact editorial collection of everyday objects.
- Core palette: charcoal `#17191c`, steel `#929da7`, warm paper `#f5f5f2`, restrained vermilion `#ec5a3e`.
- Preserve layout rhythm, deliberate asymmetry, semantic headings, responsive grids, and accessible focus states.
- Avoid random gradients, stock imagery, fake reviews, unsupported performance claims, inert buttons, and decorative-only controls.
- Provide composed loading, empty, error, and recovery states, including clear action feedback and reduced-motion support.

## Testing contracts — do not break without updating tests

- Sign-in labels: `Email address`, `Password`, button `Sign in`; invalid credentials alert is exactly `Invalid email or password`.
- Shop heading: `Demo Shop`; searchbox name `Search products`; category label `Product category`.
- Cards: `data-testid="product-card"` and `Add to cart` button; cart totals: `data-testid="cart-count"` and `data-testid="cart-total"`.
- Checkout: `Place order` button and an accessible `role="status"` confirmation beginning with `Order confirmed`.
- API endpoints and seeded product IDs/prices stay stable unless tests and documentation are updated together.
- The ten UX states must remain **integrated into real shopping flows**. Do not reintroduce an Experience Lab, demo-state gallery, fake status counts, or buttons that only simulate success.
- Keep UI prices in INR and store/order API prices in integer paise (`pricePaise`, `totalPaise`). Changes to these contracts must update UI, API, test data, and assertions together.

## Design references

See `docs/STORE_DESIGN.md` for the supplied color and 10-state videos and the publicly reviewed skill references (web-design-engineer, apple-design, landing-page-design). Reference material does not grant permission to silently install or execute external scripts.

## Quality gates

Run `npm run test:server`, `npm run typecheck`, `npm run lint`, `npm test`, and inspect the UI at desktop/mobile breakpoints. Report what actually passed; never fabricate counts.

## Multi-project migration (Module 1)

- Project profiles in `projects/*/project.config.json` are validated data, never executable scripts or user-defined paths.
- Keep the `starter-api` profile disabled until an authorized target and actual test suite exist.
- The demo shop's historical selectors, API endpoints, and bundled Playwright tests remain stable.
- `GET /api/projects` is read-only discovery; do not claim multi-project execution until Module 2.
- Never store credentials in profiles or return their values via dashboard APIs.

## Module 2 project-aware execution

- The default root `tests/` directory is Northline-only; new projects must use `projects/<id>/tests/`.
- Profiles are **data**, never command definitions or arbitrary file paths. The hardcoded local sample server mappings live in `playwright.config.ts`.
- Module 2 blocks all remote and read-only targets until Module 5 adds reviewed safe-run policy. Do not remove that safeguard merely to make an external test run.
- Keep `node scripts/run-project.mjs` and the dashboard's `POST /api/runs` on the same shared `resolveProjectRun` preflight.
- Module 6 includes a visual project/environment switcher; maintain project-scoped KPIs and keep runner validation authoritative.

## Module 4 REST API testing contracts

- Keep the reusable `src/api/` client independent of Northline and Sample API endpoints.
- Use local fixture credentials only in `projects/sample-api/`; real project secrets belong in environment variables.
- The JSON checker supports a limited subset of JSON Schema, not complete OpenAPI/JSON Schema.
- Do not bypass the runner's local-only restriction before Module 5 authorizes and constrains external targets.
- Maintain old Sample API `/health` and `/api/inventory` contracts and run the full existing suite on each change.

## Module 5 remote-execution and data safety

- Do not weaken `assessTargetPolicy`: production and writable remote targets are always blocked; reviewed remote HTTPS staging needs approved project profile, `--allow-remote`, and exact matching `QA_REMOTE_APPROVAL`.
- Dashboard intentionally cannot execute remote targets. No third-party/nonlocal URLs are run in the default CI workflow.
- Restricted suites live only under `projects/<id>/tests/safe/`; each test must be reviewed for non-mutating behavior. Playwright is not a security sandbox.
- Use `ReadOnlyApiClient` on staging API checks, `TestDataScope` for local mutable test records and cleanup, and never include secrets in Git or raw report screenshots.
- Dashboard log redaction is defense-in-depth. HTML/JUnit/JSON reports and browser traces might contain secrets; do not claim they are fully sanitized.

## Module 6 dashboard project scope

- `GET /api/projects` may return only safe display metadata, including environment read-only/remote flags; never expose URLs or credential variable names.
- All visible run counts, report listings and trend charts must follow the active project and environment. Legacy run records are Northline/local.
- Do not enable unsupported suites or browsers. Do not allow UI controls to opt in to remote execution or bypass server-side approval.
- Keep dashboard e2e checks in `dashboard/e2e/`, outside product UI tests, and verify them separately in CI.

## Module 7 reporting safeguards

- Never mix history across registered projects or environments. Legacy records lacking metadata belong to `northline-goods/local` only.
- CSV/JSON exports are allowlisted summaries, not arbitrary log/report downloads. Escape CSV fields and prevent formula execution.
- Delete actions must require explicit confirmation, reject during active runs, and remove only report artifacts for valid known run UUIDs.
- Preserve deterministic server-side tests with an isolated `DASHBOARD_DATA_DIR`; do not delete a user's actual history during CI.
- The dashboard remains single-user localhost-only; it is not a public hosted service.

## Module 8 project-aware CI/CD

- The push/PR release workflow stays comprehensive; the manual/weekly project workflow is a separate scoped entrypoint.
- Never let a CI input become a shell command, arbitrary script, custom path or remote-approval token.
- Remote/production targets are not executed by GitHub Actions. The weekly schedule uses the local Sample API staging fixture only.
- Any CI feature changes require node preflight tests, GitHub Actions verification on the new commit, and explicit run evidence; a passing push workflow does not prove the manual-dispatch workflow was exercised.
