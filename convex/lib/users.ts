import type { UserIdentity } from "convex/server";
import { userFieldsFromIdentity } from "./orbita";

type ConvexCtx = {
  auth: {
    getUserIdentity(): Promise<UserIdentity | null>;
  };
  db: any;
};

export function omitUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

export async function requireIdentity(ctx: ConvexCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required");
  }

  return identity;
}

export async function findUserByTokenIdentifier(ctx: ConvexCtx, tokenIdentifier: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", tokenIdentifier))
    .first();
}

export async function requireExistingUser(ctx: ConvexCtx) {
  const identity = await requireIdentity(ctx);
  const user = await findUserByTokenIdentifier(ctx, identity.tokenIdentifier);
  if (!user) {
    throw new Error("User record not found");
  }

  return user;
}

export async function getOrCreateUser(ctx: ConvexCtx) {
  const identity = await requireIdentity(ctx);
  const now = Date.now();
  const fields = omitUndefined(userFieldsFromIdentity(identity, now));
  const existing = await findUserByTokenIdentifier(ctx, identity.tokenIdentifier);

  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return { ...existing, ...fields };
  }

  const userId = await ctx.db.insert(
    "users",
    omitUndefined({
      ...fields,
      locale: "es-AR",
      createdAt: now,
      updatedAt: now
    })
  );

  return await ctx.db.get(userId);
}

export async function requireUser(ctx: ConvexCtx) {
  const user = await getOrCreateUser(ctx);
  if (!user) {
    throw new Error("Unable to load user");
  }

  return user;
}
