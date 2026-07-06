import { actionGeneric as action } from "convex/server";
import { v } from "convex/values";
import {
  resolvePlaceWithAstrologyApi,
  runAstrologyApiExtendedTransits,
  runAstrologyApiProvider,
  type ExtendedTransitProviderResult
} from "./lib/astrologyApi";
import {
  buildNatalInterpretationGatewayPlan,
  generateDailyHomeWithGateway,
  mergeDailyHomeWithLlm,
  type LlmDailyHomeResult
} from "./lib/aiGateway";
import {
  buildAstrologicalLabRunPayload,
  buildChartWheelData,
  buildLongRangeTimelineContract,
  buildValueRadar,
  type NormalizedAstroChart
} from "./lib/orbita";

const birthTimePrecisionValidator = v.union(v.literal("known"), v.literal("approximate"), v.literal("unknown"));
const COMPLETE_PROFILE_VERSION = "orbita-complete-profile-preview-v1";

type ProviderStatus = {
  status: string;
  providerVersion?: string;
  houseSystem?: string;
  warnings: string[];
  error?: string | null;
};

type PublicLabInput = {
  birthDate: string;
  birthTime?: string;
  birthTimePrecision: "known" | "approximate" | "unknown";
  birthPlaceLabel: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  localDate: string;
  runTimezone?: string;
  displayName?: string;
  accessKey?: string;
};

function configuredAccessKey() {
  return process.env.ORBITA_PUBLIC_LAB_KEY?.trim();
}

export function assertPublicLabAccess(accessKey?: string) {
  if (process.env.ORBITA_PUBLIC_LAB_ENABLED !== "true") {
    throw new Error("Public lab is disabled. Set ORBITA_PUBLIC_LAB_ENABLED=true in Convex env.");
  }

  const expectedKey = configuredAccessKey();
  if (expectedKey && accessKey?.trim() !== expectedKey) {
    throw new Error("Public lab access key is invalid.");
  }
}

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function stringList(value: unknown, fallback?: unknown, minLength = 3) {
  const list = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : typeof value === "string" && value.trim()
      ? [value]
      : Array.isArray(fallback)
        ? fallback.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : typeof fallback === "string" && fallback.trim()
          ? [fallback]
          : [];

  while (list.length < minLength) {
    list.push("");
  }

  return minLength > 0 ? list.slice(0, minLength) : list;
}

function providerStatusFromChart(chartPayload: Record<string, unknown> | null): ProviderStatus {
  const provider = asRecord(chartPayload?.provider);
  return {
    status: typeof provider?.status === "string" ? provider.status : "not_configured",
    providerVersion: typeof provider?.providerVersion === "string" ? provider.providerVersion : undefined,
    houseSystem: typeof provider?.houseSystem === "string" ? provider.houseSystem : undefined,
    warnings: stringList(provider?.warnings, undefined, 0),
    error: typeof provider?.error === "string" ? provider.error : null
  };
}

function sanitizeTransits(value: unknown) {
  const transits = asRecord(value);
  if (!transits) {
    return {
      highlighted: null,
      secondary: [],
      explanation: "Sin tránsitos disponibles para este preview."
    };
  }

  return {
    highlighted: transits.highlighted ?? null,
    secondary: Array.isArray(transits.secondary) ? transits.secondary : [],
    explanation:
      typeof transits.explanation === "string"
        ? transits.explanation
        : "Sin explicación de tránsitos disponible."
  };
}

function sanitizeLongRead(value: unknown) {
  const longRead = asRecord(value);
  if (!longRead) {
    return null;
  }

  return {
    title: longRead.dailyTitle ?? longRead.title ?? "Lectura larga",
    body: longRead.body ?? "",
    sections: Array.isArray(longRead.sections) ? longRead.sections : [],
    lockedForPlus: longRead.access === "plus" || longRead.lockedForPlus === true
  };
}

function getNormalizedChartFromLabPayload(labPayload: Record<string, unknown>) {
  const chartPayload = asRecord(labPayload.chart);
  const normalized = asRecord(chartPayload?.normalized);
  return normalized ? (normalized as unknown as NormalizedAstroChart) : null;
}

function signKey(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

const signMeta: Record<string, { element: string; modality: string; ruler: string }> = {
  aries: { element: "fuego", modality: "cardinal", ruler: "Marte" },
  tauro: { element: "tierra", modality: "fijo", ruler: "Venus" },
  geminis: { element: "aire", modality: "mutable", ruler: "Mercurio" },
  cancer: { element: "agua", modality: "cardinal", ruler: "Luna" },
  leo: { element: "fuego", modality: "fijo", ruler: "Sol" },
  virgo: { element: "tierra", modality: "mutable", ruler: "Mercurio" },
  libra: { element: "aire", modality: "cardinal", ruler: "Venus" },
  escorpio: { element: "agua", modality: "fijo", ruler: "Plutón" },
  sagitario: { element: "fuego", modality: "mutable", ruler: "Júpiter" },
  capricornio: { element: "tierra", modality: "cardinal", ruler: "Saturno" },
  acuario: { element: "aire", modality: "fijo", ruler: "Urano" },
  piscis: { element: "agua", modality: "mutable", ruler: "Neptuno" }
};

const englishToSpanishSigns: Record<string, string> = {
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

function normalizeSign(value: unknown) {
  const key = signKey(value);
  return englishToSpanishSigns[key] ?? key;
}

function extractSign(value: unknown) {
  const record = asRecord(value);
  if (!record) {
    return normalizeSign(value);
  }

  return normalizeSign(record.sign ?? record.signEs);
}

function countBy<T extends string>(items: T[], seed: Record<T, number>) {
  const result = { ...seed };
  for (const item of items) {
    result[item] = (result[item] ?? 0) + 1;
  }
  return result;
}

function dominantFromCounts(counts: Record<string, number>, fallback = "pendiente") {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return entries[0] && entries[0][1] > 0 ? entries[0][0] : fallback;
}

function getPlacements(chartProfile: Record<string, unknown> | null) {
  return Array.isArray(chartProfile?.placements)
    ? chartProfile.placements.map((placement) => asRecord(placement)).filter((placement): placement is Record<string, unknown> => Boolean(placement))
    : [];
}

function buildBalance(placements: Array<Record<string, unknown>>) {
  const signs = placements.map((placement) => extractSign(placement)).filter((sign) => signMeta[sign]);
  const elements = signs.map((sign) => signMeta[sign].element);
  const modalities = signs.map((sign) => signMeta[sign].modality);
  const elementCounts = countBy(elements, { fuego: 0, agua: 0, aire: 0, tierra: 0 });
  const modalityCounts = countBy(modalities, { cardinal: 0, fijo: 0, mutable: 0 });

  return {
    elements: elementCounts,
    dominantElement: dominantFromCounts(elementCounts),
    modalities: modalityCounts,
    dominantModality: dominantFromCounts(modalityCounts)
  };
}

function chartRulerFromAscendant(ascendant: unknown) {
  const sign = extractSign(ascendant);
  const meta = signMeta[sign];
  return {
    sign: sign || "pendiente",
    ruler: meta?.ruler ?? "pendiente",
    status: meta ? "ready" : "needs_exact_birth_time"
  };
}

function lifePathNumber(birthDate: string) {
  const digits = birthDate.replace(/\D/g, "").split("").map(Number).filter(Number.isFinite);
  if (digits.length === 0) {
    return null;
  }

  let total = digits.reduce((sum, digit) => sum + digit, 0);
  while (total > 9 && total !== 11 && total !== 22 && total !== 33) {
    total = String(total).split("").reduce((sum, digit) => sum + Number(digit), 0);
  }
  return total;
}

function feature(args: {
  id: string;
  title: string;
  source: Array<"A" | "B" | "C" | "dataset">;
  status: "ready" | "stub" | "needs_provider" | "needs_llm" | "needs_input" | "planned";
  entitlement: "free" | "freemium" | "premium";
  data?: unknown;
  summary?: string;
  missing?: string[];
}) {
  return args;
}

export function buildCompleteHoroscopeProfile(args: {
  input: PublicLabInput;
  labPayload: Record<string, unknown>;
  dailyHome: ReturnType<typeof buildPublicDailyHomeResponse>;
  llm?: LlmDailyHomeResult;
  timeline?: ReturnType<typeof buildPublicTransitTimelineResponse>;
}) {
  const dailyReading = asRecord(args.labPayload.dailyReading) ?? {};
  const chartPayload = asRecord(args.labPayload.chart);
  const normalizedChart = getNormalizedChartFromLabPayload(args.labPayload);
  const chartWheelData = buildChartWheelData(normalizedChart);
  const valueRadar = buildValueRadar(normalizedChart);
  const longRangeTimeline = buildLongRangeTimelineContract();
  const chartProfile = args.dailyHome.chartProfile;
  const placements = getPlacements(chartProfile);
  const balance = buildBalance(placements);
  const provider = args.dailyHome.provider;
  const hasProviderChart = provider.status === "success";
  const missingProvider = hasProviderChart ? [] : ["real_astrology_provider_or_kerykeion_service"];
  const hasLlm = args.llm?.status === "success";
  const missingLlm = hasLlm ? [] : ["llm_editorial_generation_and_cache_policy"];
  const hasTimeline = args.timeline?.provider.status === "success" || args.timeline?.provider.status === "partial";
  const natalInterpretationPlan = buildNatalInterpretationGatewayPlan();
  const ascendant = normalizedChart?.summary.ascendant ?? args.dailyHome.natalBase.ascendant;
  const chartRuler = chartRulerFromAscendant(ascendant);
  const transits = asRecord(dailyReading.transits) ?? args.dailyHome.transits;
  const highlightedTransit = args.dailyHome.highlightedTransit;
  const numerology = lifePathNumber(args.input.birthDate);

  return {
    version: COMPLETE_PROFILE_VERSION,
    generatedAt: Date.now(),
    input: {
      displayName: args.input.displayName?.trim() || undefined,
      birthDate: args.input.birthDate,
      birthTime: args.input.birthTimePrecision === "unknown" ? undefined : args.input.birthTime,
      birthTimePrecision: args.input.birthTimePrecision,
      birthPlaceLabel: args.input.birthPlaceLabel,
      latitude: args.input.latitude,
      longitude: args.input.longitude,
      timezone: args.input.timezone,
      localDate: args.input.localDate,
      runTimezone: args.input.runTimezone ?? args.input.timezone
    },
    sourceModel: {
      A: "Onboarding / carta natal fija. Se calcula una vez y se cachea.",
      B: "Interpretacion editorial en español rioplatense. Pendiente de LLM/cache.",
      C: "Cielo actual y tránsitos. Se recalcula por fecha; global + cruce per-user."
    },
    provider,
    cachePlan: {
      storage: "convex_tables_not_memory_cache",
      natalChart: "natalCharts/profileAstrologyCaches by user + birthDataHash + calculationVersion",
      natalInterpretations: "natalInterpretations by user + natalChartId + feature + promptVersion",
      daily: "dailyReadings by user + localDate + timezone + contentVersion",
      dailyLlm: "dailyLlmReadings by user + localDate + timezone + promptVersion",
      weeklyMonthlyTransits: "transitTimelineCaches by user + periodStart + periodEnd + providerVersion",
      globalSky: "globalSkyCaches by localDate + timezone + providerVersion"
    },
    chartWheelData,
    valueRadar,
    editorialGeneration: {
      ...natalInterpretationPlan,
      dailyStatus: hasLlm ? "daily_llm_ready" : "needs_generation_or_cache",
      dailyPromptVersion: args.llm?.promptVersion ?? "orbita-lab-daily-home-llm-v1",
      dailyCacheVersion: args.llm?.cacheVersion ?? "orbita-llm-daily-cache-v1",
      dailyCacheTable: "dailyLlmReadings"
    },
    longRangeTimeline,
    blocks: {
      identity: [
        feature({
          id: "1.1",
          title: "Signo solar",
          source: ["A"],
          status: args.dailyHome.natalBase.sun ? (hasProviderChart ? "ready" : "stub") : "needs_provider",
          entitlement: "free",
          data: args.dailyHome.natalBase.sun,
          missing: hasProviderChart ? [] : missingProvider
        }),
        feature({
          id: "1.2",
          title: "Ascendente",
          source: ["A"],
          status: chartRuler.status === "ready" ? (hasProviderChart ? "ready" : "stub") : "needs_provider",
          entitlement: "free",
          data: args.dailyHome.natalBase.ascendant,
          missing: chartRuler.status === "ready" && hasProviderChart ? [] : ["exact_birth_time", ...missingProvider]
        }),
        feature({
          id: "1.3",
          title: "Signo lunar",
          source: ["A"],
          status: args.dailyHome.natalBase.moon ? (hasProviderChart ? "ready" : "stub") : "needs_provider",
          entitlement: "free",
          data: args.dailyHome.natalBase.moon,
          missing: hasProviderChart ? [] : missingProvider
        }),
        feature({
          id: "1.4",
          title: "Elemento dominante",
          source: ["A"],
          status: placements.length > 0 ? (hasProviderChart ? "ready" : "stub") : "needs_provider",
          entitlement: "free",
          data: {
            dominant: balance.dominantElement,
            counts: balance.elements
          },
          missing: hasProviderChart ? [] : missingProvider
        }),
        feature({
          id: "1.5",
          title: "Modalidad dominante",
          source: ["A"],
          status: placements.length > 0 ? (hasProviderChart ? "ready" : "stub") : "needs_provider",
          entitlement: "free",
          data: {
            dominant: balance.dominantModality,
            counts: balance.modalities
          },
          missing: hasProviderChart ? [] : missingProvider
        }),
        feature({
          id: "1.6",
          title: "Regente de la carta",
          source: ["A"],
          status: chartRuler.status === "ready" ? (hasProviderChart ? "ready" : "stub") : "needs_provider",
          entitlement: "free",
          data: chartRuler,
          missing: chartRuler.status === "ready" && hasProviderChart ? [] : ["exact_birth_time", ...missingProvider]
        })
      ],
      natalChart: [
        feature({
          id: "2.1",
          title: "Posiciones planetarias + casas + aspectos",
          source: ["A"],
          status: hasProviderChart ? "ready" : "stub",
          entitlement: "free",
          data: {
            title: chartProfile?.title,
            placements: chartProfile?.placements ?? placements,
            houses: chartProfile?.houses ?? [],
            aspects: chartProfile?.mainAspects ?? [],
            chartWheelData
          },
          missing: hasProviderChart ? [] : missingProvider
        }),
        feature({
          id: "2.2",
          title: "Amor y relaciones",
          source: ["A", "B"],
          status: "needs_llm",
          entitlement: "premium",
          summary: "Requiere datos natales calculados y texto editorial cacheado.",
          missing: [...(hasProviderChart ? [] : missingProvider), ...missingLlm]
        }),
        feature({
          id: "2.3",
          title: "Tu suerte",
          source: ["A", "B"],
          status: "needs_llm",
          entitlement: "premium",
          summary: "Júpiter/casas/aspectos como dato; interpretación propia como B.",
          missing: [...(hasProviderChart ? [] : missingProvider), ...missingLlm]
        }),
        feature({
          id: "2.4",
          title: "Giros del destino",
          source: ["A", "B", "C"],
          status: "needs_provider",
          entitlement: "premium",
          summary: "La fecha del evento sale de tránsitos, no de la carta natal fija.",
          missing: ["long_range_transits_window", ...missingLlm]
        }),
        feature({
          id: "2.5",
          title: "Tu singularidad / balance de elementos",
          source: ["A", "B"],
          status: "needs_llm",
          entitlement: "premium",
          data: balance,
          missing: [...(hasProviderChart ? [] : missingProvider), ...missingLlm]
        }),
        feature({
          id: "2.6",
          title: "Mapa de valores",
          source: ["A", "B"],
          status: hasProviderChart ? "ready" : "stub",
          entitlement: "premium",
          data: valueRadar,
          summary: "Armonia/estres/restricciones derivadas de aspectos natales. El texto final puede pasar por LLM/cache.",
          missing: hasProviderChart ? missingLlm : [...missingProvider, ...missingLlm]
        }),
        feature({
          id: "2.7",
          title: "12 elementos de la carta",
          source: ["A", "B"],
          status: "planned",
          entitlement: "premium",
          summary: "Falta confirmar lista exacta desde referencia Astromix sin copiar texto.",
          missing: ["confirm_12_chart_elements_structure", ...missingLlm]
        })
      ],
      daily: [
        feature({
          id: "3.1",
          title: "3 cosas para hacer / 3 para no hacer",
          source: ["A", "C", "B"],
          status: hasProviderChart && highlightedTransit ? "ready" : "stub",
          entitlement: "freemium",
          data: args.dailyHome.modules,
          missing: highlightedTransit ? [] : ["daily_personal_transits", ...missingLlm]
        })
      ],
      currentSky: [
        feature({
          id: "4.1",
          title: "Posiciones planetarias de hoy",
          source: ["C"],
          status: "needs_provider",
          entitlement: "free",
          summary: "Debe calcularse una vez por día y reutilizarse para todos.",
          missing: ["global_daily_sky_job"]
        }),
        feature({
          id: "4.2",
          title: "Tránsitos sobre tu carta",
          source: ["C", "A"],
          status: highlightedTransit ? "ready" : "needs_provider",
          entitlement: "premium",
          data: transits,
          missing: highlightedTransit ? [] : ["personal_transits_against_cached_natal_chart"]
        }),
        feature({
          id: "4.3",
          title: "Retrógrados activos",
          source: ["C"],
          status: "needs_provider",
          entitlement: "free",
          missing: ["global_daily_sky_job"]
        }),
        feature({
          id: "4.4",
          title: "Fase lunar actual",
          source: ["C"],
          status: "needs_provider",
          entitlement: "free",
          missing: ["global_daily_sky_job"]
        }),
        feature({
          id: "4.5",
          title: "Alertas de aspectos importantes",
          source: ["C", "A", "B"],
          status: "planned",
          entitlement: "premium",
          missing: ["personal_transit_alert_rules", "push_scheduler", ...missingLlm]
        }),
        feature({
          id: "4.6",
          title: "Timeline de tránsitos próximos",
          source: ["C", "A"],
          status: hasTimeline ? "ready" : "needs_provider",
          entitlement: "freemium",
          data: args.timeline ?? null,
          missing: hasTimeline ? [] : ["natal_transits_weekly_provider_endpoint"]
        })
      ],
      future: [
        feature({
          id: "5.1",
          title: "Pronóstico próximos 10 años",
          source: ["C", "A", "B"],
          status: "needs_provider",
          entitlement: "premium",
          data: longRangeTimeline,
          missing: [...longRangeTimeline.gaps, ...missingLlm]
        }),
        feature({
          id: "5.2",
          title: "Revolución solar anual",
          source: ["C", "A", "B"],
          status: "planned",
          entitlement: "premium",
          missing: ["solar_return_calculation", ...missingLlm]
        }),
        feature({
          id: "5.3",
          title: "Retorno de Saturno / planetas lentos",
          source: ["C", "A", "B"],
          status: "needs_provider",
          entitlement: "premium",
          data: longRangeTimeline,
          missing: [...longRangeTimeline.gaps, ...missingLlm]
        }),
        feature({
          id: "5.4",
          title: "Forecast semanal / mensual",
          source: ["C", "A", "B"],
          status: "planned",
          entitlement: "freemium",
          missing: ["weekly_monthly_sky_windows", ...missingLlm]
        })
      ],
      extras: [
        feature({
          id: "6.1",
          title: "Compatibilidad / sinastría",
          source: ["A", "B"],
          status: "needs_input",
          entitlement: "premium",
          missing: ["second_person_birth_data", "synastry_calculation", ...missingLlm]
        }),
        feature({
          id: "6.2",
          title: "Tarot diario + tiradas",
          source: ["dataset", "B"],
          status: "planned",
          entitlement: "freemium",
          missing: ["tarot_card_dataset", ...missingLlm]
        }),
        feature({
          id: "6.3",
          title: "Numerología",
          source: ["A"],
          status: numerology ? "ready" : "needs_input",
          entitlement: "free",
          data: {
            lifePathNumber: numerology
          }
        }),
        feature({
          id: "6.4",
          title: "Compatibilidad con famosos",
          source: ["A", "B"],
          status: "planned",
          entitlement: "premium",
          missing: ["celebrity_chart_database", "synastry_calculation", ...missingLlm]
        }),
        feature({
          id: "6.5",
          title: "Recordatorios de tránsitos",
          source: ["C", "A"],
          status: "planned",
          entitlement: "premium",
          missing: ["transit_event_scheduler", "push_tokens"]
        })
      ]
    },
    dailyHome: args.dailyHome,
    llm: args.llm ?? null,
    timeline: args.timeline ?? null,
    modelGaps: args.dailyHome.modelGaps,
    nextBackendNeeds: [
      "Elegir motor astrologico real: AstrologyAPI hosted ahora o Kerykeion/FastAPI aislado por licencia.",
      "Configurar credenciales del proveedor astrologico y endpoint de location/geocoding.",
      "Agregar job global diario para cielo actual: posiciones, retrogrados y fase lunar.",
      "Agregar cache per-profile para carta natal y daily transits.",
      hasLlm
        ? "Definir persistencia/cache de generaciones LLM por usuario, fecha y promptVersion."
        : "Definir proveedor LLM y versionado/cache de prompts editoriales."
    ],
    rawPolicy: {
      returnsProviderRaw: false,
      reason: "El raw queda solo en backoffice; /lab devuelve output revisable y seguro."
    },
    chartPayloadSummary: {
      source: chartPayload?.source,
      version: chartPayload?.version,
      providerStatus: provider.status
    }
  };
}

export function buildPublicDailyHomeResponse(args: {
  input: PublicLabInput;
  labPayload: Record<string, unknown>;
}) {
  const dailyReading = asRecord(args.labPayload.dailyReading) ?? {};
  const home = asRecord(dailyReading.home) ?? asRecord(dailyReading.modules) ?? {};
  const chartProfile = asRecord(dailyReading.chartProfile);
  const triad = Array.isArray(chartProfile?.triad) ? chartProfile.triad : [];
  const chartPayload = asRecord(args.labPayload.chart);
  const natalSummary = asRecord(dailyReading.natalSummary);
  const personalization = asRecord(dailyReading.personalization) ?? {
    status: "maqueta_no_personalizada_completa",
    mode: dailyReading.mode ?? "demo_without_provider",
    source: dailyReading.source ?? "stub_fallback",
    explanation: "Esta salida es maqueta editorial hasta que haya proveedor y revisión.",
    basedOn: [],
    missing: [],
    confidence: "baja_maqueta"
  };
  const provider = providerStatusFromChart(chartPayload);
  const normalizedChart = getNormalizedChartFromLabPayload(args.labPayload);
  const chartWheelData = buildChartWheelData(normalizedChart);
  const valueRadar = buildValueRadar(normalizedChart);
  const modelGaps = Array.from(
    new Set([
      ...stringList(args.labPayload.modelGaps, undefined, 0),
      ...stringList(personalization.missing, undefined, 0),
      ...provider.warnings
    ])
  );
  const transits = sanitizeTransits(dailyReading.transits);

  return {
    displayName: args.input.displayName?.trim() || undefined,
    localDate: dailyReading.localDate ?? args.input.localDate,
    timezone: dailyReading.timezone ?? args.input.runTimezone ?? args.input.timezone,
    header: {
      localDate: dailyReading.localDate ?? args.input.localDate,
      timezone: dailyReading.timezone ?? args.input.runTimezone ?? args.input.timezone,
      greeting: args.input.displayName?.trim() ? `Hola, ${args.input.displayName.trim()}` : "Tu guía diaria",
      headline: home.headline ?? "Tu cielo de hoy pide una lectura simple.",
      subheadline: home.subheadline ?? "Contexto diario para mirarte con más claridad."
    },
    natalBase: {
      sun: natalSummary?.sun ?? triad[0] ?? null,
      moon: natalSummary?.moon ?? triad[1] ?? null,
      ascendant: natalSummary?.ascendant ?? triad[2] ?? null,
      accuracy: natalSummary?.accuracy ?? chartProfile?.accuracy ?? "pending",
      limitations: Array.isArray(chartProfile?.limitations) ? chartProfile.limitations : []
    },
    highlightedTransit: transits.highlighted,
    modules: {
      do: stringList(home.doList, home.do || "Elegí una acción chica y concreta."),
      avoid: stringList(home.avoidList, home.avoid || "Leer el día como predicción cerrada."),
      energy: home.energy ?? "Contexto diario en modo maqueta.",
      action: home.action ?? "Anotá una pregunta simple antes de responder en automático.",
      question: home.question ?? "¿Qué dato simple estás pasando por alto?"
    },
    topics: Array.isArray(dailyReading.topics) ? dailyReading.topics : [],
    longRead: sanitizeLongRead(dailyReading.longRead),
    void: dailyReading.voidPreview ?? null,
    futureSelf: dailyReading.futureSelf ?? null,
    personalization,
    chartProfile: chartProfile ?? null,
    chartWheelData,
    valueRadar,
    transits,
    provider,
    modelGaps,
    modelVersions: args.labPayload.modelVersions ?? {},
    reviewStatus: dailyReading.reviewStatus ?? "needs_review",
    contentVersion: dailyReading.contentVersion ?? dailyReading.version ?? "",
    calculationVersion: dailyReading.calculationVersion ?? chartPayload?.version ?? "",
    mode: dailyReading.mode ?? "demo_without_provider",
    source: dailyReading.source ?? "stub_fallback"
  };
}

export function buildPublicTransitTimelineResponse(args: {
  input: PublicLabInput;
  providerResult: ExtendedTransitProviderResult;
}) {
  const normalized = asRecord(args.providerResult.normalized);
  const timeline = asRecord(normalized?.timeline);
  const providerStatus = asRecord(timeline?.providerStatus);
  const events = Array.isArray(timeline?.events) ? timeline.events : [];
  const warnings = stringList(args.providerResult.warnings, providerStatus?.warnings, 0);
  const modelGaps = Array.from(
    new Set([
      ...warnings,
      args.providerResult.status === "not_configured" ? "astrologyapi_credentials_not_configured" : "",
      args.providerResult.status === "missing_input" ? "provider_missing_required_birth_inputs" : "",
      args.providerResult.status === "error" ? "extended_transits_provider_error" : "",
      events.length === 0 ? "extended_transits_empty_or_unavailable" : ""
    ].filter(Boolean))
  );

  return {
    localDate: args.input.localDate,
    timezone: args.input.runTimezone ?? args.input.timezone,
    provider: {
      status: args.providerResult.status,
      provider: args.providerResult.provider,
      providerVersion: args.providerResult.providerVersion,
      houseSystem: args.providerResult.houseSystem,
      endpoints: asRecord(providerStatus?.endpoints),
      warnings,
      error: args.providerResult.error ?? providerStatus?.error ?? null
    },
    timeline: {
      version: timeline?.version ?? "orbita-transit-timeline-v1",
      events,
      rawPolicy: timeline?.rawPolicy ?? {
        returnsProviderRaw: false,
        reason: "El raw completo queda solo en backoffice."
      }
    },
    cachePlan: {
      natalWeekly: "cache_by_profile_week_provider_version",
      tropicalWeekly: "cache_by_profile_week_provider_version",
      tropicalMonthly: "cache_by_profile_month_provider_version",
      longRange: "cache_by_profile_range_provider_version_after_provider_endpoint_is_confirmed"
    },
    longRangeTimeline: buildLongRangeTimelineContract(),
    modelGaps,
    rawPolicy: {
      returnsProviderRaw: false,
      reason: "El timeline publico devuelve solo eventos normalizados."
    }
  };
}

export async function buildPublicLlmDailyHomeResponse(args: {
  dailyHome: ReturnType<typeof buildPublicDailyHomeResponse>;
  enabled?: boolean;
  generateText?: Parameters<typeof generateDailyHomeWithGateway>[0]["generateText"];
}) {
  const llm = await generateDailyHomeWithGateway({
    dailyHome: args.dailyHome as Record<string, unknown>,
    enabled: args.enabled,
    generateText: args.generateText
  });

  return mergeDailyHomeWithLlm({
    dailyHome: args.dailyHome as Record<string, unknown>,
    llm
  });
}

function sanitizePlaceLookup(result: Record<string, unknown>) {
  const places = Array.isArray(result.places)
    ? result.places.map((place) => {
        const record = asRecord(place) ?? {};
        return {
          label: record.label,
          placeId: record.placeId,
          latitude: record.latitude,
          longitude: record.longitude,
          timezone: record.timezone,
          utcOffset: record.utcOffset
        };
      })
    : [];

  return {
    status: result.status,
    provider: result.provider,
    query: result.query,
    endpoint: result.endpoint,
    places,
    error: result.error
  };
}

export const previewDailyHome = action({
  args: {
    birthDate: v.string(),
    birthTime: v.optional(v.string()),
    birthTimePrecision: birthTimePrecisionValidator,
    birthPlaceLabel: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    timezone: v.string(),
    localDate: v.string(),
    runTimezone: v.optional(v.string()),
    displayName: v.optional(v.string()),
    llmEnabled: v.optional(v.boolean()),
    accessKey: v.optional(v.string())
  },
  handler: async (_ctx, args) => {
    assertPublicLabAccess(args.accessKey);

    const timezone = args.runTimezone?.trim() || args.timezone.trim();
    const input = {
      birthDate: args.birthDate,
      birthTime: args.birthTimePrecision === "unknown" ? undefined : args.birthTime,
      birthTimePrecision: args.birthTimePrecision,
      birthPlaceLabel: args.birthPlaceLabel,
      latitude: args.latitude,
      longitude: args.longitude,
      timezone
    };
    const providerResult = await runAstrologyApiProvider({
      input,
      localDate: args.localDate.trim()
    });
    const labPayload = buildAstrologicalLabRunPayload({
      localDate: args.localDate.trim(),
      input,
      providerResult
    }) as Record<string, unknown>;
    const dailyHome = buildPublicDailyHomeResponse({
      input: {
        ...args,
        timezone
      },
      labPayload
    });

    if (args.llmEnabled) {
      return buildPublicLlmDailyHomeResponse({
        dailyHome,
        enabled: true
      });
    }

    return dailyHome;
  }
});

export const previewLlmHome = action({
  args: {
    birthDate: v.string(),
    birthTime: v.optional(v.string()),
    birthTimePrecision: birthTimePrecisionValidator,
    birthPlaceLabel: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    timezone: v.string(),
    localDate: v.string(),
    runTimezone: v.optional(v.string()),
    displayName: v.optional(v.string()),
    accessKey: v.optional(v.string())
  },
  handler: async (_ctx, args) => {
    assertPublicLabAccess(args.accessKey);

    const timezone = args.runTimezone?.trim() || args.timezone.trim();
    const input = {
      birthDate: args.birthDate,
      birthTime: args.birthTimePrecision === "unknown" ? undefined : args.birthTime,
      birthTimePrecision: args.birthTimePrecision,
      birthPlaceLabel: args.birthPlaceLabel,
      latitude: args.latitude,
      longitude: args.longitude,
      timezone
    };
    const providerResult = await runAstrologyApiProvider({
      input,
      localDate: args.localDate.trim()
    });
    const labPayload = buildAstrologicalLabRunPayload({
      localDate: args.localDate.trim(),
      input,
      providerResult
    }) as Record<string, unknown>;
    const dailyHome = buildPublicDailyHomeResponse({
      input: {
        ...args,
        timezone
      },
      labPayload
    });

    return buildPublicLlmDailyHomeResponse({
      dailyHome,
      enabled: true
    });
  }
});

export const previewCompleteHoroscope = action({
  args: {
    birthDate: v.string(),
    birthTime: v.optional(v.string()),
    birthTimePrecision: birthTimePrecisionValidator,
    birthPlaceLabel: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    timezone: v.string(),
    localDate: v.string(),
    runTimezone: v.optional(v.string()),
    displayName: v.optional(v.string()),
    llmEnabled: v.optional(v.boolean()),
    includeTimeline: v.optional(v.boolean()),
    includeNatalWeekly: v.optional(v.boolean()),
    includeTropicalWeekly: v.optional(v.boolean()),
    includeTropicalMonthly: v.optional(v.boolean()),
    accessKey: v.optional(v.string())
  },
  handler: async (_ctx, args) => {
    assertPublicLabAccess(args.accessKey);

    const timezone = args.runTimezone?.trim() || args.timezone.trim();
    const input = {
      birthDate: args.birthDate,
      birthTime: args.birthTimePrecision === "unknown" ? undefined : args.birthTime,
      birthTimePrecision: args.birthTimePrecision,
      birthPlaceLabel: args.birthPlaceLabel,
      latitude: args.latitude,
      longitude: args.longitude,
      timezone
    };
    const providerResult = await runAstrologyApiProvider({
      input,
      localDate: args.localDate.trim()
    });
    const labPayload = buildAstrologicalLabRunPayload({
      localDate: args.localDate.trim(),
      input,
      providerResult
    }) as Record<string, unknown>;
    const publicInput = {
      ...args,
      timezone
    };
    const dailyHomeBase = buildPublicDailyHomeResponse({
      input: publicInput,
      labPayload
    });
    let dailyHome: ReturnType<typeof buildPublicDailyHomeResponse> | Record<string, unknown> = dailyHomeBase;
    let llm: LlmDailyHomeResult | undefined;
    let timeline: ReturnType<typeof buildPublicTransitTimelineResponse> | undefined;

    if (args.llmEnabled) {
      dailyHome = await buildPublicLlmDailyHomeResponse({
        dailyHome: dailyHomeBase,
        enabled: true
      });
      llm = asRecord((dailyHome as Record<string, unknown>).llm) as LlmDailyHomeResult;
    }

    if (args.includeTimeline) {
      const timelineResult = await runAstrologyApiExtendedTransits({
        input,
        localDate: args.localDate.trim(),
        includeNatalWeekly: args.includeNatalWeekly ?? true,
        includeTropicalWeekly: args.includeTropicalWeekly ?? false,
        includeTropicalMonthly: args.includeTropicalMonthly ?? false
      });
      timeline = buildPublicTransitTimelineResponse({
        input: publicInput,
        providerResult: timelineResult
      });
    }

    return buildCompleteHoroscopeProfile({
      input: publicInput,
      labPayload,
      dailyHome: dailyHome as ReturnType<typeof buildPublicDailyHomeResponse>,
      llm,
      timeline
    });
  }
});

export const previewTransitTimeline = action({
  args: {
    birthDate: v.string(),
    birthTime: v.optional(v.string()),
    birthTimePrecision: birthTimePrecisionValidator,
    birthPlaceLabel: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    timezone: v.string(),
    localDate: v.string(),
    runTimezone: v.optional(v.string()),
    displayName: v.optional(v.string()),
    includeNatalWeekly: v.optional(v.boolean()),
    includeTropicalWeekly: v.optional(v.boolean()),
    includeTropicalMonthly: v.optional(v.boolean()),
    accessKey: v.optional(v.string())
  },
  handler: async (_ctx, args) => {
    assertPublicLabAccess(args.accessKey);

    const timezone = args.runTimezone?.trim() || args.timezone.trim();
    const input = {
      birthDate: args.birthDate,
      birthTime: args.birthTimePrecision === "unknown" ? undefined : args.birthTime,
      birthTimePrecision: args.birthTimePrecision,
      birthPlaceLabel: args.birthPlaceLabel,
      latitude: args.latitude,
      longitude: args.longitude,
      timezone
    };
    const timelineResult = await runAstrologyApiExtendedTransits({
      input,
      localDate: args.localDate.trim(),
      includeNatalWeekly: args.includeNatalWeekly ?? true,
      includeTropicalWeekly: args.includeTropicalWeekly ?? false,
      includeTropicalMonthly: args.includeTropicalMonthly ?? false
    });

    return buildPublicTransitTimelineResponse({
      input: {
        ...args,
        timezone
      },
      providerResult: timelineResult
    });
  }
});

export const resolvePlace = action({
  args: {
    query: v.string(),
    accessKey: v.optional(v.string())
  },
  handler: async (_ctx, args) => {
    assertPublicLabAccess(args.accessKey);
    const result = (await resolvePlaceWithAstrologyApi(args.query)) as Record<string, unknown>;
    return sanitizePlaceLookup(result);
  }
});
