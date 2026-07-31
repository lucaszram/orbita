# Órbita web public preparation — frontend brief

Implement this work on the existing clean branch `codex/web-public-prep` in the current worktree. Do not create another branch, commit, push, deploy, or modify any environment. Read the repository instructions and preserve existing product patterns.

## Objective

Make the public web surface truthful and launch-ready, and add validation-only CI. This is one isolated PR. It must not alter payment behavior, backend contracts, onboarding paywall state, native behavior, or production.

## Required product changes

1. Update Support so it clearly says an account is required, account deletion is performed from Profile, and email is a help/contact path rather than the deletion mechanism.
2. Use `soporte@orbitaastrologia.xyz` consistently in Support, Privacy, Terms, and the paywall/checkout disclosure area.
3. Add the public `/terminos` route using the existing legal visual system. Terms must state, in clear Argentine Spanish:
   - subscriptions renew automatically;
   - yearly includes a three-day trial;
   - weekly has no trial;
   - cancellation is managed from Profile;
   - access remains until the end of the paid period;
   - refunds follow applicable law;
   - Órbita is entertainment/self-knowledge/daily context and not medical, psychological, legal, or financial advice or guaranteed prediction.
4. Update Privacy to explicitly name Clerk and Google for authentication, Convex for backend/data processing, and Stripe for web payments. Keep it accurate and avoid claims not supported by the product.
5. Add visible links from the paywall to Privacy and Terms, plus a visible support contact. Preserve backend-driven prices and existing checkout behavior.
6. Document in `.env.example` the public web Convex and Clerk variables, `EXPO_PUBLIC_ORBITA_GOOGLE_AUTH`, and that internal tools must remain absent/disabled in public production.
7. Configure the web document for Spanish, canonical `https://orbitaastrologia.xyz/`, and an accurate site description using the smallest Expo Router-compatible implementation. Do not change native behavior.

## CI requirements

Add a validation-only GitHub Actions workflow. It must use a frozen pnpm install, run typecheck, enforce at least 745 tests, run the web export, and run the existing web export size budget. It must not contain a Vercel deployment or production step. Prefer a reproducible, dependency-free test-count gate so the suite runs once.

## Constraints

- Do not edit `convex/**`.
- Do not change `PAYWALL_ENABLED`, commerce mode, prices, plan selection, checkout APIs, or entitlements.
- Do not redesign the legal/paywall screens.
- Do not touch Figma, native publication, Vercel production, Clerk dashboards, or live/test credentials.
- Do not add secrets.
- Keep Argentine voseo and the current Órbita brand guardrails.
- Keep the implementation narrowly scoped and testable.

## Validation

Run `pnpm typecheck`, the full test suite with the 745 minimum, `pnpm build:web`, `pnpm check:web-export`, and `git diff --check`. Report exact files changed, results, and anything still requiring manual configuration. Do not commit or push.
