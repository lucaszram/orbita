import {
  internalActionGeneric as internalAction,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery,
  mutationGeneric as mutation
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  analyticsLocalDate,
  assertOpaqueAnalyticsId,
  assertSafeEntryPoint,
  computeDailyDigestMetrics,
  formatDailyDigest,
  shiftIsoDate
} from "./lib/productAnalytics";
import { findUserByTokenIdentifier } from "./lib/users";

const internalApi = internal as any;
const frontendEventName = v.union(
  v.literal("app_opened"),
  v.literal("onboarding_started"),
  v.literal("onboarding_step_viewed"),
  v.literal("natal_chart_viewed"),
  v.literal("daily_guide_viewed"),
  v.literal("paywall_viewed"),
  v.literal("checkout_started")
);
const platformName = v.union(v.literal("ios"), v.literal("android"), v.literal("web"), v.literal("unknown"));

function assertOptionalTechnicalValue(label: string, value: string | undefined): void {
  if (value === undefined) return;
  if (value.length < 1 || value.length > 40 || !/^[A-Za-z0-9._+-]+$/.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
}

/**
 * Nuevo colector de eventos del cliente. El cliente crea eventId/sessionId UUID y
 * conserva installationId en almacenamiento local. Los reintentos son idempotentes.
 * No acepta propiedades libres: así datos natales o texto personal no pueden entrar.
 */
export const track = mutation({
  args: {
    eventId: v.string(),
    eventName: frontendEventName,
    installationId: v.string(),
    sessionId: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
    platform: v.optional(platformName),
    appVersion: v.optional(v.string()),
    buildNumber: v.optional(v.string()),
    onboardingStep: v.optional(v.number()),
    entryPoint: v.optional(v.string())
  },
  returns: v.object({ recorded: v.boolean() }),
  handler: async (ctx, args) => {
    assertOpaqueAnalyticsId("eventId", args.eventId);
    assertOpaqueAnalyticsId("installationId", args.installationId);
    if (args.sessionId !== undefined) assertOpaqueAnalyticsId("sessionId", args.sessionId);
    assertOptionalTechnicalValue("appVersion", args.appVersion);
    assertOptionalTechnicalValue("buildNumber", args.buildNumber);
    assertSafeEntryPoint(args.entryPoint);
    const receivedAt = Date.now();
    const occurredAt = args.occurredAt ?? receivedAt;
    if (
      !Number.isFinite(occurredAt) ||
      occurredAt < receivedAt - 7 * 24 * 60 * 60_000 ||
      occurredAt > receivedAt + 5 * 60_000
    ) {
      throw new Error("Invalid occurredAt");
    }
    if (args.onboardingStep !== undefined) {
      if (args.eventName !== "onboarding_step_viewed") {
        throw new Error("onboardingStep is only valid for onboarding_step_viewed");
      }
      if (!Number.isInteger(args.onboardingStep) || args.onboardingStep < 0 || args.onboardingStep > 40) {
        throw new Error("Invalid onboardingStep");
      }
    }

    const duplicate = await ctx.db
      .query("productEvents")
      .withIndex("by_event_id", (q: any) => q.eq("eventId", args.eventId))
      .first();
    if (duplicate) return { recorded: false };

    const localDate = analyticsLocalDate(occurredAt);
    const identity = await ctx.auth.getUserIdentity();
    const user = identity
      ? await findUserByTokenIdentifier(ctx, identity.tokenIdentifier)
      : null;
    let actor = await ctx.db
      .query("productActors")
      .withIndex("by_installation", (q: any) => q.eq("installationId", args.installationId))
      .first();

    if (!actor) {
      const actorId = await ctx.db.insert("productActors", {
        installationId: args.installationId,
        ...(user ? { userId: user._id } : {}),
        firstSeenAt: occurredAt,
        firstSeenDate: localDate,
        ...(args.eventName === "app_opened"
          ? {
              firstOpenedAt: occurredAt,
              firstOpenedDate: localDate,
              lastOpenedAt: occurredAt,
              lastOpenedDate: localDate
            }
          : {}),
        ...(args.platform ? { platform: args.platform } : {}),
        ...(args.appVersion ? { appVersion: args.appVersion } : {}),
        ...(args.buildNumber ? { buildNumber: args.buildNumber } : {}),
        createdAt: receivedAt,
        updatedAt: receivedAt
      });
      actor = await ctx.db.get(actorId);
    } else {
      const patch: Record<string, unknown> = {
        updatedAt: receivedAt,
        ...(args.platform ? { platform: args.platform } : {}),
        ...(args.appVersion ? { appVersion: args.appVersion } : {}),
        ...(args.buildNumber ? { buildNumber: args.buildNumber } : {})
      };
      if (occurredAt < actor.firstSeenAt) {
        patch.firstSeenAt = occurredAt;
        patch.firstSeenDate = localDate;
      }
      // Una instalación puede cambiar de cuenta. Conservamos el primer vínculo y
      // cada evento autenticado guarda además el userId vigente como snapshot.
      if (user && !actor.userId) patch.userId = user._id;
      if (args.eventName === "app_opened") {
        if (!actor.lastOpenedAt || occurredAt > actor.lastOpenedAt) {
          patch.lastOpenedAt = occurredAt;
          patch.lastOpenedDate = localDate;
        }
        if (!actor.firstOpenedAt || occurredAt < actor.firstOpenedAt) {
          patch.firstOpenedAt = occurredAt;
          patch.firstOpenedDate = localDate;
        }
      }
      await ctx.db.patch(actor._id, patch);
    }

    if (!actor) throw new Error("Unable to resolve analytics actor");
    await ctx.db.insert("productEvents", {
      eventId: args.eventId,
      eventName: args.eventName,
      source: "frontend",
      actorId: actor._id,
      ...(user ? { userId: user._id } : {}),
      installationId: args.installationId,
      ...(args.sessionId ? { sessionId: args.sessionId } : {}),
      localDate,
      occurredAt,
      ...(args.platform ? { platform: args.platform } : {}),
      ...(args.appVersion ? { appVersion: args.appVersion } : {}),
      ...(args.buildNumber ? { buildNumber: args.buildNumber } : {}),
      ...(args.onboardingStep !== undefined ? { onboardingStep: args.onboardingStep } : {}),
      ...(args.entryPoint ? { entryPoint: args.entryPoint } : {})
    });

    return { recorded: true };
  }
});

/**
 * Compatibilidad con builds anteriores: ese cliente llama una sola vez por
 * instalación y no tiene installationId, por lo que no sirve para el digest.
 */
export const appOpened = mutation({
  args: { platform: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const platform = args.platform ? ` (${args.platform})` : "";
    await ctx.scheduler.runAfter(0, internalApi.notify.sendTelegram, {
      text: `📲 Nueva instalación de Órbita${platform}`
    });
    return null;
  }
});

export const computeDigest = internalQuery({
  args: { reportDate: v.string(), previousDate: v.string() },
  handler: async (ctx, args) => {
    const [currentEvents, previousEvents] = await Promise.all([
      ctx.db
        .query("productEvents")
        .withIndex("by_date_event", (q: any) => q.eq("localDate", args.reportDate))
        .collect(),
      ctx.db
        .query("productEvents")
        .withIndex("by_date_event", (q: any) => q.eq("localDate", args.previousDate))
        .collect()
    ]);

    const allEvents = [...currentEvents, ...previousEvents];
    const actorIds = new Set(allEvents.flatMap((event: any) => (event.actorId ? [String(event.actorId)] : [])));
    const userIds = new Set(allEvents.flatMap((event: any) => (event.userId ? [String(event.userId)] : [])));
    const actorsById = new Map<string, any>();

    for (const actorId of actorIds) {
      const actor = await ctx.db.get(actorId as any);
      if (actor) actorsById.set(String(actor._id), actor);
    }
    for (const userId of userIds) {
      const userActors = await ctx.db
        .query("productActors")
        .withIndex("by_user", (q: any) => q.eq("userId", userId as any))
        .collect();
      for (const actor of userActors) actorsById.set(String(actor._id), actor);
    }

    const users: any[] = [];
    for (const userId of userIds) {
      const user = await ctx.db.get(userId as any);
      if (user) users.push(user);
    }

    return computeDailyDigestMetrics({
      reportDate: args.reportDate,
      previousDate: args.previousDate,
      currentEvents: currentEvents as any,
      previousEvents: previousEvents as any,
      actors: [...actorsById.values()] as any,
      users
    });
  }
});

export const claimDigest = internalMutation({
  args: { localDate: v.string(), force: v.optional(v.boolean()) },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("productDigests")
      .withIndex("by_date", (q: any) => q.eq("localDate", args.localDate))
      .first();
    if (existing && !args.force) {
      if (existing.status === "sent") return false;
      if (existing.status === "sending" && existing.requestedAt > now - 15 * 60_000) return false;
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "sending",
        requestedAt: now,
        sentAt: undefined,
        failedAt: undefined,
        errorCode: undefined
      });
    } else {
      await ctx.db.insert("productDigests", {
        localDate: args.localDate,
        status: "sending",
        requestedAt: now
      });
    }
    return true;
  }
});

export const finishDigest = internalMutation({
  args: {
    localDate: v.string(),
    status: v.union(v.literal("sent"), v.literal("error")),
    errorCode: v.optional(v.string())
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("productDigests")
      .withIndex("by_date", (q: any) => q.eq("localDate", args.localDate))
      .first();
    if (!existing) return null;
    const now = Date.now();
    await ctx.db.patch(existing._id, {
      status: args.status,
      ...(args.status === "sent"
        ? { sentAt: now, failedAt: undefined, errorCode: undefined }
        : { failedAt: now, errorCode: args.errorCode ?? "telegram_send_failed" })
    });
    return null;
  }
});

export const sendDailyDigest = internalAction({
  args: { reportDate: v.optional(v.string()), force: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reportDate = args.reportDate ?? shiftIsoDate(analyticsLocalDate(), -1);
    const previousDate = shiftIsoDate(reportDate, -1);
    const claimed = await ctx.runMutation(internalApi.telemetry.claimDigest, {
      localDate: reportDate,
      force: args.force
    });
    if (!claimed) return null;

    try {
      const metrics = await ctx.runQuery(internalApi.telemetry.computeDigest, {
        reportDate,
        previousDate
      });
      const delivered = await ctx.runAction(internalApi.notify.sendTelegram, {
        text: formatDailyDigest(metrics)
      });
      await ctx.runMutation(internalApi.telemetry.finishDigest, {
        localDate: reportDate,
        status: delivered ? "sent" : "error",
        ...(!delivered ? { errorCode: "telegram_not_delivered" } : {})
      });
    } catch {
      await ctx.runMutation(internalApi.telemetry.finishDigest, {
        localDate: reportDate,
        status: "error",
        errorCode: "digest_failed"
      });
    }
    return null;
  }
});
