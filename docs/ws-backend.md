# WS5 · Backend remaining — handoff para Codex (`../orbita-backend`, `feature/api`)

> Terminal BACKEND. Corré esto en `../orbita-backend`. **NO toques `app/**` ni `src/**` del frontend** (territorio de Claude/Web B0). Solo Codex corre `convex dev` / sync.

## Estado actual
- Las 4 funciones nuevas ya están **implementadas y sincronizadas** en Convex dev `dutiful-viper-815`, commit local `9aa6080 feat: publish web b0 and lab backend APIs` en `feature/api`:
  - `charts.valuesMap()` → `ValuesMapPayload`
  - `charts.personalityReading()` → `PersonalityReadingPayload`
  - `transits.getToday({ localDate })` → `TransitDetailPayload`
  - `places.resolve({ query })` → `PlaceLookup` (**action**)
- `pnpm typecheck` + `pnpm test` (38/38) en verde (fuera del sandbox).
- **No hay remoto git** configurado en el worktree.

## Lo que falta (en orden)

### 1. Consolidar el backend (remote / PR / merge)
- Configurar remoto y subir `feature/api` (`9aa6080`). Hoy está solo local. Coordinar con el repo/monorepo que use el equipo.
- Objetivo: que `main` tenga las 4 funciones + el `convex/_generated` al día para que el frontend eventualmente lo consuma por `git pull`.

### 2. Verificar las 4 funciones vivas en dev
- Confirmar contra `dutiful-viper-815` que responden (ej. desde `/lab` en el front, o un script Convex/action). Chequear:
  - `places.resolve` es **action** (el front usa `useAction`).
  - Las formas de payload matchean `src/services/appRefs.ts` (`ValuesMapPayload`, `PersonalityReadingPayload`, `TransitDetailPayload`, `PlaceLookup`) del frontend.

### 3. Sembrar datos reales (clave para test autenticado)
El front puede consumir en modo `?live`/authed, pero las funciones devuelven algo útil solo si existen los datos base. Sembrar para un usuario de prueba (el Clerk user real que se loguee, ej. `lucaszramos11@gmail.com`):
- `birthData` (fecha/lugar/hora) → `charts.calculateOrCreateNatalChart` para tener `natalCharts`.
- `readings.generateToday({ localDate, timezone })` para `dailyReadings`.
- Tránsito diario (`transitReadings`) si `transits.getToday` lo requiere.
- Verificar que `charts.valuesMap` / `personalityReading` derivan bien de la carta sembrada.

### 4. `places.resolve` real
- Configurar credenciales AstrologyAPI en las **server envs de Convex** (no en `EXPO_PUBLIC_*`). Sin esto, `places.resolve` devuelve `not_configured` y el onboarding del front usa sugerencias mock.

## Verificación
- `pnpm typecheck` + `pnpm test` verdes.
- Las 4 funciones responden en dev con datos sembrados.
- El front en `?live` (con Clerk key + sign-in) trae datos reales en home/carta/valores/personalidad/transito.

## Contrato de referencia (frontend)
- Formas de payload y bindings: `../orbita-frontend/src/services/appRefs.ts` (`appApi` + `proposedApi`).
- Mapa pantalla→función: `../orbita-frontend/docs/web-b0-backend-map.md`.
- El front va a **promover `proposedApi` → contrato real** de su lado (WS3); avisar si alguna firma cambia.
