import {
  resolveEntitlement,
  type EntitlementContext,
  type ResolvedEntitlement,
  type SubscriptionRow
} from "./entitlements";
import { isRevenueCatEnvironmentAllowed } from "./revenueCatEvents";

/**
 * Contexto de resolución del deployment.
 *
 * Se calcula acá, en un único lugar, para que todos los consumidores del
 * entitlement usen el mismo criterio en vez de repetirlo (o de olvidarlo, que
 * era el defecto).
 *
 * Los DOS entornos se autorizan explícitamente y con la misma función que usa
 * el webhook, así que el corte es idéntico venga por donde venga:
 *
 * - `development` acepta Sandbox y **no** Production;
 * - `production` acepta Production y Sandbox, de cualquier cuenta (CORE-1043:
 *   sin allowlist de review, ver `isRevenueCatEnvironmentAllowed`);
 * - un deployment sin entorno declarado (`unknown`) no acepta **ninguna** fila.
 *
 * El corte ya no depende de la identidad: es el mismo para todas las cuentas.
 */
export function entitlementContextFor(
  env: Record<string, string | undefined> = process.env
): EntitlementContext {
  return {
    sandboxAllowed: isRevenueCatEnvironmentAllowed("sandbox", { env }),
    productionAllowed: isRevenueCatEnvironmentAllowed("production", { env })
  };
}

/**
 * Resolución canónica a partir de las filas de un usuario, con el corte de
 * entorno de ESTE deployment.
 */
export function resolveRowsForUser(
  rows: SubscriptionRow[],
  now: number = Date.now(),
  env: Record<string, string | undefined> = process.env
): ResolvedEntitlement {
  return resolveEntitlement(rows, now, entitlementContextFor(env));
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
