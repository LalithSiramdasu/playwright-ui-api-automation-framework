
# QA Control Center frontend — implementation and contract inventory

**Design iteration:** 5 November 2026 · **Application:** local QA operator console, not a public SaaS product.

## Evidence-based backend capability inventory

| Endpoint (source: `dashboard/server.mjs`) | Real operation | Frontend usage | Trust/scope |
| --- | --- | --- | --- |
| `GET /api/health` | Node version, Playwright readiness, active run ID | Header, Environment and run-button disabled state | Loopback-only |
| `GET /api/projects` | Sanitized enabled/disabled projects, environment names and remote/read-only flags | Project/environment selector; remote launch disabled | No credentials or target URLs returned |
| `GET /api/suites` | Allowlisted suite metadata | Suite selector and catalog | Supported options filtered by registered profile |
| `GET /api/runs` | Actual persisted run summaries and active run | Overview KPIs, history, reports | Client scopes by project and environment |
| `POST /api/runs` | Start approved local run with projectId, environment, suite, browser | Run selected suite | Shared server-side preflight; no arbitrary shell command |
| `GET /api/runs/:id` | Structured results, logs, counts and case errors | Execution details | Only known runs |
| `POST /api/runs/:id/cancel` | Request cancellation of active test | Stop run | Only active run ID |
| `GET /api/runs/:newer/compare?with=:older` | Compare two same-scope completed runs | Reports compare | Server rejects mismatched scope |
| `GET /api/exports?projectId=…&environment=…&format=csv\|json` | Sanitized scoped summary download | Export links | Does not include case logs/errors |
| `DELETE /api/runs/:id`, `DELETE /api/history` | Confirmed removal of local history and reports | Reports management | Trusted origin, confirmation, active-run block |
| `GET /reports/:id/…` | Run-specific Playwright HTML report | View report | UUID allowlist and symlink-resistant file boundary |

**Backend status:** VERIFIED against the existing Node source and test suites.

**Roles/authorization:** One local operator only. There is **no login, registration, role model, payments, refresh-token workflow or public multi-user identity API**. Those screens must not be invented. External/public practice pilots may appear in the selectors but **cannot be launched from this dashboard**.

## Information architecture and meaningful actions

| Screen (hash) | Primary task | Data / handlers |
| --- | --- | --- |
| Overview `#overview` | Choose target, inspect real KPIs, select suite/browser and launch | `GET /api/runs`, `GET /api/projects`, `POST /api/runs` |
| Test runs `#runs` | Filter actual executions, inspect cases/logs, cancel active run, open report | `GET /api/runs`, `GET /api/runs/:id`, `POST …/cancel`, `GET /reports/:id/` |
| Test suites `#suites` | Choose only compatible suites for selected project | Project/suite metadata; navigates back to runnable Overview |
| Reports `#reports` | Open actual report, download scoped summaries, compare history or delete with confirmation | Reports, exports, comparison and delete endpoints |
| Environment `#setup` | Inspect real runtime readiness and copy local installation command | Health and project discovery |

Pages use URL hashes so reload, browser Back and bookmarks work without adding a nonexistent server router. The sidebar brand is a genuine link-like home control, and mobile navigation supports a backdrop and Escape.

## Design rationale

| Decision | Reason | Rejected approach |
| --- | --- | --- |
| Warm paper workspace + dark forest navigation rail | A practical test-operations tool benefits from quiet working surfaces, visible grouping and one anchored navigation region | Saturated purple/blue gradient or oversized decorative glass cards |
| Serif *only* for editorial page titles; neutral system UI type for data | Gives a recognizable handcrafted identity without compromising table/readability | Display typography for every metric and form |
| One dark-green execute action, restrained red for destructive actions | Clear action hierarchy and semantic risk cues | Bright accent colors on every interaction |
| Compact grid and tabular numerals | Operators compare repeated passes/fails and durations | Marketing landing-page proportions |
| Flat surfaces, narrow borders, minimal elevation | Professional density with easy visual scan | 3D decoration and constant animations |
| One viewport-aware responsive layout | Navigation becomes a drawer on phones; controls stack and report rows wrap | Pretending the desktop two-column view fits 320px |
| Live metrics only | Keeps dashboards credible; no mocked production success counts | Decorative stat counters that mislead users |

Central color, radius, typography, motion and layout variables live in `dashboard/src/editorial.css`, loaded after existing component styles. No external font download is required.

## Important states

- **Empty:** No data has a descriptive empty state; a filtered-empty history has a real **Clear filters** handler.
- **Loading:** Startup displays a local runner connection message until project discovery completes.
- **Offline / failed data endpoint:** Existing accessible alert shows backend error and offers **Retry dashboard data**. New tests cannot start while readiness is unknown.
- **Permission:** External targets display **Approval required** and the launch action stays blocked; no approval UI is fabricated.
- **Slow test / running:** Polling continues while active runs display real progress and live logs; stop action is available.
- **Validation / conflict:** Backend returns 400/409; action failures remain visible until dismissed.
- **Success:** Real test counts, history and report availability come from the Node backend.
- **Nonapplicable states:** Login expiry, customer cart, payment and multi-user permission workflows do not exist on the QA dashboard.

## Verification and limits

Run `npm run dashboard:build`, `npm run test:dashboard` and the repository's full GitHub Actions workflow. The added tests cover hash navigation, mobile drawer, 320–1440px horizontal overflow and a real filter-reset button. Automated checks are **not** a WCAG 2.2 compliance audit, external penetration test or production deployment approval.

The frontend is still served on `127.0.0.1:4300`, and `dashboard/data/` remains excluded from Git. This change does not introduce authentication, remote CI, new business APIs, third-party services or data migration.

### Visual evidence capture

The browser suite also writes **desktop 1440px overview**, **mobile 390px overview**, and **mobile 390px reports** screenshots to `test-results/qa-editorial-preview/`. GitHub Actions uploads the `test-results` artifact for review; screenshot presence is not equivalent to an independent WCAG or aesthetic certification. The screenshots use CI's fresh local demo data and do not contain a user's saved history.
