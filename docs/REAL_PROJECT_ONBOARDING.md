# Module 10 — Real-project onboarding toolkit

**Status:** Implemented as an offline scaffold plus a fail-closed readiness gate. **Not** a claim that a user-owned business application has been tested. Modules 1–9 are still available, and all previously registered projects keep their behavior.

## What this module solves

Before Module 10, you had to create and validate project profiles and test directories by hand. You can now generate a **disabled** project with one safe test location and a review checklist, without writing or running code against the destination. A separate readiness command checks the review state, authorization reference, enabled configuration and non-placeholder test sources.

This is for a **website** (`web`) or **REST API** (`api`) you own or have explicit permission to test on staging. For both frontend and backend tests, the framework stays the same; only the application-specific assertions differ.

## Windows CMD: generate a new project (offline)

Use an actual approved staging host only when you have permission. The domain below is illustrative and must not be contacted.

```bat
REM From the repository root: preview which files would be generated
npm run project:onboard -- --project client-catalog --name "Client Catalog QA" --type api --url https://staging.example.org/v1/

REM Create the disabled starter files when the name, URL and type are correct
npm run project:onboard -- --project client-catalog --name "Client Catalog QA" --type api --url https://staging.example.org/v1/ --write

REM Confirm it is safely disabled and not marked ready
npm run projects:validate
npm run project:readiness -- --project client-catalog
```

For a website, change `--type api` to `--type web`. **Preview is the default**; files are written only with `--write`. Existing projects are never overwritten, and the tool makes no network requests. Each command must be run separately.

Files generated under `projects/client-catalog/`:

```text
project.config.json              # enabled:false and remoteExecution.enabled:false
onboarding.json                  # authorization/review state: draft
TEST_PLAN.md                     # product-specific requirements checklist
tests/safe/api/smoke.spec.ts     # Playwright TODO, NOT a passing test
```

For a web app, the last path is `tests/safe/ui/smoke.spec.ts`.

## Turning the placeholder into a tested project

1. Define the application behavior and expected results using the service documentation, OpenAPI spec or confirmed business requirements. Write a meaningful requirement-to-test matrix (at least five useful checks is a good pilot goal).
2. Replace `test.todo(...)` and `ONBOARDING_PLACEHOLDER` in the generated spec with reviewed functional assertions. For website tests, import and use `useReadOnlyOrigin` in `src/web/remote-readonly.ts`. For REST endpoints, use `ReadOnlyApiClient` where practical. Keep the safe suite read-only and low-volume.
3. Confirm actual authorization from the service owner. In `onboarding.json` set `status` to `reviewed`, set `authorization.approvedHost` to the **exact** target hostname, put a reviewer/team identifier in `approvedBy`, and enter a **non-secret** reference in `evidenceReference`. Set the three `review` flags to `true` only after source, requirements and privacy review.
4. Only after approval and the reviews, edit `project.config.json`: change `enabled` to `true` and `remoteExecution.enabled` to `true`. Do **not** weaken `readOnly` or change the environment to production.
5. Run the readiness audit and dry-run preflight. These are offline checks that fail for incomplete onboarding:

```bat
npm run project:readiness -- --project client-catalog
set QA_REMOTE_APPROVAL=staging.example.org
npm run project:run -- --project client-catalog --environment staging --suite api --browser all --allow-remote --dry-run
```

When the actual website or API is approved and you are ready to test it, replace the placeholder hostname with the approved one and run the same project command **without** `--dry-run`. Clear the approval after the test:

```bat
set QA_REMOTE_APPROVAL=
```

For browser tests, use `--suite smoke --browser chromium` instead. Verify results in project-specific `playwright-report/<project>/staging/` and document defects, expected behaviors, and CI evidence. Remote tests are deliberately **not** run by the ordinary automatic GitHub Actions pipeline or the dashboard.

## Readiness and safeguards

The preflight and Playwright config independently check the Module 10 onboarding gate. They refuse a newly scaffolded project unless the review metadata is complete and the placeholder test sources have been replaced. Existing Northline, Sample Website, Sample API and public practice pilots have no onboarding metadata and retain their established controls.

**Limitations:** A checklist is self-attested and cannot independently prove you have authorization or that test assertions are correct. This is not a network sandbox: reviewed trusted test code can still send network requests; safeguards cannot make arbitrary code safe. Use a dedicated low-privilege test account, a controlled staging environment, rate limits, and explicit test data/privacy handling. Do not commit real passwords, authorization tokens, internal-only hosts, customer data or sensitive approval evidence to a public repository. Consider using a private repository for company applications.

## Acceptance checklist

- [x] Generate API and web starter profiles without any remote calls.
- [x] Templates are disabled and safe-test-only until reviewed.
- [x] Reject unsafe URLs, path traversal, overwrites and malformed input.
- [x] Independently prevent premature execution via CLI runner and direct Playwright config.
- [x] Keep existing bundled tests and dashboard endpoints compatible with additional project profiles.
- [ ] Run meaningful tests against one **user-owned or explicitly authorized** business application and collect evidence.
- [ ] Record approved scope, actual expected outcomes, and final release decision for that business pilot.

See also `docs/SECURE_EXECUTION.md`, `docs/PROJECT_PROFILES.md` and `docs/MODULE_IMPLEMENTATION_PLAN.md`.
