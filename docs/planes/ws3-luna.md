# WS3 · Fase lunar real — Luna (backend + frontend)

**Objetivo:** que la pantalla Luna muestre la fase lunar REAL del día (hoy está clavada en "Julio 2026"). El grid mensual del Calendario NO es parte de esto (lo maneja WS4 → "próximamente").

**Archivos (SOLO estos):** `convex/sky.ts` (nuevo), `app/reading/luna.tsx`. NO toques `convex/schema.ts` (no hace falta tabla; opcional cache más adelante). NO toques `app/reading/calendario.tsx` (es de WS4).

## Backend — `convex/sky.ts` (nuevo)

Action pública `getMoonPhase({ localDate, timezone }) → MoonPhasePayload` (forma en `src/services/skyRefs.ts:28`):
```ts
type MoonPhasePayload = {
  phase: string;        // "Luna creciente"
  phaseKey: string;     // "new" | "waxing_crescent" | "first_quarter" | ...
  sign: string;         // signo lunar del día
  illumination: number; // 0..1
  copy: string;         // copy corto voz Órbita (NO consejo salud/dinero)
  action: string;       // acción segura y chica
};
```
Reusá el transporte genérico `postAstrologyApi` (`convex/lib/astrologyApi.ts:228`) contra el endpoint free `moon_phase_report` (y/o `lunar_metrics`). Patrón de action: mirá `transits.getToday` (`convex/transits.ts:183`) para auth/estructura, aunque acá NO necesitás la carta del user — solo fecha+timezone. Normalizá la respuesta cruda del proveedor a `MoonPhasePayload` y **reescribí `copy`/`action` en voz Órbita** (la API trae claims de salud/dinero/suerte — descartalos). Si el proveedor no está configurado o falla, devolvé `null` (el front cae al mock).

## Frontend — `app/reading/luna.tsx`

Hoy consume `useAppData().lunar` (mock, `src/domain/appData.ts:158-172`) y renderiza `lunar.weekStrip` (`:16`), `lunar.phase` (`:22`), `lunar.copy` (`:23`), `lunar.accion` (`:25`). Cablear con `useLiveApp().isLive`:
- `useAction(proposedSkyApi.getMoonPhase)` (ref ya existe, `src/services/skyRefs.ts:113`) con `{ localDate, timezone }`. Mapeo: `payload.phase`→`phase`, `payload.copy`→`copy`, `payload.action`→`accion`. `weekStrip` no viene del payload → derivalo o dejá el del mock.
- Mock/fallback: `src/content/moonPhaseMock.ts` (`moonPhaseMock`) ya existe y es `MoonPhasePayload`; usalo para guest/loading/error. Para los campos que la pantalla toma de `useAppData().lunar` y no están en el payload, seguí con el mock.
- Loading → estado suave; nunca pantalla rota.

## Reglas
- `AGENTS.md`: voseo, sin claims destino/salud/dinero/legal, sin inglés visible. Tokens desde `src/theme/orbita.ts`.
- El backend lo deploya Lucas; el front usa `proposedSkyApi.getMoonPhase` (`anyApi`), no depende de `_generated`.
- **NO corras `pnpm typecheck` ni `pnpm test`.** **NO toques** `convex/schema.ts`, `app/reading/calendario.tsx`, ni nada fuera de la lista.
