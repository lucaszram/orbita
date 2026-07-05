import { queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import { buildWebB0TransitDetailPayload } from "./lib/orbita";
import { requireExistingUser } from "./lib/users";

export const getToday = query({
  args: {
    localDate: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireExistingUser(ctx);
    const transitReading = await ctx.db
      .query("transitReadings")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .first();

    if (transitReading) {
      return buildWebB0TransitDetailPayload(transitReading.payload, args.localDate);
    }

    const dailyReading = await ctx.db
      .query("dailyReadings")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .first();

    return dailyReading ? buildWebB0TransitDetailPayload(dailyReading.payload, args.localDate) : null;
  }
});
