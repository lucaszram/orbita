import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import { deleteAccountData } from "./lib/accountDeletion";
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
    return await getOrCreateUser(ctx);
  }
});

/**
 * Deletes every Convex document owned by the authenticated Clerk identity.
 *
 * Clerk itself is deleted by the native client only after this mutation
 * succeeds. That order is deliberate: deleting Clerk first would revoke the
 * token required to prove which Convex graph may be removed. The operation is
 * idempotent, so a Clerk failure can safely retry this mutation.
 */
export const deleteAccount = mutation({
  args: {},
  returns: v.object({ deleted: v.literal(true) }),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const user = await findUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    const clerkUserIds = user
      ? [identity.subject, user.clerkUserId]
      : [identity.subject];

    const deletedRecords = await deleteAccountData(ctx, {
      userId: user?._id,
      clerkUserIds
    });

    console.info("[account.delete]", { deletedRecords });
    return { deleted: true as const };
  }
});
