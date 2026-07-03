import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { findUserByTokenIdentifier, getOrCreateUser, requireIdentity } from "./lib/users";

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
    await requireIdentity(ctx);
    return await getOrCreateUser(ctx);
  }
});
