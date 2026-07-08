# WS5 · Barrido de bugs + estados + Home (frontend)

**Objetivo:** limpiar los bugs visibles que un usuario notaría y completar los estados loading/empty que hoy faltan.

**Archivos (SOLO estos):** `src/domain/appData.ts`, `app/(tabs)/index.tsx`, `app/(tabs)/perfil.tsx`, `app/reading/valores.tsx`, `app/reading/rueda.tsx`, `app/reading/carta.tsx`.

## Bugs de plan / entitlement — `src/domain/appData.ts`

1. `buildPerfil()` (`:153`) hardcodea `plan: "Órbita Plus · activo."` como default del mock → un invitado/free ve "Plus activo" (incoherente con free). Cambialo a un default de free (ej. "Plan gratuito." o "Órbita · gratis"). Para testeo interno todos son free.
2. `mergeLiveAppData` (`:225`) compara `docs.subscription.entitlement === "plus"`, pero el backend migró a `orbita_pro`. Aceptá **ambos** (`"plus" || "orbita_pro"`) para mostrar el plan pago, si no → "Plan gratuito." Mantené la coherencia con el default nuevo del punto 1.

## Home — `app/(tabs)/index.tsx`

Los 4 `InsightRow` (`:70-81`) tienen `body` hardcodeado que finge estado real, sobre todo `:71` "Luna creciente · tu mes en energía" (fase lunar inventada). 
- Cambiá los subtítulos a algo **genérico-verdadero** que no afirme un estado astral falso (ej. descripción de qué es cada sección), o derivá de data real si está a mano. Lo importante: que no diga "Luna creciente" si no lo sabemos.

## Perfil — `app/(tabs)/perfil.tsx`

- El label de plan ya viene del merge real; asegurate de que refleje el fix de arriba (no "Plus activo" por default).
- Opcional/menor: agregar un link a `/login` para usuarios existentes (hoy solo hay signOut). Si es rápido y limpio, hacelo; si no, dejalo.

## Estados loading/empty — reading screens

`app/reading/valores.tsx`, `rueda.tsx`, `carta.tsx` hoy, en modo live, caen a mock **en silencio** si la query devuelve `undefined`/`null` (un invitado y un error de red se ven igual). Replicá el patrón de `CartaLive` (`app/(tabs)/carta.tsx:27-58`): `undefined` → `LoadingState`, `null` → `EmptyState` (con CTA a completar datos), y solo con data real mostrar el contenido; guest sigue con mock. Estados en `src/components/orbita/states.tsx`.

## Reglas
- `AGENTS.md`: voseo, sin claims destino/salud/dinero/legal, sin inglés visible. Tokens desde `src/theme/orbita.ts`.
- NO cambies la firma de `useAppData` ni el merge más allá de lo indicado; cambios quirúrgicos.
- **NO corras `pnpm typecheck` ni `pnpm test`.** **NO toques** archivos fuera de la lista (ojo: NO toques `app/(tabs)/transitos.tsx` ni `vinculo.tsx` — son de otros WS).
