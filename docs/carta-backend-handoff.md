# Carta natal — handoff backend (Codex)

El rediseño del hub de la Carta (`app/(tabs)/carta.tsx` + rueda `src/components/orbita/NatalWheel.tsx`) consume **todo desde `charts.current`** (no necesita backend nuevo para funcionar). Lo de abajo son mejoras: (1) es la única prioridad real; (3)(4) el front puede shippear sin backend.

Todo derivable ya vive en `convex/lib/orbita.ts` (`NormalizedAstroChart`, `buildChartWheelData`).

## 1. Exponer `charts.wheel` (prioridad) — dedupe, no bloqueante
`buildChartWheelData(chart)` (`convex/lib/orbita.ts:674`) **ya está escrito y sin usar**: computa `angles.{ascendant,descendant,mc,ic}` desde las cúspides 1/7/10/4, conserva grados de cúspide, estiliza aspectos y emite `rendererHints: { rotateToAscendant, drawHousesFromCusps }`. Falta una query pública `charts.wheel()` que lo devuelva (misma forma que `charts.valuesMap`/`personalityReading`, `convex/charts.ts:69`). Hoy el front recomputa la rotación client-side desde `charts.current` (`ascendantDegree = houses[1].cusp`), así que esto es **dedupe**, no requisito.

## 2. Ángulos first-class en `summary`
Promover `summary.descendant/mc/ic` (ya computados dentro de `buildChartWheelData.angles`) al payload de `charts.current`. El front hoy deriva MC de `houses[10].cusp`; tenerlos explícitos evita que cada cliente re-derive.

## 3. Balance de elementos / modalidades — el front puede sin vos
Fuego/Tierra/Aire/Agua y Cardinal/Fijo/Mutable, contando los signos de todos los planetas. Derivable client-side (la tabla de rangos zodiacales ya existe, `convex/lib/orbita.ts:263`). Backend sólo si se quiere scoring ponderado.

## 4. Regente de la carta — el front puede sin vos
Planeta regente del signo del Ascendente. Necesita una tabla signo→regente + el signo del Asc. Chico; más limpio como `summary.chartRuler` pero se puede client-side.

## 5. Planeta dominante — necesita backend real
Scoring por angularidad + aspectos + regencia. No hay data para derivarlo client-side. Enumerar como item de backend genuino.

---

**Contrato que el front ya consume de `charts.current`** (todo presente hoy, ver `mapNatalChart` en `src/components/web/orbita-chart.tsx`): por planeta `key/label/sign/signEs/degree(norm)/fullDegree/house/isRetrograde`; por casa `house/sign/degree(cusp)/theme`; por aspecto `from/to/type/typeEs/orb/isMajor`; `summary.mainAspects/ascendant.fullDegree/accuracy/limitations`.
