import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import { omitUndefined, requireExistingUser, requireUser } from "./lib/users";

const contentKindValidator = v.union(
  v.literal("headline"),
  v.literal("do"),
  v.literal("avoid"),
  v.literal("energy"),
  v.literal("action"),
  v.literal("topic"),
  v.literal("long_read"),
  v.literal("education")
);
const entitlementValidator = v.union(v.literal("free"), v.literal("plus"));
const contentStatusValidator = v.union(v.literal("draft"), v.literal("review"), v.literal("published"), v.literal("archived"));

export const listPublished = query({
  args: {
    locale: v.optional(v.string()),
    kind: v.optional(contentKindValidator)
  },
  handler: async (ctx, args) => {
    await requireExistingUser(ctx);

    if (args.kind) {
      return await ctx.db
        .query("contentModules")
        .withIndex("by_kind_status", (q: any) => q.eq("kind", args.kind).eq("status", "published"))
        .take(100);
    }

    return await ctx.db
      .query("contentModules")
      .withIndex("by_locale_status", (q: any) => q.eq("locale", args.locale ?? "es-AR").eq("status", "published"))
      .take(100);
  }
});

export const upsertForDev = mutation({
  args: {
    kind: contentKindValidator,
    locale: v.optional(v.string()),
    topic: v.optional(v.string()),
    zodiacSign: v.optional(v.string()),
    transitType: v.optional(v.string()),
    entitlement: v.optional(entitlementValidator),
    title: v.string(),
    body: v.string(),
    action: v.optional(v.string()),
    status: v.optional(contentStatusValidator),
    version: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db.insert(
      "contentModules",
      omitUndefined({
        kind: args.kind,
        locale: args.locale ?? "es-AR",
        topic: args.topic,
        zodiacSign: args.zodiacSign,
        transitType: args.transitType,
        entitlement: args.entitlement ?? "free",
        title: args.title,
        body: args.body,
        action: args.action,
        status: args.status ?? "draft",
        version: args.version ?? "dev",
        publishedAt: args.status === "published" ? Date.now() : undefined,
        createdAt: Date.now()
      })
    );
  }
});
