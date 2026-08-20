import { queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import { findCurrentUser } from "./lib/users";
import type { SubscriptionRow } from "./lib/entitlements";
import { resolveRowsForUser } from "./lib/subscriptionAccess";

const subscriptionStatusValidator = v.union(
  v.literal("inactive"),
  v.literal("trialing"),
  v.literal("active"),
  v.literal("past_due"),
  v.literal("billing_issue"),
  v.literal("canceled"),
  v.literal("expired")
);
const providerValidator = v.union(v.literal("revenuecat"), v.literal("stripe"), v.literal("stub"));
const planValidator = v.union(
  v.literal("monthly"),
  v.literal("weekly"),
  v.literal("yearly"),
  v.literal("lifetime")
);

// Estado de acceso resuelto combinando todas las filas de suscripción del
// usuario (RevenueCat + Stripe + stub). Es la fuente de verdad server-side:
// el cliente combina esto con RevenueCat local, pero nunca escribe su acceso.
export const getCurrent = query({
  args: {},
  returns: v.object({
    entitlement: v.union(v.literal("free"), v.literal("orbita_pro")),
    isPro: v.boolean(),
    status: subscriptionStatusValidator,
    provider: v.optional(providerValidator),
    plan: v.optional(planValidator),
    isLifetime: v.boolean(),
    currentPeriodEnd: v.optional(v.number()),
    willRenew: v.optional(v.boolean()),
    canManageInStripePortal: v.boolean(),
    // Campos ADITIVOS: `provider` nombra a UN ganador, pero una persona puede
    // tener cobros vivos en los dos canales a la vez. Sin estos, la app sólo
    // ofrece cancelar el del ganador y el otro sigue cobrando.
    canManageInRevenueCat: v.boolean(),
    activeProviders: v.array(providerValidator),
    /**
     * Clerk id de la cuenta para la que se calculó ESTE resultado. Aditivo.
     *
     * El cliente cachea el último valor de la query mientras la nueva
     * suscripción resuelve. En un cambio de cuenta A → B eso deja el
     * entitlement de A publicado bajo la sesión de B, y con él el efecto que
     * limpia el marcador de compra: se levantaba el bloqueo de B con una
     * confirmación que no era suya. Con el dueño adentro, la pantalla puede
     * exigir que coincida antes de actuar.
     *
     * `null` = sin sesión (o sin fila): nada que correlacionar.
     */
    clerkUserId: v.union(v.string(), v.null())
  }),
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return { ...resolveRowsForUser([], Date.now()), clerkUserId: null };
    const rows = (await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect()) as SubscriptionRow[];

    return { ...resolveRowsForUser(rows, Date.now()), clerkUserId: user.clerkUserId ?? null };
  }
});
