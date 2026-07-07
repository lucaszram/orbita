# WS2 · Pantallas faltantes + nav

**Dueño:** FRONT. **Nuevos:** `src/components/web/orbita-values.tsx`, `orbita-personality.tsx`, `src/content/valuesMock.ts`, `personalityMock.ts`, `app/valores.tsx`, `app/personalidad.tsx`. **Edita (dueño único):** `web-nav.tsx`, `orbita-chart.tsx`.

## Tareas
- **Mapa de valores** (`/valores`): radar con `react-native-svg` reusando el patrón de la rueda de `orbita-chart.tsx` (geometría por ángulos). Mock `ValuesMapPayload` (forma en `appRefs.ts`). `?live=1` → `proposedApi.valuesMap`. Panel: Referencias + Te impulsa/Te pesa (barras) + nota.
- **Personalidad** (`/personalidad`): long-read editorial centrado (secciones con emblema + card de interpretación + disclaimer). Mock `PersonalityReadingPayload`. `?live=1` → `proposedApi.personalityReading`.
- Reusar `webAssets` (`natalChart`, `ringSystem`, `sunSymbol`, `dailyTexture`).
- **Links:** desde `orbita-chart.tsx` CTAs "Ver tu mapa de valores" / "Leer tu personalidad". Nav superior queda en Hoy/Carta/Tránsitos/Diario (valores/personalidad son secundarias, se llega desde Carta).
- Estados loading/empty/error (patrón de home/carta).
- Entrada de datos: ya vive dentro del onboarding; no se rehace salvo pedido.

## Verificación
`tsc` limpio; `/valores` y `/personalidad` 200 en dev; screenshots.
