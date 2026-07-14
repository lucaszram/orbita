import { actionGeneric as action } from "convex/server";
import { v } from "convex/values";
import { getTimezoneOffsetHours } from "./lib/astrologyApi";

/**
 * Cielo del día — fase lunar real (módulo Home/onboarding, free).
 *
 * `sky.getMoonPhase({ localDate, timezone })` pega al proveedor astrológico
 * (AstrologyAPI: `lunar_metrics` / `moon_phase_report`) y devuelve un
 * `MoonPhasePayload` (forma en `src/services/skyRefs.ts`). A diferencia de
 * `transits.getToday`, acá NO hace falta la carta del usuario: la fase lunar es
 * un dato del cielo, solo depende de la fecha + timezone.
 *
 * Guardrail (`AGENTS.md`): la API trae claims de salud/dinero/suerte/destino en
 * los campos de texto. Órbita NO expone ese texto crudo: toma el **dato**
 * astronómico (fase, signo lunar, iluminación) y reescribe `copy`/`action` en
 * voz propia (entretenimiento + autoconocimiento, sin determinismo). Si el
 * proveedor no está configurado o falla, devolvemos `null` y el front cae al
 * mock (`src/content/moonPhaseMock.ts`).
 */

const DEFAULT_ASTROLOGY_API_BASE_URL = "https://json.astrologyapi.com/v1";
const DEFAULT_ASTROLOGY_API_LANGUAGE = "en";

type SkyApiConfig = {
  baseUrl: string;
  userId?: string;
  apiKey?: string;
  language: string;
};

function getSkyApiConfig(): SkyApiConfig {
  return {
    baseUrl: (process.env.ASTROLOGY_API_BASE_URL ?? DEFAULT_ASTROLOGY_API_BASE_URL).replace(/\/$/, ""),
    userId: process.env.ASTROLOGY_API_USER_ID,
    apiKey: process.env.ASTROLOGY_API_KEY,
    language: process.env.ASTROLOGY_API_LANGUAGE ?? DEFAULT_ASTROLOGY_API_LANGUAGE
  };
}

function hasSkyApiCredentials(config: SkyApiConfig) {
  return Boolean(config.userId && config.apiKey);
}

function encodeBasicAuth(userId: string, apiKey: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(`${userId}:${apiKey}`).toString("base64");
  }
  return btoa(`${userId}:${apiKey}`);
}

// Transporte genérico contra AstrologyAPI (equivalente a `postAstrologyApi` en
// `convex/lib/astrologyApi.ts`; se replica acá porque esa función no se exporta).
async function postSkyApi(config: SkyApiConfig, endpoint: string, body: unknown) {
  if (!config.userId || !config.apiKey) {
    throw new Error("AstrologyAPI credentials are missing.");
  }

  const url = endpoint.startsWith("http") ? endpoint : `${config.baseUrl}/${endpoint.replace(/^\//, "")}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Language": config.language,
      Authorization: `Basic ${encodeBasicAuth(config.userId, config.apiKey)}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { rawText: text };
    }
  }

  if (!response.ok) {
    const detail = typeof json === "object" && json !== null ? JSON.stringify(json).slice(0, 500) : text.slice(0, 500);
    throw new Error(`AstrologyAPI ${endpoint} failed with ${response.status}: ${detail}`);
  }

  return json;
}

// ---------------------------------------------------------------------------
// Normalización a la voz Órbita
// ---------------------------------------------------------------------------

type PhaseKey =
  | "new"
  | "waxing_crescent"
  | "first_quarter"
  | "waxing_gibbous"
  | "full"
  | "waning_gibbous"
  | "last_quarter"
  | "waning_crescent";

/** Etiqueta legible en español por fase. */
const phaseLabels: Record<PhaseKey, string> = {
  new: "Luna nueva",
  waxing_crescent: "Luna creciente",
  first_quarter: "Cuarto creciente",
  waxing_gibbous: "Luna gibosa creciente",
  full: "Luna llena",
  waning_gibbous: "Luna gibosa menguante",
  last_quarter: "Cuarto menguante",
  waning_crescent: "Luna menguante"
};

/**
 * Copy + acción propios por fase (voz Órbita). Reescritos a mano: NADA de
 * salud/dinero/suerte/destino, solo clima simbólico + acción chica y segura.
 */
const phaseVoice: Record<PhaseKey, { copy: string; action: string }> = {
  new: {
    copy: "Cielo en negro: la Luna arranca un ciclo nuevo. Buen momento para nombrar algo antes de mostrarlo.",
    action: "Escribí una intención en una línea y guardala para vos."
  },
  waxing_crescent: {
    copy: "La Luna empieza a crecer: lo que empezaste pide constancia más que impulso.",
    action: "Elegí una sola cosa para sostener esta semana y dejala a la vista."
  },
  first_quarter: {
    copy: "Media Luna en tensión: aparece la fricción entre lo que querés y lo que cuesta. Es parte del envión.",
    action: "Dale un paso concreto a eso que venís posponiendo."
  },
  waxing_gibbous: {
    copy: "Casi llena: la Luna acumula, y conviene afinar los detalles antes del cierre.",
    action: "Repasá algo que ya casi está y ajustale una sola cosa."
  },
  full: {
    copy: "Luna llena: todo se ve más nítido, también lo que venías esquivando. Momento de claridad, no de decisiones apuradas.",
    action: "Dejá asentar lo que sentís antes de responder."
  },
  waning_gibbous: {
    copy: "La Luna empieza a soltar: buen clima para compartir lo que aprendiste sin exigirte de más.",
    action: "Contale a alguien algo que te haya movido esta semana."
  },
  last_quarter: {
    copy: "Media Luna de bajada: aparece la revisión, qué seguís y qué soltás.",
    action: "Sacá de tu lista una cosa que ya no va."
  },
  waning_crescent: {
    copy: "La Luna casi desaparece: baja la energía y pide descanso más que arranque.",
    action: "Bajá el ritmo un rato y no te lo cobres."
  }
};

/** Signo lunar del proveedor (inglés o español) → etiqueta capitalizada. */
const signTranslations: Record<string, string> = {
  aries: "Aries",
  taurus: "Tauro",
  tauro: "Tauro",
  gemini: "Géminis",
  geminis: "Géminis",
  géminis: "Géminis",
  cancer: "Cáncer",
  cáncer: "Cáncer",
  leo: "Leo",
  virgo: "Virgo",
  libra: "Libra",
  scorpio: "Escorpio",
  escorpio: "Escorpio",
  sagittarius: "Sagitario",
  sagitario: "Sagitario",
  capricorn: "Capricornio",
  capricornio: "Capricornio",
  aquarius: "Acuario",
  acuario: "Acuario",
  pisces: "Piscis",
  piscis: "Piscis"
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/** Toma el primer string no vacío entre varias claves posibles del proveedor. */
function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

/** Toma el primer número entre varias claves posibles del proveedor. */
function pickNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

/** Texto de fase del proveedor (p.ej. "Waxing Crescent") → clave estable. */
function normalizePhaseKey(rawPhase: string | undefined): PhaseKey | null {
  if (!rawPhase) return null;
  const key = rawPhase.toLowerCase().replace(/[\s-]+/g, "_");
  if (key.includes("new")) return "new";
  if (key.includes("first_quarter") || key.includes("first")) return "first_quarter";
  if (key.includes("last_quarter") || key.includes("third_quarter") || key.includes("last") || key.includes("third"))
    return "last_quarter";
  if (key.includes("full")) return "full";
  if (key.includes("waxing") && key.includes("gibbous")) return "waxing_gibbous";
  if (key.includes("waning") && key.includes("gibbous")) return "waning_gibbous";
  if (key.includes("waxing") && key.includes("crescent")) return "waxing_crescent";
  if (key.includes("waning") && key.includes("crescent")) return "waning_crescent";
  return null;
}

/** Normaliza la iluminación a 0..1 (el proveedor a veces la da en 0..100). */
function normalizeIllumination(value: number | undefined): number {
  if (value === undefined) return 0;
  const ratio = value > 1 ? value / 100 : value;
  return Math.max(0, Math.min(1, Number(ratio.toFixed(2))));
}

function capitalizeSign(raw: string | undefined): string {
  if (!raw) return "";
  return signTranslations[raw.toLowerCase()] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** localDate "YYYY-MM-DD" → partes numéricas (o null si no parsea). */
function parseLocalDate(localDate: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(localDate);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

// ---------------------------------------------------------------------------
// Action pública
// ---------------------------------------------------------------------------

export const getMoonPhase = action({
  args: {
    localDate: v.string(),
    timezone: v.string()
  },
  handler: async (_ctx, args) => {
    const config = getSkyApiConfig();
    if (!hasSkyApiCredentials(config)) {
      return null;
    }

    const dateParts = parseLocalDate(args.localDate);
    if (!dateParts) {
      return null;
    }

    // La fase lunar depende de la fecha + hora, casi nada de la ubicación; usamos
    // mediodía local y un punto neutro (la iluminación es global).
    const referenceDate = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, 12, 0));
    const tzone = getTimezoneOffsetHours(args.timezone, referenceDate) ?? 0;
    const request = {
      day: dateParts.day,
      month: dateParts.month,
      year: dateParts.year,
      hour: 12,
      min: 0,
      lat: 0,
      lon: 0,
      tzone
    };

    try {
      // Pegamos a los dos endpoints free y mergeamos: `lunar_metrics` suele traer
      // signo + iluminación, `moon_phase_report` el nombre de fase.
      const [metrics, report] = await Promise.allSettled([
        postSkyApi(config, "lunar_metrics", request),
        postSkyApi(config, "moon_phase_report", request)
      ]);

      const merged: Record<string, unknown> = {
        ...(metrics.status === "fulfilled" ? asRecord(metrics.value) : {}),
        ...(report.status === "fulfilled" ? asRecord(report.value) : {})
      };

      if (metrics.status === "rejected" && report.status === "rejected") {
        return null;
      }

      const rawPhase = pickString(merged, ["moon_phase", "phase", "moon_phase_name", "phase_name"]);
      const phaseKey = normalizePhaseKey(rawPhase);
      if (!phaseKey) {
        // Sin fase confiable no forzamos un dato inventado: que el front use el mock.
        return null;
      }

      const rawSign = pickString(merged, ["moon_sign", "sign", "moon_zodiac_sign", "moon_sign_name", "zodiac"]);
      const illumination = normalizeIllumination(
        pickNumber(merged, [
          "illumination",
          "moon_illumination",
          "illumination_percentage",
          "moon_percent",
          "percentage_illuminated",
          "moon_phase_percentage"
        ])
      );

      const voice = phaseVoice[phaseKey];
      return {
        phase: phaseLabels[phaseKey],
        phaseKey,
        sign: capitalizeSign(rawSign),
        illumination,
        // Copy/acción SIEMPRE en voz Órbita, nunca el texto crudo del proveedor.
        copy: voice.copy,
        action: voice.action
      };
    } catch {
      return null;
    }
  }
});
