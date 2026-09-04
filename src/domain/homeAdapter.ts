import { HomeReading } from "./types";
import type {
  CumplelunaData,
  LunaSobreLaCartaPayload,
  LunaSobreLaCartaPrecision,
  LunaSobreLaCartaStatus,
  LunarPhaseKey,
  MoonOnChartData
} from "@/services/appRefs";

/**
 * Adapta el payload de `readings.getToday` (Convex, hoy stub editorial de
 * `convex/lib/orbita.ts#buildDailyReadingPayload`) al `HomeReading` local.
 * Defensivo campo a campo: todo lo que el backend no traiga cae al fallback
 * del engine local, para que la Home nunca muestre huecos.
 */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readString(record: Record<string, unknown> | null, key: string): string | undefined {
  const v = record?.[key];
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}

/** Acepta string o lista (el Home Lab pide 3 ítems para hacé/evitá). */
function readStringOrList(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (Array.isArray(value)) {
    const items = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    if (items.length > 0) return items.join(" · ");
  }
  return undefined;
}

export function toHomeReading(payload: unknown, fallback: HomeReading): HomeReading {
  const p = asRecord(payload);
  if (!p) return fallback;

  const modules = asRecord(p.modules);
  const longRead = asRecord(p.longRead);
  const topicsRaw = Array.isArray(p.topics) ? p.topics.map(asRecord) : [];

  const topics = fallback.topics.map((ft) => {
    const match = topicsRaw.find((t) => t && t.topic === ft.topic);
    if (!match) return ft;
    return {
      ...ft,
      title: readString(match, "title") ?? ft.title,
      oneLine: readString(match, "body") ?? ft.oneLine
    };
  });

  return {
    ...fallback,
    headline: readString(modules, "headline") ?? fallback.headline,
    hace: readStringOrList(modules?.do) ?? fallback.hace,
    evita: readStringOrList(modules?.avoid) ?? fallback.evita,
    energia: readString(modules, "energy") ?? fallback.energia,
    accion: readString(modules, "action") ?? fallback.accion,
    topics,
    longReadTitle: readString(longRead, "title") ?? fallback.longReadTitle,
    longReadBody: readString(longRead, "body") ?? fallback.longReadBody
  };
}

// ---------------------------------------------------------------------------
// CORE-192 — La Luna de hoy sobre la carta natal
// ---------------------------------------------------------------------------
//
// Lector defensivo de `home.getLunaSobreLaCarta` para los módulos LA LUNA EN TU
// CARTA y CUMPLELUNA (los arma CORE-191). A diferencia de `toHomeReading`, acá
// NO se rellena con un fallback: este módulo publica un dato astronómico y
// medio dato es un dato falso. Si el sobre no viene completo devolvemos `null`
// y la pantalla muestra su estado vacío; si viene un bloque roto, cae ese
// bloque solo y el `status` del sobre sigue explicando por qué.

const LUNA_STATUSES: readonly LunaSobreLaCartaStatus[] = [
  "ready",
  "partial",
  "needs_session",
  "needs_daily_context",
  "needs_natal_chart",
  "not_configured",
  "provider_error"
];

const LUNA_PRECISIONS: readonly LunaSobreLaCartaPrecision[] = ["exact", "estimated", "range", "not_applicable"];

const LUNAR_PHASE_KEYS: readonly LunarPhaseKey[] = [
  "new",
  "waxing_crescent",
  "first_quarter",
  "waxing_gibbous",
  "full",
  "waning_gibbous",
  "last_quarter",
  "waning_crescent"
];

function readFiniteNumber(record: Record<string, unknown> | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function readNumberList(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item)) : [];
}

/** Un rango `{ from, to }` sólo vale si están los dos números y están ordenados. */
function readRange(value: unknown): { from: number; to: number } | null {
  const record = asRecord(value);
  const from = readFiniteNumber(record, "from");
  const to = readFiniteNumber(record, "to");
  return from !== null && to !== null && to >= from ? { from, to } : null;
}

/** Una ventana temporal `{ earliest, latest }`, con la misma exigencia. */
function readWindow(value: unknown): { earliest: number; latest: number } | null {
  const record = asRecord(value);
  const earliest = readFiniteNumber(record, "earliest");
  const latest = readFiniteNumber(record, "latest");
  return earliest !== null && latest !== null && latest >= earliest ? { earliest, latest } : null;
}

function toMoonOnChart(value: unknown): MoonOnChartData | null {
  const record = asRecord(value);
  if (!record || record.kind !== "moon_on_chart") return null;

  const observedAt = readFiniteNumber(record, "observedAt");
  const longitudeDegrees = readFiniteNumber(record, "longitudeDegrees");
  const elongationDegrees = readFiniteNumber(record, "elongationDegrees");
  const illumination = readFiniteNumber(record, "illumination");
  const sign = readString(record, "sign");
  const phaseKey = record.phaseKey;
  const precision = record.precision;

  if (
    observedAt === null ||
    longitudeDegrees === null ||
    elongationDegrees === null ||
    illumination === null ||
    !sign ||
    !LUNAR_PHASE_KEYS.includes(phaseKey as LunarPhaseKey) ||
    !LUNA_PRECISIONS.includes(precision as LunaSobreLaCartaPrecision)
  ) {
    return null;
  }

  // La casa es opcional por contrato; lo que no se acepta es una casa fuera de
  // rango, porque de ahí sale directo un "tu casa 0" en pantalla.
  const natalHouse = readFiniteNumber(record, "natalHouse");
  const house = natalHouse !== null && Number.isInteger(natalHouse) && natalHouse >= 1 && natalHouse <= 12 ? natalHouse : null;

  return {
    kind: "moon_on_chart",
    observedAt,
    longitudeDegrees,
    speedDegreesPerDay: readFiniteNumber(record, "speedDegreesPerDay") ?? 0,
    signKey: readString(record, "signKey") ?? "",
    sign,
    degreeInSign: readFiniteNumber(record, "degreeInSign") ?? 0,
    phaseKey: phaseKey as LunarPhaseKey,
    phaseName: readString(record, "phaseName") ?? "",
    illumination,
    elongationDegrees,
    natalHouse: house,
    houseTheme: house === null ? null : (readString(record, "houseTheme") ?? null),
    housesToday: readNumberList(record.housesToday),
    signsToday: readStringList(record.signsToday),
    phasesToday: readStringList(record.phasesToday).filter((key): key is LunarPhaseKey =>
      LUNAR_PHASE_KEYS.includes(key as LunarPhaseKey)
    ),
    precision: precision as LunaSobreLaCartaPrecision,
    summary: readString(record, "summary") ?? ""
  };
}

function toCumpleluna(value: unknown): CumplelunaData | null {
  const record = asRecord(value);
  if (!record || record.kind !== "cumpleluna") return null;

  const observedAt = readFiniteNumber(record, "observedAt");
  const natalElongationDegrees = readFiniteNumber(record, "natalElongationDegrees");
  const currentElongationDegrees = readFiniteNumber(record, "currentElongationDegrees");
  const daysRemaining = readFiniteNumber(record, "daysRemaining");
  const nextExactAt = readFiniteNumber(record, "nextExactAt");
  const previousExactAt = readFiniteNumber(record, "previousExactAt");
  const nextExactAtWindow = readWindow(record.nextExactAtWindow);
  const previousExactAtWindow = readWindow(record.previousExactAtWindow);
  const daysRemainingWindowDays = readRange(record.daysRemainingWindowDays);
  const cycleDayWindowDays = readRange(record.cycleDayWindowDays);
  const precision = record.precision === "range" ? "range" : record.precision === "estimated" ? "estimated" : null;

  // Sin ventana no hay Cumpleluna: publicar el instante solo lo convertiría en
  // la promesa exacta que el backend justamente evita.
  if (
    observedAt === null ||
    natalElongationDegrees === null ||
    currentElongationDegrees === null ||
    daysRemaining === null ||
    nextExactAt === null ||
    previousExactAt === null ||
    !nextExactAtWindow ||
    !previousExactAtWindow ||
    !daysRemainingWindowDays ||
    !cycleDayWindowDays ||
    precision === null
  ) {
    return null;
  }

  return {
    kind: "cumpleluna",
    observedAt,
    natalElongationDegrees,
    natalElongationToleranceDegrees: readFiniteNumber(record, "natalElongationToleranceDegrees") ?? 0,
    currentElongationDegrees,
    elongationRateDegreesPerDay: readFiniteNumber(record, "elongationRateDegreesPerDay") ?? 0,
    cycleDegrees: readFiniteNumber(record, "cycleDegrees") ?? 0,
    cycleFraction: readFiniteNumber(record, "cycleFraction") ?? 0,
    cycleDay: readFiniteNumber(record, "cycleDay") ?? 0,
    cycleDayWindowDays,
    cycleLengthDays: readFiniteNumber(record, "cycleLengthDays") ?? 0,
    daysRemaining,
    daysRemainingWindowDays,
    previousExactAt,
    previousExactAtWindow,
    nextExactAt,
    nextExactAtWindow,
    precision,
    summary: readString(record, "summary") ?? ""
  };
}

export function toLunaSobreLaCarta(payload: unknown): LunaSobreLaCartaPayload | null {
  const record = asRecord(payload);
  if (!record) return null;

  const status = record.status;
  const precision = record.precision;
  if (
    !LUNA_STATUSES.includes(status as LunaSobreLaCartaStatus) ||
    !LUNA_PRECISIONS.includes(precision as LunaSobreLaCartaPrecision)
  ) {
    return null;
  }

  return {
    methodVersion: readString(record, "methodVersion") ?? "",
    providerVersion: readString(record, "providerVersion") ?? "",
    status: status as LunaSobreLaCartaStatus,
    precision: precision as LunaSobreLaCartaPrecision,
    localDate: readString(record, "localDate") ?? "",
    timezone: readString(record, "timezone") ?? "",
    observedAt: readFiniteNumber(record, "observedAt"),
    moonOnChart: toMoonOnChart(record.moonOnChart),
    cumpleluna: toCumpleluna(record.cumpleluna),
    missingInputs: readStringList(record.missingInputs),
    limitations: readStringList(record.limitations)
  };
}

/** ¿Hay algo real para dibujar? Al menos un bloque sobrevivió la validación.
 *  No mira `status`: un `needs_natal_chart` igual trae la Luna del día. */
export function hasLunaSobreLaCartaData(result: LunaSobreLaCartaPayload | null): boolean {
  return Boolean(result && (result.moonOnChart || result.cumpleluna));
}
