import {
  BirthChartInput,
  buildTransitTimelinePreview,
  normalizeAstrologyApiNatalChart,
  normalizeAstrologyApiTransits,
  normalizeBirthInput,
  toSerializable,
  type AstrologyProviderRunResult,
  type NormalizedAstroTransit,
  type NormalizedAstroTimeline
} from "./orbita";

const DEFAULT_ASTROLOGY_API_BASE_URL = "https://json.astrologyapi.com/v1";
const DEFAULT_HOUSE_SYSTEM = "placidus";
const DEFAULT_ASTROLOGY_API_LANGUAGE = "en";
const DEFAULT_LOCATION_MAX_ROWS = 10;

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

export type ExtendedTransitProviderResult = {
  status: "success" | "partial" | "not_configured" | "missing_input" | "error";
  provider: "astrologyapi";
  providerVersion: string;
  houseSystem?: string;
  localDate: string;
  warnings: string[];
  request?: unknown;
  normalized?: {
    timeline: NormalizedAstroTimeline;
  };
  raw?: unknown;
  error?: string;
};

export type NatalChartProviderResult = Omit<AstrologyProviderRunResult, "normalized"> & {
  normalized?: {
    chart: NonNullable<AstrologyProviderRunResult["normalized"]>["chart"];
  };
};

export type DailyTransitProviderResult = Omit<AstrologyProviderRunResult, "normalized"> & {
  normalized?: {
    transits: NormalizedAstroTransit[];
  };
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

function getAstrologyApiLocationKey(config: AstrologyApiConfig) {
  return process.env.ASTROLOGY_API_LOCATION_KEY ?? process.env.ASTROLOGY_API_ACCESS_TOKEN ?? config.apiKey;
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

async function postAstrologyApi(
  config: AstrologyApiConfig,
  endpoint: string,
  body: unknown,
  options?: { signal?: AbortSignal }
) {
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
    body: JSON.stringify(body),
    signal: options?.signal
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

async function postAstrologyApiLocation(config: AstrologyApiConfig, endpoint: string, body: Record<string, unknown>) {
  const url = endpoint.startsWith("http") ? endpoint : `${config.baseUrl}/${endpoint.replace(/^\//, "")}`;
  const locationKey = getAstrologyApiLocationKey(config);

  if (!locationKey) {
    throw new Error("AstrologyAPI location credentials are missing.");
  }

  const baseHeaders = {
    Accept: "application/json",
    "Accept-Language": config.language,
    "x-astrologyapi-key": locationKey
  };

  try {
    return await postAstrologyApiLocationMcp(config, body);
  } catch {
    // Fall through to REST because some AstrologyAPI accounts expose geo_details there.
  }

  const parseResponse = async (response: Response) => {
    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { rawText: text };
      }
    }

    return { json, text };
  };

  const jsonResponse = await fetch(url, {
    method: "POST",
    headers: {
      ...baseHeaders,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const jsonResult = await parseResponse(jsonResponse);
  if (jsonResponse.ok) {
    return jsonResult.json;
  }

  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null) {
      form.set(key, String(value));
    }
  }

  const formResponse = await fetch(url, {
    method: "POST",
    headers: {
      ...baseHeaders
    },
    body: form
  });

  const formResult = await parseResponse(formResponse);
  if (formResponse.ok) {
    return formResult.json;
  }

  try {
    return await postAstrologyApiLocationMcp(config, body);
  } catch {
    // Keep the REST error because it points at the configured Location endpoint.
  }

  const detail =
    typeof formResult.json === "object" && formResult.json !== null
      ? JSON.stringify(formResult.json).slice(0, 500)
      : formResult.text.slice(0, 500);
  throw new Error(`AstrologyAPI ${endpoint} failed with ${formResponse.status}: ${detail}`);
}

async function postAstrologyApiLocationMcp(config: AstrologyApiConfig, body: Record<string, unknown>) {
  const locationKey = getAstrologyApiLocationKey(config);
  if (!locationKey) {
    throw new Error("AstrologyAPI location credentials are missing.");
  }

  const place = typeof body.place === "string" ? body.place : typeof body.query === "string" ? body.query : "";
  if (!place) {
    throw new Error("AstrologyAPI location place is missing.");
  }

  const maxRows =
    typeof body.maxRows === "number" && Number.isFinite(body.maxRows) ? body.maxRows : DEFAULT_LOCATION_MAX_ROWS;
  const response = await fetch(process.env.ASTROLOGY_API_MCP_URL ?? "https://mcp.astrologyapi.com/mcp", {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "x-astrologyapi-key": locationKey
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "geo_details",
        arguments: {
          place,
          maxRows,
          language: config.language
        }
      }
    })
  });

  const text = await response.text();
  const eventData = text
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice("data: ".length);
  const payloadText = eventData ?? text;
  let payload: unknown = null;

  if (payloadText) {
    try {
      payload = JSON.parse(payloadText);
    } catch {
      payload = { rawText: payloadText };
    }
  }

  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload !== null
        ? JSON.stringify(payload).slice(0, 500)
        : payloadText.slice(0, 500);
    throw new Error(`AstrologyAPI MCP geo_details failed with ${response.status}: ${detail}`);
  }

  const result = asRecord(asRecord(payload).result);
  const content = Array.isArray(result.content) ? result.content : [];
  const firstText = content
    .map((item) => asRecord(item))
    .map((item) => item.text)
    .find((value): value is string => typeof value === "string");

  if (!firstText) {
    return payload;
  }

  try {
    return JSON.parse(firstText);
  } catch {
    return { rawText: firstText };
  }
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

export async function runAstrologyApiNatalChart(args: {
  input: BirthChartInput;
  localDate: string;
}): Promise<NatalChartProviderResult> {
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
    }) as NatalChartProviderResult;
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
    }) as NatalChartProviderResult;
  }

  const warnings = [...prepared.warnings];

  try {
    let natalChartInterpretation: unknown;
    let westernChartData: unknown;
    const preferredEndpoint = process.env.ASTROLOGY_API_NATAL_CHART_ENDPOINT ?? "western_horoscope";

    try {
      const westernHoroscope = await postAstrologyApi(config, preferredEndpoint, prepared.request);
      natalChartInterpretation = westernHoroscope;
      westernChartData = westernHoroscope;
    } catch {
      warnings.push("western_horoscope_unavailable_used_legacy_natal_endpoints");
      [natalChartInterpretation, westernChartData] = await Promise.all([
        postAstrologyApi(config, "natal_chart_interpretation", prepared.request),
        postAstrologyApi(config, "western_chart_data", prepared.request)
      ]);
    }

    const chart = normalizeAstrologyApiNatalChart({
      input: prepared.normalized,
      houseSystem: config.houseSystem,
      timezoneOffset: prepared.timezoneOffset,
      calculationTimeSource: prepared.calculationTimeSource,
      natalChartInterpretation,
      westernChartData
    });

    return toSerializable({
      status: "success",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-v1",
      houseSystem: config.houseSystem,
      localDate: args.localDate,
      warnings,
      request: {
        natal: prepared.request
      },
      normalized: {
        chart
      },
      raw: {
        natalChartInterpretation,
        westernChartData
      }
    }) as NatalChartProviderResult;
  } catch (error) {
    return toSerializable({
      status: "error",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-v1",
      houseSystem: config.houseSystem,
      localDate: args.localDate,
      warnings,
      request: prepared.request,
      error: error instanceof Error ? error.message : "Unknown AstrologyAPI natal chart error"
    }) as NatalChartProviderResult;
  }
}

export async function runAstrologyApiDailyTransits(args: {
  input: BirthChartInput;
  localDate: string;
  signal?: AbortSignal;
}): Promise<DailyTransitProviderResult> {
  const config = getAstrologyApiConfig();
  const prepared = buildBirthRequest(args.input, config.houseSystem);

  if (!hasAstrologyApiCredentials(config)) {
    return toSerializable({
      status: "not_configured",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-daily-transits-v3",
      houseSystem: config.houseSystem,
      localDate: args.localDate,
      warnings: ["astrologyapi_credentials_not_configured"],
      request: prepared.status === "ready" ? prepared.request : null
    }) as DailyTransitProviderResult;
  }

  if (prepared.status !== "ready") {
    return toSerializable({
      status: "missing_input",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-daily-transits-v3",
      houseSystem: config.houseSystem,
      localDate: args.localDate,
      warnings: prepared.warnings,
      request: null
    }) as DailyTransitProviderResult;
  }

  try {
    const natalTransitsDaily = await postAstrologyApi(config, "natal_transits/daily", prepared.request, {
      signal: args.signal
    });
    const transits = normalizeAstrologyApiTransits(natalTransitsDaily);

    return toSerializable({
      status: "success",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-daily-transits-v3",
      houseSystem: config.houseSystem,
      localDate: args.localDate,
      warnings: [
        ...prepared.warnings,
        "natal_transits_daily_endpoint_date_scope_needs_provider_verification"
      ],
      request: {
        dailyTransits: prepared.request
      },
      normalized: {
        transits
      },
      raw: natalTransitsDaily
    }) as DailyTransitProviderResult;
  } catch (error) {
    return toSerializable({
      status: "error",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-daily-transits-v3",
      houseSystem: config.houseSystem,
      localDate: args.localDate,
      warnings: prepared.warnings,
      request: prepared.request,
      error: error instanceof Error ? error.message : "Unknown AstrologyAPI daily transit error"
    }) as DailyTransitProviderResult;
  }
}

export async function runAstrologyApiExtendedTransits(args: {
  input: BirthChartInput;
  localDate: string;
  includeNatalWeekly?: boolean;
  includeTropicalWeekly?: boolean;
  includeTropicalMonthly?: boolean;
}): Promise<ExtendedTransitProviderResult> {
  const config = getAstrologyApiConfig();
  const prepared = buildBirthRequest(args.input, config.houseSystem);
  const includeNatalWeekly = args.includeNatalWeekly ?? true;
  const includeTropicalWeekly = args.includeTropicalWeekly ?? false;
  const includeTropicalMonthly = args.includeTropicalMonthly ?? false;
  const endpointStatus: NormalizedAstroTimeline["providerStatus"]["endpoints"] = {
    "natal_transits/weekly": includeNatalWeekly ? "not_configured" : "skipped",
    "tropical_transits/weekly": includeTropicalWeekly ? "not_configured" : "skipped",
    "tropical_transits/monthly": includeTropicalMonthly ? "not_configured" : "skipped"
  };

  if (!hasAstrologyApiCredentials(config)) {
    return toSerializable({
      status: "not_configured",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-transits-v1",
      houseSystem: config.houseSystem,
      localDate: args.localDate,
      warnings: ["astrologyapi_credentials_not_configured"],
      request: prepared.status === "ready" ? prepared.request : null,
      normalized: {
        timeline: buildTransitTimelinePreview({
          localDate: args.localDate,
          endpointStatus,
          status: "not_configured",
          warnings: ["astrologyapi_credentials_not_configured"]
        })
      }
    }) as ExtendedTransitProviderResult;
  }

  if (prepared.status !== "ready") {
    const missingInputStatus = Object.fromEntries(
      Object.entries(endpointStatus).map(([endpoint, status]) => [endpoint, status === "skipped" ? status : "missing_input"])
    ) as NormalizedAstroTimeline["providerStatus"]["endpoints"];

    return toSerializable({
      status: "missing_input",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-transits-v1",
      houseSystem: config.houseSystem,
      localDate: args.localDate,
      warnings: prepared.warnings,
      request: null,
      normalized: {
        timeline: buildTransitTimelinePreview({
          localDate: args.localDate,
          endpointStatus: missingInputStatus,
          status: "missing_input",
          warnings: prepared.warnings
        })
      }
    }) as ExtendedTransitProviderResult;
  }

  type ExtendedTransitEndpointEntry = readonly [
    "natal_transits/weekly" | "tropical_transits/weekly" | "tropical_transits/monthly",
    "natalWeekly" | "tropicalWeekly" | "tropicalMonthly"
  ];
  const endpointEntries: ExtendedTransitEndpointEntry[] = [];
  if (includeNatalWeekly) {
    endpointEntries.push(["natal_transits/weekly", "natalWeekly"]);
  }
  if (includeTropicalWeekly) {
    endpointEntries.push(["tropical_transits/weekly", "tropicalWeekly"]);
  }
  if (includeTropicalMonthly) {
    endpointEntries.push(["tropical_transits/monthly", "tropicalMonthly"]);
  }

  if (endpointEntries.length === 0) {
    return toSerializable({
      status: "missing_input",
      provider: "astrologyapi",
      providerVersion: "astrologyapi-western-transits-v1",
      houseSystem: config.houseSystem,
      localDate: args.localDate,
      warnings: ["no_extended_transit_endpoint_selected"],
      request: prepared.request,
      normalized: {
        timeline: buildTransitTimelinePreview({
          localDate: args.localDate,
          endpointStatus,
          status: "missing_input",
          warnings: ["no_extended_transit_endpoint_selected"]
        })
      }
    }) as ExtendedTransitProviderResult;
  }

  const settled = await Promise.allSettled(
    endpointEntries.map(async ([endpoint, key]) => ({
      endpoint,
      key,
      raw: await postAstrologyApi(config, endpoint, prepared.request)
    }))
  );

  const raw: Record<string, unknown> = {};
  const warnings = [...prepared.warnings];
  let firstError: string | undefined;

  for (const result of settled) {
    if (result.status === "fulfilled") {
      raw[result.value.key] = result.value.raw;
      endpointStatus[result.value.endpoint] = "success";
      continue;
    }

    const entry = endpointEntries[settled.indexOf(result)];
    if (entry) {
      endpointStatus[entry[0]] = "error";
    }
    const message = result.reason instanceof Error ? result.reason.message : "Unknown AstrologyAPI extended transit error";
    warnings.push(message);
    firstError ??= message;
  }

  const successCount = Object.values(endpointStatus).filter((status) => status === "success").length;
  const selectedCount = Object.values(endpointStatus).filter((status) => status !== "skipped").length;
  const status: ExtendedTransitProviderResult["status"] =
    successCount === selectedCount ? "success" : successCount > 0 ? "partial" : "error";
  const timeline = buildTransitTimelinePreview({
    localDate: args.localDate,
    natalWeekly: raw.natalWeekly,
    tropicalWeekly: raw.tropicalWeekly,
    tropicalMonthly: raw.tropicalMonthly,
    endpointStatus,
    warnings,
    status,
    error: firstError
  });

  return toSerializable({
    status,
    provider: "astrologyapi",
    providerVersion: "astrologyapi-western-transits-v1",
    houseSystem: config.houseSystem,
    localDate: args.localDate,
    warnings,
    request: {
      extendedTransits: prepared.request,
      endpoints: endpointStatus
    },
    normalized: {
      timeline
    },
    raw,
    error: firstError
  }) as ExtendedTransitProviderResult;
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
    readString(record, ["label", "name", "display_name", "full_name", "city", "place", "place_name"]) ??
    "Lugar sin nombre";

  return {
    label,
    placeId: readString(record, ["place_id", "placeId", "id", "geoname_id"]),
    latitude: readNumber(record, ["lat", "latitude"]),
    longitude: readNumber(record, ["lon", "lng", "longitude"]),
    timezone: readString(record, ["timezone", "timezone_id", "timeZoneId", "iana_timezone"]),
    utcOffset: readNumber(record, ["utc_offset", "offset", "tzone"]),
    raw: rawPlace
  };
}

export function normalizeAstrologyApiPlaceResults(raw: unknown) {
  const container = asRecord(raw);
  const items = Array.isArray(raw)
    ? raw
    : Array.isArray(container.results)
      ? container.results
      : Array.isArray(container.places)
        ? container.places
        : Array.isArray(container.geonames)
          ? container.geonames
          : Array.isArray(container.data)
            ? container.data
            : [];

  return items.map(normalizePlaceResult);
}

export function buildPlaceLookupRequests(query: string) {
  const requests: Array<Record<string, unknown>> = [{ place: query, maxRows: DEFAULT_LOCATION_MAX_ROWS }];
  const simplePlace = query.split(",")[0]?.trim();

  if (simplePlace && simplePlace !== query) {
    requests.push({ place: simplePlace, maxRows: DEFAULT_LOCATION_MAX_ROWS });
  }

  return requests.filter((request, index, all) => {
    const serialized = JSON.stringify(request);
    return all.findIndex((candidate) => JSON.stringify(candidate) === serialized) === index;
  });
}

export async function resolvePlaceWithAstrologyApi(query: string): Promise<PlaceLookupResult> {
  const config = getAstrologyApiConfig();
  const endpoint = process.env.ASTROLOGY_API_LOCATION_URL;
  const trimmed = query.trim();
  const hasLocationCredentials = Boolean(getAstrologyApiLocationKey(config));

  if (!endpoint || !hasLocationCredentials) {
    return {
      status: "not_configured",
      provider: "astrologyapi",
      query: trimmed,
      endpoint: endpoint ?? "",
      places: [],
      error: "Set ASTROLOGY_API_LOCATION_URL plus ASTROLOGY_API_KEY or ASTROLOGY_API_LOCATION_KEY to enable place lookup."
    };
  }

  try {
    let lastRaw: unknown = null;
    let lastError: unknown = null;

    for (const request of buildPlaceLookupRequests(trimmed)) {
      try {
        const raw = await postAstrologyApiLocation(config, endpoint, request);
        const places = normalizeAstrologyApiPlaceResults(raw);
        lastRaw = raw;

        if (places.length > 0 || "query" in request) {
          return toSerializable({
            status: "success",
            provider: "astrologyapi",
            query: trimmed,
            endpoint,
            places,
            raw
          }) as PlaceLookupResult;
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError && lastRaw === null) {
      throw lastError;
    }

    return toSerializable({
      status: "success",
      provider: "astrologyapi",
      query: trimmed,
      endpoint,
      places: [],
      raw: lastRaw
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
