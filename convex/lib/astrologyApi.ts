import {
  BirthChartInput,
  normalizeAstrologyApiNatalChart,
  normalizeAstrologyApiTransits,
  normalizeBirthInput,
  toSerializable,
  type AstrologyProviderRunResult
} from "./orbita";

const DEFAULT_ASTROLOGY_API_BASE_URL = "https://json.astrologyapi.com/v1";
const DEFAULT_HOUSE_SYSTEM = "placidus";
const DEFAULT_ASTROLOGY_API_LANGUAGE = "en";

type AstrologyApiConfig = {
  baseUrl: string;
  userId?: string;
  apiKey?: string;
  language: string;
  houseSystem: string;
};

type AstrologyApiBirthRequest = {
  day: number;
  month: number;
  year: number;
  hour: number;
  min: number;
  lat: number;
  lon: number;
  tzone: number;
  house_type: string;
};

type PlaceLookupResult = {
  status: "success" | "not_configured" | "error";
  provider: "astrologyapi";
  query: string;
  endpoint?: string;
  places: Array<{
    label: string;
    placeId?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    utcOffset?: number;
    raw: unknown;
  }>;
  raw?: unknown;
  error?: string;
};

function getAstrologyApiConfig(): AstrologyApiConfig {
  return {
    baseUrl: (process.env.ASTROLOGY_API_BASE_URL ?? DEFAULT_ASTROLOGY_API_BASE_URL).replace(/\/$/, ""),
    userId: process.env.ASTROLOGY_API_USER_ID,
    apiKey: process.env.ASTROLOGY_API_KEY,
    language: process.env.ASTROLOGY_API_LANGUAGE ?? DEFAULT_ASTROLOGY_API_LANGUAGE,
    houseSystem: process.env.ASTROLOGY_API_HOUSE_SYSTEM ?? DEFAULT_HOUSE_SYSTEM
  };
}

function hasAstrologyApiCredentials(config: AstrologyApiConfig) {
  return Boolean(config.userId && config.apiKey);
}

function encodeBasicAuth(userId: string, apiKey: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(`${userId}:${apiKey}`).toString("base64");
  }

  return btoa(`${userId}:${apiKey}`);
}

function parseIsoDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return { year, month, day };
}

function parseTimeParts(value?: string) {
  if (!value) {
    return null;
  }

  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return { hour, minute };
}

function parseOffsetFromTimezoneName(value: string) {
  if (value === "GMT" || value === "UTC") {
    return 0;
  }

  const match = value.match(/(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) {
    return undefined;
  }

  const direction = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return undefined;
  }

  return direction * (hours + minutes / 60);
}

export function getTimezoneOffsetHours(timezone: string, date: Date) {
  const numeric = Number(timezone);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
      timeZoneName: "shortOffset"
    }).formatToParts(date);
    const timeZoneName = parts.find((part) => part.type === "timeZoneName")?.value;
    return timeZoneName ? parseOffsetFromTimezoneName(timeZoneName) : undefined;
  } catch {
    return undefined;
  }
}

function buildBirthRequest(input: BirthChartInput, houseSystem: string) {
  const normalized = normalizeBirthInput(input);
  const dateParts = parseIsoDateParts(normalized.birthDate);
  const timeParts = parseTimeParts(normalized.birthTime);
  const warnings = [...normalized.modelInputWarnings];

  if (!dateParts) {
    return { status: "missing_input" as const, warnings: [...warnings, "birth_date_required_for_astrologyapi"] };
  }

  if (normalized.latitude === undefined || normalized.longitude === undefined) {
    return { status: "missing_input" as const, warnings: [...warnings, "coordinates_required_for_astrologyapi"] };
  }

  const calculationTime =
    normalized.birthTimePrecision === "unknown" || !timeParts
      ? { hour: 12, minute: 0, source: "noon_fallback" as const }
      : { hour: timeParts.hour, minute: timeParts.minute, source: "birth_time" as const };

  if (calculationTime.source === "noon_fallback") {
    warnings.push("unknown_birth_time_uses_noon_fallback_for_provider_call");
  }

  const referenceDate = new Date(
    Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, calculationTime.hour, calculationTime.minute)
  );
  const offset = getTimezoneOffsetHours(normalized.timezone, referenceDate);

  if (offset === undefined) {
    return {
      status: "missing_input" as const,
      warnings: [...warnings, "timezone_offset_required_for_astrologyapi"]
    };
  }

  const request: AstrologyApiBirthRequest = {
    day: dateParts.day,
    month: dateParts.month,
    year: dateParts.year,
    hour: calculationTime.hour,
    min: calculationTime.minute,
    lat: normalized.latitude,
    lon: normalized.longitude,
    tzone: offset,
    house_type: houseSystem
  };

  return {
    status: "ready" as const,
    normalized,
    request,
    warnings,
    calculationTimeSource: calculationTime.source,
    timezoneOffset: offset
  };
}

async function postAstrologyApi(config: AstrologyApiConfig, endpoint: string, body: unknown) {
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

export async function runAstrologyApiProvider(args: {
  input: BirthChartInput;
  localDate: string;
}): Promise<AstrologyProviderRunResult> {
  const config = getAstrologyApiConfig();
  const prepared = buildBirthRequest(args.input, config.houseSystem);

  if (!hasAstrologyApiCredentials(config)) {
    return toSerializable({
      status: "not_configured",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-v1",
      houseSystem: config.houseSystem,
      localDate: args.localDate,
      warnings: ["astrologyapi_credentials_not_configured"],
      request: prepared.status === "ready" ? prepared.request : null
    }) as AstrologyProviderRunResult;
  }

  if (prepared.status !== "ready") {
    return toSerializable({
      status: "missing_input",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-v1",
      houseSystem: config.houseSystem,
      localDate: args.localDate,
      warnings: prepared.warnings,
      request: null
    }) as AstrologyProviderRunResult;
  }

  try {
    const [natalChartInterpretation, westernChartData, natalTransitsDaily] = await Promise.all([
      postAstrologyApi(config, "natal_chart_interpretation", prepared.request),
      postAstrologyApi(config, "western_chart_data", prepared.request),
      postAstrologyApi(config, "natal_transits/daily", prepared.request)
    ]);

    const chart = normalizeAstrologyApiNatalChart({
      input: prepared.normalized,
      houseSystem: config.houseSystem,
      timezoneOffset: prepared.timezoneOffset,
      calculationTimeSource: prepared.calculationTimeSource,
      natalChartInterpretation,
      westernChartData
    });
    const transits = normalizeAstrologyApiTransits(natalTransitsDaily);

    return toSerializable({
      status: "success",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-v1",
      houseSystem: config.houseSystem,
      localDate: args.localDate,
      warnings: [
        ...prepared.warnings,
        "natal_transits_daily_endpoint_date_scope_needs_provider_verification"
      ],
      request: {
        natal: prepared.request,
        dailyTransits: prepared.request
      },
      normalized: {
        chart,
        transits
      },
      raw: {
        natalChartInterpretation,
        westernChartData,
        natalTransitsDaily
      }
    }) as AstrologyProviderRunResult;
  } catch (error) {
    return toSerializable({
      status: "error",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-v1",
      houseSystem: config.houseSystem,
      localDate: args.localDate,
      warnings: prepared.warnings,
      request: prepared.request,
      error: error instanceof Error ? error.message : "Unknown AstrologyAPI error"
    }) as AstrologyProviderRunResult;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function readNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function normalizePlaceResult(rawPlace: unknown) {
  const record = asRecord(rawPlace);
  const label =
    readString(record, ["label", "name", "display_name", "full_name", "city", "place"]) ?? "Lugar sin nombre";

  return {
    label,
    placeId: readString(record, ["place_id", "placeId", "id"]),
    latitude: readNumber(record, ["lat", "latitude"]),
    longitude: readNumber(record, ["lon", "lng", "longitude"]),
    timezone: readString(record, ["timezone", "timezone_id", "timeZoneId", "iana_timezone"]),
    utcOffset: readNumber(record, ["utc_offset", "offset", "tzone"]),
    raw: rawPlace
  };
}

export async function resolvePlaceWithAstrologyApi(query: string): Promise<PlaceLookupResult> {
  const config = getAstrologyApiConfig();
  const endpoint = process.env.ASTROLOGY_API_LOCATION_URL;
  const trimmed = query.trim();

  if (!endpoint || !hasAstrologyApiCredentials(config)) {
    return {
      status: "not_configured",
      provider: "astrologyapi",
      query: trimmed,
      endpoint: endpoint ?? "",
      places: [],
      error: "Set ASTROLOGY_API_LOCATION_URL plus ASTROLOGY_API_USER_ID and ASTROLOGY_API_KEY to enable place lookup."
    };
  }

  try {
    const raw = await postAstrologyApi(config, endpoint, { query: trimmed });
    const container = asRecord(raw);
    const items =
      Array.isArray(raw)
        ? raw
        : Array.isArray(container.results)
          ? container.results
          : Array.isArray(container.places)
            ? container.places
            : Array.isArray(container.data)
              ? container.data
              : [];

    return toSerializable({
      status: "success",
      provider: "astrologyapi",
      query: trimmed,
      endpoint,
      places: items.map(normalizePlaceResult),
      raw
    }) as PlaceLookupResult;
  } catch (error) {
    return {
      status: "error",
      provider: "astrologyapi",
      query: trimmed,
      endpoint: endpoint ?? "",
      places: [],
      error: error instanceof Error ? error.message : "Unknown place lookup error"
    };
  }
}
