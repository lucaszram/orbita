import {
  actionGeneric as action,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { extractNormalizedChartFromPayload } from "./lib/orbita";
import { findUserByTokenIdentifier, requireIdentity } from "./lib/users";

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

type VoidAnswerPayload = {
  question: string;
  answer: string;
  basadoEn: string[];
  mejorPregunta: string;
  paso: string;
};

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
    const existing = await ctx.db
      .query("voidAnswers")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", localDate))
      .first();

    return {
      userId: user._id,
      localDate,
      existing,
      natalChart
    };
  }
});

export const persistVoidAnswer = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    localDate: v.string(),
    question: v.string(),
    payload: v.any()
  },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);

    if (!user) {
      throw new Error("User record not found");
    }

    // Límite 1/día + carrera: si otra request ya guardó hoy, devolvemos esa.
    const existing = await ctx.db
      .query("voidAnswers")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .first();

    if (existing) {
      return existing.payload;
    }

    await ctx.db.insert("voidAnswers", {
      userId: user._id,
      localDate: args.localDate,
      question: args.question,
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

    // Límite 1/día: misma respuesta del día, sin re-generar.
    if (state.existing) {
      return state.existing.payload as VoidAnswerPayload;
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

    const stored: any = await ctx.runMutation(internalApi.void.persistVoidAnswer, {
      tokenIdentifier: identity.tokenIdentifier,
      localDate: state.localDate,
      question,
      payload
    });

    return (stored ?? payload) as VoidAnswerPayload;
  }
});
