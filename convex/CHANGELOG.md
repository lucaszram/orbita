# Contrato — CHANGELOG

Registro de cambios del **contrato** entre backend (Codex) y frontend (Claude).
El contrato es `convex/schema.ts` + las firmas `args`/`returns` de cada función Convex pública.
El puente de tipos (`convex/_generated/`) se deriva de acá y lo commitea el backend.

**Reglas** (ver `WORKFLOW.md` §4):
- Todo cambio de tabla, campo o firma de función pública se anota acá.
- El cambio de contrato se commitea **solo**, sin mezclarlo con una feature.
- Quien propone un cambio que el otro lado debe implementar deja un stub con `// TODO: pendiente <backend|frontend>`.

**Formato de entrada:**

```
## YYYY-MM-DD — <título corto>
- **Qué cambió:** tabla / función / firma afectada.
- **Por qué:** motivo.
- **Quién lo pidió:** backend | frontend.
- **Estado:** propuesto (stub) | implementado.
```

---

## 2026-07-04 — Inicio del changelog de contrato
- **Qué cambió:** se establece este registro. El contrato vigente es el `convex/schema.ts` actual (tablas: `users`, `onboardingDrafts`, `birthData`, `natalCharts`, `dailyReadings`, `transitReadings`, `savedReadings`, `journalEntries`, `relationshipProfiles`, `notificationPreferences`, `devices`, `subscriptions`, `labSubjects`, `labRuns`, `contentModules`) más las firmas de las funciones públicas existentes.
- **Por qué:** arrancar el flujo multi-agente con un punto de partida explícito.
- **Quién lo pidió:** —
- **Estado:** implementado.

## 2026-07-05 — Funciones para la Web B0 (pantallas de módulos)
- **Qué cambió:** el front (Web B0) necesita 4 funciones públicas que todavía no existen, para alimentar las pantallas de diseño ya construidas en Figma. Formas de payload declaradas en `src/services/appRefs.ts` (`proposedApi`) y mapeo en `docs/web-b0-backend-map.md`:
  - `charts.valuesMap(): ValuesMapPayload` — radar de valores (8 ejes armonía/tensión) derivado de la carta natal. Alimenta la pantalla *Mapa de valores*.
  - `charts.personalityReading(): PersonalityReadingPayload` — secciones editoriales por posición (planeta en signo/casa) + disclaimer. Alimenta *Horóscopo de personalidad*. Requiere banco editorial.
  - `transits.getToday({ localDate }): TransitDetailPayload` — detalle del tránsito destacado (escena, frase por fragmentos, frecuencia/timeline, efecto en la tierra, ventana). Extiende `PublicDailyHome.transits`. Alimenta *Tránsito en el espacio*.
  - `places.resolve({ query }): PlaceLookup` — geocoding + timezone real para el onboarding (hoy sólo existe `publicLab.resolvePlace` para el lab). Alimenta *Entrada de datos*.
- **Por qué:** conectar las pantallas B0 con datos reales derivados de la carta natal; hoy el diseño está listo pero no hay función que lo alimente.
- **Quién lo pidió:** frontend (Claude).
- **Estado:** propuesto (stub). Ver bloque `// TODO: pendiente backend — Web B0` en `convex/schema.ts`. Front trabaja contra mocks tipados hasta que existan.

## 2026-07-05 — Funciones para el App Core V4.7 (Vínculo + Calendario)
- **Qué cambió:** el App Core (5 tabs + detalles, código en `feature/web`, diseño Figma `UX V4.7 - Órbita App Core Flows`) necesita 3 funciones nuevas. Formas de payload en `src/services/appCoreRefs.ts`; mapeo pantalla→función en `docs/app-core-backend-map.md`:
  - `relationships.add({ name, birthDate, birthTime?, birthPlaceLabel? }): { relationshipProfileId }` — alta de la otra persona (usa tabla `relationshipProfiles` existente). Alimenta *Vínculo / Agregar persona*.
  - `relationships.synastry({ relationshipProfileId }): SynastryPayload` — energía comparada entre dos cartas (Fluye/Fricciona/Energía/Acción + overview). Requiere banco editorial de sinastría; sin promesas de resultado. Alimenta *Vínculo / Overview* y *Resultado*.
  - `calendar.getMonth({ month }): CalendarMonthPayload` — grilla mensual (tono de energía + días intensos) + capa lunar (fase/signo/acción). Motor por rango de fechas + timezone. Alimenta *Fase lunar / Calendario*.
- **Nota:** el resto del App Core ya mapea a funciones existentes/propuestas en Web B0: Inicio→`readings.getToday`, Carta→`charts.current`, Tránsitos→`transits.getToday`, Perfil→`users.current`/`subscriptions.getCurrent`.
- **Por qué:** conectar las pantallas del app core (hoy contra mock tipado en `src/domain/appData.ts`) con datos reales derivados de la carta natal + tránsitos.
- **Quién lo pidió:** frontend (Claude).
- **Estado:** propuesto (stub). Ver bloque `// TODO: pendiente backend — App Core V4.7` en `convex/schema.ts`. Front trabaja contra `appData.ts` hasta que existan.
