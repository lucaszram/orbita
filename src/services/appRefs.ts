import { anyApi } from "convex/server";
import type { FunctionReference } from "convex/server";
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
};

/** Payload de `natalCharts.payload` — alimenta la pantalla Carta natal. */
export type NatalChartPayload = {
  triad: { sun: SignPlacement; moon: SignPlacement; ascendant: SignPlacement };
  placements: SignPlacement[];
  houses: Array<{ house: number; sign: string; cusp?: number }>;
  aspects: Array<{
    from: string;
    to: string;
    type: string;
    harmony: "harmony" | "tension" | "neutral";
    angle?: number;
  }>;
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
  charts: {
    // Carta natal
    current: anyApi.charts.current as FunctionReference<"query", "public", Empty, NatalChartDoc | null>,
    calculateOrCreateNatalChart: anyApi.charts.calculateOrCreateNatalChart as FunctionReference<
      "mutation",
      "public",
      Empty,
      NatalChartDoc
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
    unsave: anyApi.readings.unsave as FunctionReference<"mutation", "public", { readingId: string }, unknown>
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
  // TODO: pendiente backend — transits.getToday({ localDate }): TransitDetailPayload
  transitToday: anyApi.transits.getToday as FunctionReference<
    "query",
    "public",
    { localDate: string },
    TransitDetailPayload | null
  >,
  // TODO: pendiente backend — places.resolve({ query }): geocoding real para onboarding
  resolvePlace: anyApi.places.resolve as FunctionReference<"action", "public", { query: string }, PlaceLookup>
} as const;
