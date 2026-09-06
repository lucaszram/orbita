import {
  actionGeneric as action,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery
} from "convex/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { resolveCanonicalDailyContext } from "./daily";
import { getAstrologyApiConfig, hasAstrologyApiCredentials } from "./lib/astrologyApi";
import { findCurrentBirthData, findCurrentNatalChart } from "./lib/birthDataConsistency";
import { buildCuatroRitmos, type RitmoLunarFuente } from "./lib/cuatroRitmos";
import { buildEstacionVital, type EstacionVital } from "./lib/estacionVital";
import { extractNormalizedChartFromPayload } from "./lib/orbita";
import { buildTemaDelAno, type TemaDelAno } from "./lib/temaDelAno";
import { naiveNowIn, type TransitPanorama } from "./lib/transitPanorama";
import { isUserPro } from "./lib/subscriptionAccess";
import { runAstrologyApiPlanetsTropical } from "./lib/tropicalEphemeris";
import { findUserByTokenIdentifier, omitUndefined, requireIdentity } from "./lib/users";

const internalApi = internal as any;
const publicApi = api as any;
export const ESTACION_VITAL_VERSION = "orbita-estacion-vital-v1";

/**
 * «Tu momento» — las capas lentas de Tránsitos. CORE-209 abre la primera:
 * la estación vital (fase de la lunación progresada). Cada capa se calcula
 * una vez por día y por persona y se guarda en `momentoAnalyses`; los datos
 * natales entran en `inputHash`, así que cambiar la hora o el lugar invalida
 * el cache. Free recibe `locked` sin calcular nada (la capa es Plus).
 */
export const getMomentoState = internalQuery({
  args: { tokenIdentifier: v.string(), localDate: v.string(), kind: v.string() },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) throw new Error("User record not found");
    const cached = await ctx.db
      .query("momentoAnalyses")
      .withIndex("by_user_date_kind", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate).eq("kind", args.kind))
      .first();
    const isPro = await isUserPro(ctx, user._id);
    // Free recibe `locked`: no se leen datos que no se van a usar.
    if (!isPro) return { isPro, birthData: null, natalChartPayload: null, cached: null };
    const natalChart = args.kind === "tema_del_ano" ? await findCurrentNatalChart(ctx, user._id) : null;
    return {
      isPro,
      birthData: await findCurrentBirthData(ctx, user._id),
      natalChartPayload: natalChart?.payload ?? null,
      cached
    };
  }
});

export const persistMomento = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    localDate: v.string(),
    kind: v.string(),
    version: v.string(),
    inputHash: v.string(),
    payload: v.any()
  },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) throw new Error("User record not found");
    const now = Date.now();
    const existing = await ctx.db
      .query("momentoAnalyses")
      .withIndex("by_user_date_kind", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate).eq("kind", args.kind))
      .first();
    const fields = omitUndefined({ version: args.version, inputHash: args.inputHash, payload: args.payload, updatedAt: now });
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return { id: existing._id };
    }
    const id = await ctx.db.insert("momentoAnalyses", {
      userId: user._id,
      localDate: args.localDate,
      kind: args.kind,
      ...fields,
      createdAt: now
    });
    return { id };
  }
});

function localDateForInstant(instant: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
    const read = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value ?? "";
    return `${read("year")}-${read("month")}-${read("day")}`;
  } catch {
    // Una zona IANA inválida no puede tirar el action: el cliente tropical la
    // convierte en `missing_input` y el cálculo termina en `unavailable`.
    return instant.toISOString().slice(0, 10);
  }
}

function birthInputHash(birth: any) {
  return [birth.birthDate, birth.birthTime ?? "", birth.birthTimePrecision, birth.timezone, birth.latitude ?? "", birth.longitude ?? ""].join("|");
}

/**
 * `momento.getEstacionVital({ localDate })` — la estación vital de la persona
 * con sesión para la fecha canónica. Sobre siempre con `status`: `locked`
 * (Free) o `ready` con `estacion` (que a su vez declara su propio `status`:
 * `ready`, `partial`, `needs_birth_time`, `unavailable`, …). Nunca se rellena
 * una fase que el cálculo no pudo certificar.
 */
export const getEstacionVital = action({
  args: { localDate: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx as any);
    const dayState: any = await ctx.runQuery(internalApi.daily.getGuideTimezone, { tokenIdentifier: identity.tokenIdentifier });
    const canonical = resolveCanonicalDailyContext({ birthTimezone: dayState.birthTimezone, latestGuide: dayState.latestGuide });
    if (args.localDate !== canonical.localDate) {
      throw new Error("Tu momento usa la fecha canónica del servidor");
    }
    const kind = "estacion_vital";
    const state: any = await ctx.runQuery(internalApi.momento.getMomentoState, {
      tokenIdentifier: identity.tokenIdentifier,
      localDate: args.localDate,
      kind
    });
    if (!state.isPro) {
      return { status: "locked" as const, localDate: args.localDate, access: { isPro: false as const } };
    }
    const birth = state.birthData
      ? {
          birthDate: state.birthData.birthDate as string,
          birthTime: (state.birthData.birthTime as string | undefined) ?? null,
          birthTimePrecision: state.birthData.birthTimePrecision as "known" | "approximate" | "unknown",
          timezone: state.birthData.timezone as string,
          latitude: (state.birthData.latitude as number | undefined) ?? null,
          longitude: (state.birthData.longitude as number | undefined) ?? null
        }
      : null;
    const inputHash = birth ? birthInputHash(birth) : "sin-datos";
    if (state.cached && state.cached.version === ESTACION_VITAL_VERSION && state.cached.inputHash === inputHash) {
      return { status: "ready" as const, localDate: args.localDate, timezone: birth?.timezone ?? null, access: { isPro: true as const }, estacion: state.cached.payload as EstacionVital, cached: true };
    }
    const configured = hasAstrologyApiCredentials(getAstrologyApiConfig());
    const timezone = birth?.timezone ?? "UTC";
    const estacion = await buildEstacionVital({
      birth,
      observedAt: Date.now(),
      providerConfigured: configured,
      tropicalAt: async (instantMs) => {
        const response = await runAstrologyApiPlanetsTropical({
          instant: new Date(instantMs),
          localDate: localDateForInstant(new Date(instantMs), timezone),
          timezone,
          latitude: birth?.latitude ?? undefined,
          longitude: birth?.longitude ?? undefined
        });
        return response.status === "success" && response.normalized ? response.normalized.positions : null;
      }
    });
    // Se guardan los resultados que dependen sólo de los datos natales y del
    // día (listo, parcial, sin hora); un fallo del proveedor no se cachea.
    if (estacion.status === "ready" || estacion.status === "partial" || estacion.status === "needs_birth_time") {
      await ctx.runMutation(internalApi.momento.persistMomento, {
        tokenIdentifier: identity.tokenIdentifier,
        localDate: args.localDate,
        kind,
        version: ESTACION_VITAL_VERSION,
        inputHash,
        payload: estacion
      });
    }
    return { status: "ready" as const, localDate: args.localDate, timezone: birth?.timezone ?? null, access: { isPro: true as const }, estacion, cached: false };
  }
});

/**
 * `momento.getTemaDelAno({ localDate })` — la capa 02: la profección anual de
 * la persona con sesión para la fecha canónica (CORE-210). Sobre `locked`
 * (Free) o `ready` con `tema`, que declara su propio `status` (`ready`,
 * `needs_birth_time`, `needs_natal_chart`, `needs_birth_data`, `unavailable`).
 * Es un cálculo puro sobre la carta guardada: no llama al proveedor y no se
 * cachea.
 */
export const getTemaDelAno = action({
  args: { localDate: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx as any);
    const dayState: any = await ctx.runQuery(internalApi.daily.getGuideTimezone, { tokenIdentifier: identity.tokenIdentifier });
    const canonical = resolveCanonicalDailyContext({ birthTimezone: dayState.birthTimezone, latestGuide: dayState.latestGuide });
    if (args.localDate !== canonical.localDate) {
      throw new Error("Tu momento usa la fecha canónica del servidor");
    }
    const state: any = await ctx.runQuery(internalApi.momento.getMomentoState, {
      tokenIdentifier: identity.tokenIdentifier,
      localDate: args.localDate,
      kind: "tema_del_ano"
    });
    if (!state.isPro) {
      return { status: "locked" as const, localDate: args.localDate, access: { isPro: false as const } };
    }
    const birth = state.birthData
      ? {
          birthDate: state.birthData.birthDate as string,
          birthTimePrecision: state.birthData.birthTimePrecision as "known" | "approximate" | "unknown",
          timezone: state.birthData.timezone as string
        }
      : null;
    const chart = extractNormalizedChartFromPayload(state.natalChartPayload);
    const tema = buildTemaDelAno({ chart, birth, asOfDate: args.localDate, observedAt: Date.now() });
    return { status: "ready" as const, localDate: args.localDate, timezone: birth?.timezone ?? null, access: { isPro: true as const }, tema };
  }
});

/**
 * `momento.getCuatroRitmos({ localDate })` — la capa 03: el mandala temporal
 * (CORE-211). No calcula nada por su cuenta: compone los sobres de
 * `getEstacionVital`, `getTemaDelAno`, `home.getLunaSobreLaCarta` y
 * `transits.getPanorama` para la fecha canónica y los describe como cuatro
 * anillos (`convex/lib/cuatroRitmos.ts`). Una fuente que falla deja su anillo
 * vacío y no tira las demás. Free recibe `locked` antes de tocar ninguna
 * fuente. No se cachea: cada fuente ya tiene su propio cache.
 */
export const getCuatroRitmos = action({
  args: { localDate: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx as any);
    const dayState: any = await ctx.runQuery(internalApi.daily.getGuideTimezone, { tokenIdentifier: identity.tokenIdentifier });
    const canonical = resolveCanonicalDailyContext({ birthTimezone: dayState.birthTimezone, latestGuide: dayState.latestGuide });
    if (args.localDate !== canonical.localDate) {
      throw new Error("Tu momento usa la fecha canónica del servidor");
    }
    const state: any = await ctx.runQuery(internalApi.momento.getMomentoState, {
      tokenIdentifier: identity.tokenIdentifier,
      localDate: args.localDate,
      kind: "cuatro_ritmos"
    });
    if (!state.isPro) {
      return { status: "locked" as const, localDate: args.localDate, access: { isPro: false as const } };
    }
    const timezone = (state.birthData?.timezone as string | undefined) ?? null;
    const exact = state.birthData?.birthTimePrecision === "known";
    const fuente = async <T>(run: () => Promise<T>): Promise<T | null> => {
      try {
        return await run();
      } catch {
        return null;
      }
    };
    const [estacionSobre, temaSobre, luna, panorama] = await Promise.all([
      fuente(() => ctx.runAction(publicApi.momento.getEstacionVital, { localDate: args.localDate })),
      fuente(() => ctx.runAction(publicApi.momento.getTemaDelAno, { localDate: args.localDate })),
      fuente(() => ctx.runAction(publicApi.home.getLunaSobreLaCarta, {})),
      fuente(() => ctx.runAction(publicApi.transits.getPanorama, { localDate: args.localDate }))
    ]);
    const estacion: EstacionVital | null = estacionSobre && estacionSobre.status === "ready" ? (estacionSobre.estacion as EstacionVital) : null;
    const tema: TemaDelAno | null = temaSobre && temaSobre.status === "ready" ? (temaSobre.tema as TemaDelAno) : null;
    const lunar: RitmoLunarFuente | null = luna
      ? { cumpleluna: (luna.cumpleluna as RitmoLunarFuente["cumpleluna"]) ?? null, limitations: Array.isArray(luna.limitations) ? (luna.limitations as string[]) : [] }
      : null;
    const ritmos = buildCuatroRitmos({
      observedAt: Date.now(),
      exact,
      estacion,
      tema,
      lunar,
      transito: (panorama as TransitPanorama | null) ?? null,
      transitNow: naiveNowIn(timezone ?? undefined)
    });
    return { status: "ready" as const, localDate: args.localDate, timezone, access: { isPro: true as const }, ritmos };
  }
});
