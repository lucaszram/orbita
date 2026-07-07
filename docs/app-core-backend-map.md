# App Core V4.7 — Mapa de conexión con backend

Cómo cada pantalla del **App Core** (código en `feature/web`, diseño en la página Figma `UX V4.7 - Órbita App Core Flows`) se conecta al contrato de Convex.

> Regla de flujo (`WORKFLOW.md` §4): el front consume `useQuery(api.x.y)` vía `anyApi`; si falta una función, la propone en `convex/CHANGELOG.md` + stub en `schema.ts` y trabaja contra un **mock tipado** hasta que el backend la implemente.

**Estado del front:** todas las pantallas están construidas y funcionando contra un mock tipado local (`src/domain/appData.ts` + `readingEngine.ts`). Falta reemplazar el mock por las funciones Convex de abajo.

## Tipos (contrato)
- Existentes (Web B0): `src/services/appRefs.ts` — `PublicDailyHome`, `NatalChartPayload`, `TransitDetailPayload`, `PlaceLookup`.
- Nuevos (App Core): `src/services/appCoreRefs.ts` — `SynastryPayload`, `SynastryAddInput`, `CalendarMonthPayload`.
- Mock actual: `src/domain/appData.ts` (`CartaData`, `TransitosData`, `VinculoData`, `PerfilData`, `LunarData`) — formas UI que el backend debe poder alimentar con los payloads de arriba.

## Nav (5 tabs) → dato → función

| Tab / pantalla | Ruta código | Dato | Función Convex | Estado |
|---|---|---|---|---|
| **Inicio** (Home) | `app/(tabs)/index.tsx` | lectura diaria de hoy | `readings.getToday` / `readings.generateToday` → `PublicDailyHome` | existente |
| **Carta** (overview) | `app/(tabs)/carta.tsx` | tríada + casa destacada | `charts.current` → `NatalChartPayload` | existente |
| ↳ Carta / Posiciones | `app/reading/carta.tsx` | placements por planeta/casa | `charts.current.payload.placements` | existente |
| **Tránsitos** (hoy) | `app/(tabs)/transitos.tsx` | tránsito destacado + secundarios | `transits.getToday` → `TransitDetailPayload` | **propuesta (Web B0)** |
| ↳ Tránsitos / Por área | `app/reading/transitos.tsx` | lecturas por área (Amor/Trabajo/Vínculos/Energía) | `PublicDailyHome.transits` + `topics` | existente |
| **Vínculo** (overview) | `app/(tabs)/vinculo.tsx` | energía compartida | `relationships.synastry` → `SynastryPayload` | **propuesta (App Core)** |
| ↳ Vínculo / Agregar | `app/reading/vinculo-add.tsx` | alta de la otra persona | `relationships.add` (input `SynastryAddInput`) | **propuesta (App Core)** |
| ↳ Vínculo / Resultado | `app/reading/vinculo-result.tsx` | Fluye/Fricciona/Energía/Acción | `relationships.synastry` → `SynastryPayload` | **propuesta (App Core)** |
| **Perfil** | `app/(tabs)/perfil.tsx` | datos de nacimiento + plan | `users.current`, `birthData` (existente), `subscriptions.getCurrent` | existente |

## Módulos (cuelgan de Inicio / secundarios)

| Módulo | Ruta código | Dato | Función | Estado |
|---|---|---|---|---|
| Lectura larga | `app/reading/long-read.tsx` | deep read del día | `PublicDailyHome.longRead` | existente |
| Profundizar (deep dive) | `app/reading/deep-dive.tsx` | detalle señal del día | `PublicDailyHome.modules` | existente |
| Void / Preguntas | `app/reading/void.tsx` | pregunta del día + sugeridas | `PublicDailyHome.modules.question` + `void` | existente |
| Fase lunar / Calendario | `app/reading/calendario.tsx` | grilla mensual + lunar | `calendar.getMonth` → `CalendarMonthPayload` | **propuesta (App Core)** |
| Guardadas | `app/reading/saved.tsx` | lecturas guardadas | `readings.listSaved` / `savedReadings` (existente) | existente |
| Paywall / Plus | `app/reading/plus.tsx` | planes + entitlement | `subscriptions.*` (existente) | existente |

## Estados (transversales)
`src/components/orbita/states.tsx` — Cargando (query loading) · Vacío (sin datos: guardadas, vínculo sin perfil) · Error (`provider.status`/`error` de `PublicDailyHome`) · Bloqueado (gating por `subscriptions.getCurrent` = free).

## Funciones que faltan (pedido App Core al backend)

Se agregan a lo ya propuesto en Web B0 (`transits.getToday`, `places.resolve`, `charts.valuesMap`, `charts.personalityReading`).

1. **`relationships.add({ name, birthDate, birthTime?, birthPlaceLabel? }): { relationshipProfileId }`** — alta de la otra persona (usa tabla `relationshipProfiles` existente). Idealmente reusa `places.resolve` para el lugar.
2. **`relationships.synastry({ relationshipProfileId }): SynastryPayload`** — energía comparada entre la carta del usuario y la del perfil. **Requiere banco editorial de sinastría.** Sin promesas de resultado relacional (guardrail `AGENTS.md`).
3. **`calendar.getMonth({ month }): CalendarMonthPayload`** — grilla por fecha (tono de energía + días intensos) + capa lunar (fase/signo/acción). Motor por rango de fechas + timezone; cache mensual.

## Notas
- Los `payload: v.any()` no validan forma: el **tipo TS del front es el contrato**. Cambios de forma → `convex/CHANGELOG.md`.
- Vínculo y Calendario dependen de que exista carta natal calculada (`charts.calculateOrCreateNatalChart`).
- El front seguirá contra `src/domain/appData.ts` (mock tipado) hasta que existan las 3 funciones.
