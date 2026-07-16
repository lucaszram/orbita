const AI_GATEWAY_CHAT_COMPLETIONS_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const DEFAULT_PROMPT_VERSION = "orbita-lab-daily-home-llm-v3";
const DEFAULT_CACHE_VERSION = "orbita-llm-daily-cache-v1";
const DEFAULT_NATAL_PROMPT_VERSION = "orbita-natal-profile-llm-v1";
const DEFAULT_NATAL_CACHE_VERSION = "orbita-natal-profile-cache-v1";

export type LlmDailyHomeText = {
  headline: string;
  subheadline: string;
  do: string[];
  avoid: string[];
  action: string;
  question: string;
  longRead: {
    title: string;
    body: string;
  };
  personalizationNote: string;
};

export type LlmDailyHomeResult = {
  status: "success" | "disabled" | "not_configured" | "error";
  provider: "vercel-ai-gateway";
  model?: string;
  promptVersion: string;
  cacheVersion: string;
  tags: string[];
  user: "lab";
  generated?: LlmDailyHomeText;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  warnings: string[];
  gaps: string[];
  error?: string;
};

type GatewayGenerateText = (args: {
  apiKey: string;
  model: string;
  prompt: string;
  system: string;
  tags: string[];
  maxTokens?: number;
}) => Promise<{
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}>;

type GenerateDailyHomeWithGatewayArgs = {
  dailyHome: Record<string, unknown>;
  enabled?: boolean;
  apiKey?: string;
  model?: string;
  promptVersion?: string;
  cacheVersion?: string;
  generateText?: GatewayGenerateText;
};

type MergeDailyHomeArgs = {
  dailyHome: Record<string, unknown>;
  llm: LlmDailyHomeResult;
};

const gatewayTags = ["feature:orbita-lab", "env:dev", "user:lab"];

function configuredEnabled() {
  return process.env.ORBITA_LLM_ENABLED === "true";
}

function configuredApiKey() {
  return process.env.AI_GATEWAY_API_KEY?.trim();
}

function configuredModel() {
  return process.env.ORBITA_LLM_MODEL?.trim();
}

export function getAiGatewayPromptVersion() {
  return process.env.ORBITA_LLM_DAILY_PROMPT_VERSION?.trim() || DEFAULT_PROMPT_VERSION;
}

export function getAiGatewayCacheVersion() {
  return process.env.ORBITA_LLM_DAILY_CACHE_VERSION?.trim() || DEFAULT_CACHE_VERSION;
}

export function getAiGatewayNatalPromptVersion() {
  return process.env.ORBITA_LLM_NATAL_PROMPT_VERSION?.trim() || DEFAULT_NATAL_PROMPT_VERSION;
}

export function getAiGatewayNatalCacheVersion() {
  return process.env.ORBITA_LLM_NATAL_CACHE_VERSION?.trim() || DEFAULT_NATAL_CACHE_VERSION;
}

export function buildNatalInterpretationGatewayPlan(args?: { model?: string; locale?: string }) {
  return {
    provider: "vercel-ai-gateway",
    model: args?.model?.trim() || configuredModel(),
    locale: args?.locale ?? "es-AR",
    promptVersion: getAiGatewayNatalPromptVersion(),
    cacheVersion: getAiGatewayNatalCacheVersion(),
    cacheTable: "natalInterpretations",
    status: "contract_ready",
    sections: [
      {
        id: "love_relationships",
        title: "Amor y relaciones",
        cacheKeyShape: "userId+natalChartId+love_relationships+locale+promptVersion",
        inputs: ["venus", "mars", "moon", "house_5", "house_7", "natal_aspects", "valueRadar"],
        outputShape: {
          title: "string",
          placementLine: "string",
          body: "string",
          questions: ["string"],
          trace: ["string"]
        }
      },
      {
        id: "luck",
        title: "Tu suerte",
        cacheKeyShape: "userId+natalChartId+luck+locale+promptVersion",
        inputs: ["jupiter", "house_9", "house_12", "natal_aspects", "chartWheelData"],
        outputShape: {
          title: "string",
          placementLine: "string",
          body: "string",
          trace: ["string"]
        }
      },
      {
        id: "values_radar",
        title: "Mapa de valores",
        cacheKeyShape: "userId+natalChartId+values_radar+locale+promptVersion",
        inputs: ["valueRadar", "chartWheelData", "dominant_element", "dominant_modality"],
        outputShape: {
          dimensionSummaries: ["string"],
          topHarmony: "string",
          topStress: "string",
          topRestrictions: "string",
          trace: ["string"]
        }
      }
    ],
    guardrails: [
      "entretenimiento_y_autoconocimiento",
      "no_determinismo",
      "no_salud_dinero_legal_psicologia_como_consejo",
      "no_copy_de_proveedor_astrologico"
    ]
  };
}

function resultBase(args: { model?: string; promptVersion?: string; cacheVersion?: string }): Omit<LlmDailyHomeResult, "status" | "warnings" | "gaps"> {
  return {
    provider: "vercel-ai-gateway",
    model: args.model,
    promptVersion: args.promptVersion ?? getAiGatewayPromptVersion(),
    cacheVersion: args.cacheVersion ?? getAiGatewayCacheVersion(),
    tags: gatewayTags,
    user: "lab"
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function readStringList(value: unknown, fallback: string[]) {
  const list = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];

  const padded = [...list, ...fallback].filter((item) => item.trim().length > 0);
  while (padded.length < 3) {
    padded.push("");
  }
  return padded.slice(0, 3);
}

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function parseLlmDailyHomeText(text: string): LlmDailyHomeText | null {
  try {
    const parsed = JSON.parse(stripJsonFence(text));
    const record = asRecord(parsed);
    const longRead = asRecord(record.longRead);
    const fallbackDo = ["Elegí una acción chica y concreta.", "Nombrá el foco del día.", "Volvé a un dato verificable."];
    const fallbackAvoid = ["Leer el día como sentencia.", "Forzar una conclusión.", "Prometer más de lo sostenible."];

    return {
      headline: readString(record.headline, "Tu cielo de hoy pide una lectura simple."),
      subheadline: readString(record.subheadline, "Contexto diario para mirarte con más claridad."),
      do: readStringList(record.do, fallbackDo),
      avoid: readStringList(record.avoid, fallbackAvoid),
      action: readString(record.action, "Escribí una línea sobre lo que pide atención."),
      question: readString(record.question, "¿Qué dato simple estás pasando por alto?"),
      longRead: {
        title: readString(longRead.title, "Lectura del día"),
        body: readString(longRead.body, "Usalo como contexto simbólico, no como predicción cerrada.")
      },
      personalizationNote: readString(record.personalizationNote, "Texto generado desde tu carta, tu tránsito destacado y los guardrails de Órbita.")
    };
  } catch {
    return null;
  }
}

function compactForPrompt(value: unknown, maxChars = 7000) {
  const serialized = JSON.stringify(value, null, 2);
  return serialized.length > maxChars ? `${serialized.slice(0, maxChars)}\n...truncated` : serialized;
}

export function buildDailyHomeGatewayPrompt(dailyHome: Record<string, unknown>) {
  return `Generá una Home diaria para Órbita en español rioplatense con voseo.

Reglas:
- Producto de entretenimiento, autoconocimiento y contexto.
- Escribile a la persona: usá "vos", "tu", "te", "elegís", "querés", "podés".
- Todo texto visible debe tener tildes y signos de apertura: ¿? y ¡! cuando correspondan.
- Las preguntas tienen que ser personales: "¿Qué estás...?", "¿Qué te...?", "¿Dónde sentís...?".
- Evitá frases abstractas impersonales como "El deseo pide..." o "Una prioridad ordena...".
- "headline", "subheadline" y "energy" no pueden repetir la misma idea.
- "subheadline" abre el contexto del día; "energy" debe nombrar el tono o área activa para el módulo Energía.
- No hagas promesas de destino, salud, dinero, legal, psicología clínica ni resultados garantizados.
- No copies voz de proveedores externos.
- Frases breves, editoriales y naturales.
- Devolvé SOLO JSON válido.
- El JSON debe tener esta forma:
{
  "headline": "string",
  "subheadline": "string",
  "do": ["string", "string", "string"],
  "avoid": ["string", "string", "string"],
  "action": "string",
  "question": "string",
  "longRead": { "title": "string", "body": "string" },
  "personalizationNote": "string"
}

Datos normalizados de Órbita:
${compactForPrompt({
    header: asRecord(dailyHome.header),
    natalBase: asRecord(dailyHome.natalBase),
    highlightedTransit: dailyHome.highlightedTransit ?? null,
    modules: asRecord(dailyHome.modules),
    personalization: asRecord(dailyHome.personalization),
    guardrails: ["entretenimiento_y_autoconocimiento", "no_determinismo", "no_salud_dinero_legal_psicologia_como_consejo"]
  })}`;
}

async function defaultGatewayGenerateText(args: {
  apiKey: string;
  model: string;
  prompt: string;
  system: string;
  tags: string[];
  maxTokens?: number;
}) {
  const response = await fetch(AI_GATEWAY_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      "X-Vercel-AI-App-Name": "Orbita Lab"
    },
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.prompt }
      ],
      temperature: 0.7,
      max_tokens: args.maxTokens ?? 900,
      stream: false,
      providerOptions: {
        gateway: {
          user: "lab",
          tags: args.tags
        }
      }
    })
  });

  const rawText = await response.text();
  let json: Record<string, unknown> = {};
  if (rawText) {
    try {
      json = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      json = { rawText };
    }
  }

  if (!response.ok) {
    const detail = JSON.stringify(json).slice(0, 500);
    const error = new Error(`AI Gateway failed with ${response.status}: ${detail}`);
    (error as Error & { statusCode?: number }).statusCode = response.status;
    throw error;
  }

  const choices = Array.isArray(json.choices) ? json.choices : [];
  const firstChoice = asRecord(choices[0]);
  const message = asRecord(firstChoice.message);
  const usage = asRecord(json.usage);

  return {
    text: readString(message.content),
    usage: {
      promptTokens: typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : undefined,
      completionTokens: typeof usage.completion_tokens === "number" ? usage.completion_tokens : undefined,
      totalTokens: typeof usage.total_tokens === "number" ? usage.total_tokens : undefined
    }
  };
}

function gapForGatewayError(error: unknown) {
  const statusCode =
    typeof error === "object" && error !== null && typeof (error as { statusCode?: unknown }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : null;

  if (statusCode === 429) {
    return "ai_gateway_rate_limited";
  }

  if (statusCode === 402) {
    return "ai_gateway_budget_or_payment_required";
  }

  return "ai_gateway_generation_failed";
}

export async function generateDailyHomeWithGateway(args: GenerateDailyHomeWithGatewayArgs): Promise<LlmDailyHomeResult> {
  const enabled = args.enabled ?? configuredEnabled();
  const model = args.model?.trim() || configuredModel();
  const apiKey = args.apiKey?.trim() || configuredApiKey();
  const promptVersion = args.promptVersion ?? getAiGatewayPromptVersion();
  const cacheVersion = args.cacheVersion ?? getAiGatewayCacheVersion();
  const base = resultBase({ model, promptVersion, cacheVersion });

  if (!enabled) {
    return {
      ...base,
      status: "disabled",
      warnings: ["ORBITA_LLM_ENABLED_is_not_true"],
      gaps: ["llm_gateway_disabled"]
    };
  }

  if (!apiKey || !model) {
    return {
      ...base,
      status: "not_configured",
      warnings: ["AI Gateway env is incomplete."],
      gaps: [
        !apiKey ? "ai_gateway_api_key_not_configured" : "",
        !model ? "orbita_llm_model_not_configured" : ""
      ].filter(Boolean)
    };
  }

  const system =
    "Sos la capa editorial de Órbita. Escribís en español rioplatense, con voseo, tildes, signos de apertura, precisión y guardrails estrictos.";
  const prompt = buildDailyHomeGatewayPrompt(args.dailyHome);

  try {
    const generated = await (args.generateText ?? defaultGatewayGenerateText)({
      apiKey,
      model,
      prompt,
      system,
      tags: gatewayTags
    });
    const parsed = parseLlmDailyHomeText(generated.text);

    if (!parsed) {
      return {
        ...base,
        status: "error",
        usage: generated.usage,
        warnings: ["AI Gateway returned non-JSON or invalid JSON."],
        gaps: ["ai_gateway_invalid_json_response"],
        error: "Invalid JSON response from AI Gateway."
      };
    }

    return {
      ...base,
      status: "success",
      generated: parsed,
      usage: generated.usage,
      warnings: [],
      gaps: []
    };
  } catch (error) {
    return {
      ...base,
      status: "error",
      warnings: ["AI Gateway generation failed; falling back to deterministic templates."],
      gaps: [gapForGatewayError(error)],
      error: error instanceof Error ? error.message : "Unknown AI Gateway error"
    };
  }
}

export function mergeDailyHomeWithLlm(args: MergeDailyHomeArgs) {
  const dailyHome = args.dailyHome;
  const generated = args.llm.status === "success" ? args.llm.generated : null;
  const header = { ...asRecord(dailyHome.header) };
  const modules = { ...asRecord(dailyHome.modules) };
  const longRead = { ...asRecord(dailyHome.longRead) };
  const personalization = { ...asRecord(dailyHome.personalization) };
  const baseGaps = Array.isArray(dailyHome.modelGaps) ? dailyHome.modelGaps : [];

  if (generated) {
    header.headline = generated.headline;
    header.subheadline = generated.subheadline;
    modules.do = generated.do;
    modules.avoid = generated.avoid;
    modules.action = generated.action;
    modules.question = generated.question;
    longRead.title = generated.longRead.title;
    longRead.body = generated.longRead.body;
    personalization.llm = {
      status: args.llm.status,
      provider: args.llm.provider,
      model: args.llm.model,
      promptVersion: args.llm.promptVersion,
      cacheVersion: args.llm.cacheVersion,
      note: generated.personalizationNote,
      tags: args.llm.tags
    };
  } else {
    personalization.llm = {
      status: args.llm.status,
      provider: args.llm.provider,
      model: args.llm.model,
      promptVersion: args.llm.promptVersion,
      cacheVersion: args.llm.cacheVersion,
      gaps: args.llm.gaps,
      warnings: args.llm.warnings
    };
  }

  return {
    ...dailyHome,
    header,
    modules,
    longRead,
    personalization,
    llm: args.llm,
    modelGaps: Array.from(new Set([...baseGaps, ...args.llm.gaps])),
    mode: generated ? `${dailyHome.mode ?? "daily_home"}+llm_gateway` : dailyHome.mode
  };
}

// ---------------------------------------------------------------------------
// Interpretación natal larga — 7 capítulos temáticos desde la carta completa.
// ---------------------------------------------------------------------------

export type NatalReadingSection = {
  key: string;
  title: string;
  intro: string;
  placement: { label: string; planet: string; sign?: string; house?: number };
  body: string;
  questions: string[];
};

export type NatalReadingPayload = {
  headline: string;
  sections: NatalReadingSection[];
  disclaimer: string;
};

export type NatalReadingResult = {
  status: "success" | "disabled" | "not_configured" | "error";
  provider: "vercel-ai-gateway";
  model?: string;
  promptVersion: string;
  cacheVersion: string;
  payload?: NatalReadingPayload;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  gaps: string[];
  warnings: string[];
  error?: string;
};

export const NATAL_SECTION_KEYS = [
  "identidad",
  "emocional",
  "mente",
  "amor",
  "impulso",
  "expansion",
  "estructura"
] as const;

const NATAL_SECTION_SPEC = [
  { key: "identidad", title: "Tu identidad", planets: "Sol (identidad central) + Ascendente (cómo te presentás)" },
  { key: "emocional", title: "Tu mundo emocional", planets: "Luna (necesidades emocionales, mundo interno)" },
  { key: "mente", title: "Cómo pensás y comunicás", planets: "Mercurio (mente, aprendizaje, comunicación)" },
  { key: "amor", title: "Amor y vínculos", planets: "Venus (cómo amás y disfrutás) + Marte (deseo)" },
  { key: "impulso", title: "Tu impulso", planets: "Marte (acción, energía, cómo avanzás)" },
  {
    key: "expansion",
    title: "Dónde te expandís",
    planets: "Júpiter (crecimiento, dónde florecés) — sin promesas de suerte, dinero o éxito"
  },
  { key: "estructura", title: "Estructura y madurez", planets: "Saturno (límites, constancia y madurez)" }
] as const;

const NATAL_GUARDRAILS = [
  "Producto de entretenimiento, autoconocimiento y contexto — nunca predicción ni diagnóstico.",
  "No prometas destino, dinero, éxito, salud ni resultados garantizados en amor o trabajo.",
  "No des órdenes ni consejo médico, legal, financiero o psicológico. Evitá 'tenés que'.",
  "No copies la voz de proveedores astrológicos externos.",
  "Español rioplatense con voseo, tildes y signos de apertura (¿ ¡)."
];

export function buildNatalReadingGatewayPrompt(chartPayload: unknown) {
  const chart = asRecord(chartPayload);
  const sectionsSpec = NATAL_SECTION_SPEC.map(
    (section, index) => `${index + 1}. key "${section.key}" — "${section.title}": ${section.planets}`
  ).join("\n");

  return `Sos la capa editorial de Órbita. Escribí una lectura LARGA de la carta natal completa, organizada en 7 capítulos temáticos, en español rioplatense con voseo.

Tono y estructura de CADA body (~4 párrafos que lleven al lector):
1) Explicá en simple qué representa ese planeta o punto.
2) Explicá qué aporta su signo concreto.
3) Explicá qué agrega su casa concreta.
4) Integrá los aspectos relevantes y cerrá con un borde de crecimiento, sin dar órdenes.

Los capítulos no son siete posiciones aisladas: identidad integra Sol + Ascendente; amor integra Venus + Marte. Usá también casas y aspectos para explicar cómo se relacionan las piezas de esta carta.

Guardrails obligatorios:
${NATAL_GUARDRAILS.map((guardrail) => `- ${guardrail}`).join("\n")}

Devolvé SOLO JSON válido con esta forma EXACTA (7 secciones, en este orden y con estas keys):
{
  "headline": "string",
  "sections": [
    {
      "key": "identidad|emocional|mente|amor|impulso|expansion|estructura",
      "title": "string",
      "intro": "string",
      "placement": { "label": "string", "planet": "string", "sign": "string opcional", "house": 7 },
      "body": "string largo, ~4 párrafos separados por \\n\\n",
      "questions": ["1 o 2 preguntas personales con ¿?"]
    }
  ],
  "disclaimer": "string"
}

Las 7 secciones, en orden:
${sectionsSpec}

Usá únicamente los datos reales de la carta. Si falta el Ascendente o alguna casa por hora desconocida, no lo inventes: explicá suavemente el límite y trabajá con lo disponible.

Carta natal normalizada completa:
${compactForPrompt(
    {
      placements: chart.placements ?? chart.summary ?? null,
      houses: chart.houses ?? null,
      aspects: chart.aspects ?? null,
      accuracy: chart.accuracy ?? null
    },
    9000
  )}`;
}

export function parseNatalReadingText(text: string): NatalReadingPayload | null {
  try {
    const parsed = asRecord(JSON.parse(stripJsonFence(text)));
    const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
    const sections: NatalReadingSection[] = rawSections
      .map((raw): NatalReadingSection | null => {
        const section = asRecord(raw);
        const placement = asRecord(section.placement);
        const key = readString(section.key);
        const body = readString(section.body);
        if (!key || body.split(/\n\s*\n/).filter(Boolean).length < 4) return null;

        const questions = Array.isArray(section.questions)
          ? section.questions
              .filter((question): question is string => typeof question === "string" && question.trim().length > 0)
              .map((question) => question.trim())
              .slice(0, 2)
          : [];
        if (questions.length < 1) return null;

        const normalizedPlacement: NatalReadingSection["placement"] = {
          label: readString(placement.label),
          planet: readString(placement.planet)
        };
        if (typeof placement.sign === "string") normalizedPlacement.sign = placement.sign;
        if (typeof placement.house === "number") normalizedPlacement.house = placement.house;

        return {
          key,
          title: readString(section.title, key),
          intro: readString(section.intro),
          placement: normalizedPlacement,
          body,
          questions
        };
      })
      .filter((section): section is NatalReadingSection => section !== null);

    if (
      sections.length !== NATAL_SECTION_KEYS.length ||
      sections.some((section, index) => section.key !== NATAL_SECTION_KEYS[index])
    ) {
      return null;
    }

    return {
      headline: readString(parsed.headline, "Tu carta, leída de principio a fin."),
      sections,
      disclaimer: readString(
        parsed.disclaimer,
        "Esta lectura describe tendencias de tu carta natal, en clave de autoconocimiento. No es una predicción ni un diagnóstico."
      )
    };
  } catch {
    return null;
  }
}

export async function generateNatalReadingWithGateway(args: {
  chartPayload: unknown;
  enabled?: boolean;
  apiKey?: string;
  model?: string;
  generateText?: GatewayGenerateText;
}): Promise<NatalReadingResult> {
  const enabled = args.enabled ?? configuredEnabled();
  const model = args.model?.trim() || configuredModel();
  const apiKey = args.apiKey?.trim() || configuredApiKey();
  const promptVersion = getAiGatewayNatalPromptVersion();
  const cacheVersion = getAiGatewayNatalCacheVersion();
  const base = { provider: "vercel-ai-gateway" as const, model, promptVersion, cacheVersion };

  if (!enabled) {
    return {
      ...base,
      status: "disabled",
      gaps: ["llm_gateway_disabled"],
      warnings: ["ORBITA_LLM_ENABLED_is_not_true"]
    };
  }

  if (!apiKey || !model) {
    return {
      ...base,
      status: "not_configured",
      gaps: [
        !apiKey ? "ai_gateway_api_key_not_configured" : "",
        !model ? "orbita_llm_model_not_configured" : ""
      ].filter(Boolean),
      warnings: ["AI Gateway env is incomplete."]
    };
  }

  const system =
    "Sos la capa editorial de Órbita. Escribís lecturas de carta natal cálidas, precisas y pedagógicas, en español rioplatense con voseo, tildes, signos de apertura y guardrails estrictos.";

  try {
    const generated = await (args.generateText ?? defaultGatewayGenerateText)({
      apiKey,
      model,
      prompt: buildNatalReadingGatewayPrompt(args.chartPayload),
      system,
      tags: ["feature:orbita-natal", "env:app", "user:app"],
      maxTokens: 7000
    });
    const payload = parseNatalReadingText(generated.text);
    if (!payload) {
      return {
        ...base,
        status: "error",
        usage: generated.usage,
        gaps: ["ai_gateway_invalid_json_response"],
        warnings: ["Non-JSON or incomplete natal reading."],
        error: "Invalid JSON from AI Gateway."
      };
    }
    return { ...base, status: "success", payload, usage: generated.usage, gaps: [], warnings: [] };
  } catch (error) {
    return {
      ...base,
      status: "error",
      gaps: [gapForGatewayError(error)],
      warnings: ["AI Gateway natal generation failed."],
      error: error instanceof Error ? error.message : "Unknown AI Gateway error"
    };
  }
}
