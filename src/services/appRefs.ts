import { anyApi } from "convex/server";
import type { FunctionReference } from "convex/server";
import type { ProductEventPayload } from "@/domain/productEvents";
import type { PublicDailyHome } from "./publicLabRefs";

/**
 * Capa de datos del front para la Web B0 (usuario autenticado con Clerk).
 *
 * Patrón: como `convex/_generated/` no se consume en este worktree, enlazamos
 * las funciones Convex vía `anyApi` y declaramos a mano las firmas y las formas
 * de payload. El tipo TS ES el contrato para los campos `payload: v.any()`.
 *
 * - Las funciones bajo `appApi` YA existen en `convex/` (ver `schema.ts` + módulos).
 * - Las funciones bajo `proposedApi` todavía NO existen: son el pedido del front
 *   al backend. Ver `convex/CHANGELOG.md` y el bloque `// TODO: pendiente backend`
 *   en `convex/schema.ts`. Mientras tanto, se trabaja contra mocks tipados.
 *
 * Mapa pantalla → dato en `docs/web-b0-backend-map.md`.
 */

/** Envelope que Convex agrega a todo documento. */
type Doc<T> = T & { _id: string; _creationTime: number };

type Empty = Record<string, never>;

// ---------------------------------------------------------------------------
// Formas de payload (contrato de los campos `payload: v.any()`)
// ---------------------------------------------------------------------------

export type SignPlacement = {
  planet: string;
  sign: string;
  house?: number;
  degree?: number;
  /** Id estable del punto: "sun" | "moon" | "ascendant" | "mercury"… */
  key?: string;
  /** Longitud eclíptica 0–360 (para ubicar el planeta en la rueda). */
  fullDegree?: number;
  /** Grado 0–30 dentro del signo (para mostrar "15° Leo"). */
  normDegree?: number;
  isRetrograde?: boolean;
};

export type NatalChartAspect = {
  from: string;
  to: string;
  type: string;
  /** Nombre en español: "trígono", "cuadratura"… */
  typeEs?: string;
  harmony: "harmony" | "tension" | "neutral";
  angle?: number;
  orb?: number;
  isMajor?: boolean;
};

/** Payload de `natalCharts.payload` — alimenta la pantalla Carta natal. */
export type NatalChartPayload = {
  triad: { sun: SignPlacement; moon: SignPlacement; ascendant: SignPlacement };
  placements: SignPlacement[];
  houses: Array<{ house: number; sign: string; cusp?: number; theme?: string }>;
  aspects: NatalChartAspect[];
  /** Longitud del Ascendente (ancla de rotación de la rueda). */
  ascendantDegree?: number;
  /** Longitud del Medio Cielo (MC). */
  mc?: number;
  /** Aspectos principales (top-6 por orbe) — para dibujar en la rueda. */
  mainAspects?: NatalChartAspect[];
  accuracy: string;
  limitations: string[];
};

export type UserDoc = Doc<{
  tokenIdentifier: string;
  clerkUserId: string;
  email?: string;
  name?: string;
  locale?: string;
}>;

export type BirthDataDoc = Doc<{
  userId: string;
  birthDate: string;
  birthTime?: string;
  birthTimePrecision: "known" | "approximate" | "unknown";
  birthPlaceLabel: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
}>;

export type NatalChartDoc = Doc<{
  userId: string;
  birthDataId: string;
  calculationVersion: string;
  payload: NatalChartPayload;
}>;

export type DailyReadingDoc = Doc<{
  userId: string;
  localDate: string;
  timezone: string;
  natalChartId?: string;
  contentVersion: string;
  payload: PublicDailyHome;
}>;

/** Fila de `readings.listSaved` (contrato PR #12): archivo remoto de guardadas. */
export type SavedReadingListItem = {
  savedReadingId: string;
  readingId: string | null;
  readingDate: string;
  /** Payload legado completo; el front lo valida antes de usarlo. */
  readingPayload: unknown;
  note: string | null;
  createdAt: number;
};

export type OnboardingDraftInput = {
  clientDraftId?: string;
  currentStep: number;
  identity?: "ella" | "el" | "prefiero_no_decirlo";
  birthDate?: string;
  birthTime?: string;
  birthTimePrecision?: "known" | "approximate" | "unknown";
  birthPlaceLabel?: string;
  placeId?: string;
  placeProvider?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
};

export type BirthDataInput = {
  birthDate: string;
  birthTime?: string;
  birthTimePrecision: "known" | "approximate" | "unknown";
  birthPlaceLabel: string;
  placeId?: string;
  placeProvider?: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  source?: "onboarding" | "profile" | "import";
};

export type CompleteBirthDataInput = {
  clientDraftId?: string;
  birthDate: string;
  birthTime?: string;
  birthTimePrecision: "known" | "approximate" | "unknown";
  birthPlaceLabel: string;
  placeId?: string;
  placeProvider?: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
};

// ---------------------------------------------------------------------------
// Formas propuestas (todavía sin función backend — ver proposedApi)
// ---------------------------------------------------------------------------

/** Mapa de valores (radar) — derivado de la carta natal. */
export type ValuesAxis = { key: string; label: string; harmony: number; tension: number };
export type ValuesMapPayload = {
  axes: ValuesAxis[];
  topDrivers: Array<{ label: string; value: number }>;
  topStressors: Array<{ label: string; value: number }>;
  note: string;
};

/** Horóscopo de personalidad — interpretación editorial de la carta. */
export type PersonalitySection = {
  key: string;
  title: string;
  intro: string;
  placement: { label: string; planet: string; sign?: string; house?: number };
  body: string;
  /** 1-2 preguntas de reflexión por sector (el plan LLM natal ya las prevé). */
  questions?: string[];
};
export type PersonalityReadingPayload = {
  headline: string;
  sections: PersonalitySection[];
  disclaimer: string;
};

/** Tránsito en el espacio — detalle del tránsito destacado del día. */
export type TransitDetailPayload = {
  title: string;
  aspect: { type: string; angleLabel: string };
  scene: {
    transitingBody: { name: string; label: string };
    natalPoint: { name: string; sign?: string; label: string };
  };
  reading: { fragments: Array<{ source: string; text: string }>; plain: string };
  frequency: { label: string; timeline: Array<{ label: string; current: boolean }> };
  earth: { headline: string; suggestions: string[] };
  window: { label: string; note: string };
  /** Lectura del tránsito de hoy desglosada por área (Amor/Trabajo/Vínculos/
   *  Energía). Hoy el backend NO la manda (queda undefined → el tab oculta la
   *  sección). Contrato pendiente en `transits.getToday`. Ver convex/CHANGELOG.md. */
  porArea?: Array<{ title: string; body: string }>;
};

export type VoidAnswerPayload = {
  /** Pregunta del usuario, normalizada. */
  question: string;
  /** Respuesta editorial del Vacío (nunca sí/no; marco para decidir). */
  answer: string;
  /** Placements usados, en mayúsculas mono (ej. "TU LUNA EN SAGITARIO"). */
  basadoEn: string[];
  mejorPregunta: string;
  /** Paso concreto y seguro (sin destino/salud/dinero/legal). */
  paso: string;
  /** Cupo diario restante después de esta pregunta (3 free / 5 pro). */
  remaining?: number;
  /** Cupo total del día. */
  limit?: number;
  /** true si ya no quedan preguntas hoy (no se generó respuesta). */
  locked?: boolean;
};

/** La carta del día, ya sorteada por el backend (determinística por usuario+fecha).
 *
 *  `id` (0–77, contrato PR #15: mayores 0–21 históricos + menores 22–77) viaja como
 *  número y el front resuelve la ilustración con `cardById(id)` de
 *  `src/content/tarotDeck.ts`: Metro no puede hacer `require()` con string dinámico,
 *  así que el mapeo id→imagen tiene que vivir en el bundle, no en el payload. */
/** Orientación con la que salió la carta (parte del sorteo diario, estable por
 *  usuario+fecha). El front rota SOLO la ilustración 180° cuando es `invertida`. */
export type DailyOrientacion = "derecho" | "invertida";

/** Una faceta del SIGNIFICADO GENERAL de la carta (título + una frase). */
export type DailyRitualFaceta = { titulo: string; texto: string };

/** El análisis de la carta del día — intrínseco a la carta (ya NO cruza con el cielo
 *  ni la carta natal). Estructura canónica (Figma sección 14, frame `727:127`):
 *  esencia → SIGNIFICADO GENERAL (siempre 3 facetas) → EN TU DÍA → EL CONSEJO →
 *  cierre (pregunta → Umbral). El backend v3 lo entrega SIEMPRE completo. */
export type DailyRitual = {
  esencia: string;
  significadoGeneral: DailyRitualFaceta[]; // siempre 3
  enTuDia: string;
  consejo: string;
  cierre: { pregunta: string; umbralSeed?: string };
};

export type DailyCarta = {
  id: number;
  nombre: string;
  correspondencia: string;
  orientacion: DailyOrientacion;
  ritual: DailyRitual;
};

/** Una celda de la tira del Diario. `cartaId` null = ese día no se generó guía (no abriste
 *  la app); el front lo pinta boca abajo igual. `orientacion` acompaña a la carta. */
export type DailyStripDay = {
  localDate: string;
  cartaId: number | null;
  orientacion: DailyOrientacion | null;
  revealed: boolean;
};

/** Un área de la Home (Amor/Trabajo/Familia/Vínculos) escrita por el LLM. */
export type DailyTopic = {
  topic: "amor" | "trabajo" | "familia" | "vinculos";
  label: string;
  title: string;
  oneLine: string;
  detail: string;
  hace: string;
  evita: string;
  question: string;
};

/** Guía diaria personalizada (análisis del cielo de hoy sobre la carta natal).
 *
 *  Desde `orbita-daily-home-v2`, una sola generación cubre TODA la Home: hero + guía +
 *  las 4 áreas + lectura larga, todo derivado de los mismos tránsitos y atado a una
 *  única `tesis`. Antes solo el hero era real y el resto salía de plantillas, así que
 *  la Home se contradecía consigo misma a mitad del scroll.
 *
 *  Los bloques nuevos son OPCIONALES: si el LLM está apagado o devuelve un JSON
 *  incompleto, llegan `undefined` y cada sección cae al engine local (`homeReading`). */
export type DailyGuidePayload = {
  headline: string;
  body: string;
  clima: string;
  destacado: { aspecto: string; lectura: string };
  secundarios: Array<{ aspecto: string; lectura: string }>;
  basadoEn: string[];
  disclaimer: string;
  /** Carta del día + su lectura. El sorteo no depende del LLM, así que siempre viene;
   *  si el LLM falló, los beats son los de fallback. */
  carta?: DailyCarta;
  /** Idea única del día. Todos los bloques la retoman; no se renderiza sola. */
  tesis?: string;
  guia?: {
    eyebrow: string;
    headline: string;
    intro: string;
    hace: string;
    evita: string;
    energia: string;
    accion: string;
  };
  topics?: DailyTopic[];
  lecturaLarga?: { eyebrow: string; title: string; body: string };
  cierre?: string;
};

/** Cupo del día de El Vacío (contador). */
export type VoidTodayPayload = { limit: number; used: number; remaining: number; isPro: boolean };

/** Preguntas sugeridas personalizadas por categoría (El Vacío). */
export type VoidPromptCategory = { key: string; label: string; glyph: string; prompts: string[] };
export type VoidSuggestedPayload = { categories: VoidPromptCategory[] };

export type PlaceLookup = {
  status: "success" | "not_configured" | "error";
  places: Array<{
    label?: string;
    placeId?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  }>;
  error?: string;
};

// ---------------------------------------------------------------------------
// Funciones existentes (ya implementadas en convex/)
// ---------------------------------------------------------------------------

export const appApi = {
  users: {
    current: anyApi.users.current as FunctionReference<"query", "public", Empty, UserDoc | null>,
    getOrCreateCurrentUser: anyApi.users.getOrCreateCurrentUser as FunctionReference<
      "mutation",
      "public",
      Empty,
      UserDoc
    >,
    // Eliminación completa de cuenta (App Review). Idempotente: borra todos los
    // datos propios en Convex; el cliente borra Clerk DESPUÉS de que responda ok.
    // Backend mergeado (PR #27); por ahora desplegado solo en Convex dev.
    deleteAccount: anyApi.users.deleteAccount as FunctionReference<
      "mutation",
      "public",
      Empty,
      { deleted: true }
    >
  },
  birthData: {
    getCurrent: anyApi.birthData.getCurrent as FunctionReference<"query", "public", Empty, BirthDataDoc | null>,
    // devuelve el Id del doc birthData (string), no el doc completo
    upsertForCurrentUser: anyApi.birthData.upsertForCurrentUser as FunctionReference<
      "mutation",
      "public",
      BirthDataInput,
      string
    >
  },
  onboarding: {
    saveDraft: anyApi.onboarding.saveDraft as FunctionReference<"mutation", "public", OnboardingDraftInput, string>,
    // devuelve el Id del birthData (string)
    completeBirthData: anyApi.onboarding.completeBirthData as FunctionReference<
      "mutation",
      "public",
      CompleteBirthDataInput,
      string
    >,
    markAccountCreated: anyApi.onboarding.markAccountCreated as FunctionReference<"mutation", "public", Empty, null>,
    markPaymentState: anyApi.onboarding.markPaymentState as FunctionReference<
      "mutation",
      "public",
      { paymentState: "not_started" | "started" | "paid" | "skipped" },
      null
    >
  },
  home: {
    // Read path de la Home real (público-safe: null sin sesión). Se lee DESPUÉS de
    // llamar la action `transits.getToday`, que actualiza dailyReadings.
    getDaily: anyApi.home.getDaily as FunctionReference<"query", "public", { localDate: string }, unknown>
  },
  charts: {
    // Carta natal
    current: anyApi.charts.current as FunctionReference<"query", "public", Empty, NatalChartDoc | null>,
    // Codex la pasó a Action (pega a AstrologyAPI): se invoca con useAction.
    calculateOrCreateNatalChart: anyApi.charts.calculateOrCreateNatalChart as FunctionReference<
      "action",
      "public",
      Empty,
      NatalChartDoc
    >,
    // Ya implementadas en backend (el "propuesto" quedó obsoleto): derivan de la carta.
    valuesMap: anyApi.charts.valuesMap as FunctionReference<"query", "public", Empty, ValuesMapPayload | null>,
    personalityReading: anyApi.charts.personalityReading as FunctionReference<
      "query",
      "public",
      Empty,
      PersonalityReadingPayload | null
    >,
    // Señal de la generación (backend #32 `24ba2ac`): reactiva y nunca null —
    // sin usuario/carta responde `pending`. `error` = la generación (prewarm o
    // cliente) falló o venció el lease: el bloque de lectura debe ofrecer reintento.
    personalityReadingState: anyApi.charts.personalityReadingState as FunctionReference<
      "query",
      "public",
      Empty,
      { status: "pending" | "ready" | "error" }
    >,
    // Genera (LLM) + cachea la lectura rica; la query de arriba la devuelve reactiva.
    generatePersonalityReading: anyApi.charts.generatePersonalityReading as FunctionReference<
      "action",
      "public",
      Empty,
      unknown
    >
  },
  readings: {
    // Home diaria
    getToday: anyApi.readings.getToday as FunctionReference<
      "query",
      "public",
      { localDate: string },
      DailyReadingDoc | null
    >,
    generateToday: anyApi.readings.generateToday as FunctionReference<
      "mutation",
      "public",
      { localDate: string; timezone: string },
      DailyReadingDoc
    >,
    save: anyApi.readings.save as FunctionReference<
      "mutation",
      "public",
      { readingId?: string; readingDate: string; readingPayload: unknown; note?: string },
      unknown
    >,
    // Archivo remoto de guardadas (contrato PR #12): más nueva primero; el
    // front valida cada `readingPayload` y mergea con lo local primero.
    listSaved: anyApi.readings.listSaved as FunctionReference<
      "query",
      "public",
      { limit?: number },
      SavedReadingListItem[]
    >,
    // `readingId` acá es el _id de `dailyReadings` (casi siempre ausente en
    // nuestras filas); el borrado real va por `savedReadingId`.
    unsave: anyApi.readings.unsave as FunctionReference<
      "mutation",
      "public",
      { savedReadingId?: string; readingId?: string },
      boolean
    >
  },
  subscriptions: {
    getCurrent: anyApi.subscriptions.getCurrent as FunctionReference<
      "query",
      "public",
      Empty,
      { entitlement: "free" | "plus"; status: string } | null
    >
  }
} as const;

// ---------------------------------------------------------------------------
// Funciones PROPUESTAS — todavía sin implementar del lado backend.
// TODO: pendiente backend. Ver convex/CHANGELOG.md.
// Mientras tanto, las pantallas usan mocks tipados con estas formas.
// ---------------------------------------------------------------------------

export const proposedApi = {
  // TODO: pendiente backend — charts.valuesMap(): ValuesMapPayload (Mapa de valores)
  valuesMap: anyApi.charts.valuesMap as FunctionReference<"query", "public", Empty, ValuesMapPayload | null>,
  // TODO: pendiente backend — charts.personalityReading(): PersonalityReadingPayload
  personalityReading: anyApi.charts.personalityReading as FunctionReference<
    "query",
    "public",
    Empty,
    PersonalityReadingPayload | null
  >,
  // transits.getToday es una ACTION live (genera + cachea con AstrologyAPI). Se invoca con useAction.
  transitToday: anyApi.transits.getToday as FunctionReference<
    "action",
    "public",
    { localDate: string },
    unknown
  >,
  // TODO: pendiente backend — places.resolve({ query }): geocoding real para onboarding
  resolvePlace: anyApi.places.resolve as FunctionReference<"action", "public", { query: string }, PlaceLookup>,
  // void.ask({ question }): VoidAnswerPayload (El Vacío; guardrail: nunca sí/no; cupo 3 free / 5 pro)
  voidAsk: anyApi.void.ask as FunctionReference<"action", "public", { question: string }, VoidAnswerPayload>,
  // void.today(): cupo del día para el contador (reactivo).
  voidToday: anyApi.void.today as FunctionReference<"query", "public", Empty, VoidTodayPayload | null>,
  // void.suggestedQuestions(): preguntas sugeridas personalizadas por categoría.
  voidSuggested: anyApi.void.suggestedQuestions as FunctionReference<"action", "public", Empty, VoidSuggestedPayload>,
  // daily.getGuide(): guía diaria personalizada (action: genera+cachea 1/día/usuario).
  dailyGuide: anyApi.daily.getGuide as FunctionReference<"action", "public", { localDate?: string; timezone?: string }, DailyGuidePayload>,
  // daily.revealCard(): da vuelta la carta de ese día. Idempotente, irreversible.
  revealCard: anyApi.daily.revealCard as FunctionReference<"mutation", "public", { localDate: string }, number>,
  // daily.getStrip(): la tira del Diario (qué carta salió cada día, si ya la diste vuelta).
  // Query reactiva: después de revealCard, la Home y la tira se actualizan solas.
  dailyStrip: anyApi.daily.getStrip as FunctionReference<"query", "public", { from: string; to: string }, DailyStripDay[]>,
  // Dev/testeo interno: marca al usuario como Pro (gateado por ALLOW_DEV_STUB en Convex).
  setStubPro: anyApi.subscriptions.setStubPlusForDev as FunctionReference<"mutation", "public", Empty, unknown>,
  // Telemetría legacy: aviso de instalación al bot de Telegram (1 vez por install, sin sesión).
  appOpened: anyApi.telemetry.appOpened as FunctionReference<"mutation", "public", { platform?: string }, null>,
  // telemetry.track: eventos de producto v1, idempotente por eventId (contrato en
  // docs/handoff-claude-product-events.md; forma en src/domain/productEvents.ts).
  trackEvent: anyApi.telemetry.track as FunctionReference<
    "mutation",
    "public",
    ProductEventPayload,
    { recorded: boolean }
  >
} as const;
