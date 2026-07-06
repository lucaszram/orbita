# Web B0 — Mapa de conexión con backend

Cómo se conecta cada pantalla de la **Web B0** (diseño en Figma, página `WEB B0 - Órbita Home Web`) con el contrato de Convex. Fuente de tipos del front: `src/services/appRefs.ts` (existentes) y `src/services/publicLabRefs.ts` (lab). Contrato: `convex/schema.ts` + firmas de funciones.

> Regla de flujo (ver `WORKFLOW.md` §4): el front consume `useQuery(api.x.y)` vía `anyApi`; si falta una función, la propone en `convex/CHANGELOG.md` + stub en `schema.ts` y trabaja contra un mock tipado hasta que el backend la implemente.

## Flujo de usuario

```
Entrada de datos ──► Carta natal ──► Home diaria ──┬─► Tránsito en el espacio
                                                   ├─► Mapa de valores
                                                   └─► Horóscopo de personalidad
```

## Pantalla → dato → función

| # | Pantalla (Figma) | Dato que consume | Función Convex | Estado | Payload (tipo TS) |
|---|---|---|---|---|---|
| 1 | Entrada de datos (`266:2`) | draft de onboarding; geocoding del lugar; cálculo de carta | `onboarding.saveDraft`, `onboarding.completeBirthData`, `charts.calculateOrCreateNatalChart`, **`places.resolve`** | existentes + `places.resolve` **propuesta** | `OnboardingDraftInput`, `PlaceLookup` |
| 2 | Carta natal (`252:2`) | carta natal del usuario | `charts.current` | existente | `NatalChartPayload` |
| 3 | Home diaria (`225:10`) | lectura diaria de hoy | `readings.getToday` / `readings.generateToday` | existente | `PublicDailyHome` |
| 4 | Tránsito en el espacio (`271:70`) | detalle del tránsito destacado | **`transits.getToday`** | **propuesta** | `TransitDetailPayload` |
| 5 | Mapa de valores (`260:2`) | radar de valores (derivado de la carta) | **`charts.valuesMap`** | **propuesta** | `ValuesMapPayload` |
| 6 | Horóscopo de personalidad (`280:2`) | interpretación editorial de la carta | **`charts.personalityReading`** | **propuesta** | `PersonalityReadingPayload` |

Transversal: `users.current` / `users.getOrCreateCurrentUser`, `subscriptions.getCurrent` (gating Plus), `readings.save`/`unsave` (guardar en diario).

## Funciones que faltan (pedido al backend)

Todas devuelven `payload` derivado de la carta natal + fecha/tránsitos. Formas en `src/services/appRefs.ts` (`proposedApi`).

1. **`charts.valuesMap(): ValuesMapPayload`** — 8 ejes `{ key, label, harmony, tension }` (0..1) + top drivers/stressors + nota. Derivado de la carta (no requiere provider externo nuevo).
2. **`charts.personalityReading(): PersonalityReadingPayload`** — secciones editoriales `{ key, title, intro, placement, body }` + disclaimer. Requiere banco editorial por posición (planeta en signo/casa).
3. **`transits.getToday({ localDate }): TransitDetailPayload`** — detalle del tránsito destacado: escena (cuerpo en tránsito + punto natal), frase por fragmentos, frecuencia/timeline, efecto en la tierra, ventana. Extiende lo que hoy vive resumido en `PublicDailyHome.transits`.
4. **`places.resolve({ query }): PlaceLookup`** — geocoding + timezone para el onboarding real (hoy sólo existe `publicLab.resolvePlace` para el lab).

## Notas

- Los `payload: v.any()` del schema no validan forma: el **tipo TS del front es el contrato**. Cambios de forma se anotan en `convex/CHANGELOG.md`.
- Las 3 pantallas de módulos (tránsito/valores/personalidad) dependen de que exista una carta natal calculada (`charts.calculateOrCreateNatalChart` tras `completeBirthData`).
- Mientras las funciones propuestas no existan, cada pantalla se desarrolla contra un **mock tipado** con la forma correspondiente.
