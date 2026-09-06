/**
 * Posiciones tropicales geocéntricas para un instante (`planets/tropical` de
 * AstrologyAPI). Es el mismo cliente que la línea `release/1.0.0` usa para las
 * capas (`runAstrologyApiPlanetsTropical`), portado tal cual para que una
 * reconciliación posterior no encuentre dos clientes distintos del mismo
 * endpoint. Devuelve longitud, velocidad y retrogradación de los diez cuerpos
 * clásicos; si el proveedor no cumple el contrato (faltan o sobran cuerpos), el
 * resultado es `error`, nunca una lista parcial.
 */
import {
  getAstrologyApiConfig,
  getTimezoneOffsetHours,
  hasAstrologyApiCredentials,
  postAstrologyApi,
  type AstrologyApiBirthRequest
} from "./astrologyApi";

export const CANONICAL_TROPICAL_PLANETS = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto"
] as const;

export type TropicalPlanetKey = (typeof CANONICAL_TROPICAL_PLANETS)[number];

/** Una posición del cielo con velocidad: lo que la fase, el aspecto y la aplicación necesitan. */
export type EphemerisPosition = {
  key: string;
  label: string;
  sign: string;
  signEs: string;
  degree: number;
  fullDegree: number;
  speed: number;
  isRetrograde: boolean;
};

export type TropicalEphemerisProviderResult = {
  status: "success" | "not_configured" | "missing_input" | "error";
  provider: "astrologyapi";
  providerVersion: "astrologyapi-planets-tropical-v1";
  localDate: string;
  timezone: string;
  observedAt: number;
  warnings: string[];
  normalized?: { positions: EphemerisPosition[] };
  error?: string;
};

const PLANET_LABELS: Record<TropicalPlanetKey, string> = {
  sun: "Sol",
  moon: "Luna",
  mercury: "Mercurio",
  venus: "Venus",
  mars: "Marte",
  jupiter: "Júpiter",
  saturn: "Saturno",
  uranus: "Urano",
  neptune: "Neptuno",
  pluto: "Plutón"
};

const SIGN_NAMES_ES: Record<string, string> = {
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

const SIGN_ORDER = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces"
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function readNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function readOptionalBoolean(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "yes", "1", "retrograde", "r"].includes(normalized)) return true;
      if (["false", "no", "0", "direct", "d"].includes(normalized)) return false;
    }
  }
  return undefined;
}

export function normalizeLongitude(value: number) {
  return ((value % 360) + 360) % 360;
}

function normalizePlanetKey(value: string): TropicalPlanetKey | null {
  const normalized = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const aliases: Record<string, TropicalPlanetKey> = {
    sun: "sun",
    sol: "sun",
    moon: "moon",
    luna: "moon",
    mercury: "mercury",
    mercurio: "mercury",
    venus: "venus",
    mars: "mars",
    marte: "mars",
    jupiter: "jupiter",
    saturn: "saturn",
    saturno: "saturn",
    uranus: "uranus",
    urano: "uranus",
    neptune: "neptune",
    neptuno: "neptune",
    pluto: "pluto",
    pluton: "pluto"
  };
  return aliases[normalized] ?? null;
}

function normalizeSignName(value: string | undefined, longitude: number) {
  const supplied = value?.trim();
  if (supplied) {
    const key = supplied
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
    const english = Object.keys(SIGN_NAMES_ES).find((candidate) => candidate === key);
    if (english) {
      return { sign: english[0].toUpperCase() + english.slice(1), signEs: SIGN_NAMES_ES[english] };
    }
    const spanish = Object.entries(SIGN_NAMES_ES).find(
      ([, label]) =>
        label
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase() === key
    );
    if (spanish) {
      return { sign: spanish[0][0].toUpperCase() + spanish[0].slice(1), signEs: spanish[1] };
    }
  }
  const sign = SIGN_ORDER[Math.floor(normalizeLongitude(longitude) / 30)] ?? "Aries";
  return { sign, signEs: SIGN_NAMES_ES[sign.toLowerCase()] ?? sign };
}

function tropicalPositionItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const root = asRecord(raw);
  if (Array.isArray(root.planets)) return root.planets;
  if (Array.isArray(root.data)) return root.data;
  const data = asRecord(root.data);
  if (Array.isArray(data.planets)) return data.planets;
  const output = asRecord(root.output);
  if (Array.isArray(output.planets)) return output.planets;
  return [];
}

/**
 * Normaliza la respuesta de `planets/tropical`. Una entrada sin nombre,
 * longitud o velocidad se descarta: esos tres valores son obligatorios para
 * la fase, el aspecto y la aplicación/separación.
 */
export function normalizeAstrologyApiTropicalPositions(raw: unknown): EphemerisPosition[] {
  const positions = tropicalPositionItems(raw).flatMap((item) => {
    const record = asRecord(item);
    const rawName = readString(record, ["name", "planet", "planet_name", "key"]);
    const key = rawName ? normalizePlanetKey(rawName) : null;
    const fullDegree = readNumber(record, ["fullDegree", "full_degree", "fullDegreeInZodiac", "longitude", "lon"]);
    const speed = readNumber(record, ["speed", "planetSpeed", "planet_speed", "dailyMotion"]);
    if (!key || fullDegree === undefined || speed === undefined) return [];
    const longitude = normalizeLongitude(fullDegree);
    const sign = normalizeSignName(readString(record, ["sign", "sign_name", "zodiacSign"]), longitude);
    const suppliedDegree = readNumber(record, ["normDegree", "norm_degree", "degree"]);
    return [
      {
        key,
        label: PLANET_LABELS[key],
        sign: sign.sign,
        signEs: sign.signEs,
        degree: suppliedDegree === undefined ? longitude % 30 : normalizeLongitude(suppliedDegree) % 30,
        fullDegree: longitude,
        speed,
        isRetrograde: readOptionalBoolean(record, ["isRetro", "is_retro", "isRetrograde", "retrograde"]) ?? speed < 0
      } satisfies EphemerisPosition
    ];
  });
  return positions.sort(
    (left, right) =>
      CANONICAL_TROPICAL_PLANETS.indexOf(left.key as TropicalPlanetKey) -
      CANONICAL_TROPICAL_PLANETS.indexOf(right.key as TropicalPlanetKey)
  );
}

function getLocalDateTimeParts(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date);
    const readPart = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    const year = readPart("year");
    const month = readPart("month");
    const day = readPart("day");
    const hour = readPart("hour");
    const minute = readPart("minute");
    if ([year, month, day, hour, minute].every(Number.isFinite)) {
      return { year, month, day, hour, minute };
    }
  } catch {
    // Una zona IANA inválida se convierte en `missing_input` en el llamador.
  }
  return null;
}

export async function runAstrologyApiPlanetsTropical(args: {
  instant: Date;
  localDate: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
  signal?: AbortSignal;
}): Promise<TropicalEphemerisProviderResult> {
  const config = getAstrologyApiConfig();
  const observedAt = args.instant.getTime();
  const local = getLocalDateTimeParts(args.instant, args.timezone);
  const offset = getTimezoneOffsetHours(args.timezone, args.instant);
  const warnings: string[] = [];
  const base = {
    provider: "astrologyapi" as const,
    providerVersion: "astrologyapi-planets-tropical-v1" as const,
    localDate: args.localDate,
    timezone: args.timezone
  };

  if (!local || offset === undefined || !Number.isFinite(observedAt)) {
    return {
      ...base,
      status: "missing_input",
      observedAt: Number.isFinite(observedAt) ? observedAt : Date.now(),
      warnings: ["valid_instant_and_timezone_required_for_planets_tropical"]
    };
  }

  const request: AstrologyApiBirthRequest = {
    day: local.day,
    month: local.month,
    year: local.year,
    hour: local.hour,
    min: local.minute,
    lat: args.latitude ?? 0,
    lon: args.longitude ?? 0,
    tzone: offset,
    house_type: config.houseSystem
  };
  if (args.latitude === undefined || args.longitude === undefined) {
    warnings.push("geocentric_positions_use_zero_coordinates_without_house_interpretation");
  }
  if (!hasAstrologyApiCredentials(config)) {
    return { ...base, status: "not_configured", observedAt, warnings: [...warnings, "astrologyapi_credentials_not_configured"] };
  }

  try {
    const raw = await postAstrologyApi(config, "planets/tropical", request, { signal: args.signal });
    const positions = normalizeAstrologyApiTropicalPositions(raw);
    const counts = new Map<string, number>();
    for (const position of positions) counts.set(position.key, (counts.get(position.key) ?? 0) + 1);
    const missing = CANONICAL_TROPICAL_PLANETS.filter((key) => !counts.has(key));
    const duplicates = CANONICAL_TROPICAL_PLANETS.filter((key) => (counts.get(key) ?? 0) > 1);
    if (missing.length > 0 || duplicates.length > 0 || positions.length !== CANONICAL_TROPICAL_PLANETS.length) {
      return {
        ...base,
        status: "error",
        observedAt,
        warnings: [
          ...warnings,
          ...(missing.length > 0 ? [`planets_tropical_contract_missing:${missing.join(",")}`] : []),
          ...(duplicates.length > 0 ? [`planets_tropical_contract_duplicate:${duplicates.join(",")}`] : []),
          ...(positions.length !== CANONICAL_TROPICAL_PLANETS.length ? [`planets_tropical_contract_count:${positions.length}`] : [])
        ],
        error: "AstrologyAPI planets/tropical did not satisfy the verified fixture contract."
      };
    }
    return { ...base, status: "success", observedAt, warnings, normalized: { positions } };
  } catch (error) {
    return {
      ...base,
      status: "error",
      observedAt,
      warnings,
      error: error instanceof Error ? error.message : "Unknown AstrologyAPI planets/tropical error"
    };
  }
}
