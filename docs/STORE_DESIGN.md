# Northline Goods storefront — design rationale and QA state contract

## Purpose

Northline Goods is a **local testing fixture** for the Playwright UI/API framework, not a production shop or a simulated commercial success story. The application includes a local Node API and real workflow-level loading, empty, failure and recovery behavior. The UX states are not a separate test gallery.

## Visual direction

Chosen from the supplied design video: **Cool Steel Grey**, anchored by midnight charcoal and a restrained vermilion accent. Rather than copying the sample design, Northline Goods uses an editorial storefront layout appropriate for a compact set of everyday objects.

| Token | Value | Role |
| --- | --- | --- |
| Ink | `#17191c` | Headlines, main actions |
| Steel | `#929da7` | Neutral supporting visuals |
| Paper | `#f5f5f2` | Page background |
| Vermilion | `#ec5a3e` | Small wayfinding accents |
| Success | `#28765f` | Completed operation |
| Error | `#b63e38` | Recovery messaging |

The page uses CSS-drawn product art to avoid external stock image dependencies. Visual treatment includes deliberate asymmetry, compact labels, clear numeric hierarchy, stable skeletons, dark-on-light contrast, keyboard focus rings, semantic labels and responsive layouts. Animated cues respect `prefers-reduced-motion`.

## Reference design skills

The user-supplied image listed six public GitHub repositories containing UI design skills. The following **public skill documents were reviewed as reference material**, rather than installed or executed as code:

- [ConardLi / web-design-engineer](https://github.com/ConardLi/garden-skills/blob/main/skills/web-design-engineer/SKILL.md) — design-system calibration, an intentional redesign, and avoiding repeated generic dashboard patterns.
- [Emil Kowalski / apple-design](https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md) — predictable interactive feedback, interruption and reduced motion.
- [elayadesign / landing-page-design](https://github.com/elayadesign/ai-design-skills/blob/main/skills/landing-page-design/SKILL.md) — content realism, form errors, focus visibility, loading/empty states and no dead controls.

No third-party skill scripts or dependencies are required to run Northline Goods; the project is intentionally standalone.

## Ten integrated shopping states

The ten interaction conditions from the supplied reference are now implemented in the real storefront. There is **no separate gallery**. Playwright exercises unusual conditions with browser networking, request interception, or denied clipboard permissions; the ordinary visitor sees them only when those conditions apply.

| # | User-facing condition | Actual behavior | Automated check |
| --- | --- | --- | --- |
| 1 | Empty cart | Cart explains it is empty and focuses search from its browse action | Cart empty + focus |
| 2 | Loading | Catalog shows content-shaped skeletons while the HTTP request is pending | Delayed catalog request |
| 3 | Error | Failed catalog GET shows a specific message, retains filters/cart and offers a functioning retry | HTTP 503 then successful retry |
| 4 | Offline | Network event shows a persistent connectivity notice, which disappears after reconnection | `context.setOffline()` |
| 5 | Slow network | A waiting notice appears only after a real request delay; it disappears when finished | Delayed GET longer than threshold |
| 6 | No results | No matching catalog items triggers empty-search guidance with working Clear filters action | Unmatched product search |
| 7 | Permission denied | When copying a real order reference is blocked, a selectable manual-copy field appears | Rejected Clipboard API |
| 8 | Session expired | Checkout HTTP 401 sends the user back to sign-in; items are restored after reauthentication | Injected order 401 |
| 9 | Form validation | Required and malformed email inputs show field-specific guidance and `aria-invalid` feedback | Invalid sign-in fields |
| 10 | Success | A confirmed API checkout shows the real order reference, a copy action and a cleared cart | Successful checkout |

There is also an explicit checkout HTTP 503 test ensuring the cart is preserved and an inline error is shown. Product prices are displayed in **INR** using `Intl.NumberFormat('en-IN')`; the API stores integer **paise** to avoid floating-point rounding issues. Seeded objects retain their numeric product IDs and test-safe fake account.

## Verification and limitations

From the repository root:

```bash
npm run test:server
npm run typecheck
npm run lint
npm test
```

For just the real shopping-state scenarios:

```bash
npx playwright test tests/ui/states.spec.ts --project=chromium
```

No external stock assets, real payment processor, persistent customer database or production login system are used. The app is a controlled QA test target, not a commercial storefront. Public GitHub Actions is the release gate for complete Chromium, Firefox, WebKit and API verification.

The chosen palette is an interpretation of the user-provided video, not an endorsement or affiliation with its creator. No assets from the videos were redistributed or embedded in this repository.
