# Contrato — CHANGELOG

## 2026-07-18 — Carta inmediata y enriquecimiento diario en segundo plano
- **Qué cambió:** `daily.getGuide()` conserva los mismos argumentos y el payload `orbita-daily-guide-v3`, pero ahora persiste/devuelve primero la carta completa sin llamar a AstrologyAPI ni al AI Gateway. La lectura inmediata sale de un catálogo versionado de **156 rituales editoriales** (78 cartas × `derecho|invertida`), cada uno con esencia, exactamente tres facetas, `enTuDia`, consejo y cierre. El payload suma metadata aditiva `enrichment: { status: "pending" | "ready" | "fallback" | "error", requestedAt, completedAt?, retryAfter?, attempt }`. Los clientes existentes pueden ignorarla. Se agrega `daily.getCard({ localDate?, timezone? })`, que devuelve el contrato separado `{ card, enrichment, personalized }` para build 17+. La carta, orientación, ritual y `revealedAt` quedan inmutables; el job posterior solo actualiza módulos personalizados de la misma fila.
- **Compatibilidad:** un payload v3 anterior sin `enrichment` se trata como terminado y se devuelve intacto. El build 16 sigue recibiendo inmediatamente todos los campos que ya espera. No hay cambio de schema ni migración destructiva.
- **Ejecución:** la mutation transaccional sobre `(userId, localDate)` crea una sola fila y agenda una sola mejora. AstrologyAPI y AI Gateway tienen un máximo de 5 segundos cada uno; ante fallo se conserva el contenido base. Los logs registran tiempos/resultado sin email, datos natales ni texto generado.
- **Contenido:** dos personas con la misma carta y orientación reciben la misma lectura editorial base, inmediata y estable. La personalización natal/tránsitos llega en módulos separados; nunca reemplaza esa lectura. El catálogo está validado estructuralmente y sin copy defensivo, mocks o astrología personalizada fingida.
- **Estado:** implementado en rama backend; pendiente deploy actualizado exclusivo a Convex dev, medición fría/caliente y aprobación de una muestra editorial antes de cualquier promoción a producción.

## 2026-07-17 — Carta diaria: ritual intrínseco + orientación estable
- **Qué cambió:** `daily.getGuide()` migra `carta` de `{ id, nombre, correspondencia, beats }` a `{ id, nombre, correspondencia, orientacion: "derecho" | "invertida", ritual: { esencia, significadoGeneral, enTuDia, consejo, cierre } }`. `significadoGeneral` exige exactamente tres facetas, siguiendo el formato aprobado en Figma. `daily.getStrip()` suma `orientacion` para reproducir fielmente el historial. Los payloads nuevos usan `orbita-daily-guide-v3`; un cache v2 se regenera sin borrar `revealedAt`.
- **Compatibilidad de rollout:** durante la convivencia con el build 13, `carta` conserva además un `beats` legacy derivado de `ritual` (`QUÉ ES`, `EN TU DÍA`, `EL CONSEJO`). No dispara otra generación ni inventa cruces con el cielo. El frontend v3 lo ignora; se retira en un PR posterior cuando el cliente viejo deje de circular.
- **Por qué:** la carta diaria deja de fingir un cruce con la carta natal o los tránsitos. La nueva apertura muestra una lectura completa de la carta misma, diferenciada por orientación.
- **Decisiones cerradas:** mazo completo de 78; sin repetición durante los seis días anteriores; 50% invertidas mediante una segunda semilla determinística; orientación persistida; ritual generado dentro de la guía diaria con fallback intrínseco y sin cruce astro.
- **Quién lo pidió:** Lucas (handoff frontend/Claude, sección 14 de Figma).
- **Estado:** implementado en backend; pendiente integración del frontend contra el contrato real y prueba en Convex dev.

## 2026-07-17 — La lectura natal corta deja de presentarse como resultado final
- **Qué cambió:** `charts.personalityReading()` conserva su firma `PersonalityReadingPayload | null`, pero ahora devuelve `null` hasta que exista una interpretación LLM completa y cacheada con estado `ready`. Ya no entrega la plantilla breve determinística durante la generación. `charts.generatePersonalityReading()` rechaza la llamada si el generador está deshabilitado, incompleto o falla, para que el cliente pueda salir de la carga y ofrecer reintento.
- **Por qué:** la plantilla breve (`Núcleo`, `Clima interno`, etc.) aparecía como si fuera la carta natal terminada y ocultaba que los siete capítulos largos todavía se estaban generando o habían fallado.
- **Compatibilidad:** no cambian argumentos ni tipos públicos. El frontend actual ya interpreta `null` como carga y una action rechazada como error recuperable.
- **Estado:** implementado en rama backend; desplegar primero en Convex dev y verificar carga → lectura larga antes de producción.

## 2026-07-16 — Mazo completo de 78 cartas y ventana móvil sin repetición
- **Qué cambió:** el dominio de `carta.id` en `daily.getGuide()` y `cartaId` en `daily.getStrip()` se amplía de `0–21` a `0–77`. Los ids históricos `0–21` conservan exactamente las mismas cartas; los arcanos menores ocupan ids estables `22–77` en orden Bastos, Copas, Espadas y Oros (As, 2–10, Paje, Caballero, Reina, Rey).
- **Regla de producto:** al generar una carta nueva se excluyen las cartas persistidas en los seis días calendario anteriores. La ventana es móvil: no hay un reinicio semanal abrupto y una carta puede volver a salir recién al octavo día. Un documento ya generado nunca se vuelve a sortear.
- **Compatibilidad:** no cambian argumentos ni forma del payload. El frontend debe ampliar su mapa estático `id→imagen/contenido` a las 78 cartas antes de desplegar este backend; los 78 assets ya existen en `assets/orbita/optimized/tarot/`.
- **Quién lo pidió:** producto.
- **Estado:** implementado en rama coordinada; no desplegar hasta que el frontend de 78 cartas esté listo.

## 2026-07-16 — Recuperación remota de lecturas guardadas
- **Qué cambió:** nueva query autenticada `readings.listSaved({ limit? })`. Devuelve, de más nueva a más vieja, `{ savedReadingId, readingId, readingDate, readingPayload, note, createdAt }` para las lecturas que sí llegaron a `savedReadings` en Convex. Límite por defecto 60, máximo 120.
- **Por qué:** un simulador o teléfono nuevo no tiene el `AsyncStorage` anterior. La app necesita mergear el archivo remoto con el local sin confundir “remoto vacío” con “borrar lo local”.
- **Límite honesto:** esto recupera lecturas guardadas explícitamente; no inventa cartas que solo se revelaron localmente antes de existir `dailyGuides`.
- **Estado:** backend implementado; frontend pendiente de validar cada payload, integrar `listSaved` y `unsave`, y mergear por `readingPayload.id` (fecha+carta como fallback), con lo local primero.

## 2026-07-16 — Recuperación del motor natal largo original
- **Qué cambió:** `charts.generatePersonalityReading()` vuelve a usar el motor rico `generateNatalReadingWithGateway`, preservado en `b341606`/snapshot productivo `135861e`. El prompt recibe la carta completa (placements, casas, aspectos y precisión), genera los siete capítulos canónicos (`identidad`, `emocional`, `mente`, `amor`, `impulso`, `expansion`, `estructura`) y usa un presupuesto de 7000 tokens. Se elimina el motor inline posterior que reducía la carta a siete líneas aisladas y 1400 tokens.
- **Contrato:** no cambia ninguna firma pública. `charts.personalityReading()` conserva `PersonalityReadingPayload` y sigue cayendo a la plantilla determinística mientras se genera la lectura rica.
- **Regresión cubierta:** el parser rechaza respuestas incompletas o desordenadas; las pruebas exigen los siete capítulos, Júpiter, casas, aspectos, integraciones Sol+Ascendente y Venus+Marte, y el presupuesto largo.
- **Guardrails:** entretenimiento y autoconocimiento; sin destino, salud, dinero, consejo legal ni posiciones/casas inventadas.

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

## 2026-07-15 — Contrato del ritual diario: reveal irreversible e historial

- **Qué cambió:** `dailyGuides` suma `revealedAt?: number`. `daily.revealCard({ localDate })` devuelve el timestamp del primer reveal y `daily.getStrip({ from, to })` devuelve `{ localDate, cartaId, revealed }[]` para el archivo diario. `daily.getGuide()` incorpora una carta determinística y versiona el payload como `orbita-daily-guide-v2`, invalidando caches anteriores que no pueden sostener el ritual.
- **Por qué:** el binario iOS necesita distinguir una carta generada de una carta revelada y mostrar el historial sin crear otra tabla.
- **Quién lo pidió:** frontend + producto.
- **Estado:** implementado en backend y cubierto por tests; pendiente de merge y deploy coordinado con la Home nueva.

## 2026-07-15 — Edición de datos natales consistente

- **Qué cambió:** las firmas públicas se mantienen. `onboarding.completeBirthData` ahora elimina una hora anterior cuando `birthTimePrecision="unknown"`; `charts.current` resuelve la carta que coincide con los datos natales vigentes; y `readings.generateToday` recalcula la lectura existente del día si cambió la carta, timezone o versión de contenido.
- **Por qué:** el editor del build 11 espera confirmación del backend y no puede confirmar un estado que después reaparece con la hora o lectura anteriores.
- **Quién lo pidió:** frontend + revisión backend.
- **Estado:** implementado, pendiente de deploy.

## 2026-07-15 — Stripe Checkout/Portal sin SDK Node (sin cambio de contrato)
- **Qué cambió:** `payments/stripeActions.ts` mantiene las mismas firmas públicas pero usa la API REST de Stripe mediante `fetch`; se elimina el SDK `stripe` y el runtime `"use node"`.
- **Por qué:** el SDK hacía que la evaluación del deploy de producción agotara el timeout. El backend completo sin ese módulo se evalúa en segundos.
- **Quién lo pidió:** producto/backend para estabilizar producción.
- **Estado:** implementado y verificado en producción `exciting-bat-311`.

## 2026-07-10 — Calidad de generación diaria: anti-redundancia + voz criolla (feedback usuario Sofi)
- **Qué reportó el usuario (Sofi, 2026-07-10):**
  - **HACÉ repite el body** casi palabra por palabra ("marcá/elegí la tarea que desbloquea el resto… veinte minutos" en ambos) → *"dice lo mismo tal cual"*.
  - **Lectura del tránsito larga y repetitiva:** nombra "Sol en Cáncer"/"Mercurio" 4-5 veces y reformula la misma idea → *"ese texto está raro / dice lo mismo"*.
  - **Energía en crudo:** muestra `"Elemento de base: agua"` → *"en energía no puede decir agua, puede decir sensible"*.
- **Dónde está en el código:**
  - Prompt daily LLM: `convex/daily.ts` → `buildDailyPrompt` (y el prompt lab `orbita-lab-daily-home-llm-v1`).
  - Plantilla energía cruda: `convex/lib/orbita.ts` → `energy: \`Elemento de base: ${element}.\`` (~línea 490) y `energy: \`Casa ${natalHouse}: …\``.
  - Redundancia body/hacé en topics: `buildTopicReadings` en `orbita.ts`.
- **Reglas a agregar al prompt (pedido a Codex):**
  1. **Cada campo aporta algo DISTINTO.** El `body` explica el tránsito; `hacé`/`evitá` son gestos concretos que **NO repiten frases ni ideas del body**; `acción` ≠ `hacé`; `energía` describe el clima, no repite el hacé. Prohibido que dos campos digan lo mismo con otras palabras.
  2. **No repitas placements.** Nombrá cada planeta/signo/casa **una vez**. Nada de "Sol en Cáncer" / "tu Mercurio" en cada frase.
  3. **Conciso.** `body` máximo 2-3 frases; una idea por frase; sin reformular.
  4. **Criollo, no técnico.** Nada de "Elemento de base: agua", "casa 9", "cuadratura" en crudo → traducir al **efecto humano**.
- **Mapa de humanización (para la plantilla `energy` y como guía al LLM):**
  - `agua` → "hoy te movés desde lo sensible y la memoria"
  - `fuego` → "desde el impulso y las ganas"
  - `tierra` → "desde lo concreto y lo que se sostiene"
  - `aire` → "desde la cabeza y la palabra"
  - Casas: usar `houseThemes` en criollo (ej. casa 7 → "vínculos y acuerdos"), nunca "casa N" pelado.
- **Quién lo pidió:** frontend (Claude), desde feedback de usuario real.
- **Estado:** propuesto. La personalización LLM ya está **en implementación por Codex** — estas reglas se suman al mismo prompt (y aplican también a la plantilla de fallback). Regenerar/bustear cache para que las lecturas ya emitidas se corrijan.
- **Texto LISTO PARA PEGAR (Codex).** Sumar al bloque "Reglas duras" del prompt daily (`buildDailyPrompt` en `daily.ts` y el prompt lab):
  ```
  - CONCISO: el body son 2-3 frases, una idea por frase. Prohibido reformular la misma idea con otras palabras.
  - NO REPITAS placements: nombrá cada planeta / signo / casa UNA sola vez en TODO el texto.
  - Cada campo aporta algo DISTINTO: el headline nombra el tránsito; el body lo explica una vez; el hacé y el evitá son gestos concretos NUEVOS que NO repiten frases ni ideas del body; la acción es un gesto distinto del hacé; la energía es el clima emocional en criollo. Ningún campo puede decir lo mismo que otro.
  - CRIOLLO, no técnico: si nombrás una casa, un aspecto o un elemento, traducilo al efecto humano ("casa 7" -> "vínculos y acuerdos"; "cuadratura" -> "tensión o roce"; elemento agua -> "lo sensible y la memoria"). NUNCA términos crudos tipo "Elemento de base: agua" ni "casa 9" pelado.
  ```
  Y reemplazar la plantilla de energía cruda en `convex/lib/orbita.ts` (`energy: \`Elemento de base: ${element}.\``) por criollo:
  ```ts
  const ENERGIA_CRIOLLA: Record<string, string> = {
    agua:   "Hoy te movés desde lo sensible y la memoria.",
    fuego:  "Hoy te movés desde el impulso y las ganas.",
    tierra: "Hoy te movés desde lo concreto y lo que se sostiene.",
    aire:   "Hoy te movés desde la cabeza y la palabra.",
  };
  // energy: ENERGIA_CRIOLLA[String(element).toLowerCase()] ?? "Tu día tiene un tono propio."
  ```

## 2026-07-09 — Enriquecer input del prompt daily (personalización real por punto) + sinastría vínculos
- **Hallazgo (verificado en vivo):** `buildDailyPrompt` (`convex/daily.ts:80`) hoy pasa a GPT **solo Sol/Luna/Asc** + las líneas de tránsito. Corriendo `publicLab:previewCompleteHoroscope` para 14/08/2002 se confirmó que la API **ya trae** el signo/casa/aspectos natales del punto que el tránsito toca (ej. Venus en Libra, casa 7, con 5 aspectos natales), pero **no llegan al prompt** → el LLM habla del punto sin su contexto. La materia prima rica existe; el prompt la desperdicia.
- **Pedido a Codex (1) — enriquecer el input del prompt daily:** por cada tránsito, incluir el **punto natal tocado con su signo, casa y aspectos natales** (ya está en `chartWheelData` planets/houses/aspects y en el normalizado del proveedor). No cambia el contrato de tipos del front — mejora la calidad del texto generado. Mantener guardrails (entretenimiento/autoconocimiento; sin destino/salud/dinero/legal; voseo).
- **Pedido a Codex (2) — sinastría para Vínculos:** cablear `relationships.synastry({ relationshipProfileId }): SynastryPayload` → `synastry_horoscope` + `love_compatibility_report` (ya propuesto en el bloque App Core; se reafirma para la Home de Vínculos "con quién sintonizás"). El empty state ("clima de tus vínculos") NO necesita esto: se deriva de los tránsitos propios a Venus/Marte/casas 5-7-11, que ya existen.
- **Decisión de producto (Lucas, pendiente):** prender el LLM daily (`ORBITA_LLM_ENABLED=true` + `AI_GATEWAY_API_KEY`) con cache `dailyLlmReadings` (1×/usuario/día). Costo medido: ~1.496 tokens/generación (1.088 in + 408 out) en `gpt-5.4`. Propuesta: **modelo mini para el daily** (~15× más barato), `gpt-5.4` para la interpretación natal (1×/vida, cacheada). ~$0,01–0,16 por usuario/mes según modelo.
- **Quién lo pidió:** frontend (Claude). Análisis completo en `.claude/plans/mossy-gathering-lobster.md`.
- **Estado:** propuesto (stub). Construcción se decide después (el usuario pidió no editar la app todavía).

## 2026-07-09 — Tránsitos por área (usuario logueado)
- **Qué cambió (contrato):** `TransitDetailPayload` (en `src/services/appRefs.ts`) suma `porArea?: Array<{ title: string; body: string }>` — la lectura del tránsito de hoy desglosada por área (Amor / Trabajo / Vínculos / Energía).
- **Qué construyó el front:** el tab **Tránsitos** (`app/(tabs)/transitos.tsx`) ahora **embebe la sección "POR ÁREA" inline al final** (antes era el botón "VER POR ÁREA" → `/reading/transitos`, que se saca). Mapea `porArea` del payload de `transits.getToday`; si viene vacía/undefined, la sección **se oculta** (no rompe). Consistente con "TU DÍA POR ÁREA" de la Home.
- **Pedido a backend (Codex):** que `transits.getToday` devuelva `porArea` con la lectura del **tránsito principal por cada una de las 4 áreas** (Amor/Trabajo/Vínculos/Energía) para el usuario logueado. Cada item: `{ title (ej. "Saturno pesa sobre tu Venus"), body (la lectura para esa área, en criollo, ~1-2 frases) }`. Mismos guardrails que el daily (entretenimiento/autoconocimiento; sin destino/dinero/salud/legal; voseo rioplatense). Fallback: sin dato → omitir `porArea` (el front oculta la sección).
- **Quién lo pidió:** frontend (Claude).
- **Estado:** propuesto (stub).
- **Además — labels crudos del proveedor en `transits.getToday` (bug de copy, backend):** el payload filtra placeholders del proveedor que violan el guardrail "voz Órbita, nunca copy crudo": `frequency.label` = `"Ventana del proveedor"`, `frequency.timeline[].label` = `"Pico "` sin fecha (queda "Pico -"), `window.label` = `"Ventana estimada"/"Pico estimado"`, `window.note` = `"La ventana exacta tiene que venir del proveedor astrológico."` (todo en `convex/lib/orbita.ts` ~1182/1266/1274). **Mientras tanto el front los oculta** (helper `PROVIDER_JUNK`/`humanCopy` en `app/(tabs)/transitos.tsx`): sanitiza sufijos colgados y esconde captions placeholder; cuando el copy pase a voz Órbita, se muestra solo. **Pedido a Codex:** humanizar esos strings (ej. cadencia → "Este tránsito dura ~2 meses; hoy pega fuerte"; ventana → fecha real formateada) o dejarlos vacíos.

## 2026-07-07 — Horóscopo de personalidad: pedido de interpretación natal por LLM
- **Qué cambió (contrato):** `PersonalitySection` (en `src/services/appRefs.ts`) suma `questions?: string[]` (1-2 preguntas de reflexión por sector; el plan `buildNatalInterpretationGatewayPlan` ya las prevé). El front promovió `charts.personalityReading` y `charts.valuesMap` de `proposedApi`→`appApi` (ya estaban implementadas; el "propuesto" era obsoleto).
- **Qué construyó el front:** la pantalla `/personalidad` (`src/components/web/orbita-personality.tsx`) es ahora la **lectura larga por sectores**: rueda natal real (`charts.current`) + 7 secciones interpretativas + mapa de valores (`charts.valuesMap`). El mock (`src/content/personalityMock.ts`) tiene la lectura rica de ejemplo = **target de calidad y taxonomía**.
- **Pedido a backend (Codex):** cablear el **LLM natal** (GPT-5.4, `ORBITA_LLM_ENABLED=true`) para que `charts.personalityReading` genere las **7 secciones temáticas** desde la carta real, con guardrails, cacheadas en `natalInterpretations`, con **fallback a la plantilla** actual. Ejecutar el plan `buildNatalInterpretationGatewayPlan` (falta la action que llame al gateway, parsee y escriba en `natalInterpretations`).
  - **Taxonomía de secciones (keys exactas que espera el front):** `identidad` (Sol+Asc), `emocional` (Luna), `mente` (Mercurio), `amor` (Venus+Marte), `impulso` (Marte), `expansion` (Júpiter — **reframe de "suerte"**, sin dinero/éxito), `estructura` (Saturno). Cada sección: `{ key, title, intro, placement:{label,planet,sign?,house?}, body (largo, ~4 párrafos, EXPLICATIVO/pedagógico: (1) qué es el planeta/placement en términos simples, (2) qué te da tu signo, (3) qué agrega la casa, (4) el borde de crecimiento), questions: 1-2 en CADA sección (promesa "por sector") }`. Ver `src/content/personalityMock.ts` como target de tono, largo y estructura. **No alargar más el body**; el enriquecimiento futuro va por sub-bloques opcionales por sección (ej. "Cómo se juega en tu día", "Para observar esta semana"), no por más párrafos. Evitar imperativos duros ("tenés que…").
  - **Guardrails duros en el prompt:** entretenimiento/autoconocimiento; sin destino/dinero/salud/legal como consejo; sin órdenes ("le diremos lo que debe hacer" ❌); no copiar copy crudo del proveedor. Voseo rioplatense.
- **Quién lo pidió:** frontend (Claude).
- **Estado:** front implementado (contra plantilla + mock rico). Backend LLM natal: **pendiente (Codex)**.

## 2026-07-07 — Capacidades ampliadas (endpoints AstrologyAPI disponibles sin cablear)
- **Qué cambió:** el front propone 4 funciones públicas nuevas para exponer endpoints de AstrologyAPI que ya existen pero no están cableados. No requieren tablas nuevas (cache opcional, patrón `transits.getToday`). Formas de payload en `src/services/skyRefs.ts`; catálogo completo en `docs/api-capacidades-orbita.md`:
  - `sky.getMoonPhase({ localDate, timezone })` → `MoonPhasePayload` — fase lunar del día (`moon_phase_report`/`lunar_metrics`). Módulo Home/onboarding. Free.
  - `forecast.getLongRange()` → `LongRangeForecastPayload` — tránsitos lentos por ventanas (`life_forecast_report/tropical`). **Reemplaza** el contrato que hoy figura `needs_provider_endpoint` en `buildLongRangeTimelineContract`. Premium.
  - `charts.solarReturn({ year })` → `SolarReturnPayload` — revolución solar anual (`solar_return_*`). Premium.
  - `content.sunSignDaily({ sign, localDate })` → `SunSignContentPayload` — lectura diaria por signo sin carta (`sun_sign_prediction/daily/:signo`), para demo free / logueado-sin-carta / notificaciones. Free.
- **Guardrail:** `sun_sign_prediction` y los reportes traen claims de salud/dinero/suerte/destino. Órbita toma el dato y reescribe en voz propia; nada del texto crudo va a app y todo pasa por `/backoffice`.
- **Nota:** la sinastría (`relationships.synastry`, bloque App Core) queda reconfirmada — el motor existe (`synastry_horoscope` + `love_compatibility_report`), no era "falta proveedor" sino "falta cablear + input de 2da persona".
- **Por qué:** ampliar lo mostrable con datos que ya se pueden sacar de la API (fase lunar, pronóstico largo, revolución solar, contenido por signo) sin depender de un motor nuevo.
- **Quién lo pidió:** frontend (Claude).
- **Estado:** propuesto (stub). Ver bloque `// TODO: pendiente backend — Capacidades ampliadas` en `convex/schema.ts`. Front trabaja contra mocks (`src/content/moonPhaseMock.ts`, `forecastMock.ts`, `solarReturnMock.ts`, `sunSignMock.ts`) hasta que existan.

## 2026-07-06 — Contrato de pagos v2 (RevenueCat app + Stripe web)
- **Qué cambió:**
  - **`subscriptions` v2** — una fila por `(userId, provider)`. Campos nuevos: `clerkUserId?` (denormalizado para webhooks), `provider` ahora `"revenuecat"|"stripe"|"stub"`, `plan? "weekly"|"yearly"|"lifetime"`, `providerSubscriptionId?`, `isLifetime?`, `willRenew?`, `environment? "sandbox"|"production"`, `lastEventAt?`. `status` suma `"billing_issue"`. Índices nuevos: `by_user_provider`, `by_clerkUserId`, `by_providerCustomerId`, `by_providerSubscriptionId`.
  - **`paymentEvents`** (tabla nueva) — idempotencia/auditoría de webhooks (`provider`, `eventId`, `eventType`, `clerkUserId?`, `rawPayload`, `processedAt`; índice `by_provider_eventId`).
  - **entitlement** — `plus` → `orbita_pro` (identificador canónico). Union transitorio `free|plus|orbita_pro` hasta correr `migrations:renamePlusToOrbitaPro`; después un commit lo deja en `free|orbita_pro`. Afecta también `contentModules.entitlement`.
  - **Firmas que consume el frontend:**
    - `subscriptions.getCurrent()` (query, sin args) → `{ entitlement: "free"|"orbita_pro", isPro: boolean, status, provider?, plan?, isLifetime: boolean, currentPeriodEnd?: number, willRenew?: boolean, canManageInStripePortal: boolean }`.
    - `payments.createCheckoutSession({ plan: "weekly"|"yearly"|"lifetime" })` (action, auth Clerk) → `{ url: string }` (Stripe Checkout, web).
    - `payments.createPortalSession()` (action, auth Clerk) → `{ url: string }` (Stripe Customer Portal, web).
  - **Webhooks (no los consume el front):** `POST /webhooks/revenuecat` y `POST /webhooks/stripe` en `convex/http.ts` (dominio `*.convex.site`).
- **Por qué:** habilitar el paywall real — RevenueCat en la app (iOS/Android), Stripe en la web — con Convex como fuente de verdad server-side del acceso, alimentada por webhooks. El cliente nunca escribe su propio entitlement.
- **Quién lo pidió:** frontend (mega plan de lanzamiento, Fase 1).
- **Estado:** implementado (backend). Requiere `pnpm exec convex dev --once` de Lucas para sync + correr `migrations:renamePlusToOrbitaPro`. Envs server nuevas: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_WEEKLY|YEARLY|LIFETIME`, `REVENUECAT_WEBHOOK_AUTH`, `WEB_APP_URL`, `ALLOW_DEV_STUB`.

## 2026-07-06 — Voz editorial diaria v3
- **Qué cambió:** el payload diario separa `home.subheadline` de `home.energy`, y `home.getDaily()` / `/lab` usan `home.subheadline` para el header en vez de repetir el módulo Energía. `DAILY_READING_EDITORIAL_VERSION` pasa a `orbita-daily-editorial-p0-v3`, el prompt diario AI Gateway a `orbita-lab-daily-home-llm-v3`, y la cache de `transits.getToday` a `astrologyapi-western-daily-transits-v3`.
- **Por qué:** evitar que el subtítulo de Home repita el bloque Energía y dejar cada pieza con función editorial propia.
- **Quién lo pidió:** frontend.
- **Estado:** implementado.

## 2026-07-06 — Voz editorial diaria v2
- **Qué cambió:** se actualiza la voz visible de Home/temas/tránsito/personalidad/valores a español rioplatense con voseo, tildes y signos de apertura. `DAILY_READING_EDITORIAL_VERSION` pasa a `orbita-daily-editorial-p0-v2`, el prompt diario AI Gateway pasa a `orbita-lab-daily-home-llm-v2`, y la cache de `transits.getToday` usa `astrologyapi-western-daily-transits-v2` para regenerar payloads diarios con la nueva voz.
- **Por qué:** alinear la salida dinámica con la guía de voz Órbita: hablarle a la persona, no del tema, y evitar copy abstracto/impersonal.
- **Quién lo pidió:** frontend.
- **Estado:** implementado.

## 2026-07-06 — Tránsitos diarios live con AstrologyAPI
- **Qué cambió:** `transits.getToday({ localDate })` pasa de query cache-only a action autenticada provider-backed. Si existe cache `astrologyapi-western-daily-transits-v1`, devuelve el payload público actual; si no, llama `natal_transits/daily`, normaliza aspectos/ventanas (`startTime`, `exactTime`, `endTime`), persiste `transitReadings`, actualiza/crea `dailyReadings` con `orbita-daily-editorial-p0-v1`, y no guarda raw/request en tablas app-facing.
- **Por qué:** desbloquear Home diaria y pantalla de tránsitos con tránsitos personales reales contra la carta/birth data guardada.
- **Quién lo pidió:** frontend.
- **Estado:** implementado.

## 2026-07-06 — Carta natal live con AstrologyAPI
- **Qué cambió:** `charts.calculateOrCreateNatalChart()` deja de crear el stub y pasa a ser una action provider-backed: lee el `birthData` vigente, calcula la carta natal con AstrologyAPI usando coords/timezone reales, persiste en `natalCharts`, actualiza `profileAstrologyCaches`, y `charts.current()` sigue devolviendo el chart persistido. El payload usa `orbita-astrologyapi-western-v1`; para hora desconocida no devuelve ascendente ni casas.
- **Por qué:** desbloquear `/carta?live=1` con Sol/Luna/Asc y placements reales después de que onboarding guarda lat/lon/timezone desde `places.resolve`.
- **Quién lo pidió:** frontend.
- **Estado:** implementado.

## 2026-07-06 — Location API via `geo_details`
- **Qué cambió:** `places.resolve({ query })` mantiene la misma firma, pero el adapter de AstrologyAPI ahora envía `place` a `ASTROLOGY_API_LOCATION_URL`, soporta respuestas `geonames`, normaliza `place_name`, `latitude`, `longitude` y `timezone_id`, usa `ASTROLOGY_API_KEY` para el header `x-astrologyapi-key` con `ASTROLOGY_API_LOCATION_KEY` como override opcional, usa MCP `geo_details` primero para evitar que Convex pierda el body REST, manda `maxRows: 10` como número, y hace fallback para queries con coma como `Buenos Aires, Argentina`.
- **Por qué:** conectar onboarding/lugar real al shape confirmado por el MCP de AstrologyAPI sin cambiar el contrato frontend ni duplicar configuración cuando la sandbox/API key sirve para Location.
- **Quién lo pidió:** backend.
- **Estado:** implementado.

## 2026-07-05 — Seed QA Web B0 autenticado
- **Qué cambió:** se agrega `webB0Seed.persistCurrentUserSnapshot({ localDate, timezone, birthData, chartPayload, dailyReadingPayload, markPlus? })`, una mutación pública restringida por allowlist de backoffice. Persiste snapshots QA para el usuario autenticado en `birthData`, `natalCharts`, `dailyReadings`, `transitReadings` y opcionalmente `subscriptions`; sanitiza `raw` y `request` antes de escribir payloads app-facing. `charts.current()` ahora devuelve la carta vigente más reciente.
- **Por qué:** permitir que Claude pruebe Web B0 en modo live con la cuenta QA sin exponer raw del proveedor ni depender de mocks.
- **Quién lo pidió:** frontend + backend.
- **Estado:** implementado.

## 2026-07-05 — Funciones Web B0 para modulos post-Home
- **Qué cambió:** se implementan las funciones publicas `charts.valuesMap()`, `charts.personalityReading()`, `transits.getToday({ localDate })` y `places.resolve({ query })`. No agregan tablas nuevas: `charts.*` derivan de `natalCharts.payload`, `transits.getToday` lee `transitReadings` y cae a `dailyReadings.payload`, y `places.resolve` usa el adapter server-side de AstrologyAPI sin devolver raw provider.
- **Por qué:** desbloquear las pantallas Web B0 ya disenadas por frontend: Mapa de valores, Horoscopo de personalidad, Transito en el espacio y geocoding real de entrada de datos.
- **Quién lo pidió:** frontend.
- **Estado:** implementado.

## 2026-07-05 — Cache mobile, rueda natal y radar de valores
- **Qué cambió:** `convex/schema.ts` agrega caches persistentes para app mobile: `profileAstrologyCaches`, `natalInterpretations`, `dailyLlmReadings`, `transitTimelineCaches` y `globalSkyCaches`; además extiende `natalCharts`, `dailyReadings` y `transitReadings` con campos opcionales de cache/version/provider. `publicLab.previewDailyHome(args)` y `publicLab.previewCompleteHoroscope(args)` ahora devuelven `chartWheelData` y `valueRadar`. `previewCompleteHoroscope(args)` también devuelve `editorialGeneration` versionado para Gateway y `longRangeTimeline` con estado `needs_provider_endpoint`.
- **Por qué:** preparar el contrato real para una app móvil con persistencia por perfil, renderer visual de carta natal en frontend, radar calculado en backend y timeline largo basado en proveedor/API, no en texto inventado.
- **Quién lo pidió:** producto/backend.
- **Estado:** implementado.

## 2026-07-05 — Public-dev AI Gateway y timeline extendido
- **Qué cambió:** se agrega `publicLab.previewLlmHome(args)` y `publicLab.previewTransitTimeline(args)`. `previewDailyHome(args)` acepta `llmEnabled?`. `previewCompleteHoroscope(args)` acepta `llmEnabled?`, `includeTimeline?`, `includeNatalWeekly?`, `includeTropicalWeekly?` e `includeTropicalMonthly?`, y puede devolver bloques `llm` y `timeline`. El timeline público normaliza eventos con `startTime`, `exactTime`, `endTime`, planeta transitante, punto natal, aspecto, casa, prioridad y `displayText`; no devuelve raw completo. La capa LLM usa Vercel AI Gateway server-side con tags `feature:orbita-lab`, `env:dev`, `user:lab`, y cae a templates determinísticos con gaps explícitos si Gateway está deshabilitado, falta config o falla.
- **Por qué:** probar en `/lab` copy editorial generado por Órbita y próximos tránsitos sin mover todavía el backend a Vercel ni persistir runs públicos.
- **Quién lo pidió:** producto/backend.
- **Estado:** implementado.

## 2026-07-05 — Public-dev complete horoscope profile
- **Qué cambió:** se agrega `publicLab.previewCompleteHoroscope(args)`. Recibe el mismo input público-dev que `previewDailyHome` y devuelve un mapa completo por perfil con bloques `identity`, `natalChart`, `daily`, `currentSky`, `future` y `extras`, fuente A/B/C/dataset, estado por feature, entitlement, faltantes backend, plan de cache, política de raw, `dailyHome`, gaps y estado provider. No persiste datos y no devuelve raw completo de AstrologyAPI.
- **Por qué:** poder cargar una persona en `/lab` y ver todo lo que Órbita necesitará conseguir/generar para un horóscopo completo antes de conectar dailies reales por usuario.
- **Quién lo pidió:** producto/backend.
- **Estado:** implementado.

## 2026-07-05 — Public-dev Home Lab
- **Qué cambió:** se agrega `publicLab.previewDailyHome(args)` y `publicLab.resolvePlace({ query, accessKey? })`. `previewDailyHome` acepta datos natales/manuales y devuelve una salida pública-dev tipo Home diaria sin sesión: header, base natal, tránsito destacado, `Hacé` x3, `Evitá` x3, acción, pregunta, topics, lectura larga, Void/Future Self, traza de personalización, gaps, versiones y estado provider. Ambas acciones requieren `ORBITA_PUBLIC_LAB_ENABLED=true`; si `ORBITA_PUBLIC_LAB_KEY` está definido, también exigen `accessKey`.
- **Por qué:** levantar `/lab` como web rápida para probar inputs natales y resultados de Home sin ensuciar `/backoffice` ni persistir datos.
- **Quién lo pidió:** producto/backend.
- **Estado:** implementado.

## 2026-07-05 — Home diaria P0 y draft remoto
- **Qué cambió:** se agrega `home.getDaily({ localDate })`, `home.generateDaily({ localDate, timezone })` y `onboarding.getDraft({ clientDraftId? })`. `home.*` devuelve un `DailyHomeReading` P0 para Claude: header diario, base natal visible, tránsito destacado, `Hacé` x3, `Evitá` x3, energía, acción, pregunta, topics, long read, Void preview, personalization trace, `modelGaps`, versiones y `reviewStatus`.
- **Por qué:** crear el primer puente backend/frontend para Home/App Core sin adaptar el contrato al `DailyReading` local heredado ni exponer raw/provider payloads.
- **Quién lo pidió:** frontend + backend.
- **Estado:** implementado.

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

## 2026-07-06 — Función para El Vacío (app nativa)
- **Qué cambió:** la pantalla Void del app core (3 momentos: Entrada → Escuchando → Respuesta, `app/reading/void.tsx`) necesita una función que responda la pregunta diaria del usuario. Forma de payload en `src/services/appRefs.ts` (`proposedApi.voidAsk`, `VoidAnswerPayload`):
  - `void.ask({ question }): VoidAnswerPayload` — `{ question, answer, basadoEn[], mejorPregunta, paso }`. Deriva de carta natal + tránsitos del día; `basadoEn` lleva los placements reales usados (ej. "TU LUNA EN SAGITARIO"). Límite de producto: una pregunta por día por usuario.
- **Guardrails duros:** el Vacío NUNCA contesta sí o no; devuelve marco + una mejor pregunta + un paso concreto; sin claims de destino/salud/dinero/legal (ver AGENTS.md y `docs/home-contenidos-personalizados.md` §6).
- **Por qué:** el flujo ya está implementado en nativo contra respuesta de maqueta; falta el generador real.
- **Quién lo pidió:** frontend (Claude).
- **Estado:** propuesto (stub). Ver bloque `// TODO: pendiente backend — El Vacío` en `convex/schema.ts`.
