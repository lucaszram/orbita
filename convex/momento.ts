import {
  actionGeneric as action,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { resolveCanonicalDailyContext } from "./daily";
import { getAstrologyApiConfig, hasAstrologyApiCredentials } from "./lib/astrologyApi";
import { findCurrentBirthData } from "./lib/birthDataConsistency";
import { buildEstacionVital, type EstacionVital } from "./lib/estacionVital";
import { isUserPro } from "./lib/subscriptionAccess";
import { runAstrologyApiPlanetsTropical } from "./lib/tropicalEphemeris";
import { findUserByTokenIdentifier, omitUndefined, requireIdentity } from "./lib/users";

const internalApi = internal as any;
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
    return {
      isPro: await isUserPro(ctx, user._id),
      birthData: await findCurrentBirthData(ctx, user._id),
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
