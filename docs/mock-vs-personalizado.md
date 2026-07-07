# Órbita — Inventario: texto MOCK → texto PERSONALIZADO

Qué contenido es hoy maqueta y en qué se tiene que convertir (real/calculado), con su **fuente** (función backend) y **estado**. Aplica a **web** (worktree `orbita-frontend`) y **app** (App Core, `src/components/orbita/**` + `src/domain/appData.ts`, territorio de la otra sesión). La **fuente de datos es la misma** para ambas — cambia solo la UI.

Leyenda estado: ✅ real y andando · ⏳ backend pendiente · ❓ a confirmar si existe · 🟢 estático (queda así).

---

## Tres tipos de contenido

1. **Fijo por usuario (carta natal)** — no cambia nunca: se calcula una vez. Fuente: `charts.*` (AstrologyAPI).
2. **Por día (tránsitos + LLM)** — cambia cada día: se calcula mirando los tránsitos de hoy contra la carta + editorial LLM en español. Fuente: `transits.getToday` + `readings.getToday` (`dailyLlmReadings`).
3. **Estático (chrome)** — labels, disclaimers, texto explicativo. **No se personaliza** (y está bien así).

---

## 1) Fijo por usuario — CARTA NATAL

| Contenido | Mock hoy | Fuente | Estado |
|---|---|---|---|
| Tríada Sol / Luna / Ascendente | Leo / Piscis / Libra | `charts.current` (triad) | ✅ real |
| Posiciones clave (10 planetas + Nodo/Quirón/PdF/Asc, signo + casa) | fijas | `charts.current` (placements) | ✅ real |
| Casas (cúspides por signo) | fijas | `charts.current` (houses) | ✅ real (con hora válida) |
| Aspectos (armonía/tensión) | fijos | `charts.current` (aspects) | ✅ real |
| Posición en la rueda (grado real) | ángulos decorativos | `placements[].fullDegree` | ✅ real |
| `accuracy` (precisión) | "Hora exacta…" | `calculationTimeSource` | ✅ real |

> Nota: sin hora válida → sin Ascendente ni casas (fallback mediodía). El **fixer de hora** en `/carta` corrige eso.

## 2) Fijo por usuario — derivados de la carta

| Contenido | Mock hoy | Fuente | Estado |
|---|---|---|---|
| **Mapa de valores** — ejes armonía/tensión por área | `valuesMock` | `charts.valuesMap` | ❓ confirmar si está implementada o es stub |
| Mapa de valores — te impulsa / te pesa | fijos | derivado de la carta | ❓ |
| **Personalidad** — headline | "Quién sos, en tu propio cielo." | `charts.personalityReading` | ❓ confirmar |
| Personalidad — `placement.label` ("Sol en Leo") | fijo | de la carta | ⏳ real (mapear) |
| Personalidad — `body` (interpretación editorial) | mock a mano | **LLM** sobre la carta | ⏳ (prompts LLM) |

## 3) Por día — HOME diaria (`readings.getToday` → `dailyLlmReadings`)

| Contenido | Mock hoy | Fuente | Estado |
|---|---|---|---|
| Saludo con nombre ("Buenas, Lucas.") | Lucas | `user.name` | ⏳ real (mapear) |
| Tríada del hero (Sol/Luna/Asc) | Leo/Piscis/Libra | carta natal | ⏳ real (mapear) |
| `headline` del día | "Un día para ordenar…" | **LLM** (transits vs carta) | ⏳ |
| `subheadline` | fijo | **LLM** | ⏳ |
| Guía diaria — **Hacé** (`do[]`) | fijos | **LLM** | ⏳ |
| Guía diaria — **Evitá** (`avoid[]`) | fijos | **LLM** | ⏳ |
| **Energía del día** | fijo | tránsitos + **LLM** | ⏳ |
| Acción concreta (`action`) | fijo | **LLM** | ⏳ |
| Pregunta del día (`question` / `void`) | fijo | **LLM** | ⏳ |
| **Temas** (Amor/Trabajo/Familia/Vínculos: oneLine + pregunta) | fijos | **LLM** por área, con carta+tránsitos | ⏳ |
| Long-read ("El tránsito de hoy…") | fijo | **LLM** | ⏳ |

> Todo esto **depende de los tránsitos** (abajo) + los prompts LLM. Sin proveedor de tránsitos, la home no tiene contenido diario real.

## 4) Por día — TRÁNSITOS (`transits.getToday`)

| Contenido | Mock hoy | Fuente | Estado |
|---|---|---|---|
| Tránsito destacado (título/aspecto) | "Luna en Piscis en tensión…" | `transits.getToday` → AstrologyAPI `natal_transits/daily` | ⏳ Codex (en curso) |
| Tránsitos secundarios | fijos | idem | ⏳ |
| Escena (cuerpo en tránsito ↔ punto natal) | fija | idem | ⏳ |
| Lectura del tránsito (fragmentos + plain) | fija | tránsito + **LLM** | ⏳ |
| Ventana (begin/exact/end) | fija | `natal_transits/daily` (start/exact/end_time) | ⏳ |
| Frecuencia / timeline | fija | idem | ⏳ |
| "Cómo se juega en la tierra" (sugerencias) | fijas | **LLM** | ⏳ |

## 5) Estático — NO se personaliza (queda así) 🟢

- Títulos de sección y chrome: "Estos son tus puntos de partida", "Tu tríada", "Posiciones clave", "Cómo leerla", "Guía diaria", "Temas", "Mapa de valores", "Referencias", etc.
- Descripciones fijas: "Tu identidad y voluntad" (Sol), "Tu mundo emocional" (Luna), "Cómo te presentás. Se afina con la hora" (Asc).
- Disclaimers: "Esta lectura describe tendencias, no un destino…", "Este mapa es una foto, no una sentencia…".
- Leyendas: "Armonía / Energías que fluyen entre sí", "Tensión / Energías que se friccionan".

---

## Resumen de qué falta para que TODO sea personalizado

1. ✅ **Carta natal** — real (web). *App: mapear en su UI.*
2. ⏳ **Tránsitos** (`transits.getToday`) — **Codex en curso** → desbloquea Home + pantalla Tránsitos.
3. ⏳ **Home diaria** — depende de (2) + prompts LLM (`dailyLlmReadings`) → mapear forma en el front.
4. ❓ **Valores / Personalidad** — confirmar si `charts.valuesMap` / `charts.personalityReading` calculan real o son stub; el `body` de personalidad es **LLM**.
5. 🤖 **Front (web):** por cada uno, reconciliar la forma real → pantalla (como se hizo con la carta) + prender live.
6. 📱 **App:** misma fuente de datos; la otra sesión mapea en `src/components/orbita/**`.

## Dónde vive cada mock (web)
`src/content/{homeMock, chartMock, valuesMock, personalityMock, transitMock, onboardingSteps}.ts` + prosa estática en `src/components/web/orbita-*.tsx`.
