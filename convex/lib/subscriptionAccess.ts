import {
  resolveEntitlement,
  type SubscriptionRow
} from "./entitlements";

export async function isUserPro(
  ctx: { db: any },
  userId: string
): Promise<boolean> {
  const rows = (await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect()) as SubscriptionRow[];
  return resolveEntitlement(rows, Date.now()).isPro;
}
