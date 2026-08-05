import {
  mutationGeneric as mutation,
  paginationOptsValidator,
  queryGeneric as query
} from "convex/server";
import { v } from "convex/values";
import { requireBackofficeIdentity } from "./lib/backoffice";

const rangeValidator = v.union(v.literal("7d"), v.literal("30d"), v.literal("90d"));
const segmentValidator = v.union(v.literal("all"), v.literal("pro"), v.literal("free"));
const sortValidator = v.union(
  v.literal("newest"),
  v.literal("last_activity"),
  v.literal("streak")
);
const statusValidator = v.union(
  v.literal("inactive"),
  v.literal("trialing"),
  v.literal("active"),
  v.literal("past_due"),
  v.literal("billing_issue"),
  v.literal("canceled"),
  v.literal("expired")
);
const providerValidator = v.union(
  v.literal("revenuecat"),
  v.literal("stripe"),
  v.literal("stub"),
  v.literal("admin")
);
const planValidator = v.union(
  v.literal("monthly"),
  v.literal("weekly"),
  v.literal("yearly"),
  v.literal("lifetime")
);
const productEventValidator = v.union(
  v.literal("app_opened"),
  v.literal("onboarding_started"),
  v.literal("onboarding_step_viewed"),
  v.literal("account_created"),
  v.literal("onboarding_completed"),
  v.literal("natal_chart_viewed"),
  v.literal("daily_guide_viewed"),
  v.literal("daily_card_revealed"),
  v.literal("paywall_viewed"),
  v.literal("checkout_started"),
  v.literal("checkout_completed"),
  v.literal("checkout_failed"),
  v.literal("natal_chart_created"),
  v.literal("natal_interpretation_created"),
  v.literal("daily_guide_created"),
  v.literal("transit_reading_created"),
  v.literal("void_answer_created"),
  v.literal("saved_reading_created"),
  v.literal("journal_entry_created")
);

const accountValidator = v.object({
  userId: v.id("users"),
  clerkUserId: v.string(),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  createdAt: v.number(),
  onboardingCompletedAt: v.optional(v.number()),
  isPro: v.boolean(),
  status: statusValidator,
  provider: v.optional(providerValidator),
  plan: v.optional(planValidator),
  currentPeriodEnd: v.optional(v.number()),
  isLifetime: v.boolean(),
  lastActivityAt: v.optional(v.number()),
  lastActivityDate: v.optional(v.string()),
  currentStreak: v.number(),
  longestStreak: v.number(),
  activeDayCount: v.number(),
  contentCreatedCount: v.number()
});

const pageValidator = v.object({
  page: v.array(accountValidator),
  isDone: v.boolean(),
  continueCursor: v.string()
});

const effectiveAccessValidator = v.object({
  entitlement: v.union(v.literal("free"), v.literal("orbita_pro")),
  isPro: v.boolean(),
  status: statusValidator,
  provider: v.optional(providerValidator),
  plan: v.optional(planValidator),
  isLifetime: v.boolean(),
  currentPeriodEnd: v.optional(v.number()),
  willRenew: v.optional(v.boolean()),
  canManageInStripePortal: v.boolean()
});

/** TODO: pendiente backend — implementación en el PR siguiente. */
export const getDashboard = query({
  args: { range: rangeValidator },
  returns: v.object({
    range: rangeValidator,
    totalAccounts: v.number(),
    newAccounts: v.number(),
    proAccounts: v.number(),
    freeAccounts: v.number(),
    activeToday: v.number(),
    activeStreaks: v.number(),
    contentCreated: v.number(),
    voidAnswers: v.number(),
    backfillStatus: v.union(
      v.literal("not_started"),
      v.literal("running"),
      v.literal("complete"),
      v.literal("error")
    ),
    canManagePro: v.boolean()
  }),
  handler: async (ctx) => {
    await requireBackofficeIdentity(ctx);
    throw new Error("TODO: admin accounts backend is not implemented");
  }
});

/** TODO: pendiente backend — implementación en el PR siguiente. */
export const listAccounts = query({
  args: {
    paginationOpts: paginationOptsValidator,
    segment: segmentValidator,
    sort: sortValidator
  },
  returns: pageValidator,
  handler: async (ctx) => {
    await requireBackofficeIdentity(ctx);
    throw new Error("TODO: admin accounts backend is not implemented");
  }
});

/** TODO: pendiente backend — implementación en el PR siguiente. */
export const searchAccounts = query({
  args: {
    query: v.string(),
    segment: segmentValidator,
    limit: v.number()
  },
  returns: v.array(accountValidator),
  handler: async (ctx) => {
    await requireBackofficeIdentity(ctx);
    throw new Error("TODO: admin accounts backend is not implemented");
  }
});

/** TODO: pendiente backend — implementación en el PR siguiente. */
export const getAccount = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      account: accountValidator,
      effectiveAccess: effectiveAccessValidator,
      manualGrant: v.optional(
        v.object({
          mode: v.union(v.literal("permanent"), v.literal("until")),
          expiresAt: v.optional(v.number()),
          updatedAt: v.number()
        })
      ),
      recentVoid: v.array(
        v.object({
          voidAnswerId: v.id("voidAnswers"),
          question: v.string(),
          localDate: v.string(),
          createdAt: v.number()
        })
      )
    })
  ),
  handler: async (ctx) => {
    await requireBackofficeIdentity(ctx);
    throw new Error("TODO: admin accounts backend is not implemented");
  }
});

/** TODO: pendiente backend — implementación en el PR siguiente. */
export const listActivity = query({
  args: { userId: v.id("users"), paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        eventId: v.string(),
        eventName: productEventValidator,
        occurredAt: v.number(),
        localDate: v.string(),
        entryPoint: v.optional(v.string()),
        question: v.optional(v.string()),
        backfilled: v.boolean()
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string()
  }),
  handler: async (ctx) => {
    await requireBackofficeIdentity(ctx);
    throw new Error("TODO: admin accounts backend is not implemented");
  }
});

/** TODO: pendiente backend — implementación en el PR siguiente. */
export const grantPro = mutation({
  args: {
    userId: v.id("users"),
    mode: v.union(v.literal("permanent"), v.literal("until")),
    expiresAt: v.optional(v.number()),
    reason: v.string()
  },
  returns: v.object({
    manualGrantApplied: v.literal(true),
    effectiveAccess: effectiveAccessValidator,
    auditEventId: v.id("adminAuditEvents")
  }),
  handler: async (ctx) => {
    await requireBackofficeIdentity(ctx);
    throw new Error("TODO: admin accounts backend is not implemented");
  }
});

/** TODO: pendiente backend — implementación en el PR siguiente. */
export const revokePro = mutation({
  args: { userId: v.id("users"), reason: v.string() },
  returns: v.object({
    manualGrantRemoved: v.boolean(),
    effectiveAccess: effectiveAccessValidator,
    auditEventId: v.id("adminAuditEvents")
  }),
  handler: async (ctx) => {
    await requireBackofficeIdentity(ctx);
    throw new Error("TODO: admin accounts backend is not implemented");
  }
});
