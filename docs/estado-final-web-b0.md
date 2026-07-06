# Órbita Web B0 — Estado final + handoff

Snapshot del estado al cierre de la integración front-back. Para retomar sin releer todo.

## 🌐 Live
- **https://orbita-lac-three.vercel.app** — deployado, real, verificado.
- Deploy: `npx vercel@latest deploy --prod --yes --scope lucas-projects-8587db0f` (por CLI, sube el working tree). Envs en Vercel: `EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.

## Qué es real (todo, logueado → live por defecto)
| Pantalla | Fuente real | Nota |
|---|---|---|
| Carta natal | `charts.current` (AstrologyAPI western) | rueda con grados reales; fixer de hora en `/carta` |
| Valores | `charts.valuesMap` | derivado de la carta |
| Personalidad | `charts.personalityReading` | derivado + editorial |
| Tránsitos | `transits.getToday` (action, `natal_transits/daily`) | begin/exact/end |
| Home diaria | `home.getDaily` (+ dispara `transits.getToday`) | saludo con nombre, triángulo de `charts.current`, voz v2 |
| Sin sesión | mocks (`src/content/*Mock.ts`) | demo estable |

## Arquitectura del front (dónde tocar)
- **`src/components/web/live.tsx`** — `LiveGate` (mock vs live auth-aware: logueado→live por defecto, spinner mientras resuelve el handshake Convex, nunca salto mock→real) + `LiveBoundary` (cae al mock si una query falla) + `LiveLoading`.
- **`src/services/appRefs.ts`** — contrato tipado de las funciones Convex (`appApi` reales, `proposedApi`). `charts.calculateOrCreateNatalChart` y `transits.getToday` son **actions** (useAction).
- **Mappers** (payload real backend → forma de pantalla): `mapNatalChart` en `orbita-chart.tsx`, `toHomeView`/`triadFromChart` en `orbita-home.tsx`. Si el backend cambia forma, se ajustan acá.
- Auth: `src/hooks/useOrbitaAuth.ts` (Clerk + Convex). Nav avatar en `web-nav.tsx`.
- Onboarding: `orbita-onboarding.tsx` (escribe carta real: `places.resolve` → `completeBirthData` → `calcChart` action → `genToday`).

## Git
- Branch: `feature/web`. Todo el trabajo de la sesión **commiteado** (`cf71413` feat live data, `9603227` docs, `1a4bae2` untrack higgsfield).
- Remoto: `github.com/lucaszram/orbita` — `origin/main` = snapshot orphan viejo (`46dcb2fc`), `origin/feature/api` = backend de Codex (`872d405`).

## Remanentes (con dueño + acción)

### 📋 Rediseño del onboarding — GUARDADO (después)
Plan completo en `~/.claude/plans/fluffy-questing-adleman.md`. Requiere reiniciar Claude Code para cargar el **MCP de Mobbin** y referenciar flujos reales. Los 4 problemas: espacio muerto, visuales pobres, reveal débil, se siente formulario.

### 🛰️ Copy iteración 2 — Codex
`modules.energy` de la home repite `header.subheadline` (ambos "Casa 8: profundidad, confianza y cambio"). Que `energy` sea un read propio de energía del día, distinto del subtítulo. Ver `docs/voz-copy-orbita.md`.

### 🧑 GitHub `main` (auto-deploy) — DECISIÓN + PUSH del humano
`origin/main` es un snapshot orphan viejo; `feature/web` diverge (38 adelante, 1 atrás, sin historia compartida) → merge/rebase da add/add masivo. **El deploy por CLI funciona hoy**, así que esto es solo para auto-deploy por push.
- **Opción recomendada (destructiva, coordinar con Codex + App Core):** hacer `main` = estado actual:
  ```
  git push origin feature/web:main --force-with-lease
  ```
  Pisa el snapshot orphan (que igual no es historia real). **Coordinar** antes: afecta lo que ven las otras sesiones en `main`.
- **Alternativa:** seguir deployando por CLI y dejar el auto-deploy para cuando el equipo consolide `main` (una branch `deploy` limpia, o merge coordinado con `feature/api`).

### 🧹 Rewrite de historia git — coordinado, diferido
Pack de 768 MB por los higgsfield en la historia. Ya destrackeados (no crecen más). Para achicar el pack: `git filter-repo`/BFG, pero la `.git` es **compartida entre worktrees** → se hace con acuerdo de las 3 sesiones, no unilateral.

## Cómo verificar rápido
`node_modules/.bin/tsc --noEmit` (ignorar errores de `app/onboarding.tsx` = onboarding NATIVO de App Core, cambio de API Clerk) · `expo export --platform web` · Playwright headless en el scratchpad (`diagnose.js` = ROOT childCount + pageerrors).
