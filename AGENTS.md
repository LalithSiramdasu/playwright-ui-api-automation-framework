# Project design and automation guardrails

This is a learning-focused, local QA automation framework. Treat its frontend as an actual UI test fixture with stable contracts, not as a marketing mockup.

## Visual system

- Brand: **Good Form**, a compact editorial collection of everyday objects.
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
- Every fixture in Experience lab uses `data-testid="state-view"` plus a `data-state` identifier, and has a meaningful recovery action.

## Design references

See `docs/STORE_DESIGN.md` for the supplied color and 10-state videos and the publicly reviewed skill references (web-design-engineer, apple-design, landing-page-design). Reference material does not grant permission to silently install or execute external scripts.

## Quality gates

Run `npm run test:server`, `npm run typecheck`, `npm run lint`, `npm test`, and inspect the UI at desktop/mobile breakpoints. Report what actually passed; never fabricate counts.
