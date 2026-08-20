import {
  actionGeneric as action,
  internalActionGeneric as internalAction,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery,
  queryGeneric as query
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  generateNatalReadingWithGateway,
  getAiGatewayNatalCacheVersion,
  getAiGatewayNatalPromptVersion
} from "./lib/aiGateway";
import { runAstrologyApiNatalChart } from "./lib/astrologyApi";
import {
  buildBirthDataHash,
  buildNatalChartCacheKey,
  findCurrentBirthData,
  findCurrentNatalChart,
  findExactNatalChart
} from "./lib/birthDataConsistency";
import { storedNatalChartIsSufficient } from "./lib/natalGeometry";
import { natalPayloadRevision, natalStampMatches } from "./lib/natalRevision";
import {
  ASTROLOGY_API_CHART_CALCULATION_VERSION,
  buildWebB0ValuesMapPayload
} from "./lib/orbita";
import { buildPublicNatalChartDocument } from "./lib/publicNatalChart";
import { isUserPro } from "./lib/subscriptionAccess";
import { findCurrentUser, findUserByTokenIdentifier, requireIdentity } from "./lib/users";

const internalApi = internal as any;

async function getCurrentChart(ctx: any, userId: string) {
  // Sin datos vigentes no existe una carta personal vigente. Con datos
  // cambiados, estado vacío hasta que aparezca el cache exacto.
  return await findCurrentNatalChart(ctx, userId);
}

export const current = query({
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return null;
    const chart = await getCurrentChart(ctx, user._id);
    if (!chart) return null;
    return buildPublicNatalChartDocument(chart, await isUserPro(ctx, user._id));
  }
});

export const valuesMap = query({
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return null;
    if (!(await isUserPro(ctx, user._id))) return null;
    const chart = await getCurrentChart(ctx, user._id);

    return chart ? buildWebB0ValuesMapPayload(chart.payload) : null;
  }
});

const NATAL_READING_FEATURE = "personality";
const NATAL_READING_LEASE_MS = 90 * 1000;

async function getCachedPersonalityReading(ctx: any, natalChartId: string) {
  const promptVersion = getAiGatewayNatalPromptVersion();
  return await ctx.db
    .query("natalInterpretations")
    .withIndex("by_chart_feature_version", (q: any) =>
      q.eq("natalChartId", natalChartId).eq("feature", NATAL_READING_FEATURE).eq("promptVersion", promptVersion)
    )
    .first();
}

type PersonalityReadingCache = {
  status?: string;
  payload?: unknown;
  updatedAt?: number;
  /** Revisión del payload natal con el que se generó. Ausente en filas legadas. */
  chartRevision?: string;
  /** Versión de caché con la que se generó (`ORBITA_LLM_NATAL_CACHE_VERSION`). */
  cacheVersion?: string;
  /** Número del claim que la escribió, para el CAS de la persistencia final. */
  claimSeq?: number;
} | null | undefined;

export type NatalGenerationClaim = "ready" | "pending" | "claim";
export type NatalReadingPublicStatus = "pending" | "ready" | "error";

/**
 * Lo que una fila guardada tiene que poder demostrar para valer como la lectura
 * de AHORA. Son dos marcas, y las dos son necesarias.
 *
 * - **`chartRevision`** — la identidad del payload natal. `natalChartId`
 *   sobrevive a una mejora: cuando el proveedor por fin entrega las casas y los
 *   ejes que faltaban, la fila natal se reescribe sobre el MISMO `_id`, así que
 *   una lectura escrita sobre la carta parcial seguía pasando como cache hit
 *   sobre la carta completa.
 * - **`cacheVersion`** — la versión de caché configurada
 *   (`ORBITA_LLM_NATAL_CACHE_VERSION`). Se persistía en cada fila y **no la
 *   miraba nadie**: ni la lectura pública, ni el estado, ni el claim. Un bump
 *   v1 → v2 con el mismo `promptVersion` dejaba la fila v1 `ready` para
 *   siempre, así que la palanca que existe para invalidar el texto generado no
 *   invalidaba nada.
 *
 * Una fila que no puede demostrar las dos se trata como **no verificada**: no se
 * publica, no frena una generación nueva y se regenera.
 */
export type NatalReadingExpectation = {
  chartRevision: string | null | undefined;
  cacheVersion: string | null | undefined;
};

/** La expectativa vigente de una carta: su revisión y la versión configurada. */
export function natalReadingExpectation(chartPayload: unknown): NatalReadingExpectation {
  return {
    chartRevision: natalPayloadRevision(chartPayload),
    cacheVersion: getAiGatewayNatalCacheVersion()
  };
}

/** ¿Esta fila demuestra que describe la carta Y la versión de ahora? */
export function natalReadingIsVerified(
  cached: PersonalityReadingCache,
  expected: NatalReadingExpectation
): boolean {
  return (
    natalStampMatches(cached?.chartRevision, expected.chartRevision) &&
    natalStampMatches(cached?.cacheVersion, expected.cacheVersion)
  );
}

/** Una fila que no puede demostrar su carta ni su versión no es cache de nada. */
function verifiedCache(
  cached: PersonalityReadingCache,
  expected: NatalReadingExpectation
): PersonalityReadingCache {
  return natalReadingIsVerified(cached, expected) ? cached : null;
}

/**
 * Una mutation serializada usa esta decisión para que el cliente y el prewarm
 * no disparen dos lecturas largas a la vez. Un pending viejo se puede retomar.
 *
 * `expected` es la identidad vigente —revisión del payload natal y versión de
 * caché—: una fila `ready` —o un `pending` con lease vivo— que no la demuestra
 * no frena nada, porque su texto ya no describe la carta que la pantalla está
 * mostrando, o se generó con una versión que ya se retiró.
 */
export function resolveNatalGenerationClaim(
  cached: PersonalityReadingCache,
  now: number,
  expected: NatalReadingExpectation,
  leaseMs = NATAL_READING_LEASE_MS
): NatalGenerationClaim {
  const verified = verifiedCache(cached, expected);
  if (verified?.status === "ready" && verified.payload) return "ready";
  if (
    verified?.status === "pending" &&
    typeof verified.updatedAt === "number" &&
    now - verified.updatedAt < leaseMs
  ) {
    return "pending";
  }
  return "claim";
}

/**
 * Estado mínimo para que el bloque de lectura nunca quede cargando a ciegas.
 *
 * Una fila de otra revisión —o de otra versión de caché— se ignora entera: no
 * es `ready` —su texto no describe esta carta, o se generó con una versión que
 * ya se retiró— y tampoco es `error`, porque lo que corresponde es regenerarla.
 * Se declara `pending`, que es lo que de verdad está pasando.
 */
export function resolveNatalReadingPublicStatus(
  cached: PersonalityReadingCache,
  now: number,
  expected: NatalReadingExpectation,
  leaseMs = NATAL_READING_LEASE_MS
): NatalReadingPublicStatus {
  const verified = verifiedCache(cached, expected);
  if (verified?.status === "ready" && verified.payload) return "ready";
  if (verified?.status === "error" || verified?.status === "fallback") return "error";
  if (
    verified?.status === "pending" &&
    typeof verified.updatedAt === "number" &&
    now - verified.updatedAt >= leaseMs
  ) {
    return "error";
  }
  return "pending";
}

/**
 * Solo una lectura LLM completa, persistida, **de esta carta** y **de esta
 * versión** se muestra.
 *
 * Las dos marcas son obligatorias acá: sin la revisión se publicaría texto
 * generado sobre una carta sin Ascendente ni casas al lado de una rueda que ya
 * las tiene; sin la versión, un bump de `ORBITA_LLM_NATAL_CACHE_VERSION` no
 * retiraría nunca el texto que ese bump existe para retirar.
 */
export function resolveReadyPersonalityReading(
  cached: PersonalityReadingCache,
  expected: NatalReadingExpectation
) {
  const verified = verifiedCache(cached, expected);
  return verified?.status === "ready" && verified.payload ? verified.payload : null;
}

type NatalGenerationResult = {
  status: string;
  payload?: unknown;
  [key: string]: unknown;
};

/** Convierte cualquier fallo del generador en un rechazo recuperable para el cliente. */
export function requireSuccessfulNatalReading(result: NatalGenerationResult) {
  if (result.status !== "success" || !result.payload) {
    throw new Error("NATAL_READING_GENERATION_FAILED");
  }
  return result.payload;
}

export const personalityReading = query({
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return null;
    if (!(await isUserPro(ctx, user._id))) return null;
    const chart = await getCurrentChart(ctx, user._id);
    if (!chart) return null;

    const cached = await getCachedPersonalityReading(ctx, chart._id);
    return resolveReadyPersonalityReading(cached, natalReadingExpectation(chart.payload));
  }
});

export const personalityReadingState = query({
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return { status: "pending" as const };
    if (!(await isUserPro(ctx, user._id))) {
      return { status: "locked" as const };
    }
    const chart = await getCurrentChart(ctx, user._id);
    if (!chart) return { status: "pending" as const };
    const cached = await getCachedPersonalityReading(ctx, chart._id);
    return {
      status: resolveNatalReadingPublicStatus(cached, Date.now(), natalReadingExpectation(chart.payload))
    };
  }
});

export const getNatalReadingState = internalQuery({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) {
      throw new Error("User record not found");
    }
    const chart = await getCurrentChart(ctx, user._id);
    if (!chart) {
      return {
        userId: user._id,
        chartId: null,
        chartPayload: null,
        cachedStatus: null,
        isPro: await isUserPro(ctx, user._id)
      };
    }
    const cached = await getCachedPersonalityReading(ctx, chart._id);
    return {
      userId: user._id,
      chartId: chart._id,
      chartPayload: chart.payload,
      // La revisión viaja con el payload: la generación tiene que poder decir
      // sobre QUÉ carta escribió, y el CAS final tiene que poder compararlo.
      chartRevision: natalPayloadRevision(chart.payload),
      cachedStatus: cached?.status ?? null,
      isPro: await isUserPro(ctx, user._id)
    };
  }
});

export const getNatalReadingStateByChart = internalQuery({
  args: { natalChartId: v.id("natalCharts") },
  handler: async (ctx, args) => {
    const chart = await ctx.db.get(args.natalChartId);
    if (!chart) return null;
    const cached = await getCachedPersonalityReading(ctx, chart._id);
    return {
      userId: chart.userId,
      chartId: chart._id,
      chartPayload: chart.payload,
      chartRevision: natalPayloadRevision(chart.payload),
      cachedStatus: cached?.status ?? null,
      isPro: await isUserPro(ctx, chart.userId)
    };
  }
});

/**
 * Toma —o rechaza— el turno de generar la lectura larga de ESTA revisión.
 *
 * Devuelve un objeto y no una cadena porque el turno tiene identidad: el
 * `claimSeq` es monótono por fila y es la mitad del CAS con el que
 * `persistNatalReading` decide si esta generación todavía puede escribir. Una
 * generación que perdió el lease —porque venció y otra lo tomó— se queda con un
 * número viejo y ya no puede pisar a la nueva.
 */
export type NatalReadingClaimResult =
  | { decision: "claimed"; claimSeq: number }
  | { decision: NatalReadingClaimRejection };

/**
 * Por qué un claim no se toma. Ninguna es un error visible ni un cache hit: las
 * cuatro son estados internos del ciclo de generación.
 *
 * - `ready` / `pending` — la lectura vigente ya existe, o alguien la está
 *   generando con el lease vivo.
 * - `stale_chart` — la carta cambió entre la lectura del estado y este turno.
 * - `stale_cache_version` — quien pide el turno viene de una versión de caché
 *   que ya no es la configurada. No toca nada: ver la barrera de
 *   `applyNatalReadingClaim`.
 */
export type NatalReadingClaimRejection = "ready" | "pending" | "stale_chart" | "stale_cache_version";

/**
 * El cuerpo del claim, exportado para poder probar la carrera real contra una
 * base en memoria: una generación vieja que vuelve después de una mejora, un
 * claim que perdió el lease, y un claimant que llega con una versión de caché
 * que ya se retiró.
 *
 * La primera barrera es la versión, y está antes de leer o escribir la fila
 * (ver el comentario del `if`): un claimant atrasado no puede destruir la
 * lectura vigente sólo porque la mide contra su propia versión.
 */
export async function applyNatalReadingClaim(
  ctx: any,
  args: {
    userId: any;
    natalChartId: any;
    locale: string;
    promptVersion: string;
    cacheVersion: string;
    chartRevision: string;
  }
): Promise<NatalReadingClaimResult> {
  // ANTES de mirar —o tocar— `natalInterpretations`: quien pide el turno tiene
  // que venir de la versión de caché que la configuración pide AHORA.
  //
  // El CAS final ya compara las dos versiones, pero llega tarde: un claimant de
  // v1 que arranca su action antes del bump y aterriza acá con la configuración
  // ya en v2 vería la fila v2 como "de otra versión" —porque la mide contra SU
  // v1—, la tomaría, incrementaría `claimSeq` y dejaría `pending` v1 con el
  // payload en null. Una lectura v2 `ready` se perdería, y una generación v2 en
  // vuelo perdería su claim para nada: su escritura terminaría en `claim_lost`
  // y la del claimant viejo en `cache_version_changed`.
  //
  // Con la barrera acá, el claimant atrasado no toma turno, no incrementa nada,
  // no cambia status ni payload y no programa ninguna generación. Es un no-op
  // estable: superseded, ni error ni cache hit.
  if (args.cacheVersion !== getAiGatewayNatalCacheVersion()) {
    return { decision: "stale_cache_version" as const };
  }
  const now = Date.now();
  const chart = await ctx.db.get(args.natalChartId);
  // La carta pudo mejorar entre la lectura del estado y este turno: generar
  // sobre un payload que ya no existe sería escribir texto nacido viejo.
  if (!chart || natalPayloadRevision(chart.payload) !== args.chartRevision) {
    return { decision: "stale_chart" as const };
  }
  const existing = await ctx.db
    .query("natalInterpretations")
    .withIndex("by_chart_feature_version", (q: any) =>
      q
        .eq("natalChartId", args.natalChartId)
        .eq("feature", NATAL_READING_FEATURE)
        .eq("promptVersion", args.promptVersion)
    )
    .first();
  const decision = resolveNatalGenerationClaim(existing, now, {
    chartRevision: args.chartRevision,
    cacheVersion: args.cacheVersion
  });
  if (decision !== "claim") return { decision };

  const claimSeq = (typeof existing?.claimSeq === "number" ? existing.claimSeq : 0) + 1;
  const fields = {
    userId: args.userId,
    natalChartId: args.natalChartId,
    feature: NATAL_READING_FEATURE,
    locale: args.locale,
    promptVersion: args.promptVersion,
    cacheVersion: args.cacheVersion,
    provider: "vercel-ai-gateway",
    status: "pending" as const,
    payload: null,
    chartRevision: args.chartRevision,
    claimSeq,
    updatedAt: now
  };
  if (existing) {
    await ctx.db.patch(existing._id, fields);
  } else {
    await ctx.db.insert("natalInterpretations", { ...fields, createdAt: now });
  }
  return { decision: "claimed" as const, claimSeq };
}

export const claimNatalReadingGeneration = internalMutation({
  args: {
    userId: v.id("users"),
    natalChartId: v.id("natalCharts"),
    locale: v.string(),
    promptVersion: v.string(),
    cacheVersion: v.string(),
    /** Revisión del payload natal con el que se va a generar. */
    chartRevision: v.string()
  },
  handler: async (ctx, args) => await applyNatalReadingClaim(ctx, args)
});

/** Por qué una generación no llegó a escribir. Ninguna es un error del usuario. */
export type NatalReadingWriteRejection =
  /** La carta mejoró mientras se generaba: este texto nació viejo. */
  | "chart_revision_changed"
  /** Otro claim reemplazó a éste: el lease venció y alguien más lo tomó. */
  | "claim_lost"
  /** La versión de caché se movió: este texto pertenece a la versión anterior. */
  | "cache_version_changed";

export type NatalReadingWriteResult =
  | { applied: true; id: unknown }
  | { applied: false; reason: NatalReadingWriteRejection };

/**
 * ¿Esta generación todavía puede escribir?
 *
 * Es el CAS de la lectura larga, escrito como tabla para poder probarlo entero.
 * Tres condiciones, las tres necesarias:
 *
 * 1. **La carta sigue en la revisión con la que se generó.** Una mejora del
 *    payload natal —el proveedor entrega por fin las casas— reescribe la fila
 *    sobre el mismo `_id`; el texto que arrancó sobre la carta parcial ya no la
 *    describe y no puede quedar como estado nuevo.
 * 2. **El claim sigue siendo el vigente.** Si el lease venció y otra generación
 *    tomó el turno, la vieja perdió: escribir ahora pisaría una lectura que sí
 *    corresponde. Es también el caso de la fila que ya no está.
 * 3. **La versión de caché configurada sigue siendo la de este texto.** Un bump
 *    de `ORBITA_LLM_NATAL_CACHE_VERSION` retira lo generado con la versión
 *    anterior: una generación que arrancó en v1 y vuelve después del bump no
 *    puede publicar v1 como estado vigente. Lo que corresponde es que la fila
 *    quede para que un claim de v2 la regenere.
 */
export function resolveNatalReadingWrite(args: {
  /** Revisión que la carta tiene AHORA, leída dentro de la transacción. */
  currentChartRevision: string | null;
  /** Revisión con la que se generó este texto. */
  generatedForRevision: string;
  /** `claimSeq` que la fila tiene ahora. `null` si la fila ya no está. */
  currentClaimSeq: number | null;
  /** `claimSeq` que esta generación se llevó al empezar. */
  ownedClaimSeq: number;
  /** Versión de caché VIGENTE de la configuración, leída al escribir. */
  currentCacheVersion: string | null;
  /** Versión de caché con la que se generó este texto. */
  generatedForCacheVersion: string;
}): { applied: boolean; reason?: NatalReadingWriteRejection } {
  if (args.currentChartRevision !== args.generatedForRevision) {
    return { applied: false, reason: "chart_revision_changed" };
  }
  if (args.currentClaimSeq === null || args.currentClaimSeq !== args.ownedClaimSeq) {
    return { applied: false, reason: "claim_lost" };
  }
  if (args.currentCacheVersion !== args.generatedForCacheVersion) {
    return { applied: false, reason: "cache_version_changed" };
  }
  return { applied: true };
}

/**
 * Persiste la lectura larga **sólo si esta generación todavía es la vigente**.
 *
 * No es un upsert ciego: sin el CAS, una generación A que arrancó con el payload
 * parcial podía terminar después de la mejora B y dejar su texto encima del
 * estado nuevo, o pisar la lectura de un claim que la había reemplazado.
 */
/** El cuerpo del CAS, exportado para poder probar la carrera real. */
export async function applyNatalReadingWrite(
  ctx: any,
  args: {
    userId: any;
    natalChartId: any;
    locale: string;
    promptVersion: string;
    cacheVersion: string;
    model?: string;
    status: "ready" | "fallback" | "error";
    payload: unknown;
    usage?: unknown;
    chartRevision: string;
    claimSeq: number;
  }
): Promise<NatalReadingWriteResult> {
  const now = Date.now();
  const chart = await ctx.db.get(args.natalChartId);
  const existing = await ctx.db
    .query("natalInterpretations")
    .withIndex("by_chart_feature_version", (q: any) =>
      q.eq("natalChartId", args.natalChartId).eq("feature", NATAL_READING_FEATURE).eq("promptVersion", args.promptVersion)
    )
    .first();

  const cas = resolveNatalReadingWrite({
    currentChartRevision: chart ? natalPayloadRevision(chart.payload) : null,
    generatedForRevision: args.chartRevision,
    currentClaimSeq: typeof existing?.claimSeq === "number" ? existing.claimSeq : null,
    ownedClaimSeq: args.claimSeq,
    // La versión que la configuración pide AHORA, no la que la fila declara: si
    // el bump ocurrió mientras este texto se generaba, publicarlo dejaría v1
    // como estado vigente de una versión que ya se retiró.
    currentCacheVersion: getAiGatewayNatalCacheVersion(),
    generatedForCacheVersion: args.cacheVersion
  });
  if (!cas.applied) {
    return { applied: false, reason: cas.reason as NatalReadingWriteRejection };
  }

  await ctx.db.patch(existing._id, {
    userId: args.userId,
    natalChartId: args.natalChartId,
    feature: NATAL_READING_FEATURE,
    locale: args.locale,
    promptVersion: args.promptVersion,
    cacheVersion: args.cacheVersion,
    model: args.model,
    provider: "vercel-ai-gateway",
    status: args.status,
    payload: args.payload,
    usage: args.usage,
    chartRevision: args.chartRevision,
    claimSeq: args.claimSeq,
    updatedAt: now
  });
  return { applied: true, id: existing._id };
}

export const persistNatalReading = internalMutation({
  args: {
    userId: v.id("users"),
    natalChartId: v.id("natalCharts"),
    locale: v.string(),
    promptVersion: v.string(),
    cacheVersion: v.string(),
    model: v.optional(v.string()),
    status: v.union(v.literal("ready"), v.literal("fallback"), v.literal("error")),
    payload: v.any(),
    usage: v.optional(v.any()),
    /** Revisión del payload natal con el que se generó este texto. */
    chartRevision: v.string(),
    /** El turno que esta generación se llevó de `claimNatalReadingGeneration`. */
    claimSeq: v.number()
  },
  handler: async (ctx, args): Promise<NatalReadingWriteResult> =>
    await applyNatalReadingWrite(ctx, args as any)
});

type NatalReadingGenerationState = {
  userId: string;
  chartId: string;
  chartPayload: unknown;
  /**
   * La revisión del payload con el que se va a generar. Puede faltar en un
   * estado legado; entonces se deriva del payload que sí viaja.
   */
  chartRevision?: string;
};

/**
 * Genera la lectura larga y la escribe **sólo si sigue siendo la vigente**.
 *
 * El ciclo entero está atado a la revisión del payload natal:
 *
 * 1. el claim se pide PARA esa revisión y para la versión de caché que esta
 *    corrida leyó; si esa versión ya se retiró, el claim no toma nada
 *    (`stale_cache_version`) y esta corrida termina sin tocar la fila;
 * 2. se genera con ese mismo payload;
 * 3. la escritura es un CAS: la carta tiene que seguir en esa revisión, el
 *    turno tiene que seguir siendo éste y la versión configurada tiene que
 *    seguir siendo la de este texto.
 *
 * Cuando el CAS rechaza no hay nada que arreglar: la carta mejoró, o alguien más
 * está generando el texto que corresponde. Se dice `superseded` y no se toca la
 * fila, ni siquiera para marcar el error.
 */
export async function generateAndPersistNatalReading(
  ctx: any,
  state: NatalReadingGenerationState,
  source: "client" | "prewarm",
  generate: typeof generateNatalReadingWithGateway = generateNatalReadingWithGateway
) {
  const startedAt = Date.now();
  const promptVersion = getAiGatewayNatalPromptVersion();
  const cacheVersion = getAiGatewayNatalCacheVersion();
  const chartRevision = state.chartRevision ?? natalPayloadRevision(state.chartPayload);
  const claim = await ctx.runMutation(internalApi.charts.claimNatalReadingGeneration, {
    userId: state.userId,
    natalChartId: state.chartId,
    locale: "es-AR",
    promptVersion,
    cacheVersion,
    chartRevision
  });
  if (claim?.decision !== "claimed") {
    // Ninguna de las cuatro es un error de nadie: la lectura ya existe, alguien
    // la está generando, la carta cambió, o esta corrida viene de una versión de
    // caché que ya se retiró (`stale_cache_version`). Se registra el desenlace y
    // se sale sin tocar nada; sólo `ready` cuenta como cache hit.
    const decision = claim?.decision ?? "claim";
    console.info(
      "[natal.prewarm]",
      JSON.stringify({ source, cacheHit: decision === "ready", result: decision, totalMs: Date.now() - startedAt })
    );
    return { status: decision };
  }
  const claimSeq: number = claim.claimSeq;

  const generationStartedAt = Date.now();
  const result = await generate({ chartPayload: state.chartPayload });
  const generationMs = Date.now() - generationStartedAt;
  if (result.status !== "success" || !result.payload) {
    const persistStartedAt = Date.now();
    const write = await ctx.runMutation(internalApi.charts.persistNatalReading, {
      userId: state.userId,
      natalChartId: state.chartId,
      locale: "es-AR",
      promptVersion,
      cacheVersion,
      model: result.model,
      status: "error",
      payload: null,
      usage: result.usage,
      chartRevision,
      claimSeq
    });
    console.error(
      "[natal.prewarm]",
      JSON.stringify({
        source,
        cacheHit: false,
        result: write?.applied === false ? `superseded:${write.reason}` : "error",
        generationMs,
        persistMs: Date.now() - persistStartedAt,
        totalMs: Date.now() - startedAt
      })
    );
    // Un fallo que ya no describe nada no se le informa a nadie como fallo: la
    // carta mejoró, o el claim nuevo está generando el texto que corresponde.
    if (write?.applied === false) return { status: "superseded", reason: write.reason };
    return requireSuccessfulNatalReading(result);
  }

  const persistStartedAt = Date.now();
  const write = await ctx.runMutation(internalApi.charts.persistNatalReading, {
    userId: state.userId,
    natalChartId: state.chartId,
    locale: "es-AR",
    promptVersion,
    cacheVersion,
    model: result.model,
    status: "ready",
    payload: result.payload,
    usage: result.usage,
    chartRevision,
    claimSeq
  });
  console.info(
    "[natal.prewarm]",
    JSON.stringify({
      source,
      cacheHit: false,
      result: write?.applied === false ? `superseded:${write.reason}` : "generated",
      generationMs,
      persistMs: Date.now() - persistStartedAt,
      totalMs: Date.now() - startedAt
    })
  );
  if (write?.applied === false) return { status: "superseded", reason: write.reason };
  return { status: "generated" };
}

export const generatePersonalityReadingForChart = internalAction({
  args: { natalChartId: v.id("natalCharts") },
  handler: async (ctx, args): Promise<any> => {
    const state: any = await ctx.runQuery(internalApi.charts.getNatalReadingStateByChart, args);
    if (!state?.chartId || !state.chartPayload) return { status: "missing_chart" };
    if (!state.isPro) return { status: "locked" };
    return await generateAndPersistNatalReading(ctx, state, "prewarm");
  }
});

/** Genera una vez la lectura rica desde la carta completa y la cachea. */
export const generatePersonalityReading = action({
  args: {},
  handler: async (ctx): Promise<any> => {
    const identity = await requireIdentity(ctx as any);
    const state: any = await ctx.runQuery(internalApi.charts.getNatalReadingState, {
      tokenIdentifier: identity.tokenIdentifier
    });
    if (!state.isPro) throw new Error("Órbita Plus es necesario para esta lectura");
    if (!state.chartId || !state.chartPayload) return null;
    return await generateAndPersistNatalReading(ctx, state, "client");
  }
});

export const getBirthDataForNatalCalculation = internalQuery({
  args: {
    tokenIdentifier: v.string()
  },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);

    if (!user) {
      throw new Error("User record not found");
    }

    const birthData = await findCurrentBirthData(ctx, user._id);

    if (!birthData) {
      throw new Error("Birth data is required before calculating a natal chart");
    }

    const birthDataHash = buildBirthDataHash(birthData);
    const cacheKey = buildNatalChartCacheKey(user._id, birthDataHash);
    const existing = await ctx.db
      .query("natalCharts")
      .withIndex("by_cacheKey", (q: any) => q.eq("cacheKey", cacheKey))
      .first();

    return {
      userId: user._id,
      birthData,
      birthDataHash,
      cacheKey,
      existingChart: existing ?? null
    };
  }
});

/**
 * Los datos natales cambiaron mientras el proveedor calculaba.
 *
 * La corrida vieja calculó para OTRA persona natal: persistir su resultado como
 * carta vigente sería publicar la carta de datos que ya no existen. Es una
 * carrera legítima —alguien editó su hora de nacimiento mientras la Carta
 * recalculaba— y la salida es reintentar, no romper: el rechazo es estable y
 * traducible, y el reintento sale con los datos nuevos.
 */
export const NATAL_BIRTH_DATA_CHANGED = "NATAL_BIRTH_DATA_CHANGED_DURING_CALCULATION";

/** Los datos natales vigentes de una cuenta, con su hash y su `cacheKey`. */
async function readNatalIdentity(ctx: any, userId: any) {
  const birthData = await findCurrentBirthData(ctx, userId);
  const hash = birthData ? buildBirthDataHash(birthData) : null;
  return {
    birthData,
    hash,
    cacheKey: hash ? buildNatalChartCacheKey(String(userId), hash) : null
  };
}

/**
 * ¿La identidad natal vigente sigue siendo la que esta corrida usó?
 *
 * Las tres cosas a la vez: la MISMA fila, el mismo hash y el mismo `cacheKey`.
 * El proveedor tarda, y en esa ventana la persona pudo editar su hora o su
 * lugar de nacimiento: lo que se calculó describe a los datos anteriores.
 */
function natalIdentityMatches(
  identidad: { birthData: any; hash: string | null; cacheKey: string | null },
  args: { birthDataId: unknown; birthDataHash: string; cacheKey: string }
): boolean {
  return Boolean(
    identidad.birthData &&
      String(identidad.birthData._id) === String(args.birthDataId) &&
      identidad.hash === args.birthDataHash &&
      identidad.cacheKey === args.cacheKey
  );
}

/** El estado natal vigente para una corrida que ya no tiene nada que persistir. */
export type NatalRunRecheck =
  /** Los datos natales cambiaron mientras el proveedor respondía. */
  | { status: "birth_data_changed" }
  /** Siguen siendo los mismos; ésta es la carta que hay AHORA para ellos. */
  | { status: "same"; chart: any | null; sufficient: boolean };

/**
 * Relee el estado natal VIGENTE para la identidad con la que salió una corrida.
 *
 * Existe por una carrera concreta: cuando una corrida arranca **sin carta** y su
 * proveedor falla, no tiene nada que persistir, así que nunca llega a la
 * mutación —que es donde vive la decisión con el estado de ahora—. Pero el
 * proveedor tarda, y en esa ventana otra corrida pudo dejar una carta. Sin esta
 * relectura, la primera informaba `provider_failed`, `sufficient:false` y
 * `chart:null` mientras la pantalla ya podía mostrar una carta suficiente.
 *
 * Es una query interna y cerrada: mide la suficiencia con la precisión natal
 * vigente, la misma regla del read-model, y no escribe nada.
 */
export async function readNatalStateForRun(
  ctx: any,
  args: {
    tokenIdentifier: string;
    birthDataId: unknown;
    birthDataHash: string;
    cacheKey: string;
  }
): Promise<NatalRunRecheck> {
  const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);

  if (!user) {
    throw new Error("User record not found");
  }

  const identidad = await readNatalIdentity(ctx, user._id);
  if (!natalIdentityMatches(identidad, args)) {
    return { status: "birth_data_changed" as const };
  }

  const chart = await ctx.db
    .query("natalCharts")
    .withIndex("by_cacheKey", (q: any) => q.eq("cacheKey", args.cacheKey))
    .first();

  return {
    status: "same" as const,
    chart: chart ?? null,
    sufficient:
      Boolean(chart) &&
      storedNatalChartIsSufficient({
        birthTimePrecision: identidad.birthData.birthTimePrecision,
        payload: chart.payload
      })
  };
}

export const recheckNatalStateForRun = internalQuery({
  args: {
    tokenIdentifier: v.string(),
    birthDataId: v.id("birthData"),
    birthDataHash: v.string(),
    cacheKey: v.string()
  },
  handler: async (ctx, args): Promise<NatalRunRecheck> => await readNatalStateForRun(ctx, args)
});

/** Qué payload queda en la fila natal al cerrar la transacción. */
export type NatalPersistDecision = {
  keep: "existing" | "candidate";
  outcome: "kept_existing" | "updated_existing" | "inserted_candidate";
};

/**
 * La decisión de persistencia, MONOTÓNICA y medida dentro de la transacción.
 *
 * El defecto que cierra: la mutación releía la fila por `cacheKey` y la
 * parcheaba a ciegas con el payload que le llegaba. Dos corridas que arrancan
 * sobre la misma carta A incompleta —dos toques, dos pantallas, el prewarm y la
 * persona— pueden terminar en cualquier orden; la que llega tarde traía un
 * snapshot viejo de A, o una respuesta C que tampoco alcanza, y lo escribía
 * encima de la B completa que la otra ya había publicado. La Carta EMPEORABA
 * por una corrida atrasada.
 *
 * La regla, entera y en un solo lugar:
 *
 * | Fila actual | Candidato | Qué queda |
 * |---|---|---|
 * | no hay | cualquiera | se inserta el candidato, aunque sea parcial |
 * | suficiente | cualquiera | **la fila actual**, intacta |
 * | insuficiente | suficiente | el candidato |
 * | insuficiente | insuficiente | la fila actual |
 *
 * Suficiente se mide con `storedNatalChartIsSufficient` y la precisión natal
 * VIGENTE, que es la misma regla con la que `layers.getNatalChartBase` decide si
 * publica los ejes y las casas. Una carta que ya alcanza nunca se reemplaza:
 * ni por una respuesta parcial atrasada, ni por otra respuesta completa de una
 * corrida más vieja del mismo `cacheKey` —la clave ya incorpora la versión de
 * cálculo, así que dos completas describen lo mismo y pisar una publicada sólo
 * agrega ruido—.
 */
export function resolveNatalPersistDecision(args: {
  hasExistingChart: boolean;
  /** ¿La fila que hay AHORA alcanza para estos datos? */
  existingIsSufficient: boolean;
  /** ¿El payload que trae esta corrida alcanza? MISMA regla. */
  candidateIsSufficient: boolean;
}): NatalPersistDecision {
  if (!args.hasExistingChart) return { keep: "candidate", outcome: "inserted_candidate" };
  if (args.existingIsSufficient) return { keep: "existing", outcome: "kept_existing" };
  if (args.candidateIsSufficient) return { keep: "candidate", outcome: "updated_existing" };
  return { keep: "existing", outcome: "kept_existing" };
}

export type NatalChartPersistResult = {
  /** La fila natal tal como quedó. */
  chart: any;
  /** `candidate` sólo si ESTA corrida escribió el payload. */
  stored: "existing" | "candidate";
  outcome: NatalPersistDecision["outcome"];
  /** ¿La fila FINAL alcanza? Medido dentro de la transacción. */
  sufficient: boolean;
};

/**
 * El cuerpo de `persistCalculatedNatalChart`, exportado para poder probar la
 * concurrencia real contra una base en memoria con el orden de resolución bajo
 * control. Una suite que sólo llama a la mutación de a una no prueba nada de lo
 * que este arreglo cierra.
 */
export async function applyCalculatedNatalChart(
  ctx: any,
  args: {
    tokenIdentifier: string;
    birthDataId: any;
    birthDataHash: string;
    cacheKey: string;
    providerVersion: string;
    calculationVersion: string;
    payload: unknown;
  }
): Promise<NatalChartPersistResult> {
  const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);

  if (!user) {
    throw new Error("User record not found");
  }

  const birthData = await ctx.db.get(args.birthDataId);

  if (!birthData || birthData.userId !== user._id) {
    throw new Error("Birth data not found for user");
  }

  // Revalidación de identidad DENTRO de la transacción. El proveedor tarda, y
  // en esa ventana la persona pudo editar su hora o su lugar de nacimiento: la
  // fila vigente sería otra, con otro hash y otro `cacheKey`. Lo que se calculó
  // describe a los datos anteriores y no puede quedar como carta de ahora.
  const identidad = await readNatalIdentity(ctx, user._id);
  if (!natalIdentityMatches(identidad, args)) {
    throw new Error(NATAL_BIRTH_DATA_CHANGED);
  }
  const vigente = identidad.birthData;

  const now = Date.now();
  /**
   * La identidad VIGENTE, que se reafirma gane quien gane.
   *
   * El hash y el `cacheKey` describen los CAMPOS natales, no la fila que los
   * guarda: una fila natal más nueva y semánticamente idéntica —volver a cargar
   * los mismos datos, una reescritura del alta, una migración— produce el mismo
   * `cacheKey`, así que la carta que ya existe gana… y se queda apuntando al
   * `birthDataId` HISTÓRICO para siempre. `chartMatchesCompletionBirthData`
   * exige la fila vigente exacta, así que el alta se quedaba en `chart_pending`
   * con el payload correcto delante. Reafirmar no toca el payload ni su
   * procedencia: sólo dice de quién y de qué datos es esta carta AHORA.
   */
  const identidadVigente = {
    userId: user._id,
    birthDataId: args.birthDataId,
    birthDataHash: args.birthDataHash,
    cacheKey: args.cacheKey
  };
  const existingChart = await ctx.db
    .query("natalCharts")
    .withIndex("by_cacheKey", (q: any) => q.eq("cacheKey", args.cacheKey))
    .first();

  const alcanza = (payload: unknown) =>
    storedNatalChartIsSufficient({
      birthTimePrecision: vigente.birthTimePrecision,
      payload
    });

  const existingIsSufficient = Boolean(existingChart) && alcanza(existingChart.payload);
  const candidateIsSufficient = alcanza(args.payload);
  const decision = resolveNatalPersistDecision({
    hasExistingChart: Boolean(existingChart),
    existingIsSufficient,
    candidateIsSufficient
  });

  let chartId = existingChart?._id;
  // Lo que de verdad queda publicado. `profileAstrologyCaches` copia ESTO y no
  // el candidato: si divergieran, el cache de perfil podría servir la carta
  // descartada mientras `natalCharts` sirve la buena.
  let chosenPayload: unknown = existingChart?.payload;
  let chosenProviderVersion: string = existingChart?.providerVersion ?? args.providerVersion;
  let chosenCalculationVersion: string = existingChart?.calculationVersion ?? args.calculationVersion;

  if (decision.keep === "candidate") {
    chosenPayload = args.payload;
    chosenProviderVersion = args.providerVersion;
    chosenCalculationVersion = args.calculationVersion;
    if (existingChart) {
      await ctx.db.patch(existingChart._id, {
        ...identidadVigente,
        providerVersion: args.providerVersion,
        calculationVersion: args.calculationVersion,
        payload: args.payload,
        updatedAt: now
      });
    } else {
      chartId = await ctx.db.insert("natalCharts", {
        ...identidadVigente,
        providerVersion: args.providerVersion,
        calculationVersion: args.calculationVersion,
        payload: args.payload,
        createdAt: now,
        updatedAt: now
      });
    }
  } else {
    // La fila que ya estaba gana. Se reafirma su IDENTIDAD vigente —de quién es
    // y a qué fila natal corresponde— y nada más: tocarle el payload o la
    // versión del proveedor con los del candidato descartado sería relabelar una
    // carta con la procedencia de otra.
    //
    // Y SÓLO si la identidad de verdad difiere. El patch incondicional tocaba
    // `updatedAt` en cada refresh de capas —que reusa la carta varias veces por
    // minuto— y la comparación de Vínculos, que incluye ese timestamp en su
    // `inputHash` y tarda segundos, se encontraba el insumo "cambiado" al
    // persistir: `RELATIONSHIP_INPUT_CHANGED_DURING_REFRESH` en loop, y la
    // comparación de una persona recién creada no persistía nunca (iPhone,
    // 2026-08-19). Un refresh que no cambió nada es un no-op de verdad.
    const identidadYaVigente =
      existingChart.userId === identidadVigente.userId &&
      existingChart.birthDataId === identidadVigente.birthDataId &&
      existingChart.birthDataHash === identidadVigente.birthDataHash &&
      existingChart.cacheKey === identidadVigente.cacheKey;
    if (!identidadYaVigente) {
      await ctx.db.patch(existingChart._id, { ...identidadVigente, updatedAt: now });
    }
  }

  const existingCache = await ctx.db
    .query("profileAstrologyCaches")
    .withIndex("by_cacheKey", (q: any) => q.eq("cacheKey", args.cacheKey))
    .first();

  const cachePayload = {
    feature: "natal_chart",
    provider: "astrologyapi",
    providerVersion: chosenProviderVersion,
    calculationVersion: chosenCalculationVersion,
    birthDataHash: args.birthDataHash,
    chart: chosenPayload
  };

  if (existingCache) {
    // Mismas dos referencias que la fila natal, por el mismo motivo: un cache
    // que quedó apuntando al `birthDataId` histórico describe a una fila que ya
    // no es la vigente, aunque su payload sea exactamente el correcto.
    await ctx.db.patch(existingCache._id, {
      userId: user._id,
      birthDataId: args.birthDataId,
      natalChartId: chartId,
      cacheKey: args.cacheKey,
      cacheVersion: chosenCalculationVersion,
      payload: cachePayload,
      updatedAt: now
    });
  } else {
    await ctx.db.insert("profileAstrologyCaches", {
      userId: user._id,
      birthDataId: args.birthDataId,
      natalChartId: chartId,
      cacheKey: args.cacheKey,
      cacheVersion: chosenCalculationVersion,
      payload: cachePayload,
      createdAt: now,
      updatedAt: now
    });
  }

  return {
    chart: await ctx.db.get(chartId),
    stored: decision.keep,
    outcome: decision.outcome,
    sufficient: decision.keep === "candidate" ? candidateIsSufficient : existingIsSufficient
  };
}

export const persistCalculatedNatalChart = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    birthDataId: v.id("birthData"),
    birthDataHash: v.string(),
    cacheKey: v.string(),
    providerVersion: v.string(),
    calculationVersion: v.string(),
    payload: v.any()
  },
  handler: async (ctx, args) => await applyCalculatedNatalChart(ctx, args)
});

/**
 * Qué pasó realmente con una corrida de carta natal.
 *
 * No es "la llamada HTTP volvió": es si el read-model puede publicar la
 * geometría que estos datos natales permiten calcular.
 */
export type NatalChartCalculationOutcome =
  /** La carta guardada ya alcanzaba. No se llamó al proveedor. */
  | "cache_sufficient"
  /** El proveedor entregó lo que faltaba y se persistió. */
  | "calculated"
  /** El proveedor no respondió. Se conserva lo que hubiera. */
  | "provider_failed"
  /** El proveedor respondió y la carta sigue sin la geometría exigible. */
  | "still_insufficient";

/** Qué hacer con la respuesta del proveedor, sin tocar la base. */
export type NatalCalculationDecision = {
  /**
   * `reuse_existing` — se reafirma la carta guardada tal cual. Nunca se la
   * borra ni se la sustituye por una peor.
   * `persist_provider` — se escribe el payload nuevo.
   * `fail` — no hay nada que devolver.
   */
  action: "reuse_existing" | "persist_provider" | "fail";
  outcome: NatalChartCalculationOutcome;
};

/**
 * La decisión completa de una corrida, escrita como tabla y probada como tabla.
 *
 * Las dos reglas que la gobiernan:
 *
 * 1. **Una carta guardada nunca empeora.** Si el proveedor falla —o responde
 *    algo que sigue sin alcanzar— se conserva la que ya había. Sustituir un
 *    parcial por otro parcial no se puede justificar: no hay forma de ordenar
 *    dos cálculos incompletos, y el que ya está publicado es el que la Carta
 *    está mostrando.
 * 2. **Éxito significa suficiente.** `cache_sufficient` y `calculated` son los
 *    únicos resultados en los que el read-model puede publicar la geometría
 *    que el estado recuperable pedía. Que el proveedor haya contestado no
 *    alcanza.
 *
 * Sin carta guardada, en cambio, algo es mejor que nada: un payload
 * insuficiente se persiste igual —la Carta ya sabe declararlo `partial` y
 * ofrecer el reintento— pero el resultado sigue siendo `still_insufficient`,
 * porque lo que faltaba sigue faltando.
 */
export function resolveNatalCalculationDecision(args: {
  hasExistingChart: boolean;
  /** ¿La carta guardada alcanza para estos datos? (`storedNatalChartIsSufficient`) */
  existingIsSufficient: boolean;
  providerSucceeded: boolean;
  /** ¿La respuesta nueva alcanza? MISMA regla que la de arriba. */
  providerIsSufficient: boolean;
}): NatalCalculationDecision {
  if (args.hasExistingChart && args.existingIsSufficient) {
    return { action: "reuse_existing", outcome: "cache_sufficient" };
  }
  if (!args.providerSucceeded) {
    return args.hasExistingChart
      ? { action: "reuse_existing", outcome: "provider_failed" }
      : { action: "fail", outcome: "provider_failed" };
  }
  if (args.providerIsSufficient) {
    return { action: "persist_provider", outcome: "calculated" };
  }
  return args.hasExistingChart
    ? { action: "reuse_existing", outcome: "still_insufficient" }
    : { action: "persist_provider", outcome: "still_insufficient" };
}

/** Los dos únicos desenlaces en los que la geometría pedida quedó publicable. */
export function natalCalculationSucceeded(outcome: NatalChartCalculationOutcome): boolean {
  return outcome === "cache_sufficient" || outcome === "calculated";
}

/**
 * El desenlace REAL, medido sobre la fila que quedó publicada.
 *
 * La decisión de arriba se toma con el estado que esta corrida vio antes de
 * llamar al proveedor; la mutación decide con el estado de AHORA. Cuando las dos
 * no coinciden, manda la segunda:
 *
 * - esta corrida falló, pero mientras tanto otra publicó una carta que alcanza
 *   ⇒ no es un fallo: el read-model ya puede publicar la geometría, y decirle
 *   "no pudimos" a alguien que está mirando la carta completa sería mentir;
 * - esta corrida traía una carta completa y la mutación conservó la que ya
 *   estaba (también completa) ⇒ el éxito es `stored`, no `provider`: lo que se
 *   ve no lo escribió esta corrida.
 *
 * Cuando la fila final NO alcanza, el desenlace es el que esta corrida
 * consiguió: `still_insufficient` o `provider_failed` siguen siendo lo honesto.
 *
 * La usan los dos caminos de salida: el que persistió algo y el que no llegó a
 * tener candidato —ahí `storedCandidate` es false por construcción y la fila
 * final es la que la relectura encontró—.
 */
export function resolveFinalNatalOutcome(args: {
  /** Lo que esta corrida creía haber conseguido. */
  intended: NatalChartCalculationOutcome;
  /** ¿Fue ESTA corrida la que escribió la fila? */
  storedCandidate: boolean;
  /** ¿La fila final alcanza, medida después de la mutación? */
  finalIsSufficient: boolean;
}): NatalChartCalculationOutcome {
  if (!args.finalIsSufficient) return args.intended;
  if (args.intended === "calculated" && args.storedCandidate) return "calculated";
  return "cache_sufficient";
}

export type NatalChartCalculationResult = {
  outcome: NatalChartCalculationOutcome;
  /** ¿El read-model puede publicar la geometría que estos datos permiten? */
  sufficient: boolean;
  /** La carta vigente al terminar. `null` sólo cuando no quedó ninguna. */
  chart: any | null;
  /** El motivo del proveedor, para el error de quien lo necesite. */
  detail: string | null;
};

/** La firma del proveedor natal, inyectable para poder probar la decisión real. */
export type NatalChartProvider = typeof runAstrologyApiNatalChart;

/**
 * Calcula (o reafirma) la carta natal y dice CÓMO terminó.
 *
 * Es el cuerpo compartido por las dos actions públicas: la de siempre
 * —`calculateOrCreateNatalChart`, que devuelve la carta y rechaza cuando no hay
 * ninguna— y la de recuperación —`recoverNatalChart`, que devuelve el desenlace
 * discriminado para que la pantalla no llame éxito a un intento que no mejoró
 * nada—. Las dos hacen exactamente el mismo trabajo y toman exactamente la
 * misma decisión; lo único que cambia es qué se le cuenta a quien llamó.
 *
 * **Por qué el cache no se mide sólo por `cacheKey`.** La clave se arma con los
 * DATOS natales, así que dice "esta carta se calculó con estos datos"; no dice
 * que el cálculo haya llegado hasta donde estos datos permiten. Con hora exacta,
 * una corrida en la que el proveedor no devolvió las casas deja una fila sin
 * casas y sin Ascendente: `layers.getNatalChartBase` la declara `partial` con
 * `verified_ascendant_mc_geometry`, la Carta ofrece volver a pedir el cálculo…
 * y esta operación encontraba esa misma fila por `cacheKey` y la volvía a
 * persistir igual. El botón prometía un cambio que no podía ocurrir nunca.
 *
 * La suficiencia se mide con `storedNatalChartIsSufficient`, la misma regla de
 * geometría que usa `layers.ts`, y se mide DOS veces: sobre la carta guardada
 * —para decidir si hay que volver al proveedor— y sobre la respuesta nueva
 * —para decidir si de verdad mejoró algo—. Sin hora exacta no hay geometría que
 * exigir y el cache sano se reutiliza exactamente como antes.
 *
 * **Y por qué la decisión final NO es ésta.** Lo de arriba se decide con el
 * estado que esta corrida vio ANTES de llamar al proveedor, y el proveedor
 * tarda. Dos corridas sobre la misma carta incompleta pueden terminar en
 * cualquier orden: la que llega tarde trae un snapshot viejo —o una respuesta
 * que tampoco alcanza— y escribirlo pisaría la carta completa que la otra ya
 * publicó. Por eso la decisión que MANDA vive dentro de la mutación
 * (`resolveNatalPersistDecision`), que compara contra el estado de ahora, y por
 * eso al volver se vuelve a medir la fila final (`resolveFinalNatalOutcome`):
 * si otra corrida ganó con una carta que alcanza, esto termina en éxito
 * almacenado y no en un fallo falso.
 *
 * **Y la corrida que no tiene nada que persistir tampoco decide sola.** Cuando
 * arranca sin carta y el proveedor falla, no hay candidato, así que no pasa por
 * la mutación: antes devolvía `provider_failed` con `chart:null` aunque otra
 * corrida hubiera publicado una carta durante la espera. Ahora relee el estado
 * vigente (`recheckNatalStateForRun`) para la MISMA identidad y aplica la misma
 * medida final: si hay una carta que alcanza, el desenlace es éxito almacenado;
 * si la que hay es parcial, el fallo sigue siendo honesto pero devuelve esa
 * carta real en vez de fingir que no existe.
 *
 * **Si los datos natales cambiaron mientras el proveedor respondía**, la
 * mutación rechaza con `NATAL_BIRTH_DATA_CHANGED_DURING_CALCULATION` y ese
 * rechazo sube tal cual: lo calculado describe a los datos anteriores, así que
 * no se publica como carta vigente ni se cuenta como recuperación exitosa. La
 * relectura del camino sin candidato rechaza igual, y por el mismo motivo: una
 * carta calculada para OTROS datos no puede convertirse en el éxito de ésta. La
 * salida es reintentar, ahora con los datos nuevos.
 */
export async function runNatalChartCalculation(
  ctx: any,
  tokenIdentifier: string,
  provider: NatalChartProvider = runAstrologyApiNatalChart
): Promise<NatalChartCalculationResult> {
  const state: any = await ctx.runQuery(internalApi.charts.getBirthDataForNatalCalculation, {
    tokenIdentifier
  });
  const birthData = state.birthData;
  const sufficient = (payload: unknown) =>
    storedNatalChartIsSufficient({
      birthTimePrecision: birthData?.birthTimePrecision,
      payload
    });

  // La mutación canónica reafirma los metadatos de identidad, revalida que los
  // datos natales sigan siendo estos y toma la decisión FINAL de persistencia
  // con el estado vigente; por eso se usa la misma para reafirmar y para
  // escribir, y por eso devuelve qué quedó guardado y no sólo la fila.
  const persist = async (payload: unknown, providerVersion: string) => {
    const applied = await ctx.runMutation(internalApi.charts.persistCalculatedNatalChart, {
      tokenIdentifier,
      birthDataId: birthData._id,
      birthDataHash: state.birthDataHash,
      cacheKey: state.cacheKey,
      providerVersion,
      calculationVersion: ASTROLOGY_API_CHART_CALCULATION_VERSION,
      payload
    });
    if (applied?.chart?._id) {
      await ctx.scheduler.runAfter(0, internalApi.charts.generatePersonalityReadingForChart, {
        natalChartId: applied.chart._id
      });
    }
    return applied;
  };

  const hasExistingChart = Boolean(state.existingChart);
  const existingIsSufficient = hasExistingChart && sufficient(state.existingChart.payload);

  let providerSucceeded = false;
  let providerChart: unknown = null;
  let providerVersion: string = state.existingChart?.providerVersion ?? "astrologyapi";
  let detail: string | null = null;

  // El cache que alcanza evita por completo otra llamada al proveedor.
  if (!(hasExistingChart && existingIsSufficient)) {
    const providerResult = await provider({
      input: {
        birthDate: birthData.birthDate,
        birthTime: birthData.birthTime,
        birthTimePrecision: birthData.birthTimePrecision,
        birthPlaceLabel: birthData.birthPlaceLabel,
        latitude: birthData.latitude,
        longitude: birthData.longitude,
        timezone: birthData.timezone
      },
      localDate: new Date().toISOString().slice(0, 10)
    });
    providerChart = providerResult.normalized?.chart ?? null;
    providerSucceeded = providerResult.status === "success" && Boolean(providerChart);
    if (providerSucceeded) providerVersion = providerResult.providerVersion;
    detail = providerSucceeded
      ? null
      : providerResult.error ?? (providerResult.warnings.join(", ") || providerResult.status);
  }

  const decision = resolveNatalCalculationDecision({
    hasExistingChart,
    existingIsSufficient,
    providerSucceeded,
    providerIsSufficient: providerSucceeded && sufficient(providerChart)
  });

  if (decision.action === "fail") {
    // Esta corrida no tiene NADA que persistir —arrancó sin carta y el proveedor
    // no respondió—, así que nunca llega a la mutación, que es donde vive la
    // decisión con el estado de ahora. Pero el proveedor tardó, y en esa ventana
    // otra corrida pudo dejar una carta: informar `provider_failed` con
    // `chart:null` mientras la pantalla ya muestra una carta suficiente es un
    // fallo falso. Se relee el estado vigente para la MISMA identidad.
    const revision: NatalRunRecheck = await ctx.runQuery(
      internalApi.charts.recheckNatalStateForRun,
      {
        tokenIdentifier,
        birthDataId: birthData._id,
        birthDataHash: state.birthDataHash,
        cacheKey: state.cacheKey
      }
    );
    if (revision.status === "birth_data_changed") {
      // Los datos natales cambiaron mientras esperábamos: la carta que hoy
      // exista bajo esta clave describe a otra persona natal y no puede contarse
      // como el éxito de esta corrida. Mismo rechazo estable que la mutación.
      throw new Error(NATAL_BIRTH_DATA_CHANGED);
    }
    // La misma medida final que después de persistir: esta corrida no escribió
    // nada, así que `storedCandidate` es false por construcción.
    const outcome = resolveFinalNatalOutcome({
      intended: decision.outcome,
      storedCandidate: false,
      finalIsSufficient: revision.sufficient
    });
    const succeeded = natalCalculationSucceeded(outcome);
    return {
      outcome,
      sufficient: succeeded,
      // La carta REAL que haya quedado, aunque sea parcial: fingir que no existe
      // deja a la pantalla sin lo único que podía mostrar.
      chart: revision.chart,
      detail: succeeded ? null : detail
    };
  }

  // `reuse_existing` propone la fila que esta corrida vio, con su payload
  // intacto: un intento que no mejoró nada no puede borrarla ni pisarla con algo
  // peor. Sea cual sea la propuesta, la mutación compara contra el estado de
  // AHORA y puede conservar una carta mejor que otra corrida ya publicó.
  const candidato =
    decision.action === "persist_provider"
      ? { payload: providerChart, providerVersion }
      : {
          payload: state.existingChart.payload,
          providerVersion: state.existingChart.providerVersion ?? "astrologyapi"
        };

  const applied = await persist(candidato.payload, candidato.providerVersion);
  const chart = applied?.chart ?? null;
  // Se vuelve a medir la carta FINAL: si otra corrida ganó con una que alcanza,
  // esto es un éxito almacenado y no un fallo falso.
  const finalIsSufficient = Boolean(chart) && sufficient(chart.payload);
  const outcome = resolveFinalNatalOutcome({
    intended: decision.outcome,
    storedCandidate: applied?.stored === "candidate",
    finalIsSufficient
  });
  const succeeded = natalCalculationSucceeded(outcome);
  return {
    outcome,
    sufficient: succeeded,
    chart,
    detail: succeeded ? null : detail
  };
}

/**
 * Calcula la carta natal, o devuelve la que ya está calculada para estos datos.
 *
 * **Su contrato no cambia**, y no cambia a propósito: la usan el alta, el editor
 * de perfil y la Carta web, y todas esperan una carta o un rechazo. Devuelve la
 * carta vigente —la recién calculada, o la que ya había cuando el proveedor no
 * pudo mejorarla— y sólo rechaza cuando no queda ninguna: reintentar puede no
 * mejorar nada, pero nunca deja la cuenta sin carta ni bloquea un alta por una
 * caída del proveedor.
 *
 * El otro rechazo posible es `NATAL_BIRTH_DATA_CHANGED_DURING_CALCULATION`: los
 * datos natales cambiaron mientras el proveedor calculaba, así que lo que volvió
 * describe a la persona natal anterior. Rechazar es lo compatible —la firma ya
 * rechaza— y el reintento sale con los datos nuevos.
 *
 * Quien necesite saber si el intento MEJORÓ algo —el botón de recuperación de
 * la Carta— usa `recoverNatalChart`, que hace exactamente este trabajo y además
 * lo dice.
 */
export const calculateOrCreateNatalChart = action({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx as any);
    const result = await runNatalChartCalculation(ctx, identity.tokenIdentifier);
    if (!result.chart) {
      throw new Error(`Natal chart provider failed: ${result.detail ?? result.outcome}`);
    }
    return result.chart;
  }
});

/**
 * La recuperación de la Carta, con el desenlace que la pantalla necesita.
 *
 * `calculateOrCreateNatalChart` resuelve con la carta guardada cuando el
 * proveedor falla, y eso es lo correcto para el alta —no dejar a nadie sin
 * carta— pero es exactamente lo que no sirve acá: el botón "COMPROBAR DE NUEVO"
 * existe porque a esa carta le falta geometría, así que recibirla de vuelta sin
 * cambios y llamarlo éxito deja a la pantalla anunciando un final que no
 * ocurrió.
 *
 * Esta action hace el MISMO trabajo y devuelve el desenlace discriminado:
 *
 * | Qué pasó | Qué devuelve |
 * |---|---|
 * | la carta guardada ya alcanzaba | `recovered` · `stored` |
 * | el proveedor entregó lo que faltaba | `recovered` · `provider` |
 * | el proveedor no respondió | `failed` · `provider_failed` |
 * | respondió y sigue sin alcanzar | `failed` · `still_incomplete` |
 *
 * `recovered` significa una sola cosa: el read-model puede publicar la
 * geometría que estos datos natales permiten. En los dos `failed` la carta
 * anterior sigue intacta y visible, y el reintento sigue disponible.
 *
 * Hay un quinto camino que no es un desenlace sino un rechazo: si los datos
 * natales cambiaron mientras el proveedor calculaba
 * (`NATAL_BIRTH_DATA_CHANGED_DURING_CALCULATION`), la action rechaza en vez de
 * devolver `recovered` sobre una carta que ya no corresponde. El controlador lo
 * trata como cualquier otro rechazo: la pantalla dice que no se pudo y ofrece
 * reintentar, ahora sobre los datos nuevos. El `returns` no cambia.
 *
 * Es **aditiva**: `calculateOrCreateNatalChart` queda igual y los clientes
 * instalados no se enteran.
 */
export const recoverNatalChart = action({
  args: {},
  returns: v.union(
    v.object({
      status: v.literal("recovered"),
      source: v.union(v.literal("stored"), v.literal("provider"))
    }),
    v.object({
      status: v.literal("failed"),
      reason: v.union(v.literal("provider_failed"), v.literal("still_incomplete"))
    })
  ),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx as any);
    const result = await runNatalChartCalculation(ctx, identity.tokenIdentifier);
    if (result.outcome === "cache_sufficient") {
      return { status: "recovered" as const, source: "stored" as const };
    }
    if (result.outcome === "calculated") {
      return { status: "recovered" as const, source: "provider" as const };
    }
    return {
      status: "failed" as const,
      reason:
        result.outcome === "provider_failed"
          ? ("provider_failed" as const)
          : ("still_incomplete" as const)
    };
  }
});
