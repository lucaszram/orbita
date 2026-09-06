import { anyApi } from "convex/server";
import type { FunctionReference } from "convex/server";

/**
 * Contrato de datos del **App Core V4.7** (las 5 tabs + detalles, diseñadas en
 * la página Figma `UX V4.7 - Órbita App Core Flows`).
 *
 * Patrón (igual que `appRefs.ts`): el front no consume `convex/_generated/` en
 * este worktree; enlaza funciones vía `anyApi` y el **tipo TS es el contrato**
 * de los `payload: v.any()`. Ver `docs/app-core-backend-map.md`,
 * `convex/CHANGELOG.md` y el bloque `// TODO: pendiente backend — App Core`
 * en `convex/schema.ts`.
 *
 * Mucho ya está cubierto por el contrato Web B0 (`appRefs.ts`):
 *   - Inicio (Home)      → `readings.getToday`   → PublicDailyHome
 *   - Carta / Posiciones → `charts.current`       → NatalChartPayload
 *   - Tránsitos          → `transits.getToday`    → TransitDetailPayload (propuesta)
 *   - Perfil             → `users.current`, `subscriptions.getCurrent`
 *
 * Este archivo agrega SOLO lo nuevo del app core: Vínculo (sinastría) y
 * Calendario/lunar. Mientras no existan, la pantalla no muestra nada: el mock
 * tipado que las alimentaba (`src/domain/appData.ts` + `src/content/chartMock.ts`)
 * se eliminó. Fabricaba tránsitos ("Venus armoniza tu Sol en Leo") a partir de
 * una carta de demo y de un perfil de relleno, y era alcanzable desde el Perfil
 * de una cuenta real: contenido inventado presentado como dato personal.
 */

// ---------------------------------------------------------------------------
// Vínculo / sinastría
// ---------------------------------------------------------------------------

/** Payload de `relationships.synastry` — energía comparada entre dos cartas. */
export type SynastryPayload = {
  pairing: string; // "Escorpio + Libra"
  headline: string; // "Atracción con ritmos distintos."
  sharedEnergy: string; // línea del overview: "Diálogo alto · ritmos distintos."
  flows: string; // FLUYE
  frictions: string; // FRICCIONA
  energy: string; // ENERGÍA
  action: string; // ACCIÓN
  disclaimer: string; // no promete resultados relacionales
};

/** Input de `relationships.add` — datos de la otra persona. */
export type SynastryAddInput = {
  name: string;
  birthDate: string;
  birthTime?: string;
  birthPlaceLabel?: string;
};

// --- CORE-212: la primera persona y su comparación real -----------------------

/** Nivel de datos de la persona guardada: define qué puede calcular la comparación. */
export type VinculoNivel = "signo" | "fecha" | "carta";

export type VinculoPersona = {
  id: string;
  name: string;
  relationshipType: string | null;
  level: VinculoNivel;
  zodiacSign: string | null;
  birthDate: string | null;
  /** `HH:MM` si se guardó junto con el lugar; `null` si no. */
  birthTime?: string | null;
  birthPlaceLabel: string | null;
  chartStatus: string;
  /** CORE-213: la persona elegida en la biblioteca. */
  isActive?: boolean;
  /** CORE-213: cuándo se guardó (ms). */
  savedAt?: number;
};

/** El cupo de personas (CORE-214): derivado del entitlement real, nunca de un contador local. */
export type VinculoAcceso = {
  isPro: boolean;
  limit: number | null;
  remaining: number | null;
  atLimit: boolean;
};

/** Sobre de `relationships.listPeople` (CORE-213/214): la biblioteca, de la más reciente a la más antigua, y el cupo. */
export type VinculoBiblioteca = {
  people: Array<VinculoPersona & { isActive: boolean; savedAt: number }>;
  activeId: string | null;
  access: VinculoAcceso;
};

/** Un contacto REAL entre las dos cartas: aspecto mayor dentro de orbe, con su orbe medido. */
export type VinculoContacto = {
  id: string;
  from: { key: string; label: string };
  to: { key: string; label: string };
  aspect: "conjunction" | "sextile" | "square" | "trine" | "opposition";
  aspectEs: string;
  symbol: string;
  orb: number;
  orbLabel: string;
  tone: "armonico" | "tenso" | "fusion";
  dimensions: Array<"hablan" | "cuidan" | "deseo">;
};

export type VinculoResumen = {
  total: number;
  armonicos: number;
  tensos: number;
  fusiones: number;
  dimensions: Array<{
    key: "hablan" | "cuidan" | "deseo";
    label: string;
    total: number;
    armonicos: number;
    tensos: number;
    fusiones: number;
  }>;
};

export type VinculoPrecision = {
  level: VinculoNivel;
  label: string;
  includesAngles: boolean;
  limitations: string[];
};

export type VinculoTono = {
  relation: "mismo_elemento" | "elementos_afines" | "elementos_distintos";
  headline: string;
  body: string;
};

/** Sobre de `relationships.synastry`: siempre con `status`; nunca `null`. */
export type VinculoComparacion =
  | { status: "no_person"; person: null }
  | { status: "needs_natal_chart"; person: VinculoPersona }
  | { status: "person_chart_unavailable"; person: VinculoPersona; pairing: string; disclaimer: string }
  | {
      status: "ready";
      person: VinculoPersona;
      precision: VinculoPrecision;
      pairing: string;
      tone: VinculoTono | null;
      contacts: VinculoContacto[];
      /** Cuántos contactos reales quedaron fuera de la lista visible (Free). */
      hiddenContacts: number;
      summary: VinculoResumen;
      access: { isPro: boolean; contactLimit: number | null };
      disclaimer: string;
    };

export type VinculoAddPersonInput = {
  name: string;
  level: VinculoNivel;
  relationshipType?: string;
  zodiacSign?: string;
  birthDate?: string;
  birthTime?: string;
  birthPlaceLabel?: string;
  latitude?: number;
  longitude?: number;
  /** Editar una persona ya guardada. Sin él, se crea una nueva (CORE-213). */
  profileId?: string;
};

export type VinculoAddPersonResult = {
  relationshipProfileId: string;
  chartStatus: "ready" | "not_needed" | "not_configured" | "error";
  level: VinculoNivel;
};

/** Funciones reales de Vínculos (CORE-212). Se invocan con `useAction` / `useQuery`. */
export const appCoreApi = {
  relationships: {
    addPerson: anyApi.relationships.addPerson as FunctionReference<
      "action",
      "public",
      VinculoAddPersonInput,
      VinculoAddPersonResult
    >,
    synastry: anyApi.relationships.synastry as FunctionReference<
      "query",
      "public",
      { profileId?: string },
      VinculoComparacion
    >,
    listPeople: anyApi.relationships.listPeople as FunctionReference<"query", "public", Record<string, never>, VinculoBiblioteca>,
    selectPerson: anyApi.relationships.selectPerson as FunctionReference<
      "mutation",
      "public",
      { profileId: string },
      { profileId: string }
    >
  }
} as const;

// ---------------------------------------------------------------------------
// Calendario energético + fase lunar
// ---------------------------------------------------------------------------

export type CalendarDay = {
  date: string; // ISO
  day: number; // 1..31
  energyTone: string; // "sensible" | "activo" | ...
  intense: boolean; // día de mayor intensidad emocional
};

/** Payload de `calendar.getMonth` — grilla mensual + capa lunar. */
export type CalendarMonthPayload = {
  month: string; // "2026-07"
  label: string; // "JULIO 2026"
  startWeekday: number; // 0 = lunes
  daysInMonth: number;
  days: CalendarDay[];
  lunar: {
    phase: string; // "Luna creciente en Tauro."
    weekStrip: string;
    copy: string;
    action: string;
  };
};

// ---------------------------------------------------------------------------
// Funciones propuestas (todavía sin backend — ver CHANGELOG + schema TODO)
// ---------------------------------------------------------------------------

export const proposedAppCoreApi = {
  relationships: {
    /** add({ name, birthDate, birthTime?, birthPlaceLabel? }): { relationshipProfileId } */
    add: anyApi.relationships.add as FunctionReference<"mutation">,
    /** synastry({ relationshipProfileId }): SynastryPayload */
    synastry: anyApi.relationships.synastry as FunctionReference<"query">
  },
  calendar: {
    /** getMonth({ month }): CalendarMonthPayload */
    getMonth: anyApi.calendar.getMonth as FunctionReference<"query">
  }
} as const;
