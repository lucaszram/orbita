# Architecture

## Overview

This repository is an Expo/React Native app using Expo Router. The implemented app is a technical MVP inherited from an earlier project name; the current product/design direction is `Órbita`.

The app still has local-first behavior for the visible MVP screens, but the new backend foundation is Convex + Clerk. Supabase remains legacy/reference until removed. The domain layer generates deterministic daily/weekly readings so the same user/date/preferences can produce a stable result.

## App Structure

- `app/_layout.tsx`: root Expo Router layout.
- `app/index.tsx`: entry route.
- `app/onboarding.tsx`: inherited onboarding screen.
- `app/backoffice.tsx`: internal Expo Web lab for test subjects, stub model runs, and backend/model inspection.
- `app/(tabs)/_layout.tsx`: tab navigation.
- `app/(tabs)/index.tsx`: Home tab.
- `app/(tabs)/explore.tsx`: exploration/weekly/transit style content.
- `app/(tabs)/relationship.tsx`: compatibility/relationship experience.
- `app/(tabs)/journal.tsx`: saved readings, notes, favorites.
- `app/(tabs)/profile.tsx`: profile, preferences, birth data, notifications.

## Source Modules

- `src/components/`: UI components such as cards, buttons, tags, topic selectors, reading cards, transit cards, relationship cards, and share previews.
- `src/domain/`: astrology/domain types, zodiac helpers, deterministic reading engine, and randomization utilities.
- `src/content/catalog.ts`: local content catalog for MVP readings and modules.
- `src/hooks/useAppState.tsx`: shared app state.
- `src/hooks/useRequireProfile.ts`: profile gating helper.
- `src/services/storage.ts`: local persistence.
- `src/services/backendProviders.tsx`: optional Clerk + Convex provider wrapper enabled by env vars.
- `src/services/supabase.ts`: legacy Supabase client/adapter.
- `src/services/notifications.ts`: notification setup.
- `src/theme/`: theme and text styles.

## Data And Backend

The V1 can still run with local data. Convex + Clerk is the new backend direction:

- Clerk owns auth/session.
- Convex owns app data, user records, onboarding drafts, birth data, chart snapshots, readings, journal, relationship profiles, notifications/devices, subscriptions, and content modules.
- Backoffice Lab V1 uses isolated Convex tables for `labSubjects` and `labRuns`; it is for testing model inputs/outputs only, not production user data.
- Backoffice Astro Lab calls AstrologyAPI from Convex actions only, normalizes chart/transit payloads in `convex/lib/orbita.ts`, stores raw provider output in lab runs, and keeps all final copy as Órbita-owned editorial text.
- Local development is linked to Convex deployment `dutiful-viper-815`.
- Expo uses Clerk through `@clerk/expo`.
- `convex/auth.config.ts` reads `CLERK_JWT_ISSUER_DOMAIN`.
- Expo reads `EXPO_PUBLIC_CONVEX_URL` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- If those env vars are missing, `BackendProviders` falls back to rendering the app without remote providers so local development still works.
- `/backoffice` also requires a Clerk session whose email is allowlisted in `ORBITA_BACKOFFICE_ALLOWED_EMAILS`; local-only development may use `ORBITA_BACKOFFICE_ALLOW_ALL=true`.

Convex modules live in `convex/`:

- `schema.ts`
- `users.ts`
- `onboarding.ts`
- `birthData.ts`
- `charts.ts`
- `readings.ts`
- `journal.ts`
- `relationships.ts`
- `subscriptions.ts`
- `notifications.ts`
- `devices.ts`
- `contentModules.ts`
- `backoffice.ts`
- `lib/astrologyApi.ts`
- `lib/backoffice.ts`
- `lib/orbita.ts`
- `lib/users.ts`

Supabase is legacy/reference only. Existing schema is in `supabase/schema.sql` and includes:

- `content_templates`
- `tarot_cards`
- `weekly_energy_days`
- `transit_events`
- `share_card_templates`
- `saved_readings`
- `user_profiles`

## Assets

Órbita assets live under `assets/orbita/`.

- `assets/orbita/core/`: selected Home/App Core assets already generated and used in Figma.
- `assets/orbita/higgsfield/archive-7/`: catalogued batch with inbox, selected, rejected, contact sheets, and manifest.
- `assets/orbita/higgsfield/archive-9/`: style-reference batch.
- `assets/orbita/symbolic-library/`: canonical symbolic asset catalog and Batch 1 prompts.

Rules:

- Preserve raw input files.
- Use manifests and contact sheets for review.
- Treat RGB PNGs as backgrounds/crops unless real alpha is confirmed.
- UI symbols should become editable/vector assets where possible.

## Design System Direction

Current design direction is documented in:

- `docs/contexto-actual.md`
- `docs/figma-context.md`
- `docs/ritmo-trabajo.md`
- `docs/assets-needed.md`

Short version:

- dark premium astrology,
- black/charcoal base,
- subtle copper,
- editorial layout,
- orbital geometry,
- voseo argentino,
- no generic mysticism or fake claims.

## Run And Verify

```bash
pnpm install
pnpm convex:dev
pnpm convex:codegen
pnpm start
pnpm ios
pnpm android
pnpm test
pnpm typecheck
```

Use `pnpm test` for the reading engine tests and `pnpm typecheck` for TypeScript.

## Implementation Notes

- Keep product changes aligned with the current Órbita docs, even if old code names still carry historical naming.
- Do not rename broad technical structures just to match the brand unless the task is a scoped migration.
- Keep changes small and aligned with existing Expo/React Native patterns.
- For content safety, frame outputs as entertainment, self-knowledge, and context.
