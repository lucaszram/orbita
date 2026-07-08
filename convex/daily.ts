import {
  actionGeneric as action,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { runAstrologyApiDailyTransits } from "./lib/astrologyApi";
import {
  extractNormalizedChartFromPayload,
  selectRelevantTransits,
  type NormalizedAstroTransit
} from "./lib/orbita";
import { findUserByTokenIdentifier, requireIdentity } from "./lib/users";

/**
 * Guía diaria personalizada: análisis del día para CADA usuario, calculado sobre los
 * aspectos tránsito→carta natal (los trae el proveedor) e interpretado con LLM en voz
 * Órbita. Cache 1 por (userId, localDate). Fallback determinístico sin LLM/proveedor.
 * Ver `docs/guia-diaria-personalizada.md`.
 */

const internalApi = internal as any;
const AI_GATEWAY_CHAT_COMPLETIONS_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";

type DailyGuidePayload = {
  headline: string;
  body: string;
  clima: string;
  destacado: { aspecto: string; lectura: string };
  secundarios: Array<{ aspecto: string; lectura: string }>;
  basadoEn: string[];
  disclaimer: string;
};

type DailyGenerated = { headline: string; body: string; clima: string; destacadoLectura: string };

const DISCLAIMER = "Entretenimiento y autoconocimiento. No es predicción ni consejo profesional.";

function localDateForTimezone(timezone?: string): string {
  const tz = timezone && timezone.trim() ? timezone.trim() : DEFAULT_TIMEZONE;
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date()
    );
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// --- Aspecto tránsito→natal en texto legible -------------------------------

function aspectLine(t: NormalizedAstroTransit): string {
  const sign = t.transitSignEs ? ` en ${t.transitSignEs}` : "";
  const house = t.natalHouse ? ` (casa ${t.natalHouse})` : "";
  return `${t.transitPlanetEs}${sign} ${t.aspectTypeEs} tu ${t.natalPointEs}${house}`;
}

function natalContext(chartPayload: unknown): string[] {
  const chart = extractNormalizedChartFromPayload(chartPayload);
  const s = chart?.summary;
  const lines: string[] = [];
  const push = (p: { label: string; signEs: string } | null | undefined) => {
    if (p && typeof p.signEs === "string" && p.signEs.trim()) lines.push(`${p.label} en ${p.signEs.trim()}`);
  };
  push(s?.sun);
  push(s?.moon);
  push(s?.ascendant);
  return lines;
}

// --- Capa LLM (gateway clonado, prompt/parser propios) ----------------------

const DAILY_SYSTEM =
  "Sos la guía diaria de Órbita: análisis astrológico de entretenimiento y autoconocimiento. " +
  "Escribís en español rioplatense, voseo, con tildes y signos de apertura (¿? ¡!). " +
  "Analizás el cielo de hoy sobre la carta natal de la persona y lo explicás claro, sin jerga ni misterio vacío.";

function buildDailyPrompt(args: { natal: string[]; transits: NormalizedAstroTransit[] }): string {
  const natalLines = args.natal.length ? args.natal.map((l) => `- ${l}`).join("\n") : "- (carta en calibración)";
  const transitLines = args.transits.length
    ? args.transits.map((t, i) => `${i + 1}. ${aspectLine(t)}`).join("\n")
    : "- (sin tránsitos destacados hoy)";

  return `Carta natal de la persona (puntos base):
${natalLines}

Aspectos del cielo de HOY sobre su carta (el 1 es el destacado; los demás matizan):
${transitLines}

Escribí la guía del día ANALIZANDO esos aspectos: qué está tocando hoy su carta y qué significa para su día. Descriptivo, claro, en criollo — nombrando el tránsito real (ej. "Venus pasa por tu Sol"). NADA de frases genéricas sin contexto.

Reglas duras (no negociables):
- Entretenimiento y autoconocimiento. NO es predicción ni consejo de salud/dinero/legal/psicología. Sin promesas de destino.
- Voseo ("vos", "te", "tenés", "estás"). Tildes y signos de apertura. Sin inglés visible.
- Tono breve y concreto. El "por qué" sale de los aspectos de arriba.

Devolvé SOLO JSON válido con esta forma exacta:
{
  "headline": "string — 4 a 6 palabras, nombra el tránsito destacado (ej. \\"Venus pasa por tu Sol\\")",
  "body": "string — 2 a 4 frases: el análisis del día desde los aspectos reales",
  "clima": "string — una línea corta de clima del día",
  "destacadoLectura": "string — 1 frase sobre el tránsito destacado (el aspecto 1)"
}`;
}

function stripJsonFence(value: string): string {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseDaily(text: string): DailyGenerated | null {
  try {
    const parsed = JSON.parse(stripJsonFence(text)) as Record<string, unknown>;
    const headline = readString(parsed.headline);
    const body = readString(parsed.body);
    const clima = readString(parsed.clima);
    const destacadoLectura = readString(parsed.destacadoLectura);
    if (!headline || !body || !clima) return null;
    return { headline, body, clima, destacadoLectura: destacadoLectura || body };
  } catch {
    return null;
  }
}

async function gatewayGenerateText(args: { apiKey: string; model: string; prompt: string }): Promise<string> {
  const response = await fetch(AI_GATEWAY_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      "X-Vercel-AI-App-Name": "Orbita Daily"
    },
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: "system", content: DAILY_SYSTEM },
        { role: "user", content: args.prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
      stream: false,
      providerOptions: { gateway: { user: "app", tags: ["feature:orbita-daily", "env:dev", "user:app"] } }
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
    throw new Error(`AI Gateway failed with ${response.status}: ${JSON.stringify(json).slice(0, 400)}`);
  }
  const choices = Array.isArray(json.choices) ? json.choices : [];
  const first = choices[0] && typeof choices[0] === "object" ? (choices[0] as Record<string, unknown>) : {};
  const message = first.message && typeof first.message === "object" ? (first.message as Record<string, unknown>) : {};
  return readString(message.content);
}

function fallbackDaily(args: { natal: string[]; transits: NormalizedAstroTransit[] }): DailyGenerated {
  const top = args.transits[0];
  if (top) {
    const line = aspectLine(top);
    return {
      headline: `${top.transitPlanetEs} toca tu ${top.natalPointEs}`,
      body: `Hoy ${line}. Es el movimiento del día sobre tu carta: prestale atención a esa área, sin forzar conclusiones.`,
      clima: "Un día para observar antes de decidir.",
      destacadoLectura: `Hoy ${line}.`
    };
  }
  return {
    headline: "Un día tranquilo en tu cielo",
    body: "Hoy no hay tránsitos fuertes sobre tu carta. Buen momento para sostener lo que ya venís haciendo, sin apurar nada nuevo.",
    clima: "Estable.",
    destacadoLectura: "Sin tránsitos destacados hoy."
  };
}

async function generateDaily(args: { natal: string[]; transits: NormalizedAstroTransit[] }): Promise<DailyGenerated> {
  const enabled = process.env.ORBITA_LLM_ENABLED === "true";
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  const model = process.env.ORBITA_LLM_MODEL?.trim();
  if (!enabled || !apiKey || !model) return fallbackDaily(args);
  try {
    const text = await gatewayGenerateText({ apiKey, model, prompt: buildDailyPrompt(args) });
    return parseDaily(text) ?? fallbackDaily(args);
  } catch {
    return fallbackDaily(args);
  }
}

function composePayload(args: {
  generated: DailyGenerated;
  transits: NormalizedAstroTransit[];
}): DailyGuidePayload {
  const [top, ...rest] = args.transits;
  return {
    headline: args.generated.headline,
    body: args.generated.body,
    clima: args.generated.clima,
    destacado: { aspecto: top ? aspectLine(top) : "Sin tránsito destacado", lectura: args.generated.destacadoLectura },
    secundarios: rest.slice(0, 3).map((t) => ({ aspecto: aspectLine(t), lectura: "" })),
    basadoEn: args.transits.slice(0, 3).map((t) => aspectLine(t).toUpperCase()),
    disclaimer: DISCLAIMER
  };
}

// --- Data layer ------------------------------------------------------------

export const getGuideState = internalQuery({
  args: { tokenIdentifier: v.string(), localDate: v.string() },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) throw new Error("User record not found");

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
    const existing = await ctx.db
      .query("dailyGuides")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .first();

    return { userId: user._id, birthData, natalChart, existing };
  }
});

export const persistGuide = internalMutation({
  args: { tokenIdentifier: v.string(), localDate: v.string(), payload: v.any() },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) throw new Error("User record not found");

    const existing = await ctx.db
      .query("dailyGuides")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .first();
    if (existing) return existing.payload;

    await ctx.db.insert("dailyGuides", {
      userId: user._id,
      localDate: args.localDate,
      payload: args.payload,
      createdAt: Date.now()
    });
    return args.payload;
  }
});

// --- Action pública --------------------------------------------------------

export const getGuide = action({
  args: { localDate: v.optional(v.string()), timezone: v.optional(v.string()) },
  handler: async (ctx, args): Promise<DailyGuidePayload> => {
    const identity = await requireIdentity(ctx as any);
    const stateForDate: any = await ctx.runQuery(internalApi.daily.getGuideState, {
      tokenIdentifier: identity.tokenIdentifier,
      localDate: args.localDate ?? "" // se recomputa abajo con la tz real si hace falta
    });
    const timezone = args.timezone ?? stateForDate.birthData?.timezone ?? DEFAULT_TIMEZONE;
    const localDate = args.localDate ?? localDateForTimezone(timezone);

    const state: any = args.localDate
      ? stateForDate
      : await ctx.runQuery(internalApi.daily.getGuideState, { tokenIdentifier: identity.tokenIdentifier, localDate });

    if (state.existing) return state.existing.payload as DailyGuidePayload;

    const natal = natalContext(state.natalChart?.payload);

    // Traer los tránsitos del día (mismo proveedor que transits.getToday).
    let transits: NormalizedAstroTransit[] = [];
    if (state.birthData) {
      const bd = state.birthData;
      const providerResult = await runAstrologyApiDailyTransits({
        input: {
          birthDate: bd.birthDate,
          birthTime: bd.birthTime,
          birthTimePrecision: bd.birthTimePrecision,
          birthPlaceLabel: bd.birthPlaceLabel,
          latitude: bd.latitude,
          longitude: bd.longitude,
          timezone: bd.timezone
        },
        localDate
      });
      if (providerResult.status === "success" && providerResult.normalized) {
        transits = selectRelevantTransits(providerResult.normalized.transits, 4);
      }
    }

    const generated = await generateDaily({ natal, transits });
    const payload = composePayload({ generated, transits });

    const stored: any = await ctx.runMutation(internalApi.daily.persistGuide, {
      tokenIdentifier: identity.tokenIdentifier,
      localDate,
      payload
    });
    return (stored ?? payload) as DailyGuidePayload;
  }
});
