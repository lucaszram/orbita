import {
  actionGeneric as action,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery,
  queryGeneric as query
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { extractNormalizedChartFromPayload } from "./lib/orbita";
import { resolveEntitlement, type SubscriptionRow } from "./lib/entitlements";
import { findCurrentUser, findUserByTokenIdentifier, requireIdentity } from "./lib/users";

/**
 * El Vacío (`void.ask`): responde la pregunta del usuario según su carta natal,
 * con capa editorial LLM (AI Gateway) y fallback determinístico derivado de la
 * carta. Límite 1/día por usuario: la fila `voidAnswers (userId, localDate)`
 * cachea la respuesta del día — si ya existe, se devuelve esa (no se re-genera).
 *
 * Guardrails duros (en el prompt): NUNCA sí/no; sin claims de destino/salud/
 * dinero/legal/psicología clínica; entretenimiento + autoconocimiento; voseo
 * rioplatense. `payload` = VoidAnswerPayload (contrato en src/services/appRefs.ts).
 */

const internalApi = internal as any;
const AI_GATEWAY_CHAT_COMPLETIONS_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";
const DEFAULT_QUESTION = "¿Qué estás apurando?";

// Cupo diario de preguntas por entitlement (como el "3 free" de Co-Star).
const LIMIT_FREE = 3;
const LIMIT_PRO = 5;

// Categorías de las preguntas sugeridas (mismo set que el fallback del front).
const PROMPT_CATEGORIES: { key: string; label: string; glyph: string }[] = [
  { key: "yo", label: "Yo", glyph: "☉" },
  { key: "amor", label: "Amor", glyph: "♀" },
  { key: "trabajo", label: "Trabajo", glyph: "♄" },
  { key: "vinculos", label: "Vínculos", glyph: "☍" }
];

type VoidAnswerPayload = {
  question: string;
  answer: string;
  basadoEn: string[];
  mejorPregunta: string;
  paso: string;
  /** Cupo diario restante después de esta pregunta. */
  remaining?: number;
  /** Cupo total del día (3 free / 5 pro). */
  limit?: number;
  /** true si ya no quedan preguntas hoy (no se generó respuesta). */
  locked?: boolean;
};

type VoidPromptCategory = { key: string; label: string; glyph: string; prompts: string[] };

type VoidPlacement = { key: string; label: string; signEs: string };

type VoidGenerated = { answer: string; mejorPregunta: string; paso: string };

// ---------------------------------------------------------------------------
// Carta → placements reales (Luna / Ascendente / Sol) para `basadoEn` y fallback
// ---------------------------------------------------------------------------

function chartPlacements(chartPayload: unknown): VoidPlacement[] {
  const chart = extractNormalizedChartFromPayload(chartPayload);
  const summary = chart?.summary;
  const items: VoidPlacement[] = [];
  const push = (placement: { key: string; label: string; signEs: string } | null | undefined) => {
    if (placement && typeof placement.signEs === "string" && placement.signEs.trim()) {
      items.push({ key: placement.key, label: placement.label, signEs: placement.signEs.trim() });
    }
  };
  push(summary?.moon);
  push(summary?.ascendant);
  push(summary?.sun);
  return items;
}

function buildBasadoEn(placements: VoidPlacement[]): string[] {
  if (placements.length === 0) {
    return ["TU CARTA TODAVÍA SE ESTÁ CALIBRANDO"];
  }
  return placements.map((placement) => `TU ${placement.label.toUpperCase()} EN ${placement.signEs.toUpperCase()}`);
}

// ---------------------------------------------------------------------------
// localDate desde la timezone del usuario (el ref del front es solo { question })
// ---------------------------------------------------------------------------

function localDateForTimezone(timezone?: string): string {
  const tz = timezone && timezone.trim() ? timezone.trim() : DEFAULT_TIMEZONE;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function normalizeQuestion(raw: string): string {
  const trimmed = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!trimmed) {
    return DEFAULT_QUESTION;
  }
  return trimmed.length > 280 ? `${trimmed.slice(0, 280).trim()}…` : trimmed;
}

// ---------------------------------------------------------------------------
// Capa LLM (AI Gateway) — transporte clonado del gateway + prompt/parser propios
// ---------------------------------------------------------------------------

const VOID_SYSTEM =
  "Sos El Vacío de Órbita, una capa editorial de entretenimiento y autoconocimiento. " +
  "Escribís en español rioplatense, con voseo, tildes y signos de apertura (¿? ¡!). " +
  "Nunca contestás sí o no: ordenás la pregunta y devolvés un marco para pensar.";

function buildVoidPrompt(args: { question: string; placements: VoidPlacement[] }): string {
  const placementLines = args.placements.length
    ? args.placements.map((placement) => `- ${placement.label} en ${placement.signEs}`).join("\n")
    : "- (carta en calibración; usá un marco general de autoconocimiento)";

  return `Una persona le pregunta al Vacío: "${args.question}".

Respondé desde su carta natal (placements reales):
${placementLines}

Reglas duras (no negociables):
- NUNCA contestes sí o no, ni des un veredicto cerrado. El Vacío ordena la pregunta, no la cierra.
- Producto de entretenimiento y autoconocimiento. No es predicción, ni consejo profesional.
- Guardrails: entretenimiento_y_autoconocimiento, no_determinismo, no_salud_dinero_legal_psicologia_como_consejo, no_copy_de_proveedor_astrologico.
- No hagas promesas ni advertencias de destino, salud, dinero, legal ni psicología clínica.
- Escribile a la persona en voseo: "vos", "te", "tenés", "estás". Tildes y signos de apertura siempre.
- Tono breve, editorial, cálido y concreto. Sin inglés visible.

Devolvé SOLO JSON válido con esta forma exacta:
{
  "answer": "string — 2 a 4 líneas cortas (separá con \\n), un marco para decidir, jamás sí/no",
  "mejorPregunta": "string — una sola pregunta, personal y mejor que la original (empezá con ¿)",
  "paso": "string — un paso concreto y seguro, en MAYÚSCULAS, empezando con \\"UN PASO · \\""
}`;
}

function stripJsonFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function looksLikeYesNo(value: string): boolean {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z]/g, "");
  return normalized === "si" || normalized === "no" || normalized === "sino" || normalized === "nosi";
}

function parseVoidAnswer(text: string): VoidGenerated | null {
  try {
    const parsed = JSON.parse(stripJsonFence(text)) as Record<string, unknown>;
    const answer = readString(parsed.answer);
    const mejorPregunta = readString(parsed.mejorPregunta);
    const paso = readString(parsed.paso);

    if (!answer || !mejorPregunta || !paso) {
      return null;
    }
    // Guardrail duro: si el modelo se escapó con un sí/no, descartamos al fallback.
    if (looksLikeYesNo(answer)) {
      return null;
    }
    return { answer, mejorPregunta, paso };
  } catch {
    return null;
  }
}

async function gatewayGenerateText(args: { apiKey: string; model: string; prompt: string; system: string }): Promise<string> {
  const response = await fetch(AI_GATEWAY_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      "X-Vercel-AI-App-Name": "Orbita Void"
    },
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
      stream: false,
      providerOptions: {
        gateway: {
          user: "app",
          tags: ["feature:orbita-void", "env:dev", "user:app"]
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
    throw new Error(`AI Gateway failed with ${response.status}: ${detail}`);
  }

  const choices = Array.isArray(json.choices) ? json.choices : [];
  const firstChoice = choices[0] && typeof choices[0] === "object" ? (choices[0] as Record<string, unknown>) : {};
  const message = firstChoice.message && typeof firstChoice.message === "object" ? (firstChoice.message as Record<string, unknown>) : {};
  return readString(message.content);
}

function fallbackVoidAnswer(args: { question: string; placements: VoidPlacement[] }): VoidGenerated {
  const moon = args.placements.find((placement) => placement.key === "moon");
  const ascendant = args.placements.find((placement) => placement.key === "ascendant");
  const anchor = moon ?? ascendant ?? args.placements[0];

  const answer = anchor
    ? `Esto no se contesta con un sí o un no.\nCon tu ${anchor.label} en ${anchor.signEs},\nlo que preguntás pide que primero\nle pongas nombre a lo que estás sintiendo.`
    : "Esto no se contesta con un sí o un no.\nLo que preguntás pide que primero\nle pongas nombre a lo que estás sintiendo.";

  return {
    answer,
    mejorPregunta: "¿Qué necesitás entender de vos antes de decidir esto?",
    paso: "UN PASO · ESCRIBÍ LA PREGUNTA EN UNA HOJA\nY LEELA EN VOZ ALTA ANTES DE MOVERTE"
  };
}

async function generateVoidAnswer(args: { question: string; placements: VoidPlacement[] }): Promise<VoidGenerated> {
  const enabled = process.env.ORBITA_LLM_ENABLED === "true";
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  const model = process.env.ORBITA_LLM_MODEL?.trim();

  if (!enabled || !apiKey || !model) {
    return fallbackVoidAnswer(args);
  }

  try {
    const text = await gatewayGenerateText({
      apiKey,
      model,
      prompt: buildVoidPrompt(args),
      system: VOID_SYSTEM
    });
    return parseVoidAnswer(text) ?? fallbackVoidAnswer(args);
  } catch {
    return fallbackVoidAnswer(args);
  }
}

// ---------------------------------------------------------------------------
// Preguntas sugeridas personalizadas (por categoría) — LLM + fallback estático
// ---------------------------------------------------------------------------

const FALLBACK_PROMPTS: Record<string, string[]> = {
  yo: [
    "¿Qué estoy evitando?",
    "¿Qué necesito soltar?",
    "¿Qué parte mía pide atención?",
    "¿Dónde me estoy escondiendo?",
    "¿Qué me estoy exigiendo de más?",
    "¿Qué sé y hago como si no lo supiera?"
  ],
  amor: [
    "¿Qué patrón repito en el amor?",
    "¿Qué busco afuera que no me doy?",
    "¿Qué me cuesta pedir?",
    "¿De qué me estoy protegiendo?",
    "¿Qué confundo con amor?",
    "¿Qué necesito decir y me callo?"
  ],
  trabajo: [
    "¿Qué estoy postergando?",
    "¿Qué me está pidiendo foco?",
    "¿Qué dejé a medias?",
    "¿Qué me da miedo empezar?",
    "¿Qué estoy haciendo por inercia?",
    "¿Qué me cuesta delegar?"
  ],
  vinculos: [
    "¿Qué conversación estoy esquivando?",
    "¿A quién necesito escuchar?",
    "¿Qué límite me falta poner?",
    "¿Qué vínculo estoy descuidando?",
    "¿A quién le debo una respuesta?",
    "¿Con quién estoy midiendo de más?"
  ]
};

function fallbackSuggestedQuestions(): VoidPromptCategory[] {
  return PROMPT_CATEGORIES.map((c) => ({ ...c, prompts: FALLBACK_PROMPTS[c.key] ?? [] }));
}

function buildSuggestedPrompt(placements: VoidPlacement[]): string {
  const placementLines = placements.length
    ? placements.map((placement) => `- ${placement.label} en ${placement.signEs}`).join("\n")
    : "- (carta en calibración; usá un marco general de autoconocimiento)";

  return `Generá preguntas para "El Vacío" de Órbita, personalizadas a esta carta natal:
${placementLines}

Son preguntas que la persona se hace a sí misma para conocerse (no se las contesta nadie). Cuatro categorías: yo, amor, trabajo, vinculos. Exactamente 6 preguntas por categoría.

Reglas duras (no negociables):
- Cada pregunta empieza con "¿" y termina con "?". Personal, en voseo ("¿Qué estás…?", "¿Qué te…?"), autoconocimiento.
- Neutras de género (no uses adjetivos con género).
- Entretenimiento y autoconocimiento. Nada de destino, salud, dinero, legal ni psicología clínica. Sin predicciones. Sin inglés.
- Cortas (máx ~9 palabras). Que resuenen con los placements de arriba sin nombrarlos literalmente.

Devolvé SOLO JSON válido con esta forma exacta:
{ "yo": ["…"], "amor": ["…"], "trabajo": ["…"], "vinculos": ["…"] }`;
}

function parseSuggestedQuestions(text: string): VoidPromptCategory[] | null {
  try {
    const parsed = JSON.parse(stripJsonFence(text)) as Record<string, unknown>;
    const categories = PROMPT_CATEGORIES.map((c) => {
      const raw = Array.isArray(parsed[c.key]) ? (parsed[c.key] as unknown[]) : [];
      const prompts = raw
        .map((q) => readString(q))
        .filter((q) => q.length > 0 && q.includes("?"))
        .slice(0, 6);
      return { ...c, prompts };
    });
    // Si alguna categoría quedó vacía, no confiamos en la respuesta.
    if (categories.some((c) => c.prompts.length === 0)) {
      return null;
    }
    return categories;
  } catch {
    return null;
  }
}

async function generateSuggestedQuestions(placements: VoidPlacement[]): Promise<VoidPromptCategory[]> {
  const enabled = process.env.ORBITA_LLM_ENABLED === "true";
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  const model = process.env.ORBITA_LLM_MODEL?.trim();

  if (!enabled || !apiKey || !model) {
    return fallbackSuggestedQuestions();
  }

  try {
    const text = await gatewayGenerateText({
      apiKey,
      model,
      prompt: buildSuggestedPrompt(placements),
      system: VOID_SYSTEM
    });
    return parseSuggestedQuestions(text) ?? fallbackSuggestedQuestions();
  } catch {
    return fallbackSuggestedQuestions();
  }
}

// ---------------------------------------------------------------------------
// Data layer (las actions no tocan ctx.db: van por internalQuery/internalMutation)
// ---------------------------------------------------------------------------

export const getVoidState = internalQuery({
  args: {
    tokenIdentifier: v.string()
  },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);

    if (!user) {
      throw new Error("User record not found");
    }

    const birthData = await ctx.db
      .query("birthData")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .first();
    const natalChart = await ctx.db
      .query("natalCharts")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .first();
    const localDate = localDateForTimezone(birthData?.timezone);
    const answersToday = await ctx.db
      .query("voidAnswers")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", localDate))
      .collect();
    const promptSet = await ctx.db
      .query("voidPromptSets")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", localDate))
      .first();
    const subscriptions = (await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect()) as SubscriptionRow[];
    const { isPro } = resolveEntitlement(subscriptions, Date.now());

    return {
      userId: user._id,
      localDate,
      usedToday: answersToday.length,
      isPro,
      promptSet,
      natalChart
    };
  }
});

export const persistVoidAnswer = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    localDate: v.string(),
    question: v.string(),
    payload: v.any(),
    limit: v.number()
  },
  handler: async (ctx, args): Promise<{ inserted: boolean; usedAfter: number }> => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);

    if (!user) {
      throw new Error("User record not found");
    }

    // Cupo N/día + carrera: re-contamos acá; si ya se llenó, no insertamos.
    const answersToday = await ctx.db
      .query("voidAnswers")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .collect();

    if (answersToday.length >= args.limit) {
      return { inserted: false, usedAfter: answersToday.length };
    }

    await ctx.db.insert("voidAnswers", {
      userId: user._id,
      localDate: args.localDate,
      question: args.question,
      payload: args.payload,
      createdAt: Date.now()
    });

    return { inserted: true, usedAfter: answersToday.length + 1 };
  }
});

export const persistPromptSet = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    localDate: v.string(),
    payload: v.any()
  },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);

    if (!user) {
      throw new Error("User record not found");
    }

    const existing = await ctx.db
      .query("voidPromptSets")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .first();

    if (existing) {
      return existing.payload;
    }

    await ctx.db.insert("voidPromptSets", {
      userId: user._id,
      localDate: args.localDate,
      payload: args.payload,
      createdAt: Date.now()
    });

    return args.payload;
  }
});

// ---------------------------------------------------------------------------
// Action pública
// ---------------------------------------------------------------------------

export const ask = action({
  args: {
    question: v.string()
  },
  handler: async (ctx, args): Promise<VoidAnswerPayload> => {
    const identity = await requireIdentity(ctx as any);
    const question = normalizeQuestion(args.question);

    const state: any = await ctx.runQuery(internalApi.void.getVoidState, {
      tokenIdentifier: identity.tokenIdentifier
    });

    const limit = state.isPro ? LIMIT_PRO : LIMIT_FREE;

    // Cupo agotado: no genera, no consume; el front muestra el estado de límite.
    if (state.usedToday >= limit) {
      return { question, answer: "", basadoEn: [], mejorPregunta: "", paso: "", locked: true, limit, remaining: 0 };
    }

    const placements = chartPlacements(state.natalChart?.payload);
    const generated = await generateVoidAnswer({ question, placements });
    const payload: VoidAnswerPayload = {
      question,
      answer: generated.answer,
      basadoEn: buildBasadoEn(placements),
      mejorPregunta: generated.mejorPregunta,
      paso: generated.paso
    };

    const result: any = await ctx.runMutation(internalApi.void.persistVoidAnswer, {
      tokenIdentifier: identity.tokenIdentifier,
      localDate: state.localDate,
      question,
      payload,
      limit
    });

    // Carrera: se llenó el cupo entre el chequeo y la escritura.
    if (!result.inserted) {
      return { question, answer: "", basadoEn: [], mejorPregunta: "", paso: "", locked: true, limit, remaining: 0 };
    }

    return { ...payload, limit, remaining: Math.max(0, limit - result.usedAfter) };
  }
});

// Estado del cupo del día (reactivo) para el contador del front.
export const today = query({
  args: {},
  returns: v.object({
    limit: v.number(),
    used: v.number(),
    remaining: v.number(),
    isPro: v.boolean()
  }),
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) {
      return { limit: LIMIT_FREE, used: 0, remaining: LIMIT_FREE, isPro: false };
    }
    const birthData = await ctx.db
      .query("birthData")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .first();
    const localDate = localDateForTimezone(birthData?.timezone);
    const answersToday = await ctx.db
      .query("voidAnswers")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", localDate))
      .collect();
    const subscriptions = (await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect()) as SubscriptionRow[];
    const { isPro } = resolveEntitlement(subscriptions, Date.now());
    const limit = isPro ? LIMIT_PRO : LIMIT_FREE;
    const used = answersToday.length;
    return { limit, used, remaining: Math.max(0, limit - used), isPro };
  }
});

// Preguntas sugeridas personalizadas por categoría (cache 1 set/día).
export const suggestedQuestions = action({
  args: {},
  handler: async (ctx): Promise<{ categories: VoidPromptCategory[] }> => {
    const identity = await requireIdentity(ctx as any);
    const state: any = await ctx.runQuery(internalApi.void.getVoidState, {
      tokenIdentifier: identity.tokenIdentifier
    });

    if (state.promptSet?.payload?.categories) {
      return { categories: state.promptSet.payload.categories as VoidPromptCategory[] };
    }

    const placements = chartPlacements(state.natalChart?.payload);
    const categories = await generateSuggestedQuestions(placements);

    const stored: any = await ctx.runMutation(internalApi.void.persistPromptSet, {
      tokenIdentifier: identity.tokenIdentifier,
      localDate: state.localDate,
      payload: { categories }
    });

    return { categories: (stored?.categories ?? categories) as VoidPromptCategory[] };
  }
});
