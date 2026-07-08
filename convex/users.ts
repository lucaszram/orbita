import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { internal } from "./_generated/api";
import { findUserByTokenIdentifier, getOrCreateUser, requireIdentity } from "./lib/users";

const internalApi = internal as any;

export const current = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    return await findUserByTokenIdentifier(ctx, identity.tokenIdentifier);
  }
});

export const getOrCreateCurrentUser = mutation({
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    // ¿Es un alta nueva? (se llama en cada apertura con sesión; solo avisamos la 1ra vez)
    const existingBefore = await findUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    const user = await getOrCreateUser(ctx);

    if (!existingBefore && user) {
      const who = (user as any).email ?? (user as any).name ?? "sin email";
      await ctx.scheduler.runAfter(0, internalApi.notify.sendTelegram, {
        text: `🪐 Nueva cuenta en Órbita — ${who}`
      });
    }

    return user;
  }
});
