export const CHART_CALCULATION_VERSION = "orbita-stub-v1";
export const DAILY_READING_CONTENT_VERSION = "orbita-daily-stub-v1";
export const ASTROLOGY_API_CHART_CALCULATION_VERSION = "orbita-astrologyapi-western-v1";
export const DAILY_READING_EDITORIAL_VERSION = "orbita-daily-editorial-p0-v1";

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
      explanation: "Modo maqueta: faltan credenciales o transitos reales del proveedor.",
      rawNormalized: []
    },
    voidPreview: buildVoidPreview(editorial.question, null),
    futureSelf: buildFutureSelfPrompt(editorial),
    longRead: {
      ...buildEducationalLongRead(),
      dailyTitle: "Contexto para volver al centro",
      body: "Esta lectura es una guia simbolica para mirar el dia con mas contexto. No decide por vos."
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
  jupiter: "Jupiter",
  saturn: "Saturno",
  uranus: "Urano",
  neptune: "Neptuno",
  pluto: "Pluton",
  node: "Nodo",
  chiron: "Quiron",
  ascendant: "Ascendente",
  part_of_fortune: "Parte de Fortuna"
};

const aspectLabels: Record<string, string> = {
  conjunction: "conjuncion",
  opposition: "oposicion",
  square: "cuadratura",
  trine: "trigono",
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
  4: "raiz, casa e intimidad",
  5: "deseo, juego y expresion",
  6: "habitos, cuidado y trabajo cotidiano",
  7: "vinculos, acuerdos y espejo",
  8: "profundidad, confianza y cambio",
  9: "sentido, busqueda y expansion",
  10: "direccion, vocacion y exposicion",
  11: "redes, futuro y pertenencia",
  12: "descanso, cierre y mundo interno"
};

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
  const interpretation = asRecord(args.natalChartInterpretation);
  const chartData = asRecord(args.westernChartData);
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
      house: roundDegree(planet.house),
      isRetrograde: boolFromApi(planet.is_retro),
      source: "astrologyapi" as const
    };
  });

  const houses = asArray(interpretation.houses).map((rawHouse) => {
    const house = asRecord(rawHouse);
    const houseNumber = Number(house.house ?? house.house_id);
    return {
      house: Number.isFinite(houseNumber) ? houseNumber : 0,
      sign: String(house.sign ?? ""),
      signEs: signEs(house.sign),
      degree: roundDegree(house.degree ?? house.start_degree),
      theme: houseThemes[houseNumber] ?? "area de vida"
    };
  });

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
  const aspects = asArray(chartData.aspects).map((rawAspect) => {
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
    const aspectType = normalizeKey(transit.aspect_type);
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
      "Elegir una accion chica y concreta.",
      "Anotar una pregunta simple antes de responder en automatico.",
      "Volver al dato verificable antes de interpretar de mas."
    ];
    const avoidList = [
      "Convertir una sensacion en una conclusion definitiva.",
      "Forzar una respuesta para cerrar la incomodidad.",
      "Leer el dia como prediccion cerrada."
    ];

    return {
      headline: "Tu cielo de hoy pide una lectura simple.",
      do: doList[0],
      doList,
      avoid: avoidList[0],
      avoidList,
      energy: "Baja el ruido y mira que patron se repite.",
      action: "Anota una pregunta simple antes de responder en automatico.",
      question: "Que dato simple estas pasando por alto?",
      theme: "contexto diario",
      tone: "suave"
    };
  }

  const title = `${transit.transitPlanetEs} en ${transit.aspectTypeEs} con tu ${transit.natalPointEs}`;
  const tension = transit.aspectType === "square" || transit.aspectType === "opposition";
  const ease = transit.aspectType === "trine" || transit.aspectType === "sextile";
  const doList = tension
    ? [
        "Elegir una respuesta concreta antes de subir el volumen.",
        "Separar lo que sentis de lo que ya sabes.",
        "Bajar una conversacion a una pregunta simple."
      ]
    : ease
      ? [
          "Usar la apertura para ordenar algo que ya estaba disponible.",
          "Decir que si a una ayuda o senal clara.",
          "Convertir la facilidad en un paso visible."
        ]
      : [
          "Observar que tema vuelve al centro y darle forma simple.",
          "Nombrar lo importante sin dramatizarlo.",
          "Elegir un gesto chico que acompane el foco del dia."
        ];
  const avoidList = tension
    ? [
        "Tomar friccion como prueba definitiva de algo.",
        "Responder desde orgullo o apuro.",
        "Forzar una definicion cuando todavia falta contexto."
      ]
    : ease
      ? [
          "Dejar pasar una senal util por esperar una confirmacion perfecta.",
          "Dispersar la energia en demasiadas opciones.",
          "Prometer mas de lo que realmente queres sostener."
        ]
      : [
          "Convertir intensidad en mandato.",
          "Cerrar el tema antes de escucharlo completo.",
          "Confundir presencia con control."
        ];

  return {
    headline: `${title}: contexto para mirar el dia sin apurarlo.`,
    do: doList[0],
    doList,
    avoid: avoidList[0],
    avoidList,
    energy:
      transit.natalHouse !== null
        ? `Casa ${transit.natalHouse}: ${houseThemes[transit.natalHouse] ?? "area de vida activa"}.`
        : `${transit.transitPlanetEs} marca el tono del dia.`,
    action: "Escribi una linea: que pide atencion y que puede esperar.",
    question: tension
      ? "Que estas queriendo resolver demasiado rapido?"
      : ease
        ? "Que puerta se abre si no forces la respuesta?"
        : "Que parte de este tema pide presencia antes que definicion?",
    theme:
      transit.natalHouse !== null
        ? houseThemes[transit.natalHouse] ?? "area de vida activa"
        : `${transit.transitPlanetEs} y ${transit.natalPointEs}`,
    tone: tension ? "tension constructiva" : ease ? "apertura" : "foco"
  };
}

function formatTransitDisplay(transit: NormalizedAstroTransit | null) {
  if (!transit) {
    return "Sin transito destacado disponible.";
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
      oneLine: transit ? "El deseo pide claridad antes que intensidad." : "Presencia primero; interpretacion despues.",
      body: transit
        ? "Mira el vinculo sin exigirle una conclusion inmediata."
        : "Presencia primero; interpretacion despues.",
      detail: transit
        ? "Si algo se mueve en lo afectivo, bajalo a una pregunta concreta antes de convertirlo en definicion."
        : "La lectura afectiva queda en modo suave hasta tener transitos reales.",
      do: "Nombrar una necesidad sin convertirla en reclamo.",
      avoid: "Confundir intensidad con acuerdo.",
      question: "Que queres cuidar sin sobreactuar?",
      basedOn,
      lockedForPlus: false
    },
    {
      topic: "trabajo",
      title: "Trabajo",
      oneLine: "Una prioridad bien elegida ordena el dia.",
      body: "Una prioridad bien elegida ordena mejor que diez pendientes abiertos.",
      detail: "Usa el foco del dia para elegir una tarea concreta y medir avance por claridad, no por cantidad.",
      do: "Definir el primer paso antes de abrir otro frente.",
      avoid: "Responder todo en automatico.",
      question: "Que tarea vuelve mas liviano el resto del dia?",
      basedOn,
      lockedForPlus: false
    },
    {
      topic: "familia",
      title: "Familia",
      oneLine: "Cuidar no significa absorberlo todo.",
      body: "Podes cuidar sin absorber todo lo que pasa alrededor.",
      detail: "Si aparece una demanda del entorno cercano, separa presencia de responsabilidad total.",
      do: "Poner un limite chico y amable.",
      avoid: "Resolver por otros para calmar la incomodidad.",
      question: "Que parte de esto realmente te corresponde?",
      basedOn,
      lockedForPlus: false
    },
    {
      topic: "vinculos",
      title: "Vinculos",
      oneLine: "La claridad mejora cuando baja la reaccion.",
      body: "La claridad aparece cuando baja la reaccion automatica.",
      detail: "Antes de interpretar el gesto de otra persona, chequea si falta contexto o si sobra velocidad.",
      do: "Hacer una pregunta antes de completar la historia.",
      avoid: "Leer silencio como sentencia.",
      question: "Que conversacion necesita menos defensa y mas precision?",
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
        category: "dia",
        text: "Que necesito mirar hoy?"
      },
      {
        id: "work-focus",
        category: "trabajo",
        text: "Donde conviene poner foco hoy?"
      },
      {
        id: "relationship-pattern",
        category: "vinculos",
        text: "Que patron vincular se activa hoy?"
      },
      {
        id: "ignored-data",
        category: "decision",
        text: "Que dato estoy ignorando?"
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
    placeholder: "Escribi que queres recordar cuando vuelvas a este dia.",
    suggestedDateLabel: "Volver a leer mas adelante",
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
    title: args.transit ? "Deep Dive del dia" : "Deep Dive en modo maqueta",
    intro:
      args.source === "provider_transits"
        ? `${transitText} Esta es la pieza que ordena el resto de la lectura.`
        : "Todavia falta el proveedor real para leer transitos precisos; este deep dive sirve para pulir tono y estructura.",
    why: args.transit
      ? `El aspecto marca un tono de ${args.editorial.tone}. La casa o punto activado define el area que conviene observar.`
      : "La maqueta usa signo solar y reglas editoriales base hasta que haya transitos reales.",
    do: args.editorial.do,
    avoid: args.editorial.avoid,
    reflection: args.editorial.question,
    disclaimer: "Usalo como contexto simbolico, no como instruccion ni prediccion cerrada."
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
    args.transit ? `Transito destacado: ${formatTransitDisplay(args.transit)}` : null
  ].filter((item): item is string => Boolean(item));

  return {
    status: realProvider ? "personalizado_con_carta_y_transitos" : hasNatalFallback ? "personalizado_con_carta_sin_transito" : "maqueta_no_personalizada_completa",
    mode: args.mode,
    source: args.source,
    explanation: realProvider
      ? "Esta salida combina la carta natal calculada con transitos diarios seleccionados por prioridad."
      : hasNatalFallback
        ? "Esta salida usa carta natal calculada, pero no tiene transito diario destacado disponible."
        : "Esta salida es maqueta editorial: sirve para pulir textos, pero todavia no representa una lectura astrologica completa del perfil.",
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
      "Hay mas que planetas y signos: las casas ordenan en que area de vida se expresa cada simbolo. En Orbita este contenido vive como biblioteca editorial, separado del calculo diario.",
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
    limitations: ["Modo maqueta: faltan Luna, Ascendente, casas, aspectos y transitos reales."]
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
        ? "Estos transitos se seleccionan por planeta, punto natal, aspecto, casa y prioridad."
        : "Sin transitos diarios disponibles; se usa fallback natal para pulir estructura editorial.",
      rawNormalized: selectedTransits
    },
    voidPreview: buildVoidPreview(editorial.question, highlightedTransit),
    futureSelf: buildFutureSelfPrompt(editorial),
    longRead: {
      ...buildEducationalLongRead(),
      dailyTitle: highlightedTransit ? "El punto activo del dia" : "Contexto para volver al centro",
      body: highlightedTransit
        ? `${highlightedTransit.transitPlanetEs} activa tu ${highlightedTransit.natalPointEs}. Tomalo como contexto simbolico para elegir mejor el ritmo del dia, no como una orden.`
        : "Esta lectura es una guia simbolica para mirar el dia con mas contexto. No decide por vos."
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
