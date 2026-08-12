import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import { deleteAccountData } from "./lib/accountDeletion";
import { normalizedProfileName } from "./lib/userProfile";
import { findUserByTokenIdentifier, getOrCreateUser, requireIdentity, requireUser } from "./lib/users";

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
 * Persists the profile name captured by the official Clerk signup.
 *
 * The mutation is intentionally idempotent: onboarding recovery can repeat it
 * after a redirect or a failed chart finalization without duplicating records.
 */
export const setCurrentName = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string()
  },
  returns: v.object({
    userId: v.id("users"),
    firstName: v.string(),
    lastName: v.string(),
    name: v.string()
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const profileName = normalizedProfileName(args.firstName, args.lastName);
    await ctx.db.patch(user._id, {
      ...profileName,
      updatedAt: Date.now()
    });

    return {
      userId: user._id,
      ...profileName
    };
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
