# Contributing to the automation framework

1. Install Node.js 20+, run `npm install`, then `npx playwright install`.
2. Start by reviewing the [beginner guide](docs/BEGINNER_GUIDE.md) and [test plan](docs/TEST_PLAN.md).
3. Add/modify application behavior in `demo-app/` when practicing a new feature.
4. Put reusable selectors and browser actions in `src/pages/`; add API calls in `src/services/`.
5. Keep test data in `src/data/`. Keep tests independent and use names that describe the user-visible result.
6. Use `@smoke` only for critical paths, `@regression` for broad repeated checks, and `@negative` for error/invalid-input cases.
7. Run `npm run test:server && npm run typecheck && npm run lint && npm run test:chromium` before opening a PR.
8. Review CI artifacts when a browser or API assertion fails; fix root causes rather than hiding failures with arbitrary waits.

This is a safe learning target. Never add real secrets, credentials, access tokens, `.env`, `node_modules`, or generated reports to version control.
