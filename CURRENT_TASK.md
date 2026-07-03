# Current Task

## Goal

Keep Órbita easy to continue from a fresh Codex thread without depending on old chat history.

The active project work is broader than this file: continue planning/designing the Órbita app, especially the post-onboarding Home/App Core flow and the asset pipeline, while preserving the decisions from the `Planear app de horóscopo` and `Diagramar home en Figma` threads.

## Status

- Startup memory files have been added: `AGENTS.md`, `PROJECT_CONTEXT.md`, `CURRENT_TASK.md`, and `docs/architecture.md`.
- `README.md`, `docs/contexto-actual.md`, `docs/figma-context.md`, and `docs/decision-log.md` were adjusted so the new bootstrap files are discoverable and the old prompt-only Figma page is treated as historical.
- Existing context docs already describe the current product direction, Figma file, onboarding flow, Home V1.1, asset library, Archive 7, Archive 9, and the symbolic asset library.
- The workspace currently does not appear to expose git status from `/Users/lucas/Documents/horoscopo`; `git status --short` reports that it is not a git repository.
- Latest visible thread context shows an active request in `Diagramar home en Figma` to catalog a new `archive (10)` asset batch. Do not assume that work is complete unless you inspect the workspace/docs/Figma state.
- Backend/connections analysis was added in `docs/backend-todo.md`.
- Convex + Clerk was selected and implemented as the new backend/auth foundation. Supabase remains legacy/reference only.
- Base Convex schema and functions now exist for users, onboarding drafts, birth data, natal chart snapshots/stub, readings, saved readings, journal, relationship profiles, notification preferences/devices, subscription stub, and content modules.
- Expo root layout now mounts optional Clerk + Convex providers when `EXPO_PUBLIC_CONVEX_URL` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` are configured; local MVP rendering still works without those envs.
- Figma API inspection in this thread only listed `UX V4.3 - Órbita Onboarding Copy`; `UX V4.5 - Órbita App Core` and `UX V4.6 - Órbita Asset Library` remain documented sources, but were not visible as top-level pages through the Figma tool in this session.
- A new Figma page was created for the onboarding visual pass: `UX V4.4 - Órbita Onboarding Immersive Pass`.
- The V4.4 pass keeps onboarding flow/copy/structure but changes visual treatment so assets read as integrated backgrounds, textures, diagrams, or symbols instead of square image cards.
- Screens `01`, `02`, `03`, `04`, `05`, `06`, `07`, `08`, `09`, `10`, `11`, `12`, `13`, `14`, and `15` were updated in the duplicated Figma page. The strongest changes are `01`, `04`, `08`, `10`, `11`, `12`, `13`, and `15`.
- Direct upload of local PNG assets to the Figma MCP upload endpoint was initially blocked by sandbox networking, but the focused `05-09` onboarding pass succeeded after explicit escalated approval. The broader V4.4 pass still contains some in-file reused fills outside this `05-09` slice.
- Screens `05`, `06`, `07`, `08`, and `09` in `UX V4.4 - Órbita Onboarding Immersive Pass` now use real local project assets: `orbita_daily_texture_b.png`, Archive 10 Sol `idx25`, Archive 10 Horizonte `idx27`, and Archive 10 Anillos `idx15`.
- `09 / Birth Time Picker` now treats `No sé la hora / Usamos una carta aproximada.` as a proper full-width button instead of a split rectangular control.
- `15 / Onboarding Payment / Scroll` in `UX V4.4 - Órbita Onboarding Immersive Pass` was redesigned as a dark premium full-bleed paywall using the real local Archive 7 `idx62` payment asset. Pricing, benefits, how-it-works, legal, and CTA were restyled with glass/dark/copper treatment while preserving the existing editable payment copy.
- A React Native implementation handoff for the V4.4 onboarding beta now exists at `docs/onboarding-v44-react-native-handoff.md`. It maps the `01-15` flow to app implementation, freezes screen copy, lists exact local asset paths, calls out the legacy app onboarding as replaceable, and includes the updated paywall copy direction that avoids transit-heavy claims.
- `app/onboarding.tsx` has now been replaced with the V4.4 Órbita beta flow: 15 screens, local state, editable copy, real selected assets, payment stub, and final `createProfile` into the existing local app state.
- Expo Web support was added so the local beta can be opened in a browser: `react-native-web`, `react-dom`, `@expo/metro-runtime`, and direct `@react-native/assets-registry` for PNG resolution under pnpm.
- iOS Simulator preview is now working through Expo Go SDK 51 on `iPhone 17 Pro`. Extra fix: `expo-linking` was added and `src/services/backendProviders.tsx` now lazy-loads Clerk/Convex only when env keys exist, so local beta mode does not import Clerk native modules.
- Current technical gap: the app is now Órbita-branded in `app.json`, onboarding, storage keys, and visible local screens. Convex/Clerk backend contracts exist, but screens have not yet been migrated from `AsyncStorage` to Convex. Geocoding/timezone provider, real natal chart calculation, App Store/Google Play subscriptions, analytics, and production content workflows remain unimplemented.
- Latest cleanup renamed app config/package/storage to Órbita, updated visible Home/Explore/Journal/Profile/tab copy, fixed unaccented signal copy in local content, and removed literal previous-brand references from active docs.
- Figma page `UX V4.4 - Órbita Onboarding Immersive Pass` now has a visible implementation note: `Órbita / RN beta implementation note`, marking the React Native beta and iOS Simulator verification.
- Convex codegen/dev sync is blocked until the project is linked with `pnpm convex:dev`/`npx convex dev` and `CONVEX_DEPLOYMENT` exists.
- Pixel-perfect React Native pass for onboarding screens `01-04` is implemented in `app/onboarding.tsx`: fixed Figma canvas `393x852`, absolute-positioned local Figma components, fake status/home indicators, real Inter/Newsreader fonts, and direct screen mapping for frames `151:33`, `151:47`, `151:70`, and `151:105`.
- To avoid another responsive reinterpretation, screens `01-04` now use Figma-derived local background/slot assets under `assets/orbita/figma/onboarding-v44/`. These exports are visual crops only; visible copy and UI geometry remain editable React Native.
- Expo Go SDK 51 was installed on `iPhone 17 Pro` Simulator so this SDK 51 project opens correctly. Metro is currently running for this workspace on port `8082` because port `8081` was occupied by another local project.
- Expo/EAS preview setup is now configured for account `lucasssram`: project `@lucasssram/orbita`, EAS project ID `9e91bb5e-e69e-489e-818d-0e377f397147`.
- Android preview build is complete and installable from Expo: `https://expo.dev/accounts/lucasssram/projects/orbita/builds/41da1364-fc7b-40d9-ac70-c244c48332ab`.
- EAS Update branch `preview` is now published so the project no longer shows as empty in Expo Go's branch list: update group `52c16c65-723d-4684-b5c6-a72985f2520d`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/52c16c65-723d-4684-b5c6-a72985f2520d`.
- Expo Go on the physical iPhone showed branch `preview` but marked that first update as not compatible because it was published from the old SDK 51 app while the phone's current Expo Go expects a newer SDK.
- To unblock phone review through Expo Go, the project has been migrated to Expo SDK 57 / React Native 0.86, app version `0.2.0`, runtime policy `appVersion`, and SDK 57-compatible Expo module versions. Publish a new `preview` update after this migration so Expo Go can open it.
- iOS physical-device preview build is not complete yet because EAS requires Apple Developer credentials/ad hoc provisioning for `com.horoscopo.orbita`. The iOS flow reached the Apple login prompt and was intentionally stopped; do not paste Apple passwords into chat.
- A true installed iOS preview build still requires access to a valid Apple Developer team for signing/provisioning. Until that is available, the practical iPhone path is Expo Go + EAS Update on branch `preview`.
- A local Git repository now exists because EAS Build requires Git. The first commits capture the current Órbita beta state and EAS build fixes.

## Decisions Made

- Current brand is `Órbita`.
- Órbita is the only current product brand.
- Previous names and intermediate explorations are historical context only.
- Current design reference mix is 70% Co-Star / 30% Moonly.
- Current onboarding is `01-15` in `UX V4.3 - Órbita Onboarding Copy`.
- Payment is a single onboarding payment screen with weekly and annual plans.
- App Core/Home design lives in `UX V4.5 - Órbita App Core`.
- Asset library lives in `UX V4.6 - Órbita Asset Library`.
- Prompt-only Figma pages are not a source of truth; prompts should live in docs or chat handoff.
- Assets should be selected, cropped, classified, and verified instead of uploaded wholesale.
- Backend planning should treat `docs/backend-todo.md` as the current backlog source for auth, profile, birth data, geocoding, chart calculation, payments, daily readings, journal, notifications, analytics, CMS, and external integrations.
- Backend V1 decision is Convex + Clerk. Do not extend `supabase/schema.sql` for new Órbita work unless there is an explicit product/technical decision to revert.
- Onboarding asset rule for the V4.4 pass: no principal visual should read as a square/rectangle photo pasted onto a background. If an asset is RGB/no-alpha, use it as a full-frame background, low-opacity texture, masked symbol, or integrated diagram.
- `01 / Logo Splash` should use an editable Órbita orbital mark instead of a square logo image.
- For the `05-09` onboarding slice, the selected treatment is `Ritmo mixto`: `05`, `07`, and `09` stay light with `orbita_daily_texture_b` as an atmospheric wallpaper; `06` and `08` use stronger integrated Sol/Horizonte imagery.
- For `15 / Onboarding Payment / Scroll`, the selected treatment is `Full-bleed premium`: use Archive 7 `idx62` as the full-screen background, not as a hero card, and keep all payment copy editable and unchanged unless product explicitly revises it.
- For React Native implementation, use `docs/onboarding-v44-react-native-handoff.md` as the working handoff. Its payment copy intentionally supersedes the current Figma `15` block for the `Qué incluye` / `Cómo funciona` area until Figma is synced.
- First app beta keeps onboarding local/stubbed: no Convex write, no Clerk auth, no real geocoding/timezone, no real chart calculation, and no StoreKit/Play Billing yet.
- For pixel-perfect RN passes, use the Figma frame as source of truth over hand-guessed `Image resizeMode="cover"` crops. If an image fill crop matters, export the specific Figma background/slot node as a local derived asset and keep text/buttons editable in RN.
- A dev-only `debugStep` query param in `app/onboarding.tsx` may be used to open exact onboarding steps in Simulator for screenshots, for example `exp://127.0.0.1:8082/--/onboarding?debugStep=3`.

## Relevant Files

- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- `CURRENT_TASK.md`
- `README.md`
- `docs/contexto-actual.md`
- `docs/figma-context.md`
- `docs/ritmo-trabajo.md`
- `docs/assets-needed.md`
- `docs/onboarding-v44-react-native-handoff.md`
- `docs/backend-todo.md`
- `docs/decision-log.md`
- `docs/architecture.md`
- `docs/symbolic-asset-library.md`
- `.easignore`
- `.gitignore`
- `.npmrc`
- `app.json`
- `eas.json`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `supabase/schema.sql`
- `convex/schema.ts`
- `convex/auth.config.ts`
- `convex/users.ts`
- `convex/onboarding.ts`
- `convex/birthData.ts`
- `convex/charts.ts`
- `convex/readings.ts`
- `convex/journal.ts`
- `convex/relationships.ts`
- `convex/subscriptions.ts`
- `convex/notifications.ts`
- `convex/devices.ts`
- `convex/contentModules.ts`
- `convex/lib/orbita.ts`
- `convex/lib/users.ts`
- `src/services/backendProviders.tsx`
- `src/services/notifications.ts`
- `src/services/supabase.ts`
- `src/services/storage.ts`
- `src/hooks/useAppState.tsx`
- `src/content/catalog.ts`
- `src/domain/readingEngine.ts`
- `app/onboarding.tsx`
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/index.tsx`
- `app/(tabs)/explore.tsx`
- `app/(tabs)/relationship.tsx`
- `app/(tabs)/journal.tsx`
- `app/(tabs)/profile.tsx`
- `assets/orbita/figma/onboarding-v44/backgrounds/`
- `assets/orbita/figma/onboarding-v44/02-benefit-slots/`
- `assets/orbita/core/`
- `assets/orbita/higgsfield/archive-7/`
- `assets/orbita/higgsfield/archive-9/`
- `assets/orbita/higgsfield/archive-10/`
- `assets/orbita/symbolic-library/`

## Next Steps

1. In any new thread, read `AGENTS.md` first and follow it.
2. If continuing design/Figma work, inspect `docs/figma-context.md`, then open the current Figma pages before changing anything.
3. If continuing onboarding visual work, start from Figma page `UX V4.4 - Órbita Onboarding Immersive Pass` and compare against `UX V4.3 - Órbita Onboarding Copy`.
4. If continuing asset work, inspect `assets/orbita/higgsfield/`, `assets/orbita/symbolic-library/`, and any new batch mentioned by the user. Preserve raw files and create manifests/contact sheets/classification folders.
5. If the user wants more exact local Archive 7/9/10 PNGs applied to Figma, use the same explicit-approval upload route that succeeded for `05-09`; do not silently fall back to old in-file fills unless the user asks.
6. If continuing onboarding app implementation, inspect `app/onboarding.tsx` and run the Expo app on small/large iPhone sizes. Next practical slice is pixel-perfect continuation for screens `05-15`, using the same fixed-canvas/Figma-node-export approach when crops matter, not rewriting `01-04`.
7. If continuing backend work, start from `docs/backend-todo.md` and the existing `convex/` modules. Next practical slice: run/link `pnpm convex:dev`, configure Clerk JWT/envs, generate Convex code, then migrate one app flow from `AsyncStorage` to Convex.
8. If continuing device distribution, first publish the SDK 57 `preview` EAS Update and verify it opens in the user's current Expo Go. A true installed iOS preview still needs Apple Developer signing/provisioning; otherwise keep using Expo Go on iPhone and the completed Android preview build.
9. After any meaningful step, update this file with status, decisions, relevant files, next steps, and verification.

## Verification

- Confirmed main docs exist and describe Órbita as current product direction.
- Confirmed workspace files include Expo app, docs, Supabase schema, tests, and asset libraries.
- Confirmed `AGENTS.md` now tells new threads how to bootstrap themselves.
- Confirmed prompt-only Figma page references are marked as historical/non-source-of-truth.
- Confirmed Figma API exposes `UX V4.3 - Órbita Onboarding Copy` and inspected onboarding frames including birthdate, birthplace, base chart, personalizing, account, and payment.
- Confirmed `docs/backend-todo.md` now contains the backend/connections todo list.
- TypeScript passed with direct local `tsc --noEmit`.
- Tests passed with direct local `tsx --test test/*.test.ts`: 12 tests, 0 failures.
- `pnpm test` and `pnpm typecheck` wrappers attempted to run a pnpm install/status check and aborted in no-TTY mode; direct binaries were used for verification.
- `convex codegen --typecheck=disable` was attempted and failed because `CONVEX_DEPLOYMENT` is not set; run `pnpm convex:dev` to link the project before codegen.
- Verified Figma V4.4 onboarding pass with screenshots of the full page and detailed frames: `01`, `02`, `04`, `08`, `10`, `11`, `12`, `13`, and `15`.
- Fixed CTA contrast after screenshot review on dark screens with light CTAs.
- Added editable orbital geometry inside `04 / Daily Guidance` phone after review so the phone no longer depends on an inner square image.
- Verified the focused `05-09` real-asset pass with screenshots of `05`, `06`, `07`, `08`, and `09`, plus a final `09` screenshot after button polish.
- Confirmed Figma image hashes for the real uploaded assets: Daily Texture B `08d5a1cefa31f275148b77a2926c100bead696e2`, Sol idx25 `af326408cc03d06fa9d089655a535433de129522`, Horizonte idx27 `74d9ce51392d50d1129812a6746c64cbf40e1c50`, and Anillos idx15 `f01be82e91d78c2d2c75f3729fee4e3d5dbaef5a`.
- Verified `15 / Onboarding Payment / Scroll` after the full-bleed premium pass with a complete Figma screenshot. Confirmed the real Archive 7 idx62 upload hash is `a15ff7f68be7ee3b494237e742a6d94233ce7f6a`, applied full-screen to the background image node.
- Verified local asset paths and dimensions for the React Native handoff, including `orbita_daily_texture_b.png`, Archive 10 Sol `idx25`, Horizonte `idx27`, Anillos `idx15`, Tránsitos `idx30`, Backplate `idx34`, Before/After `idx53`/`idx81`, and Archive 7 Payment `idx62`.
- After implementing `app/onboarding.tsx`, TypeScript passed with bundled Node: `tsc --noEmit`.
- After implementing `app/onboarding.tsx`, tests passed with bundled Node outside the sandbox after the TSX pipe was blocked in-sandbox: `tsx --test test/*.test.ts`, 12 tests, 0 failures.
- Guardrail search in `app/onboarding.tsx` found no previous-brand text, transit-heavy claim, `NASA`, `védica`/`vedica`, or unaccented signal copy.
- Expo dev server originally crashed inside the sandbox with `ERR_SOCKET_BAD_PORT`; after adding web dependencies and running outside the sandbox, Expo Web is serving at `http://localhost:8081`.
- Native Expo preview was launched successfully with `expo start --ios --localhost --port 8081 --clear`. Verified via simulator screenshot that the app renders the Órbita onboarding on iPhone 17 Pro (`02 / 15`, CTA `Empezar el viaje`).
- Latest TypeScript check passed with bundled Node after the Explore/tab copy cleanup: `tsc --noEmit`.
- Latest tests passed outside the sandbox after the TSX pipe was blocked in-sandbox: `tsx --test test/*.test.ts`, 12 tests, 0 failures.
- Latest guardrail search across `AGENTS.md`, `app`, `src`, app config, package metadata, README, project context, current task, and docs found no previous-brand literal strings and no unaccented signal copy.
- Latest iOS Simulator screenshot confirms Órbita onboarding renders on `iPhone 17 Pro` without the Metro disconnect warning.
- Figma V4.4 was inspected through the plugin API, visible signal copy was confirmed valid for Órbita, and implementation note node `182:2` was created and selected on the V4.4 page.
- Pixel-perfect `01-04` pass: TypeScript passed with bundled Node via `pnpm typecheck`.
- Pixel-perfect `01-04` pass: tests passed outside the sandbox because `tsx` needs a local pipe: `pnpm test`, 12 tests, 0 failures.
- Pixel-perfect `01-04` pass: guardrail search in `app/onboarding.tsx` found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`, and no unaccented `senal`.
- Pixel-perfect `01-04` pass: `git status --short` was attempted again and the folder still does not respond as a git checkout.
- Pixel-perfect `01-04` pass: Figma references were captured from frames `151:33`, `151:47`, `151:70`, and `151:105`; Simulator screenshots were captured at `/private/tmp/orbita-onboarding-01-final.png`, `/private/tmp/orbita-onboarding-02-final.png`, `/private/tmp/orbita-onboarding-03-final.png`, and `/private/tmp/orbita-onboarding-04-final2.png`.
- Pixel-perfect `01-04` pass: Expo Go SDK 51 is installed in the `iPhone 17 Pro` Simulator and the app is open through Expo on `exp://127.0.0.1:8082`.
- EAS setup: `expo whoami` confirmed `lucasssram`; `eas init --force` created and linked `@lucasssram/orbita`.
- EAS setup: added `eas.json`, `owner: "lucasssram"`, EAS project ID, iOS non-exempt encryption flag, `.gitignore`, `.easignore`, `.npmrc`, and pnpm/EAS dependency fixes.
- EAS setup: Android build initially failed because the archive was 2.3 GB; `.easignore` reduced the upload to 1.3 GB.
- EAS setup: Android build then failed on pnpm workspace metadata; adding `packages: ["."]` to `pnpm-workspace.yaml` fixed dependency install on EAS pnpm 9.
- EAS setup: Android build then failed on Gradle resolving `@react-native/gradle-plugin`; adding `node-linker=hoisted` and explicit `@react-native/gradle-plugin@0.74.87` fixed the native build.
- EAS setup: installed SDK 51-compatible `expo-auth-session@~5.5.2` and `expo-web-browser@~13.0.3` to satisfy Clerk peer deps outside Expo Go.
- EAS verification: after the final EAS fixes, TypeScript passed with `pnpm typecheck` and tests passed outside the sandbox with `pnpm test`, 12 tests, 0 failures.
- EAS verification: Android preview build `41da1364-fc7b-40d9-ac70-c244c48332ab` completed successfully; Gradle log showed `BUILD SUCCESSFUL in 6m 32s`, produced `app-release.apk` at 131 MB, and Expo returned the install URL.
- EAS Update verification: `eas update:configure` added `expo-updates`, `updates.url`, runtime version policy `appVersion`, and channel `preview`.
- EAS Update verification: `eas update --branch preview --message "Orbita preview update" --platform all` published update group `52c16c65-723d-4684-b5c6-a72985f2520d` for Android and iOS, runtime `0.1.0`.
- EAS Update verification: `eas update:list --branch preview --limit 5 --json` returned branch `preview` with the new update group. To see it in Expo Go, refresh/reopen the project's branch list.
- EAS Update fixes: direct dependencies `expo-asset` and `babel-preset-expo` were added because pnpm did not expose them to Expo export unless they were declared explicitly.
- SDK 57 migration verification: `pnpm typecheck` passed with bundled Node.
- SDK 57 migration verification: `pnpm test` passed with bundled Node, 12 tests, 0 failures.
- SDK 57 migration verification: `pnpm exec expo install --check` reported dependencies are up to date.
- SDK 57 migration verification: `expo export --platform all` completed for web, iOS, and Android at `/private/tmp/orbita-sdk57-export-check2`.
