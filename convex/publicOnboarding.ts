"use node";

/**
 * Superficie pública del onboarding anónimo.
 *
 * Solo existe `computeTriad`: calcula Sol · Luna · Ascendente para alguien que
 * todavía no creó cuenta. NO comparte nada con `convex/publicLab.ts` — el lab
 * es superficie de laboratorio y sigue bloqueado en producción — y no persiste
 * ningún dato de nacimiento: la única escritura es el contador del rate limit.
 *
 * Corre en el runtime Node para derivar la zona horaria de las coordenadas con
 * el mismo resolver empaquetado que usa el resto del alta (`geo-tz`), sin pasar
 * nunca por la zona del dispositivo.
 */
import { actionGeneric as action } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { runAstrologyApiNatalChart } from "./lib/astrologyApi";
import { timezoneAtCoordinates } from "./lib/placeTimezone";
import { computeOnboardingTriad, type OnboardingTriad } from "./lib/onboardingTriad";

const internalApi = internal as any;

const birthTimePrecisionValidator = v.union(v.literal("known"), v.literal("approximate"), v.literal("unknown"));
const signValidator = v.union(v.string(), v.null());

/**
 * Acción pública SIN sesión. Devuelve exactamente `{ sun, moon, ascendant }`
 * (el `returns` validator lo garantiza en runtime, no solo en el tipo). Los
 * errores salen con código `ONBOARDING_TRIAD_*` para que el onboarding pueda
 * distinguir "reintentá" de "revisá los datos" en vez de seguir de largo.
 */
export const computeTriad = action({
  args: {
    birthDate: v.string(),
    birthTime: v.optional(v.string()),
    birthTimePrecision: birthTimePrecisionValidator,
    birthPlaceLabel: v.optional(v.string()),
    latitude: v.number(),
    longitude: v.number(),
    /** Borrador del alta: cupo de reintentos del flujo (no se persiste acá). */
    clientDraftId: v.string()
  },
  returns: v.object({
    sun: signValidator,
    moon: signValidator,
    ascendant: signValidator
  }),
  handler: async (ctx, args): Promise<OnboardingTriad> => {
    const now = Date.now();

    return await computeOnboardingTriad({
      args: {
        birthDate: args.birthDate,
        birthTime: args.birthTime,
        birthTimePrecision: args.birthTimePrecision,
        birthPlaceLabel: args.birthPlaceLabel,
        latitude: args.latitude,
        longitude: args.longitude,
        clientDraftId: args.clientDraftId
      },
      now,
      // La zona sale SIEMPRE de las coordenadas del lugar de nacimiento.
      resolveTimezone: (latitude, longitude) => timezoneAtCoordinates(latitude, longitude),
      consumeRateLimit: (subject) =>
        ctx.runMutation(internalApi.publicRateLimits.consumeOnboardingTriad, { subject, now }),
      // El deadline aborta el fetch natal: sin esto la acción podía quedarse
      // colgada del proveedor hasta el techo del runtime.
      runNatalChart: ({ input, localDate, signal }) =>
        runAstrologyApiNatalChart({ input, localDate, signal })
    });
  }
});
