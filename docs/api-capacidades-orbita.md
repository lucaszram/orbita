# Capacidades de la API — qué puede traer Órbita y qué mostramos

Fecha: 2026-07-07

Fuente única de **qué se puede sacar del backend astrológico** (AstrologyAPI + derivados Órbita), en qué estado está, y cómo se baja al producto — sobre todo al **primer onboarding** (web + app). Complementa (no reemplaza) `docs/api-astrologica-orbita.md` (decisión de proveedor), `docs/home-contenidos-personalizados.md` (módulos de Home) y `docs/textos-analisis-personalizacion.md` (inventario de copy).

- **Motor de datos:** AstrologyAPI (`convex/lib/astrologyApi.ts`), occidental **tropical**, casas **placidus**.
- **Motor de texto:** Vercel AI Gateway (`convex/lib/aiGateway.ts`), **off por default** — hoy el texto editorial son plantillas en `convex/lib/orbita.ts`.
- **Mapa canónico de features en código:** `previewCompleteHoroscope` (`convex/publicLab.ts`) + tipos `CompleteHoroscopeProfile` (`src/services/publicLabRefs.ts`).

---

## Dependencia dura

Nada "real" aparece sin **credenciales AstrologyAPI en Convex** (`ASTROLOGY_API_USER_ID` + `ASTROLOGY_API_KEY`). Sin ellas, carta y tránsitos caen a **stub** (solo signo solar por fecha). Con ellas, se prende toda la Capa 1.

## Guardrail sobre el texto de la API

`sun_sign_prediction` y los reportes de la API traen claims de **salud/dinero/suerte/destino**. Órbita **no** expone ese texto crudo: toma el **dato** (posiciones, tránsitos, fases) y reescribe en voz propia con los guardrails de `AGENTS.md` (entretenimiento/autoconocimiento; sin salud/dinero/legal/determinismo). Todo pasa por `/backoffice` antes de app pública.

---

## Catálogo completo de AstrologyAPI (Western tropical)

✅ = ya lo llama el adapter · ⚪ = disponible en la API, **no cableado**.

### A. Carta natal / estructura (datos duros)
- ✅ `western_chart_data`, `western_horoscope`, `natal_chart_interpretation` — planetas, casas, aspectos.
- ⚪ `planets/tropical`, `house_cusps/tropical`, `house_cusps_report/tropical`, `natal_house_cusp_report`, `natal_wheel_chart`, `general_ascendant_report/tropical`, `general_sign_report/tropical/:planeta`, `general_house_report/tropical/:planeta`.

### B. Reportes de personalidad (insumo — usamos voz propia)
- ⚪ `personality_report/tropical`, `romantic_personality_report/tropical`, `karma_destiny_report/tropical`.

### C. Compatibilidad / vínculos (sinastría — motor EXISTE)
- ⚪ `synastry_horoscope`, `composite_horoscope`, `love_compatibility_report/tropical`, `friendship_report/tropical`, `zodiac_compatibility/:z/:pz`, `compatibility/:sun/:rising/:psun/:prising`, `romantic_forecast_report/tropical`, `romantic_forecast_couple_report/tropical`.

### D. Tránsitos / forecast
- ✅ `natal_transits/daily|weekly`, `tropical_transits/weekly|monthly`.
- ⚪ `tropical_transits/daily` (cielo del día), `life_forecast_report/tropical` (**pronóstico largo**).

### E. Revolución solar anual (motor EXISTE)
- ⚪ `solar_return_details|planets|house_cusps|planet_aspects|planet_report|aspects_report`.

### F. Fase lunar (motor EXISTE)
- ⚪ `lunar_metrics`, `moon_phase_report`.

### G. Numerología
- ⚪ `numerological_numbers`, `lifepath_number`, `personality_number`, `expression_number`, `soul_urge_number`, `challenge_numbers`, `sub_conscious_self_number`, `personal_day|month|year_prediction`. (El life path hoy se deriva local.)

### H. Horóscopo por signo (NO requiere carta — free / notificaciones)
- ⚪ `sun_sign_prediction/daily|weekly|monthly` (+ next/previous), `horoscope_prediction/weekly|monthly/:signo`.

### I. Tarot (78 cartas)
- ⚪ spreads generales, yes/no, Celtic Cross, 3 cartas.

### J. Geo / Location
- ✅ `geo_details` / place (lat/lon/timezone).

---

## Las 3 capas de capacidad

### 🟢 Capa 1 — real y lista hoy (con credenciales)
Carta natal completa (Sol/Luna/Asc + planetas + casas + aspectos), rueda dibujable (`chartWheelData`), elemento/modalidad/regente/numerología, mapa de valores (`charts.valuesMap`), tránsitos diarios (`transits.getToday`), timeline semanal/mensual, geocoding (`places.resolve`).

### 🟡 Capa 2 — funciona, texto de plantilla
Daily home (headline, 3 hacé/3 evitá, energía, acción, pregunta), topics (amor/trabajo/familia/vínculos), horóscopo de personalidad, deep dive, long read, Void preview, future-self. La personalización astrológica es real; las frases son template esperando LLM o biblioteca editorial P0.

### 🔴 Capa 3 — falta construir (NO falta proveedor)
La mayoría **sí sale de AstrologyAPI**, solo falta cablear el endpoint: fase lunar (F), pronóstico largo (D), revolución solar (E), sinastría (C). Lo que realmente falta construir: (1) **job de cielo global diario** + cache (retrógrados/posiciones compartidas), (2) **scheduler de push**, (3) **texto editorial propio/LLM**.

---

## Bajada al primer onboarding (web + app)

Hoy el reveal muestra **solo Sol** (derivado de fecha por `getZodiacSign`); Luna/Asc quedan como "se afinan con la carta". Tras los datos ya se puede llamar `charts.calculateOrCreateNatalChart` + `readings.generateToday`.

**Reveal FREE (el "aha", Capa 1 real):** tríada real Sol+Luna+Ascendente · elemento/modalidad/regente/numerología · rueda natal dibujada · placements clave (Merc/Ven/Mar, casas 1/4/7/10) + aspectos · preview del mapa de valores · preview de la primera lectura diaria (headline + 3 hacé/3 evitá) · preview del tránsito destacado.

**Teaser → paywall (Capa 2):** personalidad completa, 4 topics, long read, Void, timeline (patrón Moonly: bloqueado como valor del pago).

**No prometer (Capa 3):** fase lunar, retrógrados, pronóstico anual, sinastría.

**Sin hora:** Asc/casas/regente → `needs_exact_birth_time`; mantener copy honesto.

---

## Endpoints ⚪ propuestos para cablear (pedido a backend)

Contrato del front en `src/services/skyRefs.ts` (tipos + refs) + mocks en `src/content/`. Backend (Codex) implementa el wiring en `convex/lib/astrologyApi.ts` + funciones. Ver `convex/CHANGELOG.md` y el bloque TODO en `convex/schema.ts`.

| Función propuesta | Endpoint API | Payload TS | Mock | Entitlement |
|---|---|---|---|---|
| `sky.getMoonPhase({ localDate, timezone })` | `moon_phase_report` / `lunar_metrics` | `MoonPhasePayload` | `moonPhaseMock` | free |
| `forecast.getLongRange()` | `life_forecast_report/tropical` | `LongRangeForecastPayload` | `forecastMock` | premium |
| `charts.solarReturn({ year })` | `solar_return_*` | `SolarReturnPayload` | `solarReturnMock` | premium |
| `relationships.synastry({ relationshipProfileId })` | `synastry_horoscope` + `love_compatibility_report` | `SynastryPayload` (`appCoreRefs.ts`) | `appData.ts` | premium |
| `content.sunSignDaily({ sign, localDate })` | `sun_sign_prediction/daily/:signo` | `SunSignContentPayload` | `sunSignMock` | free |

Todos reescriben el texto crudo de la API en voz Órbita y pasan por `/backoffice` antes de app.
