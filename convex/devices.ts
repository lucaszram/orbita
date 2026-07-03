import { mutationGeneric as mutation } from "convex/server";
import { v } from "convex/values";
import { requireUser } from "./lib/users";

export const registerPushToken = mutation({
  args: {
    platform: v.string(),
    pushToken: v.string(),
    permissionStatus: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("devices")
      .withIndex("by_pushToken", (q: any) => q.eq("pushToken", args.pushToken))
      .first();

    const payload = {
      userId: user._id,
      platform: args.platform,
      pushToken: args.pushToken,
      permissionStatus: args.permissionStatus,
      lastSeenAt: now
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("devices", payload);
  }
});
