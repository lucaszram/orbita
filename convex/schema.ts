import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  analysisDataValidator,
  analysisIdValidator,
  analysisStatusValidator,
  comparisonLevelValidator,
  elaborationValidator,
  ephemerisPositionValidator,
  precisionValidator,
  relationshipComparisonDataValidator,
  sourceRefValidator,
} from "./lib/layerContract";

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
const subscriptionPlan = v.union(
  v.literal("monthly"),
  // Legacy values remain readable for subscriptions created before the web
  // offer moved to a single monthly plan.
  v.literal("weekly"),
  v.literal("yearly"),
  v.literal("lifetime")
);
const providerEnvironment = v.union(v.literal("sandbox"), v.literal("production"));
const contentStatus = v.union(v.literal("draft"), v.literal("review"), v.literal("published"), v.literal("archived"));
const labReviewStatus = v.union(v.literal("needs_review"), v.literal("approved"), v.literal("rejected"));
const generationStatus = v.union(v.literal("pending"), v.literal("ready"), v.literal("fallback"), v.literal("error"), v.literal("stale"));
const timelinePeriodType = v.union(v.literal("week"), v.literal("month"), v.literal("long_range"));
const productEventName = v.union(
  v.literal("app_opened"),
  v.literal("onboarding_started"),
  v.literal("onboarding_step_viewed"),
  v.literal("account_created"),
  v.literal("onboarding_completed"),
  // Legacy event already persisted in development before the analytics
  // contract was narrowed. Keep it readable so schema deploys never require
  // deleting historical telemetry; new writes use `onboarding_completed`.
  v.literal("natal_chart_created"),
  v.literal("natal_interpretation_created"),
  v.literal("daily_guide_created"),
  v.literal("transit_reading_created"),
  v.literal("void_answer_created"),
  v.literal("saved_reading_created"),
  v.literal("journal_entry_created"),
  v.literal("natal_chart_viewed"),
  v.literal("daily_guide_viewed"),
  v.literal("daily_card_revealed"),
  v.literal("paywall_viewed"),
  v.literal("checkout_started"),
  v.literal("checkout_completed"),
  v.literal("checkout_failed")
);
const productEventSource = v.union(v.literal("frontend"), v.literal("backend"));
const digestStatus = v.union(v.literal("sending"), v.literal("sent"), v.literal("error"));

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    locale: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_clerkUserId", ["clerkUserId"]),

  // Identidad seudónima por instalación. Cuando hay sesión se vincula al userId,
  // lo que permite unir la apertura previa al login con la cuenta sin guardar PII.
  productActors: defineTable({
    installationId: v.string(),
    userId: v.optional(v.id("users")),
    firstSeenAt: v.number(),
    firstSeenDate: v.string(),
    firstOpenedAt: v.optional(v.number()),
    firstOpenedDate: v.optional(v.string()),
    lastOpenedAt: v.optional(v.number()),
    lastOpenedDate: v.optional(v.string()),
    platform: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    buildNumber: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_installation", ["installationId"])
    .index("by_user", ["userId"])
    .index("by_first_opened_date", ["firstOpenedDate"]),

  // Hechos observables, sin email, datos natales, preguntas ni contenido libre.
  // eventId hace que los reintentos del cliente y del backend sean idempotentes.
  productEvents: defineTable({
    eventId: v.string(),
    eventName: productEventName,
    source: productEventSource,
    actorId: v.optional(v.id("productActors")),
    userId: v.optional(v.id("users")),
    installationId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    localDate: v.string(),
    occurredAt: v.number(),
    platform: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    buildNumber: v.optional(v.string()),
    onboardingStep: v.optional(v.number()),
    entryPoint: v.optional(v.string()),
    // Read-only compatibility for telemetry backfilled before the current
    // product analytics contract. Current writers do not emit these fields.
    backfilled: v.optional(v.boolean()),
    resourceId: v.optional(v.string())
  })
    .index("by_event_id", ["eventId"])
    .index("by_date_event", ["localDate", "eventName"])
    .index("by_user_date", ["userId", "localDate"])
    .index("by_actor_date", ["actorId", "localDate"]),

  // Claim del digest para que el cron no mande dos resúmenes del mismo día.
  productDigests: defineTable({
    localDate: v.string(),
    status: digestStatus,
    requestedAt: v.number(),
    sentAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    errorCode: v.optional(v.string())
  }).index("by_date", ["localDate"]),

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
    // Claim durable del enriquecimiento técnico. Evita que cada autoguardado
    // programe otro worker para el mismo lugar; se libera al resolver, agotar
    // los reintentos o cambiar la elección.
    timezoneResolutionKey: v.optional(v.string()),
    // Conserva el origen después de que Clerk adjunta la cuenta. Permite
    // separar un alta nueva recuperable de una cuenta existente que debe
    // completar sus datos desde /editar-datos.
    flowOrigin: v.optional(v.union(v.literal("anonymous_signup"), v.literal("authenticated_recovery"))),
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
    /**
     * Revisión del payload natal con el que se generó esta lectura
     * (`natalPayloadRevision`). El `natalChartId` NO alcanza: una mejora de la
     * carta reescribe el payload sobre la misma fila, así que una lectura
     * `ready` de la carta parcial seguiría leyéndose como cache hit sobre la
     * carta completa. Opcional para las filas legadas, que no pueden demostrar
     * sobre qué carta se generaron y por eso se regeneran en vez de publicarse.
     */
    chartRevision: v.optional(v.string()),
    /**
     * Número del claim vigente, monótono por fila. La persistencia final es un
     * CAS: una generación sólo escribe si todavía es dueña de este número. Una
     * generación vieja que perdió el lease no puede pisar la lectura del claim
     * nuevo.
     */
    claimSeq: v.optional(v.number()),
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
    // Clave opaca del intento de creación. Permite reintentar una mutation sin
    // confundir el reintento con otra persona intencionalmente igual.
    creationRequestKey: v.optional(v.string()),
    name: v.string(),
    birthDate: v.optional(v.string()),
    birthTime: v.optional(v.string()),
    birthTimePrecision: v.optional(birthTimePrecision),
    birthPlaceLabel: v.optional(v.string()),
    placeId: v.optional(v.string()),
    placeProvider: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    timezone: v.optional(v.string()),
    zodiacSign: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"])
    .index("by_user_creation_request_key", ["userId", "creationRequestKey"]),

  // V4.9.2: resultados personales con un contrato cerrado. Las filas legacy
  // siguen intactas para clientes instalados; la nueva app nunca escribe mocks.
  analysisSnapshotsV492: defineTable({
    userId: v.id("users"),
    birthDataId: v.optional(v.id("birthData")),
    natalChartId: v.optional(v.id("natalCharts")),
    analysisId: analysisIdValidator,
    cacheKey: v.string(),
    localDate: v.optional(v.string()),
    timezone: v.optional(v.string()),
    methodVersion: v.string(),
    providerVersion: v.optional(v.string()),
    inputHash: v.string(),
    status: analysisStatusValidator,
    precision: precisionValidator,
    observedAt: v.number(),
    validUntil: v.union(v.number(), v.null()),
    data: v.union(analysisDataValidator, v.null()),
    missingInputs: v.array(v.string()),
    limitations: v.array(v.string()),
    elaboration: elaborationValidator,
    sourceRefs: v.array(sourceRefValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_analysis", ["userId", "analysisId"])
    .index("by_cache_key", ["cacheKey"]),

  // Posiciones natales canónicas de `planets/tropical`. Se guardan sólo las
  // diez posiciones normalizadas que usa V4.9.2; nunca el payload crudo del
  // proveedor. El hash cambia con los datos natales o la versión del método,
  // por lo que una efeméride histórica se calcula una sola vez por carta.
  natalEphemerisCachesV492: defineTable({
    userId: v.id("users"),
    birthDataId: v.optional(v.id("birthData")),
    natalChartId: v.optional(v.id("natalCharts")),
    cacheKey: v.string(),
    inputHash: v.string(),
    methodVersion: v.string(),
    providerVersion: v.string(),
    birthTimePrecision: birthTimePrecision,
    samples: v.array(
      v.object({
        instantMs: v.number(),
        positions: v.array(ephemerisPositionValidator),
      }),
    ),
    calculatedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_cache_key", ["cacheKey"]),

  // Efeméride global tipada. No contiene datos natales ni pertenece a una
  // cuenta, por eso no forma parte del borrado personal.
  globalSkySnapshotsV492: defineTable({
    cacheKey: v.string(),
    localDate: v.string(),
    timezone: v.string(),
    providerVersion: v.string(),
    observedAt: v.number(),
    validUntil: v.number(),
    positions: v.array(ephemerisPositionValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_cache_key", ["cacheKey"])
    .index("by_date_timezone", ["localDate", "timezone"]),

  relationshipComparisonCachesV492: defineTable({
    userId: v.id("users"),
    profileId: v.id("relationshipProfiles"),
    requestedLevel: comparisonLevelValidator,
    cacheKey: v.string(),
    analysisId: v.union(v.literal("ORB-REL-002"), v.literal("ORB-REL-003")),
    methodVersion: v.string(),
    providerVersion: v.optional(v.string()),
    inputHash: v.string(),
    status: analysisStatusValidator,
    precision: precisionValidator,
    observedAt: v.number(),
    validUntil: v.union(v.number(), v.null()),
    data: v.union(relationshipComparisonDataValidator, v.null()),
    missingInputs: v.array(v.string()),
    limitations: v.array(v.string()),
    elaboration: elaborationValidator,
    sourceRefs: v.array(sourceRefValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_profile", ["userId", "profileId"])
    .index("by_cache_key", ["cacheKey"]),

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

  // Identidad de una fila: **(userId, provider, environment)**.
  //
  // Cada webhook (RevenueCat, Stripe) escribe su propia fila sin pisar la del
  // otro proveedor, y `subscriptions.getCurrent` resuelve el acceso combinando
  // todas las filas del usuario.
  //
  // `environment` es parte de la identidad, no un adorno: una cuenta de review
  // tiene una fila `production` y otra `sandbox` A LA VEZ y no pueden pisarse
  // —un recibo Sandbox no sostiene acceso productivo—. El índice sigue siendo
  // `by_user_provider` porque son una o dos filas por proveedor: los escritores
  // (`payments/revenuecat.ts`, `payments/revenuecatRest.ts`) las colectan y
  // eligen por entorno en vez de usar `first()`, que dejaba la elección librada
  // al orden del índice. Ver `convex/CHANGELOG.md`.
  //
  // Las filas de RevenueCat SIN `environment` son legado: fallan cerrado en
  // `isRowActive` y la reconciliación REST las repara escribiendo el entorno.
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
  })
    .index("by_provider_eventId", ["provider", "eventId"])
    .index("by_clerkUserId", ["clerkUserId"]),

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
    timezone: v.optional(v.string()),
    // Identidad de la personalización. Permite conservar la carta/ritual del
    // día y regenerar solo los módulos derivados cuando se editan datos natales.
    birthDataUpdatedAt: v.optional(v.number()),
    natalChartId: v.optional(v.id("natalCharts")),
    payload: v.any(),
    createdAt: v.number(),
    // Generar la guía no revela la carta. La primera interacción guarda esta
    // marca y el reveal queda irreversible para ese día.
    revealedAt: v.optional(v.number())
  }).index("by_user_date", ["userId", "localDate"]),

  // Rate limit de las acciones públicas SIN sesión (hoy: la tríada del
  // onboarding anónimo). Un documento por ventana fija y por sujeto —el
  // borrador del alta, o "all" para el fusible global—. No guarda datos
  // natales: el sujeto es un hash corto. `by_expiresAt` limpia las vencidas.
  publicRateLimits: defineTable({
    // `bucketKey` ya no lleva el sujeto en claro: se hashea (ver
    // `rateLimitSubjectHash`). Esta tabla puede sobrevivir a un borrado de
    // cuenta que falle a mitad, y no puede quedar con un identificador de
    // persona pegado.
    bucketKey: v.string(),
    scope: v.string(),
    /**
     * Hash del sujeto, indexado. Es lo único que permite encontrar y borrar los
     * contadores de una cuenta durante la eliminación, sin guardar su id.
     * Opcional: las filas anónimas (fusible global) no tienen sujeto.
     */
    subjectHash: v.optional(v.string()),
    count: v.number(),
    windowStartedAt: v.number(),
    expiresAt: v.number()
  })
    .index("by_bucketKey", ["bucketKey"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_scope_subjectHash", ["scope", "subjectHash"]),

  // Estado DURABLE de la reconciliación con la tienda.
  //
  // Existe porque las scheduled ACTIONS de Convex son at-most-once y no se
  // reprograman solas: si la action muere —o si nunca llega a su primera
  // línea— la reparación se pierde y el cargo queda sin reflejarse. Intentar
  // cerrar eso desde la propia action (preagendar su sucesora) no alcanza: si
  // ese `runAfter` rechaza, la action muere sin sucesor y no queda nada.
  //
  // El modelo que sí cierra la ventana es el documentado por Convex: una
  // MUTATION agendada comprueba el estado persistido y agenda —o reagenda— la
  // action de forma atómica. Las mutations sí se reintentan ante un fallo
  // transitorio, y su `scheduler.runAfter` es parte de su transacción: o quedan
  // escritos el intento y su vigilancia, o no queda nada a medias.
  //
  // Una fila por trabajo. `status: "pending"` significa "hay una reparación sin
  // confirmar y un watchdog vigilándola"; `settled` la cierra y cancela el
  // watchdog. `attempt` acota el reintento y hace la recuperación idempotente.
  // Exactamente UNA fila por cuenta, reutilizada entre generaciones: el trabajo
  // no se acumula. `enqueueStoreReconcile` la crea o la reabre; la eliminación
  // de cuenta la borra.
  reconcileJobs: defineTable({
    clerkUserId: v.string(),
    /** Quién pidió la reparación. Sólo auditoría; nunca decide acceso. */
    trigger: v.string(),
    /**
     * Señales y generación — lo que cierra el "lost wakeup".
     *
     * `requestedSeq` sube en CADA pedido, incluso si ya hay un trabajo en
     * curso: sin eso, un webhook que llegaba mientras una corrida estaba en
     * vuelo se perdía, y esa corrida —con un snapshot ya viejo— liquidaba el
     * trabajo. `startedSeq` es la señal que la corrida actual está atendiendo:
     * si `requestedSeq` la superó, la corrida NO puede liquidar.
     *
     * `generation` sube cuando una señal nueva reabre un trabajo ya cerrado, y
     * forma parte del lease para que una respuesta tardía de la generación
     * anterior no pueda tocar la nueva.
     */
    generation: v.number(),
    requestedSeq: v.number(),
    startedSeq: v.number(),
    attempt: v.number(),
    status: v.union(v.literal("pending"), v.literal("settled")),
    /** Por qué se cerró: `resolved`, `exhausted`, o el motivo permanente. */
    outcome: v.optional(v.string()),
    /**
     * Token determinista de la corrida vigente (`generación:señal:intento`). La
     * action lo transporta y `settleReconcileJob` sólo acepta el que coincide:
     * un resultado tardío no liquida un trabajo que ya es de otra corrida, y
     * tampoco cancela su watchdog.
     */
    leaseToken: v.optional(v.string()),
    /**
     * Id del scheduled function que vigila este intento. Es un
     * `Id<"_scheduled_functions">`, que en runtime es un string; se guarda como
     * string para no acoplar la tabla al validador de una tabla de sistema.
     */
    watchdogId: v.optional(v.string()),
    nextCheckAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_status", ["status"])
    .index("by_status_user", ["status", "clerkUserId"]),

  /**
   * Fence de supresión: identidades cuya cuenta ya fue borrada.
   *
   * ## El agujero que cierra
   *
   * `deleteAccountV2` barre la cuenta, pero el token de Clerk sigue siendo
   * válido hasta que la identidad se borra y el JWT expira. En esa ventana
   * cualquier llamada autenticada —otro dispositivo, otra pestaña, un retry
   * tardío de `ensureUser`— vuelve a entrar por `getOrCreateUser` y **recrea**
   * la fila `users` y su `account_created`. La cuenta reaparece.
   *
   * Esta tabla sobrevive a la barrida (no la toca `deleteAccountData`) y es lo
   * que hace que esa llamada falle cerrado.
   *
   * ## Qué guarda, y qué NO
   *
   * Sólo una clave derivada. **Cero** `clerkUserId`, `tokenIdentifier`, email o
   * `userId` en crudo: si guardáramos el subject, el fence sería un registro de
   * quién borró su cuenta, que es exactamente lo que la eliminación promete
   * hacer desaparecer.
   *
   * `identityKey` es una **clave seudónima de supresión**, no una anonimización:
   * es un SHA-256 de un dominio versionado + el `subject` de Clerk, sin secreto,
   * así que quien tenga un subject candidato puede comprobar si está en la
   * tabla. Los Clerk IDs tienen alta entropía, de modo que no es enumerable por
   * fuerza bruta, pero tampoco es irreversible frente a un candidato conocido.
   * `keyVersion` existe para migrar a HMAC con secreto en una etapa posterior
   * sin tener que reinterpretar las filas viejas.
   *
   * **No expira.** Expirar reabriría exactamente la ventana del token viejo. Un
   * alta nueva en Clerk obtiene otro `subject`, así que nadie queda bloqueado.
   */
  accountDeletionFences: defineTable({
    identityKey: v.string(),
    keyVersion: v.number(),
    createdAt: v.number(),
    /**
     * **Tombstone durable: Clerk confirmó que esta identidad ya no existe.**
     *
     * Antes ese hecho vivía sólo en memoria del cliente (`identityConfirmedFor`
     * en `PendingDeletionBoundary`). Si el proceso moría entre el `deleteUser`
     * ok y la escritura del checkpoint, no quedaba rastro: el arranque siguiente
     * mandaba a `needs-owner`, o sea a entrar con una cuenta que ya no existe, y
     * la única salida era soporte.
     *
     * Vive acá, y no en una tabla nueva, porque la fila del fence ya existe para
     * exactamente este `subject` y ya está indexada por su clave seudónima: es
     * el mismo hecho en otra etapa, no un hecho distinto.
     *
     * Ausente = no se sabe. **Nunca se infiere de un `signed-out`**: sólo lo
     * escribe el finalizador, y sólo cuando Clerk confirma.
     */
    identityDeletedAt: v.optional(v.number())
  }).index("by_identityKey", ["identityKey"]),

  /**
   * Trabajo durable: borrar la identidad en Clerk, con reintentos.
   *
   * ## Por qué existe
   *
   * El borrado de una cuenta son dos cosas en dos lugares: los datos (Convex) y
   * la identidad (Clerk). Mientras el segundo paso lo daba el cliente, dependía
   * de que la app siguiera viva. Esta fila lo convierte en trabajo del servidor:
   * se escribe en la MISMA transacción que el fence y la barrida, así que o
   * quedan los tres o no queda ninguno.
   *
   * ## El identificador en crudo, y por qué está acotado
   *
   * `clerkUserId` es el Clerk id **en claro**: no se puede pedirle a Clerk que
   * borre una identidad sin nombrarla. Es una excepción deliberada y **acotada
   * en el tiempo**: la fila se borra en cuanto Clerk confirma, y lo único que
   * queda para siempre es la clave seudónima del fence. Esta tabla NO está en
   * `USER_SCOPED_DELETION_STEPS` — si la barrida se la llevara, el trabajo
   * moriría en la transacción que lo crea y la identidad no se borraría nunca.
   */
  identityDeletionJobs: defineTable({
    /** Clerk id en claro. Transitorio: la fila se borra al confirmar. */
    clerkUserId: v.string(),
    /** Fence que este trabajo promueve cuando Clerk confirma. */
    identityKey: v.string(),
    keyVersion: v.number(),
    attempt: v.number(),
    status: v.union(v.literal("pending"), v.literal("settled")),
    /** Por qué se cerró, cuando se cierra sin borrar. Sólo auditoría. */
    outcome: v.optional(v.string()),
    createdAt: v.number(),
    /** Backoff: antes de este instante no se reintenta. */
    nextAttemptAt: v.optional(v.number()),
    watchdogId: v.optional(v.string())
  })
    .index("by_identityKey", ["identityKey"])
    .index("by_status", ["status"])
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
