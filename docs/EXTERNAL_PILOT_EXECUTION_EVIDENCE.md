# External QA practice pilots — verified execution evidence

> **Portfolio evidence record.** Results below are from the developer/operator's Windows CMD output and Playwright HTML-report screenshots, shared after **actual local executions**. This document was prepared from those records; the GitHub release did **not** rerun the external targets. These are public practice services, **not a client-owned business application**.

## Executive summary

| Metric | Recorded evidence |
| --- | --- |
| Test systems | [The Internet](https://the-internet.herokuapp.com/) (website); [JSONPlaceholder](https://jsonplaceholder.typicode.com/) (REST API) |
| Execution dates | 4–5 November 2026, local India time (IST) |
| Framework | Playwright + TypeScript, project-aware runner, restricted read-only profiles |
| Repository revision used on the operator's PC | `main`, fast-forwarded to `04c9ca7` before the external runs (as shown in the supplied CMD logs) |
| Distinct acceptance cases | **16**: PWEB-01–PWEB-08 and PAPI-01–PAPI-08 |
| Recorded runs | **4**: website full suite twice, API smoke once, API full suite once |
| Recorded case executions | **26/26 passed** (8 + 8 + 2 + 8); includes repeated cases, not 26 distinct assertions |
| Failed / flaky / skipped | **0 / 0 / 0** in the supplied summaries and HTML screenshots |
| Execution location | Developer's **local Windows machine**; remote targets accessed via explicit CLI opt-in |
| GitHub Actions | Automated CI checks the framework and **local** fixtures; the external pilot suites are **not** run in CI |

**Scope of this result:** successful external QA *practice* runs. It establishes that the framework ran project-specific browser and HTTP contract tests against two independent public sandbox services. It does **not** establish production readiness or validation of an application owned by an employer/client.

## Test runs and observed outcomes

| Date (IST) | Profile / target | Configuration | Result from operator's log | Duration |
| --- | --- | --- | --- | --- |
| 4 Nov 2026 | `pilot-the-internet` — website | `staging`, `ui`, `chromium` | **8 passed**, no reported failures | **41.0 s** |
| 4 Nov 2026 | `pilot-the-internet` — website (repeat) | `staging`, `ui`, `chromium` | **8 passed**, HTML report shows 8 passed, 0 failed, 0 flaky, 0 skipped | **38.3 s** |
| 5 Nov 2026 | `pilot-jsonplaceholder` — REST API (smoke) | `staging`, `smoke`, browser `all` | **2 passed** | **1.3 s** |
| 5 Nov 2026 | `pilot-jsonplaceholder` — REST API (full) | `staging`, `api`, browser `all` | **8 passed**, HTML report shows 8 passed, 0 failed, 0 flaky, 0 skipped | **2.3 s** |

The website HTML screenshot shows the Chromium report with all eight cases passing. The API HTML screenshot shows the `api` project with all eight cases passing. Timings above are the **Playwright total run durations** displayed in CMD; case-level timings differ. No external CI run is being inferred from these screenshots.

### Website acceptance coverage

Source: [`projects/pilot-the-internet/tests/safe/ui/site.spec.ts`](../projects/pilot-the-internet/tests/safe/ui/site.spec.ts), mapped by [`pilot-coverage.json`](../projects/pilot-the-internet/pilot-coverage.json). All eight cases passed in **both** recorded Chromium runs.

| ID | Verified behavior | Result |
| --- | --- | --- |
| `PWEB-01` | Landing page exposes test examples | Passed twice |
| `PWEB-02` | Link navigation loads checkbox screen | Passed twice |
| `PWEB-03` | Checkboxes respond to browser actions | Passed twice |
| `PWEB-04` | Dropdown selection changes its value | Passed twice |
| `PWEB-05` | Table contains sample rows and expected customer | Passed twice |
| `PWEB-06` | Numeric input accepts an entered number | Passed twice |
| `PWEB-07` | Successful status route returns HTTP 200 | Passed twice |
| `PWEB-08` | Missing status route returns HTTP 404 | Passed twice |

### REST API acceptance coverage

Source: [`projects/pilot-jsonplaceholder/tests/safe/api/contracts.spec.ts`](../projects/pilot-jsonplaceholder/tests/safe/api/contracts.spec.ts), mapped by [`pilot-coverage.json`](../projects/pilot-jsonplaceholder/pilot-coverage.json). Both smoke cases (PAPI-01 and PAPI-02) also passed in the later full run.

| ID | Verified behavior | Full API result |
| --- | --- | --- |
| `PAPI-01` | Post lookup returns contract fields | Passed |
| `PAPI-02` | User lookup returns identity contract | Passed |
| `PAPI-03` | Listing posts filtered by user respects parent ID | Passed |
| `PAPI-04` | Nested post comments belong to requested post | Passed |
| `PAPI-05` | Todo item contract contains boolean completion | Passed |
| `PAPI-06` | Filtered user albums respect their owner | Passed |
| `PAPI-07` | Missing post returns HTTP 404 | Passed |
| `PAPI-08` | Unrecognized user filter returns empty collection | Passed |

**Negative testing:** PWEB-08 intentionally checks that an HTTP 404 page returns status 404; PAPI-07 intentionally checks a missing post returns HTTP 404; PAPI-08 checks that an unknown user filter returns an empty collection. These expected negative responses count as **passing assertions**, not application failures.

## Execution and safety procedure (Windows CMD)

From the repository root (each command entered separately):

```bat
git status
git pull origin main
npm run projects:validate
npm run pilots:validate

set QA_REMOTE_APPROVAL=the-internet.herokuapp.com
node scripts/run-project.mjs --project pilot-the-internet --environment staging --suite smoke --browser chromium --allow-remote --dry-run
node scripts/run-project.mjs --project pilot-the-internet --environment staging --suite ui --browser chromium --allow-remote
set QA_REMOTE_APPROVAL=

set QA_REMOTE_APPROVAL=jsonplaceholder.typicode.com
node scripts/run-project.mjs --project pilot-jsonplaceholder --environment staging --suite api --browser all --allow-remote --dry-run
node scripts/run-project.mjs --project pilot-jsonplaceholder --environment staging --suite smoke --browser all --allow-remote
node scripts/run-project.mjs --project pilot-jsonplaceholder --environment staging --suite api --browser all --allow-remote
set QA_REMOTE_APPROVAL=
```

Observed checks: repository clean and up to date for the API pilot; **six** valid project profiles; `npm run pilots:validate` confirmed **eight mapped test IDs per pilot**; both hosts passed the explicit-approval **dry run** (which does not contact the targets). The operator cleared `QA_REMOTE_APPROVAL` after each pilot. The website full suite was executed **twice**.

The framework marks these as `staging` **policy environments**, not claims about each provider's infrastructure. Both public-sandbox projects are read-only (`GET`/`HEAD`), require exact-host CLI approval, and deliberately do not expose a dashboard Run action. Browser tests run with Chromium only in these recorded executions.

## Evidence inventory and reproducibility

| Evidence item | Where it was observed / retained |
| --- | --- |
| Website execution | User-supplied Windows CMD transcript, two full `8 passed` summaries (41.0 s and 38.3 s) |
| Website Playwright report | User-supplied screenshot of `localhost:9323`: Chromium, 8 passed, 0 failed, 0 flaky |
| API smoke and complete execution | User-supplied Windows CMD transcript: `2 passed (1.3s)` and `8 passed (2.3s)` |
| API Playwright report | User-supplied screenshot of `localhost:9323`: project `api`, 8 passed, 0 failed, 0 flaky |
| Website report location on operator's computer | `playwright-report/pilot-the-internet/staging/` |
| API report location on operator's computer | `playwright-report/pilot-jsonplaceholder/staging/` |
| Source and case coverage | Versioned project configuration, restricted specs, and `pilot-coverage.json` files |

**Evidence custody:** The user shared the screenshots and CMD output for review in the project conversation. The raw local reports, screenshots, and log files were **not** imported into the Git repository or GitHub Actions artifacts. Their continued availability depends on the operator retaining them; this Markdown record is a reviewed *summary* of that evidence, not a downloadable raw-result archive. Rerunning Playwright will overwrite the relevant local report location.

To reopen each local HTML report (if retained):

```bat
npx playwright show-report playwright-report/pilot-the-internet/staging
npx playwright show-report playwright-report/pilot-jsonplaceholder/staging
```

## Risk, limitations, and interpretation

1. **Practice systems only.** The Internet and JSONPlaceholder are third-party, publicly hosted learning services. There is no client contract, private business workflow, employee experience, or owner-supplied requirement set in this record.
2. **Browser scope is Chromium only.** The website pilot has not been evidenced here on Firefox, WebKit, native Android/iOS, or assistive technology.
3. **Read-only coverage.** These tests deliberately exclude writes, logins, payment workflows, file uploads, high-volume/performance testing, penetration testing, and a full accessibility assessment.
4. **External service variability.** Availability, public sample data, selectors, latency and rate limits may change; a future failing result requires triage before being labeled an application defect.
5. **Source-review boundary.** Exact-host approval and safe test folders are defense-in-depth controls, not a network sandbox for untrusted code. Run only reviewed, permitted cases.
6. **CI distinction.** Normal GitHub Actions verifies quality checks, the dashboard and bundled/local Playwright targets. **It does not contact either external practice service**, and a green CI badge must not be presented as proof of the two local external pilot runs.
7. **Evidence retention.** Raw reports are local; no timestamped, tamper-evident artifacts were uploaded to GitHub. The observed pass count is not a reliability/stability guarantee beyond these four runs.

## Assessment and follow-up

**Practice pilot decision: PASS**, limited to the 16 reviewed cases and recorded local executions. No failing cases or reproducible defects were reported in the supplied evidence. This does not prove that either third-party application has no defects.

**Next acceptance gate:** Obtain an authorized business staging URL and true functional requirements, document scope/permission privately, onboard with the Module 10 readiness checks, and gather a separate, appropriately protected execution report. Do not relabel these public-sandbox results as employer/client production QA.

Related documentation: [Pilot setup and safety](REAL_PROJECT_PILOT.md) · [Secure execution](SECURE_EXECUTION.md) · [Module 10 onboarding](REAL_PROJECT_ONBOARDING.md) · [Verification history](VERIFICATION.md) · [GitHub Actions](../.github/workflows/playwright.yml).
