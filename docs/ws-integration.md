# WS3 · Integración backend (frontend side)

**Dueño:** FRONT. **Archivos:** `src/services/appRefs.ts`, nuevo `src/hooks/useOrbitaAuth.ts`, `.env.local` (Clerk key), `app.json.extra`.

## Tareas
- **Promover `proposedApi` → contrato real** (las 4 ya existen en dev `dutiful-viper-815`): `charts.valuesMap`, `charts.personalityReading`, `transits.getToday`, `places.resolve` (**action** → `useAction`).
- **Fix return types** en `appRefs.ts`: `onboarding.completeBirthData` y `birthData.upsertForCurrentUser` devuelven **Id string**, no `BirthDataDoc`.
- **`useOrbitaAuth` hook** extraído del patrón `orbita-studio.tsx` / `BackofficeLab.tsx` (`useAuth`/`useUser` de `@clerk/expo` + `useConvexAuth` + panel `SignIn` de `@clerk/expo/web`), **sin** el `checkAccess` allowlist. Estados: loading / signed-out (panel sign-in) / connecting / authed.
- **Clerk key:** setear `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` en `.env.local` (lo pasa el humano). Activa `ConvexProviderWithClerk`. **Default sigue mock-first** (Vercel demo sin login); `?live=1`/sign-in para real.
- **Secuencia escritura onboarding** (detrás del gate): `saveDraft` anónimo (clientDraftId) → sign-in → `getOrCreateCurrentUser` → `completeBirthData({clientDraftId,...})` → `calculateOrCreateNatalChart()`.
- Referencia viva: `/lab` ya consume acciones Convex reales.

## Depende de
- Backend (WS5/Codex) con datos sembrados para que `?live` muestre algo real.
- Clerk key del humano.

## Verificación
`tsc` limpio; con Clerk key + sign-in, `/home?live=1` trae `readings.getToday`, `/carta?live=1` trae `charts.current`.
