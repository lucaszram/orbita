export const CHART_CALCULATION_VERSION = "orbita-stub-v1";
export const DAILY_READING_CONTENT_VERSION = "orbita-daily-stub-v1";
export const ASTROLOGY_API_CHART_CALCULATION_VERSION = "orbita-astrologyapi-western-v1";
export const DAILY_READING_EDITORIAL_VERSION = "orbita-daily-editorial-p0-v2";
export const CHART_WHEEL_DATA_VERSION = "orbita-chart-wheel-v1";
export const VALUE_RADAR_VERSION = "orbita-value-radar-v1";
export const LONG_RANGE_TIMELINE_CONTRACT_VERSION = "orbita-long-range-timeline-provider-v1";

export type AuthIdentityLike = {
  tokenIdentifier: string;
  subject: string;
  email?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  nickname?: string;
  preferredUsername?: string;
};

export type BirthChartInput = {
  birthDate: string;
  birthTime?: string;
  birthTimePrecision: "known" | "approximate" | "unknown";
  birthPlaceLabel: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
};

export type NormalizedAstroPlacement = {
  key: string;
  label: string;
  sign: string;
  signEs: string;
  degree: number | null;
  fullDegree: number | null;
  house: number | null;
  isRetrograde: boolean | null;
  source: "astrologyapi";
};

export type NormalizedAstroHouse = {
  house: number;
  sign: string;
  signEs: string;
  degree: number | null;
  theme: string;
};

export type NormalizedAstroAspect = {
  from: string;
  to: string;
  type: string;
  typeEs: string;
  orb: number | null;
  diff: number | null;
  isMajor: boolean;
};

export type NormalizedAstroTransit = {
  transitPlanet: string;
  transitPlanetEs: string;
  natalPoint: string;
  natalPointEs: string;
  aspectType: string;
  aspectTypeEs: string;
  startTime: string | null;
  exactTime: string | null;
  endTime: string | null;
  isRetrograde: boolean | null;
  transitSign: string | null;
  transitSignEs: string | null;
  natalHouse: number | null;
  priority: number;
};

export type NormalizedAstroTimelineEvent = NormalizedAstroTransit & {
  id: string;
  source: "natal_transits_weekly" | "tropical_transits_weekly" | "tropical_transits_monthly";
  scope: "personal_weekly" | "tropical_weekly" | "tropical_monthly";
  date: string | null;
  displayText: string;
  windowStatus: "windowed" | "dated";
};

export type NormalizedAstroTimeline = {
  version: "orbita-transit-timeline-v1";
  provider: "astrologyapi";
  localDate: string;
  events: NormalizedAstroTimelineEvent[];
  providerStatus: {
    status: "success" | "partial" | "not_configured" | "missing_input" | "error";
    endpoints: Record<string, "success" | "not_configured" | "missing_input" | "error" | "skipped">;
    warnings: string[];
    error?: string;
  };
  rawPolicy: {
    returnsProviderRaw: false;
    reason: string;
  };
};

export type NormalizedAstroChart = {
  provider: "astrologyapi";
  calculationVersion: typeof ASTROLOGY_API_CHART_CALCULATION_VERSION;
  houseSystem: string;
  timezoneOffset: number;
  calculationTimeSource: "birth_time" | "noon_fallback";
  birth: NormalizedBirthInput;
  placements: NormalizedAstroPlacement[];
  houses: NormalizedAstroHouse[];
  aspects: NormalizedAstroAspect[];
  summary: {
    title: string;
    accuracy: "calculated" | "approximate_without_birth_time";
    sun: NormalizedAstroPlacement | null;
    moon: NormalizedAstroPlacement | null;
    ascendant: NormalizedAstroPlacement | null;
    mainAspects: NormalizedAstroAspect[];
    limitations: string[];
  };
};

export type ChartWheelData = {
  version: typeof CHART_WHEEL_DATA_VERSION;
  status: "ready" | "missing_chart";
  coordinateSystem: {
    degreeOrigin: "aries_0";
    direction: "counterclockwise";
    totalDegrees: 360;
  };
  planets: Array<{
    key: string;
    label: string;
    sign: string;
    signEs: string;
    degree: number | null;
    fullDegree: number | null;
    house: number | null;
    isRetrograde: boolean | null;
    displayDegree: string;
  }>;
  houses: Array<{
    house: number;
    label: string;
    sign: string;
    signEs: string;
    cuspDegree: number | null;
    theme: string;
  }>;
  aspects: Array<{
    from: string;
    to: string;
    type: string;
    typeEs: string;
    orb: number | null;
    isMajor: boolean;
    lineStyle: "solid" | "dashed";
    color: string;
    weight: number;
  }>;
  angles: {
    ascendant: number | null;
    descendant: number | null;
    mc: number | null;
    ic: number | null;
  };
  legend: {
    harmony: string[];
    stress: string[];
    neutral: string[];
    restriction: string[];
  };
  rendererHints: {
    rotateToAscendant: boolean;
    labelLanguage: "es";
    drawHousesFromCusps: boolean;
  };
  gaps: string[];
};

export type ValueRadarData = {
  version: typeof VALUE_RADAR_VERSION;
  status: "ready" | "missing_chart";
  formula: {
    harmony: string;
    stress: string;
    restrictions: string;
    disclaimer: string;
  };
  dimensions: Array<{
    id: string;
    label: string;
    houseFocus: number[];
    harmony: number;
    stress: number;
    restrictions: number;
    netScore: number;
    drivers: string[];
  }>;
  totals: {
    harmony: number;
    stress: number;
    restrictions: number;
    netScore: number;
  };
  gaps: string[];
};

export type WebB0ValuesMapPayload = {
  axes: Array<{ key: string; label: string; harmony: number; tension: number }>;
  topDrivers: Array<{ label: string; value: number }>;
  topStressors: Array<{ label: string; value: number }>;
  note: string;
};

export type WebB0PersonalityReadingPayload = {
  headline: string;
  sections: Array<{
    key: string;
    title: string;
    intro: string;
    placement: { label: string; planet: string; sign?: string; house?: number };
    body: string;
  }>;
  disclaimer: string;
};

export type WebB0TransitDetailPayload = {
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

export type AstrologyProviderRunResult = {
  status: "success" | "not_configured" | "missing_input" | "error";
  provider: "astrologyapi";
  providerVersion: string;
  houseSystem?: string;
  localDate: string;
  warnings: string[];
  request?: unknown;
  normalized?: {
    chart: NormalizedAstroChart;
    transits: NormalizedAstroTransit[];
    timeline?: NormalizedAstroTimeline;
  };
  raw?: unknown;
  error?: string;
};

export type NormalizedBirthInput = BirthChartInput & {
  modelInputWarnings: string[];
};

const zodiacRanges = [
  { sign: "capricornio", element: "tierra", start: [12, 22], end: [1, 19] },
  { sign: "acuario", element: "aire", start: [1, 20], end: [2, 18] },
  { sign: "piscis", element: "agua", start: [2, 19], end: [3, 20] },
  { sign: "aries", element: "fuego", start: [3, 21], end: [4, 19] },
  { sign: "tauro", element: "tierra", start: [4, 20], end: [5, 20] },
  { sign: "geminis", element: "aire", start: [5, 21], end: [6, 20] },
  { sign: "cancer", element: "agua", start: [6, 21], end: [7, 22] },
  { sign: "leo", element: "fuego", start: [7, 23], end: [8, 22] },
  { sign: "virgo", element: "tierra", start: [8, 23], end: [9, 22] },
  { sign: "libra", element: "aire", start: [9, 23], end: [10, 22] },
  { sign: "escorpio", element: "agua", start: [10, 23], end: [11, 21] },
  { sign: "sagitario", element: "fuego", start: [11, 22], end: [12, 21] }
] as const;

export function userFieldsFromIdentity(identity: AuthIdentityLike, now: number) {
  return {
    tokenIdentifier: identity.tokenIdentifier,
    clerkUserId: identity.subject,
    email: identity.email,
    name: identity.name ?? identity.givenName ?? identity.nickname ?? identity.preferredUsername,
    updatedAt: now
  };
}

export function getZodiacPlacement(birthDate: string) {
  const [, month, day] = birthDate.split("-").map(Number);
  const validDate = Number.isFinite(month) && Number.isFinite(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31;

  if (!validDate) {
    return { sign: "aries", element: "fuego" };
  }

  const matching = zodiacRanges.find((range) => {
    const [startMonth, startDay] = range.start;
    const [endMonth, endDay] = range.end;

    if (startMonth > endMonth) {
      return (month === startMonth && day >= startDay) || (month === endMonth && day <= endDay);
    }

    return (
      (month === startMonth && day >= startDay) ||
      (month === endMonth && day <= endDay) ||
      (month > startMonth && month < endMonth)
    );
  });

  return {
    sign: matching?.sign ?? "aries",
    element: matching?.element ?? "fuego"
  };
}

export function normalizeBirthTime(value?: string) {
  if (!value) {
    return undefined;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return undefined;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return undefined;
  }

  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function isISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function normalizeBirthInput(input: BirthChartInput): NormalizedBirthInput {
  const modelInputWarnings: string[] = [];
  const normalizedTime = normalizeBirthTime(input.birthTime);
  const precision = input.birthTimePrecision;

  if (!isISODate(input.birthDate)) {
    modelInputWarnings.push("birth_date_invalid_or_unverified");
  }

  if (precision === "known" && !normalizedTime) {
    modelInputWarnings.push("birth_time_marked_known_but_missing_or_invalid");
  }

  if (precision === "unknown" && input.birthTime) {
    modelInputWarnings.push("birth_time_ignored_because_precision_unknown");
  }

  if (input.latitude === undefined || input.longitude === undefined) {
    modelInputWarnings.push("coordinates_missing");
  }

  if (!input.timezone.includes("/")) {
    modelInputWarnings.push("timezone_not_iana_like");
  }

  return {
    birthDate: input.birthDate.trim(),
    birthTime: precision === "unknown" ? undefined : normalizedTime,
    birthTimePrecision: precision,
    birthPlaceLabel: input.birthPlaceLabel.trim(),
    latitude: input.latitude,
    longitude: input.longitude,
    timezone: input.timezone.trim() || "America/Argentina/Buenos_Aires",
    modelInputWarnings
  };
}

export function buildNatalChartSnapshot(input: BirthChartInput) {
  const normalized = normalizeBirthInput(input);
  const solar = getZodiacPlacement(normalized.birthDate);
  const timeKnown = normalized.birthTimePrecision === "known" && Boolean(normalized.birthTime);

  return {
    version: CHART_CALCULATION_VERSION,
    source: "stub",
    disclaimer: "Calculo simbolico inicial para desarrollo; reemplazar por motor astrologico real antes de produccion.",
    birth: {
      date: normalized.birthDate,
      time: normalized.birthTime,
      timePrecision: normalized.birthTimePrecision,
      place: normalized.birthPlaceLabel,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      timezone: normalized.timezone
    },
    placements: {
      sun: {
        sign: solar.sign,
        element: solar.element,
        degree: null
      },
      moon: {
        sign: "pendiente",
        element: "pendiente",
        degree: null
      },
      ascendant: {
        sign: timeKnown ? "pendiente" : "aproximado",
        degree: null
      }
    },
    houses: timeKnown ? { status: "pending_real_calculation" } : { status: "approximate_without_birth_time" },
    aspects: [],
    summary: {
      title: "Estos son tus puntos de partida.",
      solarSign: solar.sign,
      solarElement: solar.element,
      accuracy: timeKnown ? "ready_for_real_calculation" : "approximate_without_birth_time"
    }
  };
}

export function getModelGaps(input: BirthChartInput) {
  const normalized = normalizeBirthInput(input);
  const gaps = [
    "moon_position_requires_real_ephemeris",
    "ascendant_requires_real_calculation",
    "houses_require_real_calculation",
    "aspects_require_real_calculation",
    "daily_transits_require_real_ephemeris",
    "geocoding_timezone_provider_not_integrated"
  ];

  if (normalized.birthTimePrecision === "unknown") {
    gaps.push("unknown_birth_time_limits_ascendant_and_houses");
  }

  if (normalized.modelInputWarnings.length > 0) {
    gaps.push("input_needs_review_before_real_model");
  }

  return gaps;
}

export function buildLabRunPayload(args: {
  localDate: string;
  input: BirthChartInput;
}) {
  const normalizedInput = normalizeBirthInput(args.input);
  const chart = buildNatalChartSnapshot(normalizedInput);
  const dailyReading = buildDailyReadingPayload({
    localDate: args.localDate,
    timezone: normalizedInput.timezone,
    chart
  });

  return {
    normalizedInput,
    chart,
    dailyReading,
    modelVersions: {
      chart: CHART_CALCULATION_VERSION,
      dailyReading: DAILY_READING_CONTENT_VERSION
    },
    modelGaps: getModelGaps(normalizedInput)
  };
}

export function buildDailyReadingPayload(args: {
  localDate: string;
  timezone: string;
  chart: ReturnType<typeof buildNatalChartSnapshot> | null;
}) {
  const sign = args.chart?.summary.solarSign ?? "aries";
  const element = args.chart?.summary.solarElement ?? "fuego";
  const editorial = getTransitEditorial(null);
  const topics = buildTopicReadings(null);
  const home = {
    headline: `Tu cielo de hoy parte de ${sign}.`,
    do: editorial.do,
    doList: editorial.doList,
    avoid: editorial.avoid,
    avoidList: editorial.avoidList,
    energy: `Elemento de base: ${element}.`,
    action: editorial.action,
    question: editorial.question
  };
  const natalSummary = {
    sun: `Sol en ${sign}`,
    moon: "pendiente",
    ascendant: args.chart?.summary.accuracy === "approximate_without_birth_time" ? "aproximado" : "pendiente",
    accuracy: args.chart?.summary.accuracy ?? "pending"
  };

  return {
    version: DAILY_READING_CONTENT_VERSION,
    contentVersion: DAILY_READING_CONTENT_VERSION,
    calculationVersion: args.chart?.version ?? CHART_CALCULATION_VERSION,
    mode: "demo_without_provider",
    localDate: args.localDate,
    timezone: args.timezone,
    sign,
    natalSummary,
    personalization: buildPersonalizationTrace({
      source: "stub_fallback",
      mode: "demo_without_provider",
      chartSummary: natalSummary,
      transit: null
    }),
    chartProfile: buildChartProfileFromStub(args.chart),
    highlightedTransit: null,
    selectedTransits: [],
    home,
    modules: home,
    topics,
    deepDive: buildDeepDive({
      editorial: {
        ...editorial,
        headline: home.headline,
        energy: home.energy
      },
      transit: null,
      source: "stub_fallback"
    }),
    transits: {
      highlighted: null,
      secondary: [],
      explanation: "Modo maqueta: faltan credenciales o tránsitos reales del proveedor.",
      rawNormalized: []
    },
    voidPreview: buildVoidPreview(editorial.question, null),
    futureSelf: buildFutureSelfPrompt(editorial),
    longRead: {
      ...buildEducationalLongRead(),
      dailyTitle: "Contexto para volver al centro",
      body: "Esta lectura es una guía simbólica para mirar tu día con más contexto. No decide por vos."
    },
    guardrails: dailyGuardrails
  };
}

const signTranslations: Record<string, string> = {
  aries: "aries",
  taurus: "tauro",
  gemini: "geminis",
  cancer: "cancer",
  leo: "leo",
  virgo: "virgo",
  libra: "libra",
  scorpio: "escorpio",
  sagittarius: "sagitario",
  capricorn: "capricornio",
  aquarius: "acuario",
  pisces: "piscis"
};

const planetLabels: Record<string, string> = {
  sun: "Sol",
  moon: "Luna",
  mercury: "Mercurio",
  venus: "Venus",
  mars: "Marte",
  jupiter: "Júpiter",
  saturn: "Saturno",
  uranus: "Urano",
  neptune: "Neptuno",
  pluto: "Plutón",
  node: "Nodo",
  chiron: "Quirón",
  ascendant: "Ascendente",
  part_of_fortune: "Parte de Fortuna"
};

const aspectLabels: Record<string, string> = {
  conjunction: "conjunción",
  opposition: "oposición",
  square: "cuadratura",
  trine: "trígono",
  sextile: "sextil",
  quincunx: "quincuncio",
  semi_sextile: "semisextil",
  semi_square: "semicuadratura"
};

const majorAspects = new Set(["conjunction", "opposition", "square", "trine", "sextile"]);

const houseThemes: Record<number, string> = {
  1: "identidad y forma de entrar al mundo",
  2: "recursos, cuerpo y valor propio",
  3: "mente, palabra y entorno cercano",
  4: "raíz, casa e intimidad",
  5: "deseo, juego y expresión",
  6: "hábitos, cuidado y trabajo cotidiano",
  7: "vínculos, acuerdos y espejo",
  8: "profundidad, confianza y cambio",
  9: "sentido, búsqueda y expansión",
  10: "dirección, vocación y exposición",
  11: "redes, futuro y pertenencia",
  12: "descanso, cierre y mundo interno"
};

const valueRadarDimensions = [
  { id: "identity", label: "Identidad", houseFocus: [1] },
  { id: "body_resources", label: "Cuerpo y recursos", houseFocus: [2, 6] },
  { id: "communication", label: "Palabra y entorno", houseFocus: [3] },
  { id: "roots", label: "Raíz e intimidad", houseFocus: [4] },
  { id: "love_creativity", label: "Amor y deseo", houseFocus: [5, 7] },
  { id: "work_direction", label: "Trabajo y dirección", houseFocus: [6, 10] },
  { id: "community_expansion", label: "Expansión y red", houseFocus: [9, 11] },
  { id: "inner_world", label: "Profundidad y cierre", houseFocus: [8, 12] }
] as const;

const harmonyAspects = new Set(["trine", "sextile"]);
const stressAspects = new Set(["square", "opposition"]);
const hardAspects = new Set(["square", "opposition", "conjunction"]);

function aspectRenderStyle(type: string) {
  if (harmonyAspects.has(type)) {
    return { color: "#4E9F8A", lineStyle: "solid" as const, weight: type === "trine" ? 2 : 1.5 };
  }
  if (stressAspects.has(type)) {
    return { color: "#C45B63", lineStyle: "solid" as const, weight: 2 };
  }
  if (type === "conjunction") {
    return { color: "#7C6BFF", lineStyle: "solid" as const, weight: 1.75 };
  }
  return { color: "#9CA3AF", lineStyle: "dashed" as const, weight: 1 };
}

function formatWheelDegree(placement: NormalizedAstroPlacement) {
  if (placement.degree === null) {
    return `${placement.label} en ${placement.signEs}`;
  }
  return `${placement.label} ${placement.degree.toFixed(1)}° ${placement.signEs}`;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

function dimensionsForHouse(house: number | null | undefined) {
  if (!house) {
    return [];
  }
  return valueRadarDimensions
    .filter((dimension) => dimension.houseFocus.includes(house as never))
    .map((dimension) => dimension.id);
}

function dimensionsForPlacement(placement?: NormalizedAstroPlacement | null) {
  return dimensionsForHouse(placement?.house);
}

function pushDriver(drivers: string[], value: string) {
  if (drivers.length < 5 && !drivers.includes(value)) {
    drivers.push(value);
  }
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function buildChartWheelData(chart: NormalizedAstroChart | null): ChartWheelData {
  if (!chart) {
    return {
      version: CHART_WHEEL_DATA_VERSION,
      status: "missing_chart",
      coordinateSystem: {
        degreeOrigin: "aries_0",
        direction: "counterclockwise",
        totalDegrees: 360
      },
      planets: [],
      houses: [],
      aspects: [],
      angles: {
        ascendant: null,
        descendant: null,
        mc: null,
        ic: null
      },
      legend: {
        harmony: ["trine", "sextile"],
        stress: ["square", "opposition"],
        neutral: ["conjunction", "quincunx", "semi_sextile"],
        restriction: ["saturn", "hard_aspects"]
      },
      rendererHints: {
        rotateToAscendant: true,
        labelLanguage: "es",
        drawHousesFromCusps: true
      },
      gaps: ["natal_chart_required_for_chart_wheel_data"]
    };
  }

  const planets = chart.placements.map((placement) => ({
    key: placement.key,
    label: placement.label,
    sign: placement.sign,
    signEs: placement.signEs,
    degree: placement.degree,
    fullDegree: placement.fullDegree,
    house: placement.house,
    isRetrograde: placement.isRetrograde,
    displayDegree: formatWheelDegree(placement)
  }));
  const houses = chart.houses
    .filter((house) => house.house > 0)
    .map((house) => ({
      house: house.house,
      label: `Casa ${house.house}`,
      sign: house.sign,
      signEs: house.signEs,
      cuspDegree: house.degree,
      theme: house.theme
    }));
  const aspects = chart.aspects.map((aspect) => {
    const style = aspectRenderStyle(aspect.type);
    return {
      from: aspect.from,
      to: aspect.to,
      type: aspect.type,
      typeEs: aspect.typeEs,
      orb: aspect.orb,
      isMajor: aspect.isMajor,
      lineStyle: aspect.isMajor ? style.lineStyle : "dashed" as const,
      color: style.color,
      weight: aspect.isMajor ? style.weight : 0.75
    };
  });
  const houseDegree = (houseNumber: number) => houses.find((house) => house.house === houseNumber)?.cuspDegree ?? null;

  return {
    version: CHART_WHEEL_DATA_VERSION,
    status: "ready",
    coordinateSystem: {
      degreeOrigin: "aries_0",
      direction: "counterclockwise",
      totalDegrees: 360
    },
    planets,
    houses,
    aspects,
    angles: {
      ascendant: houseDegree(1),
      descendant: houseDegree(7),
      mc: houseDegree(10),
      ic: houseDegree(4)
    },
    legend: {
      harmony: ["trine", "sextile"],
      stress: ["square", "opposition"],
      neutral: ["conjunction", "quincunx", "semi_sextile"],
      restriction: ["saturn", "hard_aspects"]
    },
    rendererHints: {
      rotateToAscendant: true,
      labelLanguage: "es",
      drawHousesFromCusps: true
    },
    gaps: planets.some((placement) => placement.fullDegree === null) ? ["some_planet_full_degrees_missing"] : []
  };
}

export function buildValueRadar(chart: NormalizedAstroChart | null): ValueRadarData {
  const baseDimensions = valueRadarDimensions.map((dimension) => ({
    id: dimension.id,
    label: dimension.label,
    houseFocus: [...dimension.houseFocus],
    harmony: 2,
    stress: 0,
    restrictions: 0,
    netScore: 5,
    drivers: [] as string[]
  }));
  const byId = new Map(baseDimensions.map((dimension) => [dimension.id, dimension]));

  if (!chart) {
    return {
      version: VALUE_RADAR_VERSION,
      status: "missing_chart",
      formula: {
        harmony: "Trigonos y sextiles suman armonia a las casas/puntos involucrados.",
        stress: "Cuadraturas y oposiciones suman estres a las casas/puntos involucrados.",
        restrictions: "Saturno, casas activadas por Saturno y aspectos duros suman restricciones.",
        disclaimer: "Score editorial interno para ordenar la experiencia; no es diagnóstico ni predicción."
      },
      dimensions: baseDimensions,
      totals: {
        harmony: average(baseDimensions.map((dimension) => dimension.harmony)),
        stress: 0,
        restrictions: 0,
        netScore: 5
      },
      gaps: ["natal_chart_required_for_value_radar"]
    };
  }

  const placementByKey = new Map(chart.placements.map((placement) => [placement.key, placement]));

  for (const placement of chart.placements) {
    if (placement.key !== "saturn") {
      continue;
    }
    for (const dimensionId of dimensionsForPlacement(placement)) {
      const dimension = byId.get(dimensionId);
      if (!dimension) {
        continue;
      }
      dimension.restrictions += 2;
      pushDriver(dimension.drivers, `Saturno en casa ${placement.house}`);
    }
  }

  for (const aspect of chart.aspects.filter((item) => item.isMajor)) {
    const from = placementByKey.get(aspect.from);
    const to = placementByKey.get(aspect.to);
    const affectedDimensionIds = Array.from(new Set([...dimensionsForPlacement(from), ...dimensionsForPlacement(to)]));
    const aspectLabel = `${labelForPoint(aspect.from)} ${aspect.typeEs} ${labelForPoint(aspect.to)}`;

    for (const dimensionId of affectedDimensionIds) {
      const dimension = byId.get(dimensionId);
      if (!dimension) {
        continue;
      }

      if (harmonyAspects.has(aspect.type)) {
        dimension.harmony += aspect.type === "trine" ? 2 : 1.5;
        pushDriver(dimension.drivers, `${aspectLabel}: armonia`);
      }

      if (stressAspects.has(aspect.type)) {
        dimension.stress += aspect.type === "square" ? 2.5 : 2;
        pushDriver(dimension.drivers, `${aspectLabel}: estres`);
      }

      if (aspect.from === "saturn" || aspect.to === "saturn") {
        dimension.restrictions += hardAspects.has(aspect.type) ? 2.5 : 1;
        pushDriver(dimension.drivers, `${aspectLabel}: restriccion Saturno`);
      } else if (hardAspects.has(aspect.type)) {
        dimension.restrictions += 0.5;
      }
    }
  }

  const dimensions = baseDimensions.map((dimension) => {
    const harmony = clampScore(dimension.harmony);
    const stress = clampScore(dimension.stress);
    const restrictions = clampScore(dimension.restrictions);
    const netScore = clampScore(5 + harmony * 0.45 - stress * 0.55 - restrictions * 0.45);
    return {
      ...dimension,
      harmony,
      stress,
      restrictions,
      netScore
    };
  });

  return {
    version: VALUE_RADAR_VERSION,
    status: "ready",
    formula: {
      harmony: "Trigonos y sextiles suman armonia a las casas/puntos involucrados.",
      stress: "Cuadraturas y oposiciones suman estres a las casas/puntos involucrados.",
      restrictions: "Saturno, casas activadas por Saturno y aspectos duros suman restricciones.",
      disclaimer: "Score editorial interno para ordenar la experiencia; no es diagnóstico ni predicción."
    },
    dimensions,
    totals: {
      harmony: average(dimensions.map((dimension) => dimension.harmony)),
      stress: average(dimensions.map((dimension) => dimension.stress)),
      restrictions: average(dimensions.map((dimension) => dimension.restrictions)),
      netScore: average(dimensions.map((dimension) => dimension.netScore))
    },
    gaps: []
  };
}

function isNormalizedChart(value: unknown): value is NormalizedAstroChart {
  const record = asRecord(value);
  return Array.isArray(record.placements) && Array.isArray(record.houses) && typeof record.summary === "object";
}

export function extractNormalizedChartFromPayload(payload: unknown): NormalizedAstroChart | null {
  if (isNormalizedChart(payload)) {
    return payload;
  }

  const record = asRecord(payload);
  if (isNormalizedChart(record.normalized)) {
    return record.normalized;
  }

  const chart = asRecord(record.chart);
  if (isNormalizedChart(chart.normalized)) {
    return chart.normalized;
  }

  return null;
}

function scaleScore01(value: number) {
  return Math.max(0, Math.min(1, Math.round((value / 10) * 100) / 100));
}

function strongestDriverLabel(dimension: ValueRadarData["dimensions"][number]) {
  return dimension.drivers[0] ?? dimension.label;
}

export function buildWebB0ValuesMapPayload(chartPayload: unknown): WebB0ValuesMapPayload {
  const chart = extractNormalizedChartFromPayload(chartPayload);
  const radar = buildValueRadar(chart);
  const axes = radar.dimensions.map((dimension) => ({
    key: dimension.id,
    label: dimension.label,
    harmony: scaleScore01(dimension.harmony),
    tension: scaleScore01(Math.max(dimension.stress, dimension.restrictions))
  }));

  const topDrivers = [...radar.dimensions]
    .sort((left, right) => right.harmony - left.harmony || right.netScore - left.netScore)
    .slice(0, 3)
    .map((dimension) => ({
      label: strongestDriverLabel(dimension),
      value: scaleScore01(dimension.harmony)
    }));

  const topStressors = [...radar.dimensions]
    .sort((left, right) => right.stress + right.restrictions - (left.stress + left.restrictions))
    .slice(0, 3)
    .map((dimension) => ({
      label: strongestDriverLabel(dimension),
      value: scaleScore01(Math.max(dimension.stress, dimension.restrictions))
    }));

  return {
    axes,
    topDrivers,
    topStressors,
    note:
      radar.status === "ready"
        ? "Mapa editorial derivado de casas, aspectos mayores y activaciones de Saturno. No es diagnóstico ni predicción."
        : "Mapa en modo maqueta hasta que exista una carta natal calculada con proveedor real."
  };
}

type WebB0Placement = {
  key: string;
  label: string;
  planet: string;
  sign?: string;
  house?: number;
  degree?: number;
};

const personalityTemplates: Record<string, { title: string; intro: string; body: string }> = {
  sun: {
    title: "Núcleo",
    intro: "Lo que organiza tu energía de base.",
    body: "Marca una forma de orientar deseo, orgullo y vitalidad sin convertirlo en destino fijo."
  },
  moon: {
    title: "Clima interno",
    intro: "Cómo registrás lo que pasa.",
    body: "Habla de necesidades, memoria emocional y ritmo de cuidado."
  },
  ascendant: {
    title: "Entrada al mundo",
    intro: "La primera capa con la que respondés al entorno.",
    body: "Ordena tu estilo, tu reacción inicial y tu modo de ocupar espacio."
  },
  mercury: {
    title: "Mente y palabra",
    intro: "Cómo pensás, nombrás y conectás datos.",
    body: "Ayuda a leer tu manera de preguntar, explicar y procesar señales."
  },
  venus: {
    title: "Deseo y vínculo",
    intro: "Lo que busca afinidad, belleza y acuerdo.",
    body: "No define tus relaciones: muestra qué tipo de clima suele abrirte disponibilidad."
  },
  mars: {
    title: "Impulso",
    intro: "Cómo arrancás la acción cuando algo importa.",
    body: "Señala ritmo, fricción y energía para moverte sin entrar en automático."
  },
  saturn: {
    title: "Borde y oficio",
    intro: "Donde la carta pide estructura y paciencia.",
    body: "Muestra una zona de práctica: límite, responsabilidad y forma propia."
  }
};

function numberOrUndefined(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function placementFromNormalizedChart(chart: NormalizedAstroChart | null, key: string): WebB0Placement | null {
  const placement = chart?.placements.find((item) => item.key === key);
  if (!placement) {
    return null;
  }

  return {
    key,
    label: placement.label,
    planet: placement.label,
    sign: placement.signEs,
    house: placement.house ?? undefined,
    degree: placement.degree ?? undefined
  };
}

function placementFromPayloadRecord(payload: unknown, key: string): WebB0Placement | null {
  const record = asRecord(payload);
  const placements = asRecord(record.placements);
  const triad = asRecord(record.triad);
  const rawCandidates = [asRecord(placements[key]), asRecord(triad[key])];
  const raw = rawCandidates.find((candidate) => typeof candidate.sign === "string" && candidate.sign.trim());

  if (!raw) {
    return null;
  }

  const planet = typeof raw.planet === "string" ? raw.planet : labelForPoint(key);
  const sign = typeof raw.sign === "string" ? raw.sign : undefined;

  return {
    key,
    label: planet,
    planet,
    sign,
    house: numberOrUndefined(raw.house),
    degree: numberOrUndefined(raw.degree)
  };
}

function chartPlacement(payload: unknown, key: string): WebB0Placement | null {
  return placementFromNormalizedChart(extractNormalizedChartFromPayload(payload), key) ?? placementFromPayloadRecord(payload, key);
}

function formatWebB0Placement(placement: WebB0Placement) {
  const sign = placement.sign ? ` en ${placement.sign}` : "";
  const house = placement.house ? `, casa ${placement.house}` : "";
  return `${placement.planet}${sign}${house}`;
}

function buildPersonalitySection(placement: WebB0Placement) {
  const template = personalityTemplates[placement.key] ?? {
    title: placement.label,
    intro: "Una pieza más del mapa natal.",
    body: "Sirve para ordenar contexto simbólico sin cerrar una conclusión sobre vos."
  };
  const sign = placement.sign ? ` en ${placement.sign}` : " con signo pendiente";
  const house = placement.house ? ` y casa ${placement.house}` : "";

  return {
    key: placement.key,
    title: template.title,
    intro: template.intro,
    placement: {
      label: formatWebB0Placement(placement),
      planet: placement.planet,
      sign: placement.sign,
      house: placement.house
    },
    body: `${placement.planet}${sign}${house}. ${template.body}`
  };
}

export function buildWebB0PersonalityReadingPayload(chartPayload: unknown): WebB0PersonalityReadingPayload {
  const orderedKeys = ["sun", "moon", "ascendant", "mercury", "venus", "mars", "saturn"];
  const placements = orderedKeys.map((key) => chartPlacement(chartPayload, key)).filter((item): item is WebB0Placement => Boolean(item));
  const sun = placements.find((placement) => placement.key === "sun");

  return toSerializable({
    headline: sun ? `Tu carta empieza por ${formatWebB0Placement(sun)}.` : "Tu carta personal está en preparación.",
    sections: placements.map(buildPersonalitySection),
    disclaimer: "Lectura simbólica para entretenimiento, autoconocimiento y contexto diario. No reemplaza consejo profesional ni predice resultados."
  }) as WebB0PersonalityReadingPayload;
}

function normalizedTransitFromValue(value: unknown): NormalizedAstroTransit | null {
  const record = asRecord(value);
  const transitPlanet = normalizeKey(record.transitPlanet ?? record.transit_planet);
  const natalPoint = normalizeKey(record.natalPoint ?? record.natal_planet);
  const aspectType = normalizeKey(record.aspectType ?? record.aspect_type ?? record.type);

  if (!transitPlanet || !natalPoint || !aspectType) {
    return null;
  }

  const transit = {
    transitPlanet,
    transitPlanetEs:
      typeof record.transitPlanetEs === "string" ? record.transitPlanetEs : labelForPoint(record.transitPlanet ?? record.transit_planet),
    natalPoint,
    natalPointEs: typeof record.natalPointEs === "string" ? record.natalPointEs : labelForPoint(record.natalPoint ?? record.natal_planet),
    aspectType,
    aspectTypeEs: typeof record.aspectTypeEs === "string" ? record.aspectTypeEs : aspectEs(aspectType),
    startTime: typeof record.startTime === "string" ? record.startTime : typeof record.start_time === "string" ? record.start_time : null,
    exactTime: typeof record.exactTime === "string" ? record.exactTime : typeof record.exact_time === "string" ? record.exact_time : null,
    endTime: typeof record.endTime === "string" ? record.endTime : typeof record.end_time === "string" ? record.end_time : null,
    isRetrograde:
      typeof record.isRetrograde === "boolean" || record.isRetrograde === null ? record.isRetrograde : boolFromApi(record.is_retrograde),
    transitSign: typeof record.transitSign === "string" ? record.transitSign : typeof record.transit_sign === "string" ? record.transit_sign : null,
    transitSignEs:
      typeof record.transitSignEs === "string"
        ? record.transitSignEs
        : typeof record.transit_sign === "string"
          ? signEs(record.transit_sign)
          : null,
    natalHouse: numberOrUndefined(record.natalHouse ?? record.natal_house) ?? null,
    priority: numberOrUndefined(record.priority) ?? 0
  };

  return {
    ...transit,
    priority: transit.priority || transitPriority(transit)
  };
}

export function extractHighlightedTransitFromPayload(payload: unknown): NormalizedAstroTransit | null {
  const record = asRecord(payload);
  const transits = asRecord(record.transits);
  const timeline = asRecord(record.timeline);
  const candidates = [
    record.highlightedTransit,
    record.highlighted,
    transits.highlighted,
    asArray(record.selectedTransits)[0],
    asArray(transits.rawNormalized)[0],
    asArray(timeline.events)[0],
    asArray(record.events)[0]
  ];

  for (const candidate of candidates) {
    const transit = normalizedTransitFromValue(candidate);
    if (transit) {
      return transit;
    }
  }

  return null;
}

function angleLabelForAspect(aspectType: string) {
  const angles: Record<string, string> = {
    conjunction: "0 grados",
    opposition: "180 grados",
    square: "90 grados",
    trine: "120 grados",
    sextile: "60 grados"
  };
  return angles[aspectType] ?? "ángulo variable";
}

function compactWindowLabel(value: string | null) {
  if (!value) {
    return null;
  }
  return value.replace("T", " ").slice(0, 16);
}

function buildTransitTimeline(transit: NormalizedAstroTransit, localDate: string) {
  const entries = [
    transit.startTime ? { label: `Inicio ${compactWindowLabel(transit.startTime)}`, current: false } : null,
    transit.exactTime ? { label: `Pico ${compactWindowLabel(transit.exactTime)}`, current: true } : null,
    transit.endTime ? { label: `Cierre ${compactWindowLabel(transit.endTime)}`, current: false } : null
  ].filter((item): item is { label: string; current: boolean } => Boolean(item));

  return entries.length > 0 ? entries : [{ label: localDate, current: true }];
}

export function buildWebB0TransitDetailPayload(payload: unknown, localDate: string): WebB0TransitDetailPayload {
  const transit = extractHighlightedTransitFromPayload(payload);

  if (!transit) {
    const text = "Todavía no hay un tránsito destacado para esta fecha. Podés ver la estructura, pero falta proveedor diario.";
    return toSerializable({
      title: "Tránsito del día pendiente",
      aspect: { type: "pending", angleLabel: "pendiente" },
      scene: {
        transitingBody: { name: "pending", label: "Cielo actual" },
        natalPoint: { name: "pending", label: "Carta natal" }
      },
      reading: {
        fragments: [{ source: "orbita", text }],
        plain: text
      },
      frequency: {
        label: "Sin ventana confirmada",
        timeline: [{ label: localDate, current: true }]
      },
      earth: {
        headline: "Usalo como placeholder editorial hasta que tengas tránsitos reales.",
        suggestions: [
          "Mostrar un estado vacío claro.",
          "Evitar una lectura inventada.",
          "Pedir generar la lectura diaria si falta el dato."
        ]
      },
      window: {
        label: "Pendiente",
        note: "La ventana exacta tiene que venir del proveedor astrológico."
      }
    }) as WebB0TransitDetailPayload;
  }

  const editorial = getTransitEditorial(transit);
  const title = `${transit.transitPlanetEs} ${transit.aspectTypeEs} tu ${transit.natalPointEs}`;
  const fragments = [
    {
      source: "cielo",
      text: `${transit.transitPlanetEs} forma ${transit.aspectTypeEs} con tu ${transit.natalPointEs}.`
    },
    {
      source: "carta",
      text:
        transit.natalHouse !== null
          ? `La activación cae en tu casa ${transit.natalHouse}: ${houseThemes[transit.natalHouse] ?? "área de vida activa"}.`
          : "Tu casa natal queda pendiente de confirmación."
    },
    {
      source: "ritmo",
      text: editorial.question
    }
  ];

  return toSerializable({
    title,
    aspect: {
      type: transit.aspectTypeEs,
      angleLabel: angleLabelForAspect(transit.aspectType)
    },
    scene: {
      transitingBody: {
        name: transit.transitPlanet,
        label: transit.transitPlanetEs
      },
      natalPoint: {
        name: transit.natalPoint,
        sign: transit.transitSignEs ?? undefined,
        label: transit.natalPointEs
      }
    },
    reading: {
      fragments,
      plain: fragments.map((fragment) => fragment.text).join(" ")
    },
    frequency: {
      label: transit.startTime || transit.exactTime || transit.endTime ? "Ventana del proveedor" : "Fecha local",
      timeline: buildTransitTimeline(transit, localDate)
    },
    earth: {
      headline: editorial.energy,
      suggestions: editorial.doList
    },
    window: {
      label: transit.exactTime ? "Pico estimado" : transit.startTime || transit.endTime ? "Ventana estimada" : "Fecha local",
      note:
        compactWindowLabel(transit.exactTime) ??
        compactWindowLabel(transit.startTime) ??
        "Sin hora exacta en el payload normalizado."
    }
  }) as WebB0TransitDetailPayload;
}

export function buildLongRangeTimelineContract() {
  return {
    version: LONG_RANGE_TIMELINE_CONTRACT_VERSION,
    status: "needs_provider_endpoint",
    strategy: "provider_range_or_forecast_endpoint",
    policy:
      "Las fechas largas tipo una vez al anio, hasta marzo o vuelve en 2027 deben venir de endpoint astrologico de rango/forecast o inspeccion de proveedor. El LLM no inventa ventanas.",
    implementedNow: {
      weeklyPersonal: "natal_transits/weekly",
      weeklySky: "tropical_transits/weekly",
      monthlySky: "tropical_transits/monthly"
    },
    candidateProviderEndpoints: [
      {
        endpoint: "natal_transits/weekly",
        role: "ventana personal corta",
        status: "implemented"
      },
      {
        endpoint: "tropical_transits/monthly",
        role: "contexto mensual del cielo",
        status: "implemented"
      },
      {
        endpoint: "life_forecast_report/tropical",
        role: "inspección opcional de proveedor; no voz final Órbita",
        status: "needs_review"
      },
      {
        endpoint: "provider_long_range_transit_or_forecast",
        role: "inicio/exacto/fin, recurrencia y proximas ocurrencias",
        status: "needs_confirmation"
      }
    ],
    requiredEventFields: [
      "startTime",
      "exactTime",
      "endTime",
      "transitPlanet",
      "natalPoint",
      "aspectType",
      "frequencyLabel",
      "recurrenceLabel",
      "nextOccurrence"
    ],
    gaps: ["confirm_astrologyapi_long_range_or_forecast_endpoint"]
  };
}

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function roundDegree(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.round(number * 100) / 100;
}

function boolFromApi(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return null;
}

function signEs(value: unknown) {
  const key = normalizeKey(value);
  return signTranslations[key] ?? key;
}

function labelForPoint(value: unknown) {
  const key = normalizeKey(value);
  return planetLabels[key] ?? String(value ?? "").trim() ?? key;
}

function aspectEs(value: unknown) {
  const key = normalizeKey(value);
  return aspectLabels[key] ?? key;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function toSerializable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toSerializable);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, toSerializable(entryValue)] as const);
    return Object.fromEntries(entries);
  }

  return value;
}

export function normalizeAstrologyApiNatalChart(args: {
  input: NormalizedBirthInput;
  houseSystem: string;
  timezoneOffset: number;
  calculationTimeSource: "birth_time" | "noon_fallback";
  natalChartInterpretation: unknown;
  westernChartData: unknown;
}): NormalizedAstroChart {
  const interpretationRoot = asRecord(args.natalChartInterpretation);
  const chartDataRoot = asRecord(args.westernChartData);
  const interpretationData = asRecord(interpretationRoot.data);
  const chartData = asRecord(chartDataRoot.data);
  const interpretation = Object.keys(interpretationData).length > 0 ? interpretationData : interpretationRoot;
  const chartSource = Object.keys(chartData).length > 0 ? chartData : chartDataRoot;
  const hasKnownTime = args.input.birthTimePrecision !== "unknown" && args.calculationTimeSource === "birth_time";
  const placements = asArray(interpretation.planets).map((rawPlanet) => {
    const planet = asRecord(rawPlanet);
    const key = normalizeKey(planet.name);
    return {
      key,
      label: planetLabels[key] ?? String(planet.name ?? key),
      sign: String(planet.sign ?? ""),
      signEs: signEs(planet.sign),
      degree: roundDegree(planet.norm_degree),
      fullDegree: roundDegree(planet.full_degree),
      house: hasKnownTime ? roundDegree(planet.house) : null,
      isRetrograde: boolFromApi(planet.is_retro),
      source: "astrologyapi" as const
    };
  });

  const houses = hasKnownTime
    ? asArray(interpretation.houses).map((rawHouse) => {
        const house = asRecord(rawHouse);
        const houseNumber = Number(house.house ?? house.house_id);
        return {
          house: Number.isFinite(houseNumber) ? houseNumber : 0,
          sign: String(house.sign ?? ""),
          signEs: signEs(house.sign),
          degree: roundDegree(house.degree ?? house.start_degree),
          theme: houseThemes[houseNumber] ?? "área de vida"
        };
      })
    : [];

  const ascendantHouse = houses.find((house) => house.house === 1);
  const ascendant: NormalizedAstroPlacement | null = ascendantHouse
    ? {
        key: "ascendant",
        label: "Ascendente",
        sign: ascendantHouse.sign,
        signEs: ascendantHouse.signEs,
        degree: ascendantHouse.degree === null ? null : roundDegree(ascendantHouse.degree % 30),
        fullDegree: ascendantHouse.degree,
        house: 1,
        isRetrograde: null,
        source: "astrologyapi"
      }
    : null;

  const placementsWithAscendant = ascendant ? [...placements, ascendant] : placements;
  const aspects = asArray(chartSource.aspects).map((rawAspect) => {
    const aspect = asRecord(rawAspect);
    const type = normalizeKey(aspect.type);
    return {
      from: normalizeKey(aspect.aspecting_planet),
      to: normalizeKey(aspect.aspected_planet),
      type,
      typeEs: aspectEs(type),
      orb: roundDegree(aspect.orb),
      diff: roundDegree(aspect.diff),
      isMajor: majorAspects.has(type)
    };
  });

  const mainAspects = aspects
    .filter((aspect) => aspect.isMajor)
    .sort((left, right) => (left.orb ?? 99) - (right.orb ?? 99))
    .slice(0, 6);
  const limitations =
    args.input.birthTimePrecision === "unknown"
      ? ["Sin hora natal exacta: ascendente, casas y Luna pueden quedar aproximados."]
      : [];

  return {
    provider: "astrologyapi",
    calculationVersion: ASTROLOGY_API_CHART_CALCULATION_VERSION,
    houseSystem: args.houseSystem,
    timezoneOffset: args.timezoneOffset,
    calculationTimeSource: args.calculationTimeSource,
    birth: args.input,
    placements: placementsWithAscendant,
    houses,
    aspects,
    summary: {
      title: "Estos son tus puntos de partida.",
      accuracy: args.input.birthTimePrecision === "unknown" ? "approximate_without_birth_time" : "calculated",
      sun: placementsWithAscendant.find((placement) => placement.key === "sun") ?? null,
      moon: placementsWithAscendant.find((placement) => placement.key === "moon") ?? null,
      ascendant,
      mainAspects,
      limitations
    }
  };
}

function transitPriority(transit: {
  transitPlanet: string;
  natalPoint: string;
  aspectType: string;
  exactTime: string | null;
}) {
  const transitWeights: Record<string, number> = {
    moon: 1,
    sun: 4,
    mercury: 3,
    venus: 4,
    mars: 4,
    jupiter: 3,
    saturn: 5,
    uranus: 2,
    neptune: 2,
    pluto: 2
  };
  const natalWeights: Record<string, number> = {
    sun: 5,
    moon: 5,
    ascendant: 4,
    mercury: 4,
    venus: 4,
    mars: 4,
    jupiter: 3,
    saturn: 3
  };
  const aspectWeights: Record<string, number> = {
    conjunction: 5,
    opposition: 4,
    square: 4,
    trine: 3,
    sextile: 2
  };

  return (
    (transitWeights[transit.transitPlanet] ?? 1) +
    (natalWeights[transit.natalPoint] ?? 1) +
    (aspectWeights[transit.aspectType] ?? 1) +
    (transit.exactTime ? 1 : 0)
  );
}

export function normalizeAstrologyApiTransits(response: unknown): NormalizedAstroTransit[] {
  const record = asRecord(response);
  return asArray(record.transit_relation).map((rawTransit) => {
    const transit = asRecord(rawTransit);
    const transitPlanet = normalizeKey(transit.transit_planet);
    const natalPoint = normalizeKey(transit.natal_planet);
    const aspectType = normalizeKey(transit.aspect_type ?? transit.type);
    const normalized = {
      transitPlanet,
      transitPlanetEs: labelForPoint(transit.transit_planet),
      natalPoint,
      natalPointEs: labelForPoint(transit.natal_planet),
      aspectType,
      aspectTypeEs: aspectEs(aspectType),
      startTime: typeof transit.start_time === "string" ? transit.start_time : null,
      exactTime: typeof transit.exact_time === "string" ? transit.exact_time : null,
      endTime: typeof transit.end_time === "string" ? transit.end_time : null,
      isRetrograde: boolFromApi(transit.is_retrograde),
      transitSign: typeof transit.transit_sign === "string" ? transit.transit_sign : null,
      transitSignEs: typeof transit.transit_sign === "string" ? signEs(transit.transit_sign) : null,
      natalHouse: roundDegree(transit.natal_house),
      priority: 0
    };
    return {
      ...normalized,
      priority: transitPriority(normalized)
    };
  });
}

function normalizeProviderDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const dateMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, "0");
    const month = dateMatch[2].padStart(2, "0");
    return `${dateMatch[3]}-${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return parsed.toISOString().slice(0, 10);
}

function timelineEventId(args: {
  source: NormalizedAstroTimelineEvent["source"];
  date: string | null;
  transitPlanet: string;
  natalPoint: string;
  aspectType: string;
  exactTime: string | null;
}) {
  return [args.source, args.date ?? "no-date", args.transitPlanet, args.aspectType, args.natalPoint, args.exactTime ?? "no-exact"]
    .join(":")
    .replace(/[^a-z0-9:_-]+/gi, "_");
}

export function normalizeAstrologyApiTransitTimeline(
  response: unknown,
  args: {
    source: NormalizedAstroTimelineEvent["source"];
    scope: NormalizedAstroTimelineEvent["scope"];
  }
): NormalizedAstroTimelineEvent[] {
  const record = asRecord(response);
  return asArray(record.transit_relation).map((rawTransit) => {
    const transit = asRecord(rawTransit);
    const transitPlanet = normalizeKey(transit.transit_planet);
    const natalPoint = normalizeKey(transit.natal_planet);
    const aspectType = normalizeKey(transit.aspect_type ?? transit.type);
    const startTime = typeof transit.start_time === "string" ? transit.start_time : null;
    const exactTime = typeof transit.exact_time === "string" ? transit.exact_time : null;
    const endTime = typeof transit.end_time === "string" ? transit.end_time : null;
    const date = normalizeProviderDate(transit.date ?? exactTime ?? startTime);
    const normalized = {
      transitPlanet,
      transitPlanetEs: labelForPoint(transit.transit_planet),
      natalPoint,
      natalPointEs: labelForPoint(transit.natal_planet),
      aspectType,
      aspectTypeEs: aspectEs(aspectType),
      startTime,
      exactTime,
      endTime,
      isRetrograde: boolFromApi(transit.is_retrograde),
      transitSign: typeof transit.transit_sign === "string" ? transit.transit_sign : null,
      transitSignEs: typeof transit.transit_sign === "string" ? signEs(transit.transit_sign) : null,
      natalHouse: roundDegree(transit.natal_house ?? transit.house),
      priority: 0
    };
    const priority = transitPriority(normalized);
    const event = {
      ...normalized,
      priority,
      id: timelineEventId({
        source: args.source,
        date,
        transitPlanet,
        natalPoint,
        aspectType,
        exactTime
      }),
      source: args.source,
      scope: args.scope,
      date,
      displayText: formatTransitDisplay({ ...normalized, priority }),
      windowStatus: startTime || exactTime || endTime ? "windowed" : "dated"
    } satisfies NormalizedAstroTimelineEvent;

    return event;
  });
}

export function buildTransitTimelinePreview(args: {
  localDate: string;
  natalWeekly?: unknown;
  tropicalWeekly?: unknown;
  tropicalMonthly?: unknown;
  endpointStatus?: NormalizedAstroTimeline["providerStatus"]["endpoints"];
  warnings?: string[];
  status?: NormalizedAstroTimeline["providerStatus"]["status"];
  error?: string;
}): NormalizedAstroTimeline {
  const events = [
    ...normalizeAstrologyApiTransitTimeline(args.natalWeekly, {
      source: "natal_transits_weekly",
      scope: "personal_weekly"
    }),
    ...normalizeAstrologyApiTransitTimeline(args.tropicalWeekly, {
      source: "tropical_transits_weekly",
      scope: "tropical_weekly"
    }),
    ...normalizeAstrologyApiTransitTimeline(args.tropicalMonthly, {
      source: "tropical_transits_monthly",
      scope: "tropical_monthly"
    })
  ]
    .filter((event) => majorAspects.has(event.aspectType))
    .sort((left, right) => right.priority - left.priority || String(left.exactTime ?? left.date).localeCompare(String(right.exactTime ?? right.date)))
    .slice(0, 18);

  return {
    version: "orbita-transit-timeline-v1",
    provider: "astrologyapi",
    localDate: args.localDate,
    events,
    providerStatus: {
      status: args.status ?? (events.length > 0 ? "success" : "not_configured"),
      endpoints: args.endpointStatus ?? {
        "natal_transits/weekly": args.natalWeekly ? "success" : "skipped",
        "tropical_transits/weekly": args.tropicalWeekly ? "success" : "skipped",
        "tropical_transits/monthly": args.tropicalMonthly ? "success" : "skipped"
      },
      warnings: args.warnings ?? [],
      error: args.error
    },
    rawPolicy: {
      returnsProviderRaw: false,
      reason: "El timeline publico normaliza ventanas y fechas; el raw completo queda en backoffice."
    }
  };
}

export function selectRelevantTransits(transits: NormalizedAstroTransit[], limit = 3) {
  return [...transits]
    .filter((transit) => majorAspects.has(transit.aspectType))
    .sort((left, right) => right.priority - left.priority)
    .slice(0, limit);
}

function formatPlacement(placement: NormalizedAstroPlacement | null) {
  if (!placement) {
    return "pendiente";
  }

  return `${placement.label} en ${placement.signEs}`;
}

const dailyGuardrails = [
  "entretenimiento_y_autoconocimiento",
  "no_determinismo",
  "no_salud_dinero_legal_psicologia_como_consejo"
];

function getTransitEditorial(transit: NormalizedAstroTransit | null) {
  if (!transit) {
    const doList = [
      "Elegí una acción chica y concreta.",
      "Anotá una pregunta simple antes de responder en automático.",
      "Volvé al dato verificable antes de interpretar de más."
    ];
    const avoidList = [
      "Convertir una sensación en una conclusión definitiva.",
      "Forzar una respuesta para cerrar la incomodidad.",
      "Leer el día como predicción cerrada."
    ];

    return {
      headline: "Tu cielo de hoy pide una lectura simple.",
      do: doList[0],
      doList,
      avoid: avoidList[0],
      avoidList,
      energy: "Bajá el ruido y mirá qué patrón se repite.",
      action: "Anotá una pregunta simple antes de responder en automático.",
      question: "¿Qué dato simple estás pasando por alto?",
      theme: "contexto diario",
      tone: "suave"
    };
  }

  const title = `${transit.transitPlanetEs} en ${transit.aspectTypeEs} con tu ${transit.natalPointEs}`;
  const tension = transit.aspectType === "square" || transit.aspectType === "opposition";
  const ease = transit.aspectType === "trine" || transit.aspectType === "sextile";
  const doList = tension
    ? [
        "Elegí una respuesta concreta antes de subir el volumen.",
        "Separá lo que sentís de lo que ya sabés.",
        "Bajá una conversación a una pregunta simple."
      ]
    : ease
      ? [
          "Usá la apertura para ordenar algo que ya estaba disponible.",
          "Decí que sí a una ayuda o señal clara.",
          "Convertí la facilidad en un paso visible."
        ]
      : [
          "Observá qué tema vuelve al centro y dale una forma simple.",
          "Nombrá lo importante sin dramatizarlo.",
          "Elegí un gesto chico que acompañe el foco del día."
        ];
  const avoidList = tension
    ? [
        "Tomar fricción como prueba definitiva de algo.",
        "Responder desde orgullo o apuro.",
        "Forzar una definición cuando todavía falta contexto."
      ]
    : ease
      ? [
          "Dejar pasar una señal útil por esperar una confirmación perfecta.",
          "Dispersar tu energía en demasiadas opciones.",
          "Prometer más de lo que realmente querés sostener."
        ]
      : [
          "Convertir intensidad en mandato.",
          "Cerrar el tema antes de escucharlo completo.",
          "Confundir presencia con control."
        ];

  return {
    headline: `${title}: hoy tenés contexto para mirar tu día sin apurarlo.`,
    do: doList[0],
    doList,
    avoid: avoidList[0],
    avoidList,
    energy:
      transit.natalHouse !== null
        ? `Casa ${transit.natalHouse}: ${houseThemes[transit.natalHouse] ?? "área de vida activa"}.`
        : `${transit.transitPlanetEs} marca el tono de tu día.`,
    action: "Escribí una línea: qué pide atención y qué puede esperar.",
    question: tension
      ? "¿Qué estás queriendo resolver demasiado rápido?"
      : ease
        ? "¿Qué puerta se abre si no forzás la respuesta?"
        : "¿Qué parte de este tema te pide presencia antes que definición?",
    theme:
      transit.natalHouse !== null
        ? houseThemes[transit.natalHouse] ?? "área de vida activa"
        : `${transit.transitPlanetEs} y ${transit.natalPointEs}`,
    tone: tension ? "tensión constructiva" : ease ? "apertura" : "foco"
  };
}

function formatTransitDisplay(transit: NormalizedAstroTransit | null) {
  if (!transit) {
    return "Sin tránsito destacado disponible.";
  }

  const house = transit.natalHouse !== null ? ` en casa ${transit.natalHouse}` : "";
  return `${transit.transitPlanetEs} en ${transit.aspectTypeEs} con tu ${transit.natalPointEs}${house}.`;
}

function buildTopicReadings(transit: NormalizedAstroTransit | null) {
  const basedOn = transit ? [formatTransitDisplay(transit)] : ["Carta natal base y fecha local"];

  return [
    {
      topic: "amor",
      title: "Amor",
      oneLine: transit ? "Hoy tu deseo busca claridad antes que intensidad." : "Hoy te conviene presencia primero; interpretación después.",
      body: transit
        ? "Mirá el vínculo sin exigirle una conclusión inmediata."
        : "Presencia primero; interpretación después.",
      detail: transit
        ? "Si algo se mueve en lo afectivo, bajalo a una pregunta concreta antes de convertirlo en definición."
        : "Tu lectura afectiva queda en modo suave hasta tener tránsitos reales.",
      do: "Nombrá una necesidad sin convertirla en reclamo.",
      avoid: "Confundir intensidad con acuerdo.",
      question: "¿Qué estás queriendo cuidar sin sobreactuar?",
      basedOn,
      lockedForPlus: false
    },
    {
      topic: "trabajo",
      title: "Trabajo",
      oneLine: "Si elegís bien una prioridad, se te ordena el día.",
      body: "Una prioridad bien elegida te ordena más que diez pendientes abiertos.",
      detail: "Usá el foco del día para elegir una tarea concreta y medir avance por claridad, no por cantidad.",
      do: "Definí el primer paso antes de abrir otro frente.",
      avoid: "Responder todo en automático.",
      question: "¿Qué tarea te aliviana el resto del día?",
      basedOn,
      lockedForPlus: false
    },
    {
      topic: "familia",
      title: "Familia",
      oneLine: "Cuidar no significa absorberlo todo.",
      body: "Podés cuidar sin absorber todo lo que pasa alrededor.",
      detail: "Si aparece una demanda del entorno cercano, separá presencia de responsabilidad total.",
      do: "Poné un límite chico y amable.",
      avoid: "Resolver por otros para calmar tu incomodidad.",
      question: "¿Qué parte de esto realmente te corresponde?",
      basedOn,
      lockedForPlus: false
    },
    {
      topic: "vinculos",
      title: "Vínculos",
      oneLine: "Tu claridad mejora cuando baja la reacción.",
      body: "Tu claridad aparece cuando baja la reacción automática.",
      detail: "Antes de interpretar el gesto de otra persona, chequeá si falta contexto o si sobra velocidad.",
      do: "Hacé una pregunta antes de completar la historia.",
      avoid: "Leer silencio como sentencia.",
      question: "¿Qué conversación necesita menos defensa y más precisión?",
      basedOn,
      lockedForPlus: false
    }
  ];
}

function buildVoidPreview(question: string, transit: NormalizedAstroTransit | null) {
  return {
    questionOfDay: question,
    suggestedQuestions: [
      {
        id: "day-focus",
        category: "día",
        text: "¿Qué necesito mirar hoy?"
      },
      {
        id: "work-focus",
        category: "trabajo",
        text: "¿Dónde te conviene poner foco hoy?"
      },
      {
        id: "relationship-pattern",
        category: "vínculos",
        text: "¿Qué patrón vincular se activa hoy?"
      },
      {
        id: "ignored-data",
        category: "decisión",
        text: "¿Qué dato estás ignorando?"
      }
    ],
    basedOn: transit ? [formatTransitDisplay(transit)] : ["Lectura diaria en modo maqueta"],
    guardrails: dailyGuardrails
  };
}

function buildFutureSelfPrompt(editorial: ReturnType<typeof getTransitEditorial>) {
  return {
    title: "Nota a tu yo futuro",
    prompt: `Dejale una nota a tu yo futuro: ${editorial.question}`,
    placeholder: "Escribí qué querés recordar cuando vuelvas a este día.",
    suggestedDateLabel: "Volver a leer más adelante",
    savedNote: null
  };
}

function buildDeepDive(args: {
  editorial: ReturnType<typeof getTransitEditorial>;
  transit: NormalizedAstroTransit | null;
  source: "provider_transits" | "natal_fallback" | "stub_fallback";
}) {
  const transitText = formatTransitDisplay(args.transit);

  return {
    title: args.transit ? "Deep Dive del día" : "Deep Dive en modo maqueta",
    intro:
      args.source === "provider_transits"
        ? `${transitText} Esta es la pieza que ordena el resto de la lectura.`
        : "Todavía falta el proveedor real para leer tránsitos precisos; este deep dive sirve para pulir tono y estructura.",
    why: args.transit
      ? `El aspecto marca un tono de ${args.editorial.tone}. La casa o punto activado define el área que te conviene observar.`
      : "La maqueta usa signo solar y reglas editoriales base hasta que haya tránsitos reales.",
    do: args.editorial.do,
    avoid: args.editorial.avoid,
    reflection: args.editorial.question,
    disclaimer: "Usalo como contexto simbólico, no como instrucción ni predicción cerrada."
  };
}

function buildPersonalizationTrace(args: {
  source: "provider_transits" | "natal_fallback" | "stub_fallback";
  mode: string;
  chartSummary: {
    sun?: string;
    moon?: string;
    ascendant?: string;
    accuracy?: string;
  };
  transit: NormalizedAstroTransit | null;
  modelGaps?: string[];
}) {
  const realProvider = args.source === "provider_transits";
  const hasNatalFallback = args.source === "natal_fallback";
  const basedOn = [
    `Fecha local: lectura diaria por timezone del usuario.`,
    args.chartSummary.sun ? `Sol: ${args.chartSummary.sun}.` : null,
    args.chartSummary.moon ? `Luna: ${args.chartSummary.moon}.` : null,
    args.chartSummary.ascendant ? `Ascendente: ${args.chartSummary.ascendant}.` : null,
    args.transit ? `Tránsito destacado: ${formatTransitDisplay(args.transit)}` : null
  ].filter((item): item is string => Boolean(item));

  return {
    status: realProvider ? "personalizado_con_carta_y_transitos" : hasNatalFallback ? "personalizado_con_carta_sin_transito" : "maqueta_no_personalizada_completa",
    mode: args.mode,
    source: args.source,
    explanation: realProvider
      ? "Esta salida combina tu carta natal calculada con tránsitos diarios seleccionados por prioridad."
      : hasNatalFallback
        ? "Esta salida usa tu carta natal calculada, pero no tiene tránsito diario destacado disponible."
        : "Esta salida es maqueta editorial: sirve para pulir textos, pero todavía no representa una lectura astrológica completa del perfil.",
    basedOn,
    missing: args.modelGaps?.length
      ? args.modelGaps
      : realProvider
        ? []
        : ["astrologyapi_credentials_not_configured", "daily_transits_require_real_provider"],
    confidence: realProvider ? "alta_para_lab" : hasNatalFallback ? "media_para_lab" : "baja_maqueta"
  };
}

function buildEducationalLongRead() {
  return {
    title: "Las casas, explicadas",
    eyebrow: "Lectura editorial",
    body:
      "Hay más que planetas y signos: las casas ordenan en qué área de vida se expresa cada símbolo. En Órbita este contenido vive como biblioteca editorial, separado del cálculo diario.",
    ctaLabel: "Todo sobre casas",
    access: "free"
  };
}

function buildChartProfileFromAstrology(chart: NormalizedAstroChart | null) {
  if (!chart) {
    return {
      title: "Carta natal pendiente",
      accuracy: "pending",
      triad: [],
      placements: [],
      houses: [],
      mainAspects: [],
      limitations: ["Falta calcular carta natal real."]
    };
  }

  const triad = [chart.summary.sun, chart.summary.moon, chart.summary.ascendant]
    .filter((placement): placement is NormalizedAstroPlacement => Boolean(placement))
    .map((placement) => ({
      key: placement.key,
      label: placement.label,
      sign: placement.signEs,
      house: placement.house,
      degree: placement.degree,
      text: `${placement.label} en ${placement.signEs}${placement.house ? ` en casa ${placement.house}` : ""}.`
    }));

  return {
    title: chart.summary.title,
    accuracy: chart.summary.accuracy,
    triad,
    placements: chart.placements.map((placement) => ({
      key: placement.key,
      label: placement.label,
      sign: placement.signEs,
      house: placement.house,
      degree: placement.degree,
      isRetrograde: placement.isRetrograde,
      text: `${placement.label} en ${placement.signEs}${placement.house ? ` en casa ${placement.house}` : ""}.`
    })),
    houses: chart.houses.map((house) => ({
      house: house.house,
      sign: house.signEs,
      degree: house.degree,
      theme: house.theme
    })),
    mainAspects: chart.summary.mainAspects.map((aspect) => ({
      from: labelForPoint(aspect.from),
      to: labelForPoint(aspect.to),
      type: aspect.typeEs,
      orb: aspect.orb,
      text: `${labelForPoint(aspect.from)} en ${aspect.typeEs} con ${labelForPoint(aspect.to)}.`
    })),
    limitations: chart.summary.limitations
  };
}

function buildChartProfileFromStub(chart: ReturnType<typeof buildNatalChartSnapshot> | null) {
  const sun = chart?.placements.sun;
  const moon = chart?.placements.moon;
  const ascendant = chart?.placements.ascendant;
  const triad = [
    {
      key: "sun",
      label: "Sol",
      sign: sun?.sign ?? "pendiente",
      degree: sun?.degree ?? null,
      text: sun ? `Sol en ${sun.sign}.` : "Sol pendiente."
    },
    {
      key: "moon",
      label: "Luna",
      sign: moon?.sign ?? "pendiente",
      degree: moon?.degree ?? null,
      text: "Luna pendiente hasta calcular carta real."
    },
    {
      key: "ascendant",
      label: "Ascendente",
      sign: ascendant?.sign ?? "pendiente",
      degree: ascendant?.degree ?? null,
      text: "Ascendente pendiente hasta calcular hora/lugar con proveedor real."
    }
  ];

  return {
    title: chart?.summary.title ?? "Carta natal pendiente",
    accuracy: chart?.summary.accuracy ?? "pending",
    triad,
    placements: triad,
    houses: [],
    mainAspects: [],
    limitations: ["Modo maqueta: faltan Luna, Ascendente, casas, aspectos y tránsitos reales."]
  };
}

export function buildDailyReadingPayloadFromAstrology(args: {
  localDate: string;
  timezone: string;
  chart: NormalizedAstroChart | null;
  transits: NormalizedAstroTransit[];
}) {
  const selectedTransits = selectRelevantTransits(args.transits);
  const highlightedTransit = selectedTransits[0] ?? null;
  const editorial = getTransitEditorial(highlightedTransit);
  const sun = args.chart?.summary.sun ?? null;
  const moon = args.chart?.summary.moon ?? null;
  const ascendant = args.chart?.summary.ascendant ?? null;
  const topics = buildTopicReadings(highlightedTransit);
  const home = {
    headline: editorial.headline,
    do: editorial.do,
    doList: editorial.doList,
    avoid: editorial.avoid,
    avoidList: editorial.avoidList,
    energy: editorial.energy,
    action: editorial.action,
    question: editorial.question
  };
  const mode = highlightedTransit ? "provider_real" : "provider_without_daily_transit";
  const source = highlightedTransit ? "provider_transits" : "natal_fallback";
  const natalSummary = {
    sun: formatPlacement(sun),
    moon: formatPlacement(moon),
    ascendant: args.chart?.summary.accuracy === "approximate_without_birth_time" ? "aproximado" : formatPlacement(ascendant),
    accuracy: args.chart?.summary.accuracy ?? "pending"
  };

  return {
    version: DAILY_READING_EDITORIAL_VERSION,
    contentVersion: DAILY_READING_EDITORIAL_VERSION,
    calculationVersion: args.chart?.calculationVersion ?? ASTROLOGY_API_CHART_CALCULATION_VERSION,
    mode,
    source,
    localDate: args.localDate,
    timezone: args.timezone,
    natalSummary,
    personalization: buildPersonalizationTrace({
      source,
      mode,
      chartSummary: natalSummary,
      transit: highlightedTransit
    }),
    chartProfile: buildChartProfileFromAstrology(args.chart),
    highlightedTransit,
    selectedTransits,
    home,
    modules: home,
    topics,
    deepDive: buildDeepDive({
      editorial,
      transit: highlightedTransit,
      source: highlightedTransit ? "provider_transits" : "natal_fallback"
    }),
    transits: {
      highlighted: highlightedTransit
        ? {
            ...highlightedTransit,
            displayText: formatTransitDisplay(highlightedTransit)
          }
        : null,
      secondary: selectedTransits.slice(1).map((transit) => ({
        ...transit,
        displayText: formatTransitDisplay(transit)
      })),
      explanation: highlightedTransit
        ? "Estos tránsitos se seleccionan por planeta, punto natal, aspecto, casa y prioridad."
        : "Sin tránsitos diarios disponibles; se usa fallback natal para pulir estructura editorial.",
      rawNormalized: selectedTransits
    },
    voidPreview: buildVoidPreview(editorial.question, highlightedTransit),
    futureSelf: buildFutureSelfPrompt(editorial),
    longRead: {
      ...buildEducationalLongRead(),
      dailyTitle: highlightedTransit ? "Tu punto activo del día" : "Contexto para volver al centro",
      body: highlightedTransit
        ? `${highlightedTransit.transitPlanetEs} activa tu ${highlightedTransit.natalPointEs}. Tomalo como contexto simbólico para elegir mejor el ritmo del día, no como una orden.`
        : "Esta lectura es una guía simbólica para mirar tu día con más contexto. No decide por vos."
    },
    guardrails: dailyGuardrails
  };
}

export function buildAstrologicalModelGaps(args: {
  input: BirthChartInput;
  providerResult: AstrologyProviderRunResult | null;
}) {
  const normalized = normalizeBirthInput(args.input);
  const gaps = [...normalized.modelInputWarnings];

  if (normalized.birthTimePrecision === "unknown") {
    gaps.push("unknown_birth_time_limits_ascendant_houses_and_moon_precision");
  }

  if (!args.providerResult || args.providerResult.status === "not_configured") {
    gaps.push("astrologyapi_credentials_not_configured");
  }

  if (args.providerResult?.status === "missing_input") {
    gaps.push("provider_missing_required_birth_inputs");
  }

  if (args.providerResult?.status === "error") {
    gaps.push("provider_api_error_needs_review");
  }

  if (args.providerResult?.status === "success" && (args.providerResult.normalized?.transits.length ?? 0) === 0) {
    gaps.push("daily_transits_empty_or_unavailable");
  }

  gaps.push("editorial_review_required_before_app_release");
  return Array.from(new Set(gaps));
}

export function buildAstrologicalLabRunPayload(args: {
  localDate: string;
  input: BirthChartInput;
  providerResult: AstrologyProviderRunResult | null;
}) {
  const normalizedInput = normalizeBirthInput(args.input);
  const providerResult = args.providerResult;

  if (providerResult?.status === "success" && providerResult.normalized?.chart) {
    const chart = providerResult.normalized.chart;
    const dailyReading = buildDailyReadingPayloadFromAstrology({
      localDate: args.localDate,
      timezone: normalizedInput.timezone,
      chart,
      transits: providerResult.normalized.transits
    });

    return toSerializable({
      normalizedInput,
      chart: {
        version: ASTROLOGY_API_CHART_CALCULATION_VERSION,
        source: "astrologyapi",
        provider: {
          status: providerResult.status,
          providerVersion: providerResult.providerVersion,
          houseSystem: providerResult.houseSystem,
          warnings: providerResult.warnings,
          request: providerResult.request
        },
        normalized: chart,
        raw: providerResult.raw
      },
      dailyReading,
      modelVersions: {
        chart: ASTROLOGY_API_CHART_CALCULATION_VERSION,
        dailyReading: DAILY_READING_EDITORIAL_VERSION
      },
      modelGaps: buildAstrologicalModelGaps({ input: normalizedInput, providerResult })
    });
  }

  const fallbackChart = buildNatalChartSnapshot(normalizedInput);
  const fallbackReading = buildDailyReadingPayload({
    localDate: args.localDate,
    timezone: normalizedInput.timezone,
    chart: fallbackChart
  });

  return toSerializable({
    normalizedInput,
    chart: {
      ...fallbackChart,
      provider: {
        status: providerResult?.status ?? "not_configured",
        providerVersion: providerResult?.providerVersion ?? "none",
        houseSystem: providerResult?.houseSystem,
        warnings: providerResult?.warnings ?? ["provider_not_called"],
        request: providerResult?.request ?? null,
        error: providerResult?.error ?? null
      },
      raw: providerResult?.raw ?? null
    },
    dailyReading: {
      ...fallbackReading,
      source: "stub_fallback",
      guardrails: [
        "entretenimiento_y_autoconocimiento",
        "no_determinismo",
        "no_salud_dinero_legal_psicologia_como_consejo"
      ]
    },
    modelVersions: {
      chart: `${CHART_CALCULATION_VERSION}+provider-${providerResult?.status ?? "not_configured"}`,
      dailyReading: DAILY_READING_CONTENT_VERSION
    },
    modelGaps: buildAstrologicalModelGaps({ input: normalizedInput, providerResult })
  });
}
