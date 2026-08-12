import {
  internalActionGeneric as internalAction,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery,
  mutationGeneric as mutation,
  queryGeneric as query
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { resolvePlaceWithAstrologyApi } from "./lib/astrologyApi";
import { normalizeBirthTime } from "./lib/orbita";
import { decideOnboardingBirthDataWrite } from "./lib/onboardingBirthData";
import {
  pickTimezoneCandidate,
  timezoneResolutionKey,
  timezoneRetryDelayMs
} from "./lib/onboardingTimezone";
import { recordBackendProductEvent } from "./lib/productAnalytics";
import { findUserByTokenIdentifier, getOrCreateUser, omitUndefined, requireUser } from "./lib/users";

const internalApi = internal as any;
const MAX_TIMEZONE_RESOLUTION_ATTEMPTS = 9;

const identityValidator = v.union(v.literal("ella"), v.literal("el"), v.literal("prefiero_no_decirlo"));
const birthTimePrecisionValidator = v.union(v.literal("known"), v.literal("approximate"), v.literal("unknown"));
const paymentStateValidator = v.union(v.literal("not_started"), v.literal("started"), v.literal("paid"), v.literal("skipped"));

async function findDraftForCurrentContext(ctx: any, clientDraftId?: string) {
  const identity = await ctx.auth.getUserIdentity();
  const user = identity ? await findUserByTokenIdentifier(ctx, identity.tokenIdentifier) : null;

  if (user) {
    const userDraft = await ctx.db
      .query("onboardingDrafts")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();

    if (userDraft) {
      return userDraft;
    }
  }

  if (!clientDraftId) {
    return null;
  }

  return await ctx.db
    .query("onboardingDrafts")
    .withIndex("by_clientDraftId", (q: any) => q.eq("clientDraftId", clientDraftId))
    .first();
}

export const getDraft = query({
  args: {
    clientDraftId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    return await findDraftForCurrentContext(ctx, args.clientDraftId);
  }
});

export const saveDraft = mutation({
  args: {
    clientDraftId: v.optional(v.string()),
    currentStep: v.number(),
    identity: v.optional(identityValidator),
    birthDate: v.optional(v.string()),
    birthTime: v.optional(v.string()),
    birthTimePrecision: v.optional(birthTimePrecisionValidator),
    birthPlaceLabel: v.optional(v.string()),
    placeId: v.optional(v.string()),
    placeProvider: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    timezone: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await getOrCreateUser(ctx).catch(() => null);

    if (!user && !args.clientDraftId) {
      throw new Error("clientDraftId is required for anonymous onboarding drafts");
    }

    const existing = user
      ? await ctx.db
          .query("onboardingDrafts")
          .withIndex("by_user", (q: any) => q.eq("userId", user._id))
          .first()
      : await ctx.db
          .query("onboardingDrafts")
          .withIndex("by_clientDraftId", (q: any) => q.eq("clientDraftId", args.clientDraftId))
          .first();

    const patch = omitUndefined({
      userId: user?._id,
      clientDraftId: args.clientDraftId,
      currentStep: args.currentStep,
      identity: args.identity,
      birthDate: args.birthDate,
      birthTime: normalizeBirthTime(args.birthTime),
      birthTimePrecision: args.birthTimePrecision,
      birthPlaceLabel: args.birthPlaceLabel,
      placeId: args.placeId,
      placeProvider: args.placeProvider,
      latitude: args.latitude,
      longitude: args.longitude,
      timezone: args.timezone,
      accountState: user ? "created" : "anonymous",
      updatedAt: now
    });

    const labelChanged = Boolean(
      existing &&
      args.birthPlaceLabel !== undefined &&
      args.birthPlaceLabel !== existing.birthPlaceLabel
    );
    const placeChanged = Boolean(
      existing &&
      (
        labelChanged ||
        (args.latitude !== undefined && args.latitude !== existing.latitude) ||
        (args.longitude !== undefined && args.longitude !== existing.longitude)
      )
    );
    const effectiveTimezone = args.timezone ?? (placeChanged ? undefined : existing?.timezone);
    const effectivePlace = args.birthPlaceLabel ?? existing?.birthPlaceLabel;
    // Una etiqueta nueva no puede heredar silenciosamente las coordenadas de
    // la ciudad anterior si el cliente todavía no envió el nuevo par.
    const effectiveLatitude = args.latitude ?? (labelChanged ? undefined : existing?.latitude);
    const effectiveLongitude = args.longitude ?? (labelChanged ? undefined : existing?.longitude);
    const resolutionKey =
      !effectiveTimezone &&
      effectivePlace &&
      Number.isFinite(effectiveLatitude) &&
      Number.isFinite(effectiveLongitude)
        ? timezoneResolutionKey(effectivePlace, effectiveLatitude!, effectiveLongitude!)
        : undefined;
    const shouldSchedule = Boolean(
      resolutionKey && existing?.timezoneResolutionKey !== resolutionKey
    );
    const resolutionClaimPatch =
      effectiveTimezone
        ? { timezoneResolutionKey: undefined }
        : shouldSchedule
          ? { timezoneResolutionKey: resolutionKey }
          : placeChanged
            ? { timezoneResolutionKey: undefined }
            : {};
    let draftId: any;
    if (existing) {
      await ctx.db.patch(
        existing._id,
        // Cambiar de lugar invalida el timezone anterior. `undefined` elimina el
        // campo opcional en Convex; conservarlo calcularía la carta nueva con la
        // zona de la ciudad vieja hasta que el worker terminara.
        labelChanged && args.timezone === undefined
          ? {
              ...patch,
              ...resolutionClaimPatch,
              latitude: args.latitude,
              longitude: args.longitude,
              placeId: args.placeId,
              placeProvider: args.placeProvider,
              timezone: undefined
            }
          : placeChanged && args.timezone === undefined
            ? { ...patch, ...resolutionClaimPatch, timezone: undefined }
          : { ...patch, ...resolutionClaimPatch }
      );
      draftId = existing._id;
    } else {
      draftId = await ctx.db.insert("onboardingDrafts", {
        ...patch,
        ...resolutionClaimPatch,
        currentStep: args.currentStep,
        accountState: user ? "created" : "anonymous",
        paymentState: "not_started",
        createdAt: now,
        updatedAt: now
      });
    }

    // Lugar + coordenadas son el dato de la persona; timezone es un
    // enriquecimiento técnico. Si todavía no llegó, el borrador YA quedó
    // guardado y el backend lo resuelve en segundo plano. Nunca se obliga a la
    // persona a volver atrás ni se usa la zona del teléfono como reemplazo.
    if (shouldSchedule && resolutionKey) {
      await ctx.scheduler.runAfter(0, internalApi.onboarding.resolveDraftTimezone, {
        draftId,
        resolutionKey,
        attempt: 0
      });
    }

    return draftId;
  }
});

/** Snapshot mínimo para el worker; nunca expone el borrador a otro usuario. */
export const getDraftForTimezoneResolution = internalQuery({
  args: { draftId: v.id("onboardingDrafts") },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) return null;
    return {
      birthPlaceLabel: draft.birthPlaceLabel,
      latitude: draft.latitude,
      longitude: draft.longitude,
      timezone: draft.timezone,
      timezoneResolutionKey: draft.timezoneResolutionKey
    };
  }
});

/**
 * Aplica únicamente la resolución correspondiente al mismo lugar que leyó el
 * worker. Si la persona eligió otra ciudad mientras la llamada estaba en vuelo,
 * la respuesta vieja se descarta y el save nuevo programa su propio trabajo.
 */
export const applyResolvedDraftTimezone = internalMutation({
  args: {
    draftId: v.id("onboardingDrafts"),
    birthPlaceLabel: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    resolutionKey: v.string(),
    timezone: v.string()
  },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) return { applied: false, reason: "draft_missing" as const };
    if (draft.timezone) return { applied: false, reason: "already_ready" as const };
    if (draft.timezoneResolutionKey !== args.resolutionKey) {
      return { applied: false, reason: "stale_claim" as const };
    }
    if (
      draft.birthPlaceLabel !== args.birthPlaceLabel ||
      draft.latitude !== args.latitude ||
      draft.longitude !== args.longitude
    ) {
      return { applied: false, reason: "place_changed" as const };
    }
    await ctx.db.patch(draft._id, {
      timezone: args.timezone,
      timezoneResolutionKey: undefined,
      updatedAt: Date.now()
    });
    return { applied: true, reason: "resolved" as const };
  }
});

/** Libera sólo el claim de esta cadena; una cadena vieja no toca la nueva. */
export const releaseDraftTimezoneResolution = internalMutation({
  args: {
    draftId: v.id("onboardingDrafts"),
    resolutionKey: v.string()
  },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.timezoneResolutionKey !== args.resolutionKey) return false;
    await ctx.db.patch(draft._id, { timezoneResolutionKey: undefined, updatedAt: Date.now() });
    return true;
  }
});

/**
 * Resolución durable de timezone. Un fallo del proveedor conserva el borrador
 * intacto y programa backoff; no existe un estado de error que deba resolver la
 * persona. Una nueva apertura/edición vuelve a guardar y reinicia la cadena.
 */
export const resolveDraftTimezone = internalAction({
  args: {
    draftId: v.id("onboardingDrafts"),
    resolutionKey: v.string(),
    attempt: v.number()
  },
  handler: async (ctx, args) => {
    const draft: any = await ctx.runQuery(internalApi.onboarding.getDraftForTimezoneResolution, {
      draftId: args.draftId
    });
    if (!draft || draft.timezone) return { status: "ready" as const };
    if (draft.timezoneResolutionKey !== args.resolutionKey) {
      return { status: "stale" as const };
    }
    if (
      !draft.birthPlaceLabel ||
      !Number.isFinite(draft.latitude) ||
      !Number.isFinite(draft.longitude)
    ) {
      return { status: "waiting_for_place" as const };
    }

    let timezone: string | null = null;
    try {
      const result = await resolvePlaceWithAstrologyApi(draft.birthPlaceLabel);
      timezone = pickTimezoneCandidate(result.places, draft.latitude, draft.longitude);
    } catch {
      // El proveedor puede fallar o agotar el timeout. Se trata igual que una
      // respuesta sin timezone para conservar el backoff durable sin filtrar
      // la consulta natal a logs.
    }
    if (timezone) {
      const applied: any = await ctx.runMutation(internalApi.onboarding.applyResolvedDraftTimezone, {
        draftId: args.draftId,
        birthPlaceLabel: draft.birthPlaceLabel,
        latitude: draft.latitude,
        longitude: draft.longitude,
        resolutionKey: args.resolutionKey,
        timezone
      });
      return { status: applied.applied ? "resolved" as const : "stale" as const };
    }

    const nextAttempt = Math.max(0, Math.trunc(args.attempt)) + 1;
    if (nextAttempt < MAX_TIMEZONE_RESOLUTION_ATTEMPTS) {
      await ctx.scheduler.runAfter(
        timezoneRetryDelayMs(args.attempt),
        internalApi.onboarding.resolveDraftTimezone,
        { draftId: args.draftId, resolutionKey: args.resolutionKey, attempt: nextAttempt }
      );
    } else {
      await ctx.runMutation(internalApi.onboarding.releaseDraftTimezoneResolution, {
        draftId: args.draftId,
        resolutionKey: args.resolutionKey
      });
    }
    return {
      status: "pending" as const,
      scheduled: nextAttempt < MAX_TIMEZONE_RESOLUTION_ATTEMPTS
    };
  }
});

export const completeBirthData = mutation({
  args: {
    clientDraftId: v.optional(v.string()),
    birthDate: v.string(),
    birthTime: v.optional(v.string()),
    birthTimePrecision: birthTimePrecisionValidator,
    birthPlaceLabel: v.string(),
    placeId: v.optional(v.string()),
    placeProvider: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    timezone: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const normalizedBirthTime = normalizeBirthTime(args.birthTime);
    const existingBirthData = await ctx.db
      .query("birthData")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();

    const payloadWithoutTime = omitUndefined({
      userId: user._id,
      birthDate: args.birthDate,
      birthTimePrecision: args.birthTimePrecision,
      birthPlaceLabel: args.birthPlaceLabel,
      placeId: args.placeId,
      placeProvider: args.placeProvider,
      latitude: args.latitude,
      longitude: args.longitude,
      timezone: args.timezone,
      source: "onboarding",
      updatedAt: now
    });

    const writeDecision = decideOnboardingBirthDataWrite(
      existingBirthData,
      {
        birthDate: args.birthDate,
        birthTime: normalizedBirthTime,
        birthTimePrecision: args.birthTimePrecision,
        birthPlaceLabel: args.birthPlaceLabel,
        latitude: args.latitude,
        longitude: args.longitude,
        timezone: args.timezone
      }
    );

    const birthDataId =
      writeDecision === "idempotent"
        ? existingBirthData!._id
        : await ctx.db.insert("birthData", {
          ...payloadWithoutTime,
          ...omitUndefined({ birthTime: normalizedBirthTime }),
          createdAt: now
        });

    const draft = args.clientDraftId
      ? await ctx.db
          .query("onboardingDrafts")
          .withIndex("by_clientDraftId", (q: any) => q.eq("clientDraftId", args.clientDraftId))
          .first()
      : await ctx.db
          .query("onboardingDrafts")
          .withIndex("by_user", (q: any) => q.eq("userId", user._id))
          .first();

    if (draft) {
      await ctx.db.patch(
        draft._id,
        {
          ...omitUndefined({
            userId: user._id,
            currentStep: Math.max(draft.currentStep ?? 0, 11),
            birthDate: args.birthDate,
            birthTimePrecision: args.birthTimePrecision,
            birthPlaceLabel: args.birthPlaceLabel,
            placeId: args.placeId,
            placeProvider: args.placeProvider,
            latitude: args.latitude,
            longitude: args.longitude,
            timezone: args.timezone,
            accountState: "created",
            updatedAt: now
          }),
          // Igual que birthData: limpiar una hora previa cuando pasa a unknown.
          birthTime: normalizedBirthTime
        }
      );
    }

    if (!existingBirthData) {
      await recordBackendProductEvent(ctx, {
        eventName: "onboarding_completed",
        userId: user._id,
        dedupeKey: String(birthDataId),
        occurredAt: now
      });
    }

    return birthDataId;
  }
});

export const markAccountCreated = mutation({
  args: {
    clientDraftId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const draft = args.clientDraftId
      ? await ctx.db
          .query("onboardingDrafts")
          .withIndex("by_clientDraftId", (q: any) => q.eq("clientDraftId", args.clientDraftId))
          .first()
      : await ctx.db
          .query("onboardingDrafts")
          .withIndex("by_user", (q: any) => q.eq("userId", user._id))
          .first();

    if (!draft) {
      return await ctx.db.insert("onboardingDrafts", omitUndefined({
        userId: user._id,
        clientDraftId: args.clientDraftId,
        currentStep: 14,
        accountState: "created",
        paymentState: "not_started",
        createdAt: now,
        updatedAt: now
      }));
    }

    await ctx.db.patch(draft._id, {
      userId: user._id,
      currentStep: Math.max(draft.currentStep ?? 0, 14),
      accountState: "created",
      updatedAt: now
    });

    return draft._id;
  }
});

export const markPaymentState = mutation({
  args: {
    state: paymentStateValidator
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const draft = await ctx.db
      .query("onboardingDrafts")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();

    if (!draft) {
      return await ctx.db.insert("onboardingDrafts", {
        userId: user._id,
        currentStep: 15,
        accountState: "created",
        paymentState: args.state,
        createdAt: now,
        updatedAt: now
      });
    }

    await ctx.db.patch(draft._id, {
      currentStep: Math.max(draft.currentStep ?? 0, 15),
      paymentState: args.state,
      updatedAt: now
    });

    return draft._id;
  }
});
