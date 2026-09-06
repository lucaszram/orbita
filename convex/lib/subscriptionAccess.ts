import {
  resolveEntitlement,
  type EntitlementContext,
  type ResolvedEntitlement,
  type SubscriptionRow
} from "./entitlements";
import { isRevenueCatEnvironmentAllowed } from "./revenueCatEvents";

/**
 * Contexto de resolución para UNA cuenta.
 *
 * Se calcula acá, en un único lugar, para que todos los consumidores del
 * entitlement usen el mismo criterio en vez de repetirlo (o de olvidarlo, que
 * era el defecto).
 *
 * Los DOS entornos se autorizan explícitamente y con la misma función que usa
 * el webhook, así que el corte es idéntico venga por donde venga:
 *
 * - `development` acepta Sandbox y **no** Production;
 * - `production` acepta Production siempre, y Sandbox sólo para las cuentas de
 *   QA/App Review allowlisted;
 * - un deployment sin entorno declarado (`unknown`) no acepta **ninguna** fila.
 *
 * Sin `clerkUserId` no se puede evaluar la allowlist, pero el corte productivo
 * no depende de la identidad: se resuelve igual, y sandbox queda cerrado.
 */
export function entitlementContextFor(
  clerkUserId: string | undefined,
  env: Record<string, string | undefined> = process.env
): EntitlementContext {
  return {
    sandboxAllowed: clerkUserId
      ? isRevenueCatEnvironmentAllowed("sandbox", { env, clerkUserId })
      : false,
    productionAllowed: isRevenueCatEnvironmentAllowed("production", { env, clerkUserId })
  };
}

/**
 * Resolución canónica a partir de las filas de un usuario.
 *
 * El `clerkUserId` sale de las propias filas (está denormalizado en la tabla),
 * así que no hace falta una lectura extra ni pasarlo por parámetro en cada
 * consumidor.
 */
export function resolveRowsForUser(
  rows: SubscriptionRow[],
  now: number = Date.now(),
  env: Record<string, string | undefined> = process.env
): ResolvedEntitlement {
  const clerkUserId = rows.find((row) => row.clerkUserId)?.clerkUserId;
  return resolveEntitlement(rows, now, entitlementContextFor(clerkUserId, env));
}

export async function isUserPro(
  ctx: { db: any },
  userId: string
): Promise<boolean> {
  const rows = (await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect()) as SubscriptionRow[];
  return resolveRowsForUser(rows).isPro;
}
