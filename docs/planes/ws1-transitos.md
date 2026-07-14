# WS1 · Tránsitos real (frontend)

**Objetivo:** que la pantalla de Tránsitos muestre el cielo REAL del día (no el fijo "☿ en Sagitario ♀ en Leo ☾ en Tauro"). El backend ya existe y funciona (`convex/transits.ts:183`, action `transits.getToday`).

**Archivos (SOLO estos):** `app/(tabs)/transitos.tsx`, `app/reading/transitos.tsx`, `app/reading/transito.tsx`.

## Qué hacer

Patrón de referencia ya resuelto en la web: `src/components/web/orbita-transit.tsx:84` (`TransitWithBackend`). Replicarlo en nativo con `useLiveApp().isLive`:
- Ref a usar: `proposedApi.transitToday` (`src/services/appRefs.ts:335`) — es **action** `{localDate: string} → TransitDetailPayload`. Se invoca con `useAction`, patrón imperativo `useState`/`useEffect` + flag `alive` (o `useRef fired`), como en la web.
- `localDate`: usar el helper de fecha local que ya use la app (mirá cómo la web arma `todayLocalDate()`; en nativo hay `deviceTimezone()` en `src/hooks/useLiveApp.ts:57`). Fecha `YYYY-MM-DD`.
- **Invitado / sin sesión / error / loading**: fallback a los mocks actuales (`transitMock` en `src/content/transitMock.ts`, y `useAppData().transitos` para el tab). Nunca pantalla rota.

### `app/reading/transito.tsx` (detalle)
Hoy importa `transitMock` directo (`:5`, `:13`) y renderiza exactamente la forma `TransitDetailPayload` (`appRefs.ts:177`). Cablear: si `isLive`, traer `data` de `transitToday` y pasar `data` en vez de `transitMock`; loading → spinner/"Leyendo el cielo de hoy…"; error/guest → `transitMock`. La forma calza 1:1, no hay que remapear.

### `app/(tabs)/transitos.tsx` (tab) y `app/reading/transitos.tsx` (por área)
Estas renderizan una **forma-resumen distinta** (`skyLabel`, `planetsRow`, `headline`, `intro`, `destacado`, `porArea: {title,body}[]` — ver `src/domain/appData.ts:115-131`), NO `TransitDetailPayload`. 
- Derivá el resumen del payload real: `planetsRow`/`skyLabel` desde `payload.scene` (transitingBody/natalPoint) o del aspecto; `headline`/`intro` desde `payload.title` + `payload.reading.plain`; `destacado` del aspecto principal.
- `porArea` (lista de varios tránsitos): el backend hoy devuelve **un** tránsito principal, no una lista por área. **No inventes** la lista: mostrá el tránsito principal de forma prominente y, si no hay fuente real para más, ocultá/reducí la lista `porArea` (o dejá solo el principal como fila). Mejor una cosa verdadera que cinco inventadas.
- Guest → seguir con `useAppData().transitos`.

## Reglas
- No exponer como texto los flags internos del payload (`modelGaps`, `reviewStatus`, warnings de proveedor). Son metadata, no contenido.
- Guardrails `AGENTS.md`: voseo, sin claims destino/salud/dinero/legal, sin inglés visible.
- Tokens desde `src/theme/orbita.ts`, no hardcode. Reusá el kit (`src/components/orbita/*`, estados en `src/components/orbita/states.tsx`).
- **NO corras `pnpm typecheck` ni `pnpm test`** (la integración la centraliza el orquestador). **NO toques** archivos fuera de la lista.
- Dejá el código con el mismo estilo del entorno.
