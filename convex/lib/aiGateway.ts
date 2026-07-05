const AI_GATEWAY_CHAT_COMPLETIONS_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const DEFAULT_PROMPT_VERSION = "orbita-lab-daily-home-llm-v1";
const DEFAULT_CACHE_VERSION = "orbita-llm-daily-cache-v1";
const DEFAULT_NATAL_PROMPT_VERSION = "orbita-natal-profile-llm-v1";
const DEFAULT_NATAL_CACHE_VERSION = "orbita-natal-profile-cache-v1";

export type LlmDailyHomeText = {
  headline: string;
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
    const fallbackDo = ["Elegir una accion chica y concreta.", "Nombrar el foco del dia.", "Volver a un dato verificable."];
    const fallbackAvoid = ["Leer el dia como sentencia.", "Forzar una conclusion.", "Prometer mas de lo sostenible."];

    return {
      headline: readString(record.headline, "Tu cielo de hoy pide una lectura simple."),
      do: readStringList(record.do, fallbackDo),
      avoid: readStringList(record.avoid, fallbackAvoid),
      action: readString(record.action, "Escribi una linea sobre lo que pide atencion."),
      question: readString(record.question, "Que dato simple estas pasando por alto?"),
      longRead: {
        title: readString(longRead.title, "Lectura del dia"),
        body: readString(longRead.body, "Usalo como contexto simbolico, no como prediccion cerrada.")
      },
      personalizationNote: readString(record.personalizationNote, "Texto generado desde carta, transito destacado y guardrails de Orbita.")
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
  return `Genera una Home diaria para Orbita en espanol rioplatense con voseo.

Reglas:
- Producto de entretenimiento, autoconocimiento y contexto.
- No hagas promesas de destino, salud, dinero, legal, psicologia clinica ni resultados garantizados.
- No copies voz de proveedores externos.
- Frases breves, editoriales y naturales.
- Devolve SOLO JSON valido.
- El JSON debe tener esta forma:
{
  "headline": "string",
  "do": ["string", "string", "string"],
  "avoid": ["string", "string", "string"],
  "action": "string",
  "question": "string",
  "longRead": { "title": "string", "body": "string" },
  "personalizationNote": "string"
}

Datos normalizados de Orbita:
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
      max_tokens: 900,
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
    "Sos la capa editorial de Orbita. Escribis en espanol rioplatense, con voseo, precision y guardrails estrictos.";
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
    header.subheadline = modules.energy ?? header.subheadline;
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
