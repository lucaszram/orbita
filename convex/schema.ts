import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const identity = v.union(v.literal("ella"), v.literal("el"), v.literal("prefiero_no_decirlo"));
const paymentState = v.union(v.literal("not_started"), v.literal("started"), v.literal("paid"), v.literal("skipped"));
const birthTimePrecision = v.union(v.literal("known"), v.literal("approximate"), v.literal("unknown"));
// `plus` es transitorio: se mantiene aceptado mientras corre la migración
// `renamePlusToOrbitaPro`. Una vez migradas las filas existentes, un commit
// posterior lo saca y deja solo `free | orbita_pro`.
const entitlement = v.union(v.literal("free"), v.literal("plus"), v.literal("orbita_pro"));
const subscriptionStatus = v.union(
  v.literal("inactive"),
  v.literal("trialing"),
  v.literal("active"),
  v.literal("past_due"),
  v.literal("billing_issue"),
  v.literal("canceled"),
  v.literal("expired")
);
const subscriptionProvider = v.union(v.literal("revenuecat"), v.literal("stripe"), v.literal("stub"));
const subscriptionPlan = v.union(v.literal("weekly"), v.literal("yearly"), v.literal("lifetime"));
const providerEnvironment = v.union(v.literal("sandbox"), v.literal("production"));
const contentStatus = v.union(v.literal("draft"), v.literal("review"), v.literal("published"), v.literal("archived"));
const labReviewStatus = v.union(v.literal("needs_review"), v.literal("approved"), v.literal("rejected"));
const generationStatus = v.union(v.literal("pending"), v.literal("ready"), v.literal("fallback"), v.literal("error"), v.literal("stale"));
const timelinePeriodType = v.union(v.literal("week"), v.literal("month"), v.literal("long_range"));

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    locale: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_clerkUserId", ["clerkUserId"]),

  onboardingDrafts: defineTable({
    userId: v.optional(v.id("users")),
    clientDraftId: v.optional(v.string()),
    currentStep: v.number(),
    identity: v.optional(identity),
    birthDate: v.optional(v.string()),
    birthTime: v.optional(v.string()),
    birthTimePrecision: v.optional(birthTimePrecision),
    birthPlaceLabel: v.optional(v.string()),
    placeId: v.optional(v.string()),
    placeProvider: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    timezone: v.optional(v.string()),
    accountState: v.union(v.literal("anonymous"), v.literal("created")),
    paymentState,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_clientDraftId", ["clientDraftId"]),

  birthData: defineTable({
    userId: v.id("users"),
    birthDate: v.string(),
    birthTime: v.optional(v.string()),
    birthTimePrecision,
    birthPlaceLabel: v.string(),
    placeId: v.optional(v.string()),
    placeProvider: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    timezone: v.string(),
    source: v.union(v.literal("onboarding"), v.literal("profile"), v.literal("import")),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index("by_user", ["userId"]),

  natalCharts: defineTable({
    userId: v.id("users"),
    birthDataId: v.id("birthData"),
    birthDataHash: v.optional(v.string()),
    cacheKey: v.optional(v.string()),
    providerVersion: v.optional(v.string()),
    calculationVersion: v.string(),
    payload: v.any(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number())
  })
    .index("by_user", ["userId"])
    .index("by_birthData", ["birthDataId"])
    .index("by_user_version", ["userId", "calculationVersion"])
    .index("by_cacheKey", ["cacheKey"]),

  profileAstrologyCaches: defineTable({
    userId: v.id("users"),
    birthDataId: v.id("birthData"),
    natalChartId: v.optional(v.id("natalCharts")),
    cacheKey: v.string(),
    cacheVersion: v.string(),
    payload: v.any(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_birthData", ["birthDataId"])
    .index("by_cacheKey", ["cacheKey"])
    .index("by_user_version", ["userId", "cacheVersion"]),

  natalInterpretations: defineTable({
    userId: v.id("users"),
    natalChartId: v.id("natalCharts"),
    feature: v.string(),
    locale: v.string(),
    promptVersion: v.string(),
    cacheVersion: v.string(),
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
    status: generationStatus,
    payload: v.any(),
    usage: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_chart_feature_version", ["natalChartId", "feature", "promptVersion"])
    .index("by_user_feature_version", ["userId", "feature", "promptVersion"]),

  dailyReadings: defineTable({
    userId: v.id("users"),
    localDate: v.string(),
    timezone: v.string(),
    natalChartId: v.optional(v.id("natalCharts")),
    contentVersion: v.string(),
    promptVersion: v.optional(v.string()),
    cacheVersion: v.optional(v.string()),
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
    status: v.optional(generationStatus),
    usage: v.optional(v.any()),
    payload: v.any(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number())
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "localDate"])
    .index("by_user_date_version", ["userId", "localDate", "contentVersion"]),

  dailyLlmReadings: defineTable({
    userId: v.id("users"),
    localDate: v.string(),
    timezone: v.string(),
    natalChartId: v.optional(v.id("natalCharts")),
    promptVersion: v.string(),
    cacheVersion: v.string(),
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
    status: generationStatus,
    payload: v.any(),
    usage: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "localDate"])
    .index("by_user_date_prompt", ["userId", "localDate", "promptVersion"]),

  transitReadings: defineTable({
    userId: v.id("users"),
    localDate: v.string(),
    timezone: v.string(),
    natalChartId: v.optional(v.id("natalCharts")),
    providerVersion: v.optional(v.string()),
    timelineVersion: v.optional(v.string()),
    payload: v.any(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number())
  })
    .index("by_user_date", ["userId", "localDate"])
    .index("by_user_date_provider", ["userId", "localDate", "providerVersion"]),

  transitTimelineCaches: defineTable({
    userId: v.id("users"),
    natalChartId: v.optional(v.id("natalCharts")),
    periodType: timelinePeriodType,
    periodStart: v.string(),
    periodEnd: v.string(),
    providerVersion: v.string(),
    timelineVersion: v.string(),
    payload: v.any(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user_period", ["userId", "periodType", "periodStart"])
    .index("by_chart_period_version", ["natalChartId", "periodStart", "providerVersion"])
    .index("by_user_period_version", ["userId", "periodStart", "providerVersion"]),

  globalSkyCaches: defineTable({
    localDate: v.string(),
    timezone: v.string(),
    providerVersion: v.string(),
    payload: v.any(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_date", ["localDate"])
    .index("by_date_timezone_version", ["localDate", "timezone", "providerVersion"]),

  savedReadings: defineTable({
    userId: v.id("users"),
    readingId: v.optional(v.id("dailyReadings")),
    readingDate: v.string(),
    readingPayload: v.any(),
    note: v.optional(v.string()),
    createdAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_reading", ["userId", "readingId"]),

  journalEntries: defineTable({
    userId: v.id("users"),
    readingId: v.optional(v.id("dailyReadings")),
    title: v.string(),
    note: v.string(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_reading", ["readingId"]),

  relationshipProfiles: defineTable({
    userId: v.id("users"),
    name: v.string(),
    birthDate: v.optional(v.string()),
    birthTime: v.optional(v.string()),
    birthPlaceLabel: v.optional(v.string()),
    zodiacSign: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"]),

  notificationPreferences: defineTable({
    userId: v.id("users"),
    enabled: v.boolean(),
    dailyTime: v.string(),
    timezone: v.string(),
    topics: v.array(v.string()),
    updatedAt: v.number()
  }).index("by_user", ["userId"]),

  devices: defineTable({
    userId: v.id("users"),
    platform: v.string(),
    pushToken: v.string(),
    permissionStatus: v.string(),
    lastSeenAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_pushToken", ["pushToken"]),

  // Una fila por (userId, provider): cada webhook (RevenueCat, Stripe) escribe
  // su propia fila sin pisar la del otro proveedor. `subscriptions.getCurrent`
  // resuelve el acceso combinando todas las filas del usuario.
  subscriptions: defineTable({
    userId: v.id("users"),
    // Denormalizado para que los webhooks resuelvan el usuario sin auth ctx.
    clerkUserId: v.optional(v.string()),
    entitlement,
    status: subscriptionStatus,
    provider: v.optional(subscriptionProvider),
    plan: v.optional(subscriptionPlan),
    productId: v.optional(v.string()),
    providerCustomerId: v.optional(v.string()),
    providerSubscriptionId: v.optional(v.string()),
    originalTransactionId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    isLifetime: v.optional(v.boolean()),
    willRenew: v.optional(v.boolean()),
    environment: v.optional(providerEnvironment),
    // event_timestamp del último evento aplicado; descarta webhooks fuera de orden.
    lastEventAt: v.optional(v.number()),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_provider", ["userId", "provider"])
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_providerCustomerId", ["providerCustomerId"])
    .index("by_providerSubscriptionId", ["providerSubscriptionId"]),

  // Idempotencia + auditoría de webhooks de pago. Un evento ya visto
  // (por provider+eventId) no se reaplica.
  paymentEvents: defineTable({
    provider: subscriptionProvider,
    eventId: v.string(),
    eventType: v.string(),
    clerkUserId: v.optional(v.string()),
    rawPayload: v.any(),
    processedAt: v.number()
  }).index("by_provider_eventId", ["provider", "eventId"]),

  labSubjects: defineTable({
    createdByUserId: v.id("users"),
    displayName: v.string(),
    birthDate: v.string(),
    birthTime: v.optional(v.string()),
    birthTimePrecision,
    birthPlaceLabel: v.string(),
    placeId: v.optional(v.string()),
    placeProvider: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    timezone: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_createdBy", ["createdByUserId"])
    .index("by_createdBy_updatedAt", ["createdByUserId", "updatedAt"]),

  labRuns: defineTable({
    createdByUserId: v.id("users"),
    subjectId: v.id("labSubjects"),
    localDate: v.string(),
    timezone: v.string(),
    normalizedInput: v.any(),
    chartPayload: v.any(),
    dailyReadingPayload: v.any(),
    modelVersions: v.object({
      chart: v.string(),
      dailyReading: v.string()
    }),
    modelGaps: v.array(v.string()),
    editorialPayload: v.optional(v.any()),
    futureSelfNote: v.optional(v.string()),
    editorialUpdatedAt: v.optional(v.number()),
    reviewStatus: v.optional(labReviewStatus),
    reviewNote: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number()
  })
    .index("by_createdBy", ["createdByUserId"])
    .index("by_createdBy_createdAt", ["createdByUserId", "createdAt"])
    .index("by_subject_createdAt", ["subjectId", "createdAt"]),

  contentModules: defineTable({
    kind: v.union(
      v.literal("headline"),
      v.literal("do"),
      v.literal("avoid"),
      v.literal("energy"),
      v.literal("action"),
      v.literal("topic"),
      v.literal("long_read"),
      v.literal("education")
    ),
    locale: v.string(),
    topic: v.optional(v.string()),
    zodiacSign: v.optional(v.string()),
    transitType: v.optional(v.string()),
    entitlement,
    title: v.string(),
    body: v.string(),
    action: v.optional(v.string()),
    status: contentStatus,
    version: v.string(),
    publishedAt: v.optional(v.number()),
    createdAt: v.number()
  })
    .index("by_kind_status", ["kind", "status"])
    .index("by_locale_status", ["locale", "status"]),

  // El Vacío (`void.ask`): una fila por pregunta respondida. El cupo diario
  // (3 free / 5 pro) se calcula contando las filas de `(userId, localDate)`.
  // `payload` = VoidAnswerPayload (contrato en src/services/appRefs.ts).
  voidAnswers: defineTable({
    userId: v.id("users"),
    localDate: v.string(),
    question: v.string(),
    payload: v.any(),
    createdAt: v.number()
  }).index("by_user_date", ["userId", "localDate"]),

  // El Vacío — cache diario de las preguntas sugeridas personalizadas (1 set por
  // usuario por día). `payload` = { categories: [{ key, label, glyph, prompts[] }] }.
  voidPromptSets: defineTable({
    userId: v.id("users"),
    localDate: v.string(),
    payload: v.any(),
    createdAt: v.number()
  }).index("by_user_date", ["userId", "localDate"]),

  // Guía diaria personalizada (LLM sobre aspectos tránsito→carta natal). Cache 1 por
  // usuario por día. `payload` = DailyGuidePayload (contrato en src/services/appRefs.ts).
  dailyGuides: defineTable({
    userId: v.id("users"),
    localDate: v.string(),
    payload: v.any(),
    createdAt: v.number(),
    // Generar la guía no revela la carta. La primera interacción guarda esta
    // marca y el reveal queda irreversible para ese día.
    revealedAt: v.optional(v.number())
  }).index("by_user_date", ["userId", "localDate"])
});

// ---------------------------------------------------------------------------
// TODO: pendiente backend — Web B0 (propuesto por frontend, 2026-07-05)
//
// Las pantallas de módulos de la Web B0 necesitan estas funciones públicas.
// No requieren tablas nuevas: derivan de `natalCharts` / `transitReadings`
// (payload v.any()). Las formas de payload son el contrato TS del front en
// `src/services/appRefs.ts`. Detalle en `convex/CHANGELOG.md` (2026-07-05) y
// `docs/web-b0-backend-map.md`.
//
//   charts.valuesMap():                 ValuesMapPayload         // Mapa de valores
//   charts.personalityReading():        PersonalityReadingPayload// Horóscopo de personalidad
//   transits.getToday({ localDate }):   TransitDetailPayload     // Tránsito en el espacio
//   places.resolve({ query }):          PlaceLookup              // geocoding real onboarding
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TODO: pendiente backend — App Core V4.7 (propuesto por frontend, 2026-07-05)
//
// Las tabs Vínculo y el módulo Calendario del app core necesitan estas
// funciones. Vínculo usa la tabla `relationshipProfiles` existente; Calendario
// deriva de tránsitos por fecha (no requiere tabla nueva; opcional cache). Las
// formas de payload son el contrato TS en `src/services/appCoreRefs.ts`.
// Detalle en `convex/CHANGELOG.md` (2026-07-05) y `docs/app-core-backend-map.md`.
//
//   relationships.add({ name, birthDate, birthTime?, birthPlaceLabel? })
//                                       : { relationshipProfileId }
//   relationships.synastry({ relationshipProfileId }): SynastryPayload
//   calendar.getMonth({ month }):       CalendarMonthPayload
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TODO: pendiente backend — El Vacío (propuesto por frontend, 2026-07-06)
//
// La pantalla Void (app nativa, 3 momentos: Entrada → Escuchando → Respuesta)
// necesita una función que responda la pregunta del día. Guardrails duros:
// NUNCA contesta sí/no; devuelve marco + mejor pregunta + un paso concreto;
// sin claims de destino/salud/dinero/legal. Deriva de la carta natal +
// tránsitos del día (placements reales en `basadoEn`). Límite: una pregunta
// por día por usuario. Forma de payload en `src/services/appRefs.ts`
// (`VoidAnswerPayload`). Front trabaja contra mock en `app/reading/void.tsx`.
//
//   void.ask({ question }):             VoidAnswerPayload
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TODO: pendiente backend — Capacidades ampliadas (propuesto por frontend, 2026-07-07)
//
// Endpoints de AstrologyAPI ya disponibles pero SIN cablear. No requieren tablas
// nuevas (cache opcional, patrón `transits.getToday`). Formas de payload = contrato
// TS del front en `src/services/skyRefs.ts`. Catálogo completo en
// `docs/api-capacidades-orbita.md`; detalle en `convex/CHANGELOG.md` (2026-07-07).
// Guardrail: la API trae claims de salud/dinero/suerte; se reescribe voz Órbita
// y pasa por /backoffice antes de app.
//
//   sky.getMoonPhase({ localDate, timezone }): MoonPhasePayload   // moon_phase_report — free
//   forecast.getLongRange():                   LongRangeForecastPayload // life_forecast_report — premium
//   charts.solarReturn({ year }):              SolarReturnPayload   // solar_return_* — premium
//   content.sunSignDaily({ sign, localDate }): SunSignContentPayload// sun_sign_prediction/daily — free
//
// (Sinastría `relationships.synastry` ya está propuesta en el bloque App Core;
//  motor confirmado: synastry_horoscope + love_compatibility_report.)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TODO: pendiente backend — Tránsitos por área (propuesto por frontend, 2026-07-09)
//
// El tab Tránsitos (logueado) embebe una sección "POR ÁREA" al final: el tránsito
// principal del día desglosado en las 4 áreas (Amor / Trabajo / Vínculos / Energía).
// No requiere tabla nueva: se suma a `TransitDetailPayload` (payload v.any() de
// `transitReadings`). Forma en `src/services/appRefs.ts` (`TransitDetailPayload.porArea`).
// Si el backend no la devuelve, el front oculta la sección (fallback → sin `porArea`).
// Mismos guardrails que el daily (entretenimiento/autoconocimiento; sin destino/
// dinero/salud/legal; voseo). Detalle en `convex/CHANGELOG.md` (2026-07-09).
//
//   transits.getToday({ localDate }):   TransitDetailPayload
//     + porArea?: Array<{ title: string; body: string }>   // 4 áreas, lectura por área
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TODO: pendiente backend — Enriquecer input del prompt daily (propuesto por frontend, 2026-07-09)
//
// `buildDailyPrompt` (convex/daily.ts) hoy pasa a GPT solo Sol/Luna/Asc + líneas
// de tránsito. La API YA trae el contexto del punto que el tránsito toca (signo,
// casa, aspectos natales — en chartWheelData planets/houses/aspects), pero no
// llega al prompt → el LLM genera "a ciegas" sobre ese punto. No cambia contrato
// de tipos del front; mejora calidad del texto. Verificado en vivo con
// publicLab:previewCompleteHoroscope (14/08/2002). Detalle en convex/CHANGELOG.md
// (2026-07-09) y .claude/plans/mossy-gathering-lobster.md.
//
//   buildDailyPrompt: por cada tránsito incluir { natalPoint, signo, casa, aspectosNatales }
//
// Sinastría para Vínculos ("con quién sintonizás") ya propuesta en el bloque
// App Core V4.7: relationships.synastry({ relationshipProfileId }): SynastryPayload.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TODO: pendiente backend — Calidad de generación diaria (propuesto por frontend, 2026-07-10)
//
// Feedback de usuario real (Sofi): (1) el HACÉ repite el body ("dice lo mismo"),
// (2) la lectura del tránsito es larga y repite placements, (3) energía en crudo
// ("Elemento de base: agua"). Reglas a sumar al prompt daily + humanizar plantillas:
//   1. Cada campo aporta algo DISTINTO (body explica; hacé/evitá/acción/energía
//      no repiten ideas ni frases del body ni entre sí).
//   2. No repetir placements; nombrar cada planeta/signo/casa una sola vez.
//   3. Conciso: body 2-3 frases, una idea por frase.
//   4. Criollo: traducir "Elemento de base: agua" / "casa 9" / "cuadratura" al
//      efecto humano (agua -> "desde lo sensible y la memoria", etc.).
// Afecta convex/daily.ts (buildDailyPrompt), convex/lib/orbita.ts (energy template
// + buildTopicReadings). Detalle en convex/CHANGELOG.md (2026-07-10).
// ---------------------------------------------------------------------------
