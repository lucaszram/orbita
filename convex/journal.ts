import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import { findCurrentUser, omitUndefined, requireUser } from "./lib/users";

export const list = query({
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("journalEntries")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .take(120);
  }
});

export const create = mutation({
  args: {
    readingId: v.optional(v.id("dailyReadings")),
    title: v.string(),
    note: v.string()
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    return await ctx.db.insert("journalEntries", omitUndefined({
      userId: user._id,
      readingId: args.readingId,
      title: args.title,
      note: args.note.trim(),
      createdAt: now,
      updatedAt: now
    }));
  }
});

export const update = mutation({
  args: {
    entryId: v.id("journalEntries"),
    title: v.optional(v.string()),
    note: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.userId !== user._id) {
      throw new Error("Journal entry not found");
    }

    await ctx.db.patch(args.entryId, {
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(args.note !== undefined ? { note: args.note.trim() } : {}),
      updatedAt: Date.now()
    });

    return args.entryId;
  }
});

export const remove = mutation({
  args: {
    entryId: v.id("journalEntries")
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.userId !== user._id) {
      return false;
    }

    await ctx.db.delete(args.entryId);
    return true;
  }
});
