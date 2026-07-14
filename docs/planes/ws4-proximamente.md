# WS4 · Esconder lo grande, sin mentir — Vínculo + Calendario (frontend)

**Objetivo:** dos features no tienen backend viable para hoy (Sinastría y el grid mensual del Calendario). En vez de mostrar mock/mentira (siempre "Escorpio + Libra"; grid clavado en "Julio 2026, día 6"), mostrá un estado **"Próximamente"** honesto y elegante.

**Archivos (SOLO estos):** `app/(tabs)/vinculo.tsx`, `app/reading/vinculo-result.tsx`, `app/reading/calendario.tsx`. NO toques `app/reading/luna.tsx` (es de WS3).

## Vínculo — `app/(tabs)/vinculo.tsx` + `app/reading/vinculo-result.tsx`

Hoy: hero falso `☉ Escorpio ⟷ ☉ Libra` (`vinculo.tsx:13`) y resultado fijo (`vinculo-result.tsx`), todo desde `useAppData().vinculo`. 
- Reemplazar por un estado **Próximamente** con la identidad de la marca: explicar qué va a traer ("Compará tu carta con la de otra persona: dónde fluyen y dónde chocan"), sin datos inventados. Sacá el par Escorpio+Libra y los textos fijos.
- CTA: deshabilitado o un "Te avisamos cuando esté" (sin acción de red). No navegar a `vinculo-result` con data falsa; podés dejar `vinculo-result` como una vista "Próximamente" también, o que el CTA no lleve a nada.
- Usá el patrón de estado del kit (mirá `EmptyState`/`LockedState` en `src/components/orbita/states.tsx`) y tokens de `src/theme/orbita.ts`.

## Calendario — `app/reading/calendario.tsx`

Hoy: grid mensual desde `useAppData().lunar` con `intense`/`moonPhases`/`today` hardcodeados (`src/domain/appData.ts:158-172`), mes "Julio 2026", "hoy"=día 6.
- El grid mensual real necesita agregación de tránsitos por día (caro, no entra hoy). Reemplazá el grid por un estado **Próximamente** ("El calendario del mes está en camino"), o degradá a una vista mínima honesta.
- NO muestres un mes/día fijo como si fuera real. Si dejás algo de calendario, que no mienta la fecha.
- La fase lunar **del día** la cubre la pantalla Luna (WS3) — podés linkear a `/reading/luna` desde acá si querés.

## Reglas
- Honestidad ante todo: mejor "próximamente" que data inventada. Es para testeo interno.
- `AGENTS.md`: voseo, sin claims prohibidos, sin inglés visible. Tokens desde `src/theme/orbita.ts`. Reusá el kit, no inventes componentes nuevos si hay uno que sirve.
- **NO corras `pnpm typecheck` ni `pnpm test`.** **NO toques** archivos fuera de la lista.
