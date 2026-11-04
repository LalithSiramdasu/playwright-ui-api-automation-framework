# Good Form storefront — design rationale and QA state contract

## Purpose

Good Form is a **local testing fixture** for the Playwright UI/API framework, not a production shop or a simulated commercial success story. The application includes a real Node API, deliberate error handling, and a separate **Experience lab** with predictable UI-state fixtures.

## Visual direction

Chosen from the supplied design video: **Cool Steel Grey**, anchored by midnight charcoal and a restrained vermilion accent. Rather than copying the sample design, Good Form uses an editorial storefront layout appropriate for a compact set of everyday objects.

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

No third-party skill scripts or dependencies are required to run Good Form; the project is intentionally standalone.

## Ten states

The supplied reference video identified the following states. All **10** are selectable from **Experience lab** after sign-in and covered by `tests/ui/states.spec.ts`. They are explicitly **controlled fixtures**; the preview does not pretend to make ten real backend failures happen.

| # | Fixture | Behavior / recovery |
| --- | --- | --- |
| 1 | Empty | Meaningful empty view; navigate to the collection; also occurs for an empty cart |
| 2 | Loading | Content-shaped skeleton placeholders, without unexplained layout jumps |
| 3 | Error | Specific request failure and retry that calls the real catalog API |
| 4 | No internet | Clear reconnection advice; retry checks real `navigator.onLine` |
| 5 | Slow network | Illustrative progress bar and continue action |
| 6 | No search results | Search guidance and filter reset; also reachable via real search |
| 7 | Permission denied | Permission message and an actual file-input fallback (no upload) |
| 8 | Session expired | Return to sign-in; real checkout 401 is also handled |
| 9 | Form validation | Field-specific example; real login uses HTML email and required validation |
| 10 | Success | Confirmation and next step; real checkout gives an actual order ID |

**Integration coverage:** the baseline login/search/cart/checkout tests remain unchanged. Additional tests cover all ten preview states, the session recovery action, a real empty search, and an injected checkout `503` failure that must preserve cart items.

## Run locally

```bash
npm install
npx playwright install
npm run demo:start
```

Open `http://127.0.0.1:4173`, sign in with the README's fake credentials, then open **Experience lab**. The lab requires no database and no third-party services. Run `npx playwright test tests/ui/states.spec.ts --project=chromium` to exercise its fixtures.

The chosen palette is an interpretation of the user-provided video, not an endorsement or affiliation with its creator. No assets from the videos were redistributed or embedded in this repository.
