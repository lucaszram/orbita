import type { UserIdentity } from "convex/server";
import { userFieldsFromIdentity } from "./orbita";
import { recordBackendProductEvent } from "./productAnalytics";

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

/**
 * Read-only lookup for reactive queries during auth/account transitions.
 *
 * Account deletion removes the Convex user before the native Clerk identity.
 * Queries can therefore rerun briefly with a valid token but no `users` row.
 * That is a normal empty state, not an exceptional one. Mutations/actions must
 * continue using `requireExistingUser`/`requireUser` so writes fail closed.
 */
export async function findCurrentUser(ctx: ConvexCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await findUserByTokenIdentifier(ctx, identity.tokenIdentifier);
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

  await recordBackendProductEvent(ctx, {
    eventName: "account_created",
    userId,
    dedupeKey: String(userId),
    occurredAt: now
  });

  return await ctx.db.get(userId);
}

export async function requireUser(ctx: ConvexCtx) {
  const user = await getOrCreateUser(ctx);
  if (!user) {
    throw new Error("Unable to load user");
  }

  return user;
}
