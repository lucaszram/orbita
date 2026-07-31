# PR — Web runtime asset optimization

## Ownership and scope

You are the frontend/assets owner for this task. Work only in this existing branch and worktree. Do not create another branch, do not commit, do not push, do not open a PR, and do not deploy. Codex will review, validate, commit, and publish the final change.

Read `AGENTS.md`, `CLAUDE.md`, `PROJECT_CONTEXT.md`, `CURRENT_TASK.md`, `docs/contexto-actual.md`, `WORKFLOW.md`, `docs/proceso-desarrollo-y-releases.md`, `docs/figma-context.md`, `docs/ritmo-trabajo.md`, and `docs/assets-needed.md` before editing.

Frontend/assets territory is allowed. Never edit `convex/**` or regenerate Convex files.

## Objective

Reduce the Expo web export to at most 50 MB without changing product behavior or visual composition. Preserve every raw input. Runtime must use optimized derivatives.

## Required implementation

1. Preserve all existing source PNG files byte-for-byte. Never replace, rewrite, move, or delete them.
2. Reuse the existing JPG derivatives in `assets/orbita/optimized/core/**` for all runtime imports that still point at the seven heavyweight core PNGs.
3. Create visually equivalent JPG or WebP derivatives under a clear subdirectory of `assets/orbita/optimized/**` for the six Archive 10 PNGs still imported at runtime:
   - onboarding moon, Saturn, and heart assets;
   - web landing/studio moon phase, Scorpio emblem, and orbital ring-system assets.
4. Update only the corresponding runtime asset maps/imports. Preserve the exact semantic slot, crop behavior, aspect ratio, and alt text.
5. Remove the heavyweight web icon from runtime/export without changing or overwriting the native app icon. Use a web-specific optimized derivative/configuration if necessary. The exported icon must also comply with the image limit.
6. Add a dependency-free reproducible script, exposed through `package.json`, that validates an already-built `dist` directory and fails when:
   - total export size is greater than 50 MB;
   - any emitted runtime image is greater than 500 KB;
   - compressed application JavaScript is greater than 1.25 MB.
   The JavaScript check must target the actual application entry bundle, not fonts or source maps, and should print readable measured values and offending files.
7. Add focused tests for the size-check decision logic if it is factored into testable helpers. Do not weaken existing tests.
8. Update `CURRENT_TASK.md` with exact changed files, before/after measurements, test results, visual QA evidence, and any residual limitation.

## Known current heavyweight runtime imports

- `src/content/webAssets.ts`: six core PNGs and three Archive 10 PNGs.
- `src/onboarding/assets.ts`: two core PNGs, of which Carta overlaps the landing set, plus three Archive 10 PNGs.
- `src/components/web/web-nav.tsx` and Expo config: `assets/icon.png` is currently emitted at about 1.76 MB.

Do not assume this list is exhaustive. Audit the built `dist` output and all static runtime imports.

## Acceptance and validation

- `pnpm typecheck`
- `pnpm test`
- `pnpm build:web`
- the new size-limit script against `dist`
- `git diff --check`
- visual comparison with no missing images, distorted crops, layout changes, console errors, or horizontal overflow for:
  - onboarding `/empezar` at 390x844 and 1440x900;
  - Home `/home` at 390x844 and 1440x900;
  - Carta `/carta` at 390x844 and 1440x900;
  - Tránsitos `/transito` at 390x844 and 1440x900;
  - public landing `/` at 390x844 and 1440x900.

Do not redesign anything and do not hide regressions by removing imagery. No production deployment.
