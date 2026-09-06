/**
 * Tu momento · Tema del año — la profección anual (CORE-210).
 *
 * Profección anual Whole Sign: cada cumpleaños el recorrido avanza una casa
 * desde el Ascendente natal y vuelve a empezar cada doce años. La casa del
 * año dice en qué área se concentra la lectura; el signo en el que empieza esa
 * casa y su regente tradicional dicen con qué planeta la lee el método. Es el
 * método de la línea `release/1.0.0` (`buildAnnualProfectionLayerData` en
 * `convex/lib/layerAssembly.ts`), sobre la misma `annualProfectionForDate`
 * portada tal cual en `layersMath.ts`. Puro: sin proveedor.
 *
 * Qué NO se inventa: sin hora natal exacta no hay Ascendente confiable y por
 * eso no hay profección (`needs_birth_time`); un cumpleaños del 29 de febrero
 * se toma el 28 en años no bisiestos y se declara.
 */
import { resolveZonedCivilTime } from "./civilTime";
import { annualProfectionForDate, normalizeZodiacSign, type TraditionalRuler, type ZodiacSign } from "./layersMath";
import type { NormalizedAstroChart } from "./orbita";

export const SIGN_LABELS: Record<ZodiacSign, string> = {
  aries: "Aries",
  taurus: "Tauro",
  gemini: "Géminis",
  cancer: "Cáncer",
  leo: "Leo",
  virgo: "Virgo",
  libra: "Libra",
  scorpio: "Escorpio",
  sagittarius: "Sagitario",
  capricorn: "Capricornio",
  aquarius: "Acuario",
  pisces: "Piscis"
};

export const RULER_LABELS: Record<TraditionalRuler, string> = {
  sun: "Sol",
  moon: "Luna",
  mercury: "Mercurio",
  venus: "Venus",
  mars: "Marte",
  jupiter: "Júpiter",
  saturn: "Saturno"
};

export const HOUSE_THEMES: Record<number, string> = {
  1: "identidad, iniciativa y forma de presentarte",
  2: "recursos, ingresos, cuerpo y valor personal",
  3: "conversaciones, aprendizaje y entorno cercano",
  4: "hogar, familia, raíces e intimidad",
  5: "creatividad, disfrute, deseo y expresión personal",
  6: "rutinas, tareas, cuidado y trabajo cotidiano",
  7: "pareja, sociedades, contratos y acuerdos de a dos",
  8: "recursos compartidos, confianza y procesos de cambio",
  9: "estudios, creencias, viajes y búsqueda de sentido",
  10: "vocación, dirección pública y responsabilidades",
  11: "amistades, redes, proyectos y pertenencia",
  12: "descanso, cierres y vida interior"
};

export type TemaDelAno =
  | {
      status: "ready";
      precision: "exact";
      age: number;
      house: number;
      houseTheme: string;
      /** Signo en el que empieza la casa del año, en español. */
      sign: string;
      signKey: ZodiacSign;
      ruler: string;
      rulerKey: TraditionalRuler;
      /** Bordes del año personal (cumpleaños a cumpleaños) en la zona natal, ms. */
      periodStart: number;
      periodEnd: number;
      periodStartDate: string;
      periodEndDate: string;
      /** 1–12 dentro del año personal. */
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

function ascendantSignOf(chart: NormalizedAstroChart): ZodiacSign | null {
  const asc = chart.summary.ascendant ?? chart.placements.find((p) => p.key === "ascendant") ?? null;
  const candidates = [asc?.sign, asc?.signEs, chart.houses.find((h) => h.house === 1)?.sign, chart.houses.find((h) => h.house === 1)?.signEs];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      const sign = normalizeZodiacSign(c);
      if (sign) return sign;
    }
  }
  return null;
}

/** `YYYY-MM-DD` a las 00:00 en la zona natal, en ms. Sin zona válida, medianoche UTC. */
export function civilDateToTimestamp(civilDate: string, timezone: string): number {
  const r = resolveZonedCivilTime({ localDate: civilDate, localTime: "00:00", timezone });
  if (r.status === "exact") return r.instantMs;
  if (r.status === "fold" || r.status === "gap") {
    const first = r.candidates[0];
    if (first) return first.instantMs;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(civilDate);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : Number.NaN;
}

export function buildTemaDelAno(args: {
  chart: NormalizedAstroChart | null;
  birth: { birthDate: string; birthTimePrecision: "known" | "approximate" | "unknown"; timezone: string } | null;
  /** La fecha canónica del día (zona natal). */
  asOfDate: string;
  observedAt: number;
}): TemaDelAno {
  const { observedAt } = args;
  if (!args.birth) {
    return { status: "needs_birth_data", precision: "not_applicable", missingInputs: ["birth_data"], limitations: ["Para ubicar tu año personal hace falta tu fecha de nacimiento."], observedAt };
  }
  if (args.birth.birthTimePrecision !== "known") {
    return {
      status: "needs_birth_time",
      precision: "not_applicable",
      missingInputs: ["exact_birth_time"],
      limitations: ["Este cálculo recorre una casa distinta en cada cumpleaños y necesita una hora de nacimiento exacta."],
      observedAt
    };
  }
  if (!args.chart) {
    return { status: "needs_natal_chart", precision: "not_applicable", missingInputs: ["natal_chart"], limitations: ["Tu carta natal todavía no está calculada."], observedAt };
  }
  const ascendant = ascendantSignOf(args.chart);
  if (!ascendant) {
    return {
      status: "unavailable",
      precision: "not_applicable",
      missingInputs: ["ascendant_sign"],
      limitations: ["No pudimos confirmar tu Ascendente, que es el punto desde el que empieza este recorrido anual por las doce casas."],
      observedAt
    };
  }
  let calc: ReturnType<typeof annualProfectionForDate>;
  try {
    calc = annualProfectionForDate({ birthDate: args.birth.birthDate, asOfDate: args.asOfDate, ascendantSign: ascendant });
  } catch {
    return { status: "unavailable", precision: "not_applicable", missingInputs: ["valid_dates"], limitations: ["La fecha de hoy no puede ser anterior al nacimiento."], observedAt };
  }
  const periodStart = civilDateToTimestamp(calc.periodStart, args.birth.timezone);
  const periodEnd = civilDateToTimestamp(calc.periodEnd, args.birth.timezone);
  const today = civilDateToTimestamp(args.asOfDate, args.birth.timezone);
  if (![periodStart, periodEnd, today].every(Number.isFinite) || periodEnd <= periodStart) {
    return { status: "unavailable", precision: "not_applicable", missingInputs: ["valid_dates"], limitations: ["No pudimos ubicar los bordes de tu año personal."], observedAt };
  }
  const progress = Math.max(0, Math.min(1, (today - periodStart) / (periodEnd - periodStart)));
  const monthIndex = Math.min(12, Math.floor(progress * 12) + 1);
  const sign = SIGN_LABELS[calc.sign];
  const ruler = RULER_LABELS[calc.ruler];
  const houseTheme = HOUSE_THEMES[calc.house];
  return {
    status: "ready",
    precision: "exact",
    age: calc.age,
    house: calc.house,
    houseTheme,
    sign,
    signKey: calc.sign,
    ruler,
    rulerKey: calc.ruler,
    periodStart,
    periodEnd,
    periodStartDate: calc.periodStart,
    periodEndDate: calc.periodEnd,
    monthIndex,
    progress: Math.round(progress * 1e6) / 1e6,
    summary: `La profección anual es un método que recorre una casa de tu carta por cada año de vida. Este año llega a la casa ${calc.house}, asociada a ${houseTheme}. Como esa casa empieza en ${sign}, ${ruler} es el regente del año: este método usa ese planeta para leer cómo se expresan esos temas.`,
    limitations: [
      "Requiere hora natal exacta para conocer el Ascendente y las casas.",
      "El cumpleaños del 29 de febrero se toma el 28 de febrero en años no bisiestos."
    ],
    observedAt
  };
}
