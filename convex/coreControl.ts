/**
 * Aviso de cuenta nueva a core-control.
 *
 * Órbita no manda nada a Telegram: publica el hecho "se creó una cuenta" contra
 * un endpoint de core-control, que es quien decide a qué tema va y con qué
 * formato. Acá sólo viven la entrega, sus reintentos y la clave con la que el
 * otro lado deduplica.
 *
 * **Deduplicación.** core-control deduplica por un hash de `eventId`, así que
 * `eventId` tiene que ser el identificador ESTABLE de la cuenta y no cambiar
 * entre reintentos: se usa el id de Clerk, que `getOrCreateUser` escribe una
 * sola vez y ningún patch posterior toca. Por eso cada intento vuelve a leer el
 * payload de la base en vez de arrastrarlo por los argumentos del scheduler:
 * el email puede cambiar entre intentos, la clave de deduplicación no.
 *
 * **Privacidad.** Del lado de Órbita el email no se persiste en ningún lado
 * nuevo — se lee de la fila de la cuenta y viaja en el cuerpo del pedido. El
 * trabajo agendado sólo lleva `userId`, y esta action no escribe en la base ni
 * loguea.
 */
import {
  internalActionGeneric as internalAction,
  internalQueryGeneric as internalQuery,
  makeFunctionReference
} from "convex/server";
import { v } from "convex/values";
import { SEND_SIGNUP_REF_NAME } from "./lib/users";

const signupPayloadRef = makeFunctionReference<"query">("coreControl:signupPayload");
const sendSignupRef = makeFunctionReference<"action">(SEND_SIGNUP_REF_NAME);

/**
 * Los plazos del reintento, en orden. La cadena termina sola: cuando el intento
 * se pasa del último plazo no queda nada agendado. Son cinco entregas como
 * máximo (la inmediata más cuatro), repartidas en poco más de dos horas y media.
 */
export const SIGNUP_RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000] as const;

/**
 * Lo único que viaja: producto, email e identificador del evento. Nada más de
 * la persona — ni nombre, ni datos natales, ni el token de sesión — entra acá.
 *
 * Sin email no hay aviso y tampoco reintento: no es un fallo transitorio que
 * vaya a resolverse solo, y una cadena de reintentos contra una cuenta que no
 * tiene el dato giraría en falso.
 */
export const signupPayload = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user?.email) return null;
    return {
      appSlug: "orbita",
      email: user.email.trim().toLowerCase(),
      eventId: user.clerkUserId,
      occurredAt: user.createdAt
    };
  }
});

/**
 * Entrega el aviso y, si no lo logra, se reagenda a sí misma con el intento
 * siguiente. No bloquea el alta: la mutation que crea la cuenta la agenda con
 * `runAfter(0, …)` y no espera el resultado.
 *
 * Una configuración incompleta o un endpoint que no sea `https://` cortan sin
 * reintentar: no es algo que se arregle esperando, y el secreto no puede viajar
 * en claro.
 */
export const sendSignup = internalAction({
  args: { userId: v.id("users"), attempt: v.optional(v.number()) },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const signup = await ctx.runQuery(signupPayloadRef, { userId: args.userId }) as {
      appSlug: string;
      email: string;
      eventId: string;
      occurredAt: number;
    } | null;
    if (!signup) return false;

    const endpoint = process.env.CORE_CONTROL_SIGNUP_URL?.trim();
    const secret = process.env.CORE_CONTROL_SIGNUP_SECRET?.trim();
    if (!endpoint || !secret || !endpoint.startsWith("https://")) return false;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(signup),
        signal: AbortSignal.timeout(8_000)
      });
      if (response.ok) return true;
    } catch {
      // Best-effort; the durable scheduler below retries without blocking signup.
    }

    const attempt = args.attempt ?? 0;
    const delay = SIGNUP_RETRY_DELAYS_MS[attempt];
    if (delay !== undefined) {
      await ctx.scheduler.runAfter(delay, sendSignupRef, {
        userId: args.userId,
        attempt: attempt + 1
      });
    }
    return false;
  }
});
