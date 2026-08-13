/**
 * Contadores del rate limit de las acciones públicas SIN sesión.
 *
 * Vive aparte de `convex/publicOnboarding.ts` porque ese módulo corre en el
 * runtime Node (usa el resolver de zona empaquetado) y un módulo Node solo
 * puede definir actions.
 */
import { internalMutationGeneric as internalMutation } from "convex/server";
import { v } from "convex/values";
import { getOnboardingTriadRateLimits } from "./lib/onboardingTriad";
import { buildRateLimitBucketKey, evaluateRateLimit, type RateLimitConfig } from "./lib/rateLimit";

/** Cuántos documentos vencidos se limpian por invocación. */
const CLEANUP_BATCH = 10;

type Slot = {
  config: RateLimitConfig;
  bucketKey: string;
  existing: any | null;
};

async function loadSlot(ctx: any, config: RateLimitConfig, subject: string, now: number): Promise<Slot> {
  const bucketKey = buildRateLimitBucketKey(config.scope, subject, now, config.windowMs);
  const existing = await ctx.db
    .query("publicRateLimits")
    .withIndex("by_bucketKey", (q: any) => q.eq("bucketKey", bucketKey))
    .first();
  return { config, bucketKey, existing };
}

/**
 * Consume una llamada de la tríada anónima: primero el cupo del borrador y
 * después el fusible global. Si alguno de los dos niega, no se incrementa
 * ninguno — así un corte del fusible no gasta también el cupo del alta.
 */
export const consumeOnboardingTriad = internalMutation({
  args: {
    subject: v.string(),
    now: v.number()
  },
  returns: v.object({
    allowed: v.boolean(),
    retryAfterMs: v.number(),
    scope: v.union(v.string(), v.null())
  }),
  handler: async (ctx, args) => {
    const limits = getOnboardingTriadRateLimits();
    const slots = [
      await loadSlot(ctx, limits.perDraft, args.subject, args.now),
      await loadSlot(ctx, limits.globalFuse, "all", args.now)
    ];

    const decisions = slots.map((slot) =>
      evaluateRateLimit({
        existing: slot.existing
          ? { count: slot.existing.count, windowStartedAt: slot.existing.windowStartedAt }
          : null,
        now: args.now,
        config: slot.config
      })
    );

    const deniedIndex = decisions.findIndex((decision) => !decision.allowed);
    if (deniedIndex >= 0) {
      return {
        allowed: false,
        retryAfterMs: decisions[deniedIndex].retryAfterMs,
        scope: slots[deniedIndex].config.scope
      };
    }

    let inserted = false;
    for (const [index, slot] of slots.entries()) {
      const decision = decisions[index];
      if (slot.existing) {
        await ctx.db.patch(slot.existing._id, {
          count: decision.nextCount,
          windowStartedAt: decision.windowStartedAt,
          expiresAt: decision.expiresAt
        });
      } else {
        await ctx.db.insert("publicRateLimits", {
          bucketKey: slot.bucketKey,
          scope: slot.config.scope,
          count: decision.nextCount,
          windowStartedAt: decision.windowStartedAt,
          expiresAt: decision.expiresAt
        });
        inserted = true;
      }
    }

    // Sin cron dedicado: cada ventana nueva se lleva unas pocas vencidas.
    if (inserted) {
      const stale = await ctx.db
        .query("publicRateLimits")
        .withIndex("by_expiresAt", (q: any) => q.lt("expiresAt", args.now))
        .take(CLEANUP_BATCH);
      for (const doc of stale) {
        await ctx.db.delete(doc._id);
      }
    }

    return { allowed: true, retryAfterMs: 0, scope: null };
  }
});
