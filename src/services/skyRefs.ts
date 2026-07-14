import { anyApi } from "convex/server";
import type { FunctionReference } from "convex/server";

/**
 * Contrato de datos de las **capacidades astrológicas ampliadas** de Órbita:
 * endpoints de AstrologyAPI que ya están disponibles pero todavía NO cableados
 * en el backend (ver `docs/api-capacidades-orbita.md`, sección "disponible-no-cableado").
 *
 * Patrón (igual que `appRefs.ts` / `appCoreRefs.ts`): el front enlaza funciones
 * vía `anyApi` y el **tipo TS es el contrato** de los `payload: v.any()`. Mientras
 * el backend (Codex) no las implemente, cada pantalla trabaja contra el mock
 * tipado correspondiente en `src/content/`.
 *
 * Guardrail transversal: la API trae claims de salud/dinero/suerte/destino
 * (sobre todo `sun_sign_prediction` y los reportes). Órbita NO expone ese texto
 * crudo — toma el dato astronómico y reescribe en voz propia con los guardrails
 * de `AGENTS.md`. Todo pasa por `/backoffice` antes de app pública.
 *
 * Detalle del pedido en `convex/CHANGELOG.md` y el bloque
 * `// TODO: pendiente backend — Capacidades ampliadas` en `convex/schema.ts`.
 */

// ---------------------------------------------------------------------------
// Fase lunar — sky.getMoonPhase (endpoint AstrologyAPI: moon_phase_report / lunar_metrics)
// ---------------------------------------------------------------------------

/** Payload de `sky.getMoonPhase` — fase lunar del día (módulo Home/onboarding, free). */
export type MoonPhasePayload = {
  /** Etiqueta legible: "Luna creciente". */
  phase: string;
  /** Clave estable: "new" | "waxing_crescent" | "first_quarter" | ... */
  phaseKey: string;
  /** Signo lunar del día: "Tauro". */
  sign: string;
  /** Iluminación 0..1. */
  illumination: number;
  /** Copy corto en voz Órbita (no consejo de salud/dinero). */
  copy: string;
  /** Acción segura y chica asociada a la fase. */
  action: string;
};

// ---------------------------------------------------------------------------
// Pronóstico largo — forecast.getLongRange (endpoint: life_forecast_report/tropical)
// Reemplaza el contrato que hoy figura `needs_provider_endpoint`.
// ---------------------------------------------------------------------------

export type ForecastWindow = {
  id: string;
  /** "Saturno por tu casa 10". */
  title: string;
  /** Ventana temporal legible: "hasta marzo 2027". */
  range: string;
  /** Tema editorial: "estructura" | "vínculos" | "identidad" | ... */
  theme: string;
  /** Lectura en voz Órbita, sin promesas deterministas. */
  body: string;
};

/** Payload de `forecast.getLongRange` — tránsitos lentos por ventanas. Premium. */
export type LongRangeForecastPayload = {
  headline: string;
  windows: ForecastWindow[];
  disclaimer: string;
};

// ---------------------------------------------------------------------------
// Revolución solar anual — charts.solarReturn (endpoints: solar_return_*)
// ---------------------------------------------------------------------------

export type SolarReturnHighlight = {
  label: string; // "Ascendente del año"
  body: string;
};

/** Payload de `charts.solarReturn` — highlights de tu año (cumple → cumple). Premium. */
export type SolarReturnPayload = {
  year: number;
  headline: string;
  /** Ascendente de la carta de revolución solar, si hay hora. */
  ascendant?: string;
  themes: Array<{ area: string; body: string }>;
  highlights: SolarReturnHighlight[];
  disclaimer: string;
};

// ---------------------------------------------------------------------------
// Contenido por signo (sin carta) — content.sunSignDaily
// endpoint: sun_sign_prediction/daily/:signo. Para demo free / logueado-sin-carta
// y base de notificaciones. Guardrail fuerte: descartar salud/dinero/suerte.
// ---------------------------------------------------------------------------

/** Payload de `content.sunSignDaily` — lectura diaria por signo, voz Órbita. Free. */
export type SunSignContentPayload = {
  sign: string;
  /** Fecha local: "2026-07-07". */
  date: string;
  headline: string;
  body: string;
  /** Etiqueta de tono opcional: "sensible" | "activo" | ... */
  mood?: string;
  disclaimer: string;
};

// ---------------------------------------------------------------------------
// Funciones propuestas (todavía sin backend — ver CHANGELOG + schema TODO).
// Las provider-backed se tipan como `action` (generan + cachean, como
// `transits.getToday`); el backend puede agregar un read path `query` después.
// ---------------------------------------------------------------------------

export const proposedSkyApi = {
  /** getMoonPhase({ localDate, timezone }): MoonPhasePayload */
  getMoonPhase: anyApi.sky.getMoonPhase as FunctionReference<
    "action",
    "public",
    { localDate: string; timezone: string },
    MoonPhasePayload | null
  >,
  /** getLongRange(): LongRangeForecastPayload */
  getLongRange: anyApi.forecast.getLongRange as FunctionReference<
    "action",
    "public",
    Record<string, never>,
    LongRangeForecastPayload | null
  >,
  /** solarReturn({ year }): SolarReturnPayload */
  solarReturn: anyApi.charts.solarReturn as FunctionReference<
    "action",
    "public",
    { year: number },
    SolarReturnPayload | null
  >,
  /** sunSignDaily({ sign, localDate }): SunSignContentPayload */
  sunSignDaily: anyApi.content.sunSignDaily as FunctionReference<
    "action",
    "public",
    { sign: string; localDate: string },
    SunSignContentPayload | null
  >
} as const;
