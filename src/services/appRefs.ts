import { anyApi } from "convex/server";
import type { FunctionReference } from "convex/server";
import type { PublicDailyHome } from "./publicLabRefs";
import type { CheckoutStatus, WebOffer } from "@/domain/paywall";
import type { OnboardingCompletion } from "@/domain/onboardingReadiness";

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

/**
 * Documento público de `charts.current` (`convex/lib/publicNatalChart.ts`):
 * no es la fila de la base. Trae `createdAt`/`updatedAt` (ms) y NO trae
 * `_creationTime`, aunque el envelope `Doc<>` lo prometa por compatibilidad.
 */
export type NatalChartDoc = Doc<{
  userId: string;
  birthDataId: string;
  calculationVersion: string;
  providerVersion?: string;
  createdAt: number;
  /** Sólo en cartas ya recalculadas: `ensureChart` inserta sin él. */
  updatedAt?: number;
  access?: { isPro: boolean; houses: boolean; aspects: boolean };
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
  /** Identidad estable del contacto dentro de la lectura del día. Ausente en el
   *  detalle «pendiente» sin tránsito y en respuestas de backends anteriores. */
  transitId?: string;
  /** Casa natal tocada y su tema, sólo si el proveedor la publicó. */
  natalHouse?: number | null;
  houseTheme?: string | null;
  /** Cada cuánto cambia esta capa. */
  cadence?: string;
  /** Acceso según plan: Free recibe el cielo sin el cruce con la carta. */
  access?: { isPro: boolean; personalized: boolean };
};

// --- CORE-207: el panorama de hoy -------------------------------------------

export type TransitPanoramaPhase = "acercandose" | "exacto" | "integrandose";

/** Una fila del panorama: un contacto activo de hoy con su identidad y su fase. */
export type TransitPanoramaRow = {
  transitId: string;
  rank: number;
  title: string;
  transitPlanet: string;
  natalPoint: string;
  aspectType: string;
  aspectEs: string;
  aspectAngle: number | null;
  natalHouse: number | null;
  phase: TransitPanoramaPhase | null;
  peakLabel: string | null;
  /** 0–1 medido en tiempo contra `exactTime`; `null` sin ventana. Nunca un orbe en grados. */
  closeness: number | null;
  cadence?: string;
  body: string;
  startTime: string | null;
  exactTime: string | null;
  endTime: string | null;
};

/** Sobre de `transits.getPanorama`: siempre con `status`. */
export type TransitPanorama =
  | {
      status: "ready";
      localDate: string;
      count: number;
      rows: TransitPanoramaRow[];
      /** Aspectos mayores publicados hoy por el proveedor; `null` en lecturas anteriores. La lista se corta en 8. */
      activeTotal: number | null;
      cadence: string;
      access: { isPro: true; personalized: true };
    }
  | { status: "empty"; localDate: string; access: { isPro: true; personalized: true } }
  | { status: "locked"; localDate: string; access: { isPro: false; personalized: false } };

// --- CORE-209: Tu momento · Estación vital -----------------------------------

export type EstacionVitalFase = "new" | "crescent" | "first_quarter" | "gibbous" | "full" | "disseminating" | "last_quarter" | "balsamic";

/** El cálculo de la estación vital (lunación progresada). Siempre con `status`. */
export type EstacionVital =
  | {
      status: "ready";
      precision: "exact" | "range";
      phaseKey: EstacionVitalFase;
      phaseIndex: number;
      name: string;
      progressedElongationDegrees: number;
      progressedElongationRangeDegrees?: { from: number; to: number };
      ageYears: number;
      phaseStartedAt: number;
      nextPhaseAt: number;
      phaseStartedAtRange?: { earliest: number; latest: number };
      nextPhaseAtRange?: { earliest: number; latest: number };
      phaseYears: number;
      yearsIntoPhase: number;
      progress: number;
      observedAt: number;
      limitations: string[];
    }
  | {
      status: "needs_birth_data" | "needs_birth_time" | "partial" | "unavailable" | "not_configured";
      precision: "not_applicable" | "range";
      missingInputs: string[];
      limitations: string[];
      possiblePhases?: string[];
      observedAt: number;
    };

/** Sobre de `momento.getEstacionVital`: Free recibe `locked`; Plus, el cálculo. */
export type MomentoEstacionVital =
  | { status: "locked"; localDate: string; access: { isPro: false } }
  | { status: "ready"; localDate: string; /** Zona natal: las fechas de borde se escriben en ella. */ timezone: string | null; access: { isPro: true }; estacion: EstacionVital; cached: boolean };

// --- CORE-210: Tu momento · Tema del año -------------------------------------

/** La profección anual. Siempre con `status`. */
export type TemaDelAno =
  | {
      status: "ready";
      precision: "exact";
      age: number;
      house: number;
      houseTheme: string;
      sign: string;
      signKey: string;
      ruler: string;
      rulerKey: string;
      periodStart: number;
      periodEnd: number;
      periodStartDate: string;
      periodEndDate: string;
      monthIndex: number;
      progress: number;
      summary: string;
      limitations: string[];
      observedAt: number;
    }
  | {
      status: "needs_birth_data" | "needs_natal_chart" | "needs_birth_time" | "unavailable";
      precision: "not_applicable";
      missingInputs: string[];
      limitations: string[];
      observedAt: number;
    };

export type MomentoTemaDelAno =
  | { status: "locked"; localDate: string; access: { isPro: false } }
  | { status: "ready"; localDate: string; timezone: string | null; access: { isPro: true }; tema: TemaDelAno };

/** Respuesta de `transits.getDetail`: el contacto pedido, o la constancia de que
 *  no está en la lectura de hoy. Nunca otro tránsito en su lugar. */
export type TransitDetailResult =
  | { status: "ready"; localDate: string; transitId: string; detail: TransitDetailPayload }
  | { status: "not_found"; localDate: string; transitId: string };

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
  /** `transitId` abre el detalle de ese contacto (`transits.getDetail`). Los
   *  documentos anteriores no lo traen: esa fila no promete detalle. */
  destacado: { aspecto: string; lectura: string; transitId?: string };
  secundarios: Array<{ aspecto: string; lectura: string; transitId?: string }>;
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

// --- CORE-192 · La Luna de hoy sobre la carta natal -------------------------
//
// Contrato de `home.getLunaSobreLaCarta`. La fuente de verdad es
// `convex/home.ts` (sección «CORE-192»); acá se declara a mano, como el resto
// de este archivo, porque `convex/_generated/` no se consume en el front.
//
// Alimenta los dos módulos que CORE-191 tiene que armar: LA LUNA EN TU CARTA
// (por qué casa natal pasa hoy la Luna) y CUMPLELUNA (cuándo se repite la
// distancia Sol→Luna del nacimiento).

export type LunaSobreLaCartaStatus =
  | "ready"
  | "partial"
  | "needs_session"
  | "needs_daily_context"
  | "needs_natal_chart"
  | "not_configured"
  | "provider_error";

/** `exact` vale para el día completo; `range` avisa que el valor se mueve dentro del día. */
export type LunaSobreLaCartaPrecision = "exact" | "estimated" | "range" | "not_applicable";

export type LunarPhaseKey =
  | "new"
  | "waxing_crescent"
  | "first_quarter"
  | "waxing_gibbous"
  | "full"
  | "waning_gibbous"
  | "last_quarter"
  | "waning_crescent";

export type MoonOnChartData = {
  kind: "moon_on_chart";
  /** Mediodía local del día pedido: el instante canónico del módulo. */
  observedAt: number;
  longitudeDegrees: number;
  speedDegreesPerDay: number;
  signKey: string;
  sign: string;
  degreeInSign: number;
  phaseKey: LunarPhaseKey;
  phaseName: string;
  /** Fracción iluminada del disco, 0..1. */
  illumination: number;
  elongationDegrees: number;
  /** `null` sin carta, sin hora exacta o sin las doce cúspides. */
  natalHouse: number | null;
  houseTheme: string | null;
  /** Casas que la Luna recorre durante el día civil. Con más de una, `precision` es `range`. */
  housesToday: number[];
  signsToday: string[];
  phasesToday: LunarPhaseKey[];
  precision: LunaSobreLaCartaPrecision;
  summary: string;
};

export type CumplelunaData = {
  kind: "cumpleluna";
  observedAt: number;
  natalElongationDegrees: number;
  /** Cuánto puede valer de más o de menos la elongación natal. 0 con hora exacta. */
  natalElongationToleranceDegrees: number;
  currentElongationDegrees: number;
  elongationRateDegreesPerDay: number;
  cycleDegrees: number;
  cycleFraction: number;
  cycleDay: number;
  cycleDayWindowDays: { from: number; to: number };
  cycleLengthDays: number;
  daysRemaining: number;
  daysRemainingWindowDays: { from: number; to: number };
  previousExactAt: number;
  previousExactAtWindow: { earliest: number; latest: number };
  nextExactAt: number;
  nextExactAtWindow: { earliest: number; latest: number };
  /** Nunca `exact`: `nextExactAt` es una estimación y SIEMPRE viaja con su ventana. */
  precision: "estimated" | "range";
  summary: string;
};

export type LunaSobreLaCartaPayload = {
  methodVersion: string;
  providerVersion: string;
  status: LunaSobreLaCartaStatus;
  precision: LunaSobreLaCartaPrecision;
  localDate: string;
  timezone: string;
  observedAt: number | null;
  moonOnChart: MoonOnChartData | null;
  cumpleluna: CumplelunaData | null;
  /** Qué faltó (`exact_birth_time`, `natal_chart`…). La UI decide qué ofrecer. */
  missingInputs: string[];
  limitations: string[];
};

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
  placeTimezone: {
    /**
     * Zona IANA del lugar de nacimiento, derivada de las coordenadas que ya
     * eligió la persona (ver `convex/CHANGELOG.md`, 2026-08-12).
     *
     * Photon —el autocomplete— devuelve etiqueta y coordenadas, pero NO
     * timezone, y `validateBirthPayload` la exige antes de escribir. El backend
     * la resuelve con límites geográficos empaquetados: no hay provider pago ni
     * llamada externa, y la zona del dispositivo no participa (para alguien
     * nacido en otra zona, esa sería la zona equivocada).
     */
    atCoordinates: anyApi.placeTimezone.atCoordinates as FunctionReference<
      "action",
      "public",
      { latitude: number; longitude: number },
      { timezone: string }
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
    /**
     * Autoridad ÚNICA de acceso durante alta y recuperación. Reactiva y de sólo
     * lectura: no llama al proveedor ni dispara cálculos, sólo confirma lo que
     * quedó persistido. Ver `src/domain/onboardingReadiness.ts`.
     */
    getCompletionStatus: anyApi.onboarding.getCompletionStatus as FunctionReference<
      "query",
      "public",
      { clientDraftId?: string },
      OnboardingCompletion
    >,
    /**
     * Confirmación ANÓNIMA e idempotente previa a montar Clerk: sólo devuelve
     * `{ ready: true }` si el borrador remoto está completo y su origen es
     * `anonymous_signup`. Si tira, no se crea la cuenta.
     */
    confirmSignupDraft: anyApi.onboarding.confirmSignupDraft as FunctionReference<
      "mutation",
      "public",
      { clientDraftId: string },
      { ready: true }
    >,
    // devuelve el Id del birthData (string)
    completeBirthData: anyApi.onboarding.completeBirthData as FunctionReference<
      "mutation",
      "public",
      CompleteBirthDataInput,
      string
    >,
    /**
     * Alta nueva: copia atómicamente a la cuenta el borrador remoto que ya fue
     * confirmado antes de Clerk. El cliente no vuelve a enviar datos natales.
     */
    completeSignupFromDraft: anyApi.onboarding.completeSignupFromDraft as FunctionReference<
      "mutation",
      "public",
      { clientDraftId: string },
      string
    >,
    /**
     * Adjunta a la cuenta recién creada el borrador guardado anónimo. El
     * `clientDraftId` es lo que conserva el origen del alta: sin él, el mismo
     * usuario parecería una recuperación de una cuenta preexistente.
     */
    markAccountCreated: anyApi.onboarding.markAccountCreated as FunctionReference<
      "mutation",
      "public",
      { clientDraftId?: string },
      string
    >,
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
    getDaily: anyApi.home.getDaily as FunctionReference<"query", "public", { localDate: string }, unknown>,
    // CORE-192: la Luna de hoy medida sobre la carta natal. Es una ACTION (pega
    // al proveedor y cachea el cielo del día para todas las cuentas de esa
    // zona), así que se invoca con `useAction`. Nunca devuelve null: sin sesión,
    // sin carta, sin credenciales o con el proveedor caído responde el mismo
    // sobre con un `status` explícito. `localDate`/`timezone` son opcionales y
    // sólo CONFIRMAN el día canónico que resuelve el servidor: si se mandan,
    // tienen que ser exactamente los de `daily.getTodayContext` —nunca los del
    // dispositivo—; cualquier diferencia devuelve `needs_daily_context` sin
    // medir nada. Omitirlos siempre es válido.
    getLunaSobreLaCarta: anyApi.home.getLunaSobreLaCarta as FunctionReference<
      "action",
      "public",
      { localDate?: string; timezone?: string },
      LunaSobreLaCartaPayload
    >
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
      // `locked` (backend P0): el gating Free/Plus es server-side; la lectura
      // larga no se genera ni se entrega a Free.
      { status: "pending" | "ready" | "error" | "locked" }
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
    // Única fuente de verdad del acceso. El tipo anterior decía
    // `{ entitlement: "free" | "plus" } | null` y no coincidía con el backend:
    // el valor Plus es `orbita_pro`, `isPro` es explícito y nunca devuelve null
    // (sin usuario responde el entitlement gratuito).
    getCurrent: anyApi.subscriptions.getCurrent as FunctionReference<
      "query",
      "public",
      Empty,
      {
        entitlement: "free" | "orbita_pro";
        isPro: boolean;
        status: string;
        provider?: string;
        plan?: string;
        isLifetime: boolean;
        currentPeriodEnd?: number;
        willRenew?: boolean;
        canManageInStripePortal: boolean;
      }
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
  // transits.getDetail({ localDate, transitId }): el detalle de UN contacto del
  // ranking, por identidad. ACTION (reutiliza la lectura persistida del día).
  transitDetail: anyApi.transits.getDetail as FunctionReference<
    "action",
    "public",
    { localDate: string; transitId: string },
    TransitDetailResult
  >,
  // transits.getPanorama({ localDate }): el panorama de hoy (CORE-207). ACTION,
  // misma lectura persistida del día que getToday / getDetail.
  transitPanorama: anyApi.transits.getPanorama as FunctionReference<
    "action",
    "public",
    { localDate: string },
    TransitPanorama
  >,
  // momento.getEstacionVital({ localDate }): Tu momento · Estación vital (CORE-209). ACTION,
  // calcula una vez por día y persona y cachea en `momentoAnalyses`.
  momentoEstacionVital: anyApi.momento.getEstacionVital as FunctionReference<
    "action",
    "public",
    { localDate: string },
    MomentoEstacionVital
  >,
  // momento.getTemaDelAno({ localDate }): Tu momento · Tema del año (CORE-210). ACTION pura sobre la carta guardada.
  momentoTemaDelAno: anyApi.momento.getTemaDelAno as FunctionReference<
    "action",
    "public",
    { localDate: string },
    MomentoTemaDelAno
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
  // daily.getTodayContext(): fecha canónica + zona, calculadas por el servidor
  // desde la timezone natal. Es una ACTION (no reactiva): se pide una vez por
  // sesión desde `DailyContextProvider` y se comparte. El cliente NO calcula
  // el día ni manda su timezone como autoridad.
  todayContext: anyApi.daily.getTodayContext as FunctionReference<
    "action",
    "public",
    Empty,
    { localDate: string; timezone: string }
  >,
  // --- Pagos (web) ---------------------------------------------------------
  // Todas son ACTIONS. `getWebOffer` decide server-side si el comercio está
  // habilitado; con `off` devuelve `plans: []` y no hay checkout posible.
  // Los precios salen de Stripe: nunca se escriben en el cliente.
  getWebOffer: anyApi.payments.stripeActions.getWebOffer as FunctionReference<
    "action",
    "public",
    Empty,
    WebOffer
  >,
  createCheckoutSession: anyApi.payments.stripeActions.createCheckoutSession as FunctionReference<
    "action",
    "public",
    { plan: "monthly" },
    { url: string }
  >,
  // Sólo se consulta en la pantalla de retorno. `active` significa que el
  // backend verificó sesión, propietario, customer y el entitlement del
  // webhook: la URL por sí sola nunca concede Plus.
  getCheckoutStatus: anyApi.payments.stripeActions.getCheckoutStatus as FunctionReference<
    "action",
    "public",
    { sessionId: string },
    { status: CheckoutStatus }
  >,
  createPortalSession: anyApi.payments.stripeActions.createPortalSession as FunctionReference<
    "action",
    "public",
    Empty,
    { url: string }
  >,
  dailyGuide: anyApi.daily.getGuide as FunctionReference<"action", "public", { localDate?: string; timezone?: string }, DailyGuidePayload>,
  // daily.revealCard(): da vuelta la carta de ese día. Idempotente, irreversible.
  revealCard: anyApi.daily.revealCard as FunctionReference<"mutation", "public", { localDate: string }, number>,
  // daily.getStrip(): la tira del Diario (qué carta salió cada día, si ya la diste vuelta).
  // Query reactiva: después de revealCard, la Home y la tira se actualizan solas.
  dailyStrip: anyApi.daily.getStrip as FunctionReference<"query", "public", { from: string; to: string }, DailyStripDay[]>,
  // Telemetría: aviso de instalación al bot de Telegram (1 vez por install, sin sesión).
  appOpened: anyApi.telemetry.appOpened as FunctionReference<"mutation", "public", { platform?: string }, null>
} as const;
