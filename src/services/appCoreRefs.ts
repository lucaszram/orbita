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
 * Calendario/lunar. Mientras no existan, `src/domain/appData.ts` es el mock tipado.
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
