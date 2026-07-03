# Project Context

## What This Project Is

Órbita is a premium astrology app in progress. The product direction is a personalized mobile experience built from birth date, birth place, birth time, natal chart, daily transits, daily guidance, and a paid onboarding unlock.

The project currently has two parallel tracks:

- A technical Expo/React Native MVP inherited from an earlier project name.
- A newer product/design direction in Figma under the brand `Órbita`.

When code or older docs contradict the current product docs, follow the Órbita docs.

## Current Source Of Truth

- Stable product context: `docs/contexto-actual.md`.
- Figma/design context: `docs/figma-context.md`.
- Work rhythm and design rules: `docs/ritmo-trabajo.md`.
- Asset rules and naming: `docs/assets-needed.md`.
- Decision history: `docs/decision-log.md`.
- Technical map: `docs/architecture.md`.
- Current handoff/status: `CURRENT_TASK.md`.

## Current Product Direction

- Brand: `Órbita`.
- Tone: Argentine voseo, short, natural, editorial, precise.
- Mix: 70% Co-Star, 30% Moonly.
- From Co-Star: editorial rhythm, air, tables/diagrams, concise authority, dry mystery.
- From Moonly: clear onboarding, commercial clarity, before/after, payment progression.
- Visual style: dark premium, black/charcoal, subtle copper, orbital geometry, sober astrology.

Avoid generic mysticism, cheap tarot aesthetics, fake reviews, press logos, deterministic claims, and placeholder-heavy screens.

## Figma State

- Current Figma file: `BEB5v6SbgJn2Nipm8Qa0wE`.
- Current onboarding page: `UX V4.3 - Órbita Onboarding Copy`.
- Current app core page: `UX V4.5 - Órbita App Core`.
- Current asset library page: `UX V4.6 - Órbita Asset Library`.
- Historical pages such as V2, V3, V5, intermediate copy explorations, and prompt-only pages are not source of truth unless the user asks to inspect them.

Current onboarding flow is `01-15`, with a single payment screen at the end of onboarding. Extended in-app paywall ideas are historical/future, not the current onboarding payment.

## Important Folders

- `app/`: Expo Router screens and navigation.
- `app/(tabs)/`: tab screens for Home, Explore, Relationship, Journal, Profile.
- `src/components/`: reusable React Native UI components.
- `src/domain/`: zodiac/domain types, deterministic reading engine, random helpers.
- `src/content/`: local content catalog used by the MVP.
- `src/services/`: Supabase adapter, local storage, notifications.
- `src/hooks/`: app state and profile requirements.
- `src/theme/`: theme and typography tokens.
- `supabase/`: initial database schema.
- `test/`: TypeScript tests.
- `docs/`: living project context and process docs.
- `assets/orbita/`: generated and catalogued visual assets for Órbita.

## How To Run

```bash
pnpm install
pnpm start
pnpm ios
pnpm android
pnpm test
pnpm typecheck
```

Notes:

- The app can run with local fallback data.
- Supabase is optional until credentials are configured in `app.json` or `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- This workspace may not be a git checkout from `/Users/lucas/Documents/horoscopo`; inspect before assuming git state is available.

## Known Conventions

- Work pantalla por pantalla.
- Define exact copy and screen role before designing.
- Keep UI copy editable in Figma; do not bake copy into images.
- Use assets as integrated visuals, not random decoration.
- Treat PNGs without real alpha as backgrounds/crops, not stickers.
- For functional UI symbols, prefer editable/vector Figma assets.
- Keep AM/PM as editable UI, never as a bitmap.
- Preserve raw asset inboxes; classify copies into selected/rejected/reference.

## Things Codex Often Gets Wrong Here

- Treats any previous project name or intermediate exploration as current brand. They are not.
- Designs before locking copy and screen structure.
- Adds too many cards, grids, badges, or placeholders.
- Copies Co-Star or Moonly too literally instead of using them as references.
- Leaves English UI text in final screens.
- Uses `NASA/JPL` or `astrología védica` without a real product decision.
- Assumes old prompt pages are current Figma source of truth.
- Uploads every generated image instead of selecting, cropping, and rejecting.
- Treats RGB PNGs as transparent stickers.
