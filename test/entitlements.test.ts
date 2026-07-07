import assert from "node:assert/strict";
import test from "node:test";
import { isRowActive, resolveEntitlement, type SubscriptionRow } from "../convex/lib/entitlements";

const NOW = 1_000_000_000_000;
const FUTURE = NOW + 7 * 24 * 60 * 60 * 1000;
const PAST = NOW - 7 * 24 * 60 * 60 * 1000;

test("entitlement resolution", async (t) => {
  await t.test("no rows → free", () => {
    const result = resolveEntitlement([], NOW);
    assert.equal(result.entitlement, "free");
    assert.equal(result.isPro, false);
    assert.equal(result.canManageInStripePortal, false);
  });

  await t.test("active subscription within period → pro", () => {
    const rows: SubscriptionRow[] = [
      { provider: "stripe", status: "active", currentPeriodEnd: FUTURE, plan: "yearly", willRenew: true }
    ];
    const result = resolveEntitlement(rows, NOW);
    assert.equal(result.isPro, true);
    assert.equal(result.entitlement, "orbita_pro");
    assert.equal(result.provider, "stripe");
    assert.equal(result.canManageInStripePortal, true);
  });

  await t.test("expired subscription past period → free", () => {
    const rows: SubscriptionRow[] = [{ provider: "revenuecat", status: "active", currentPeriodEnd: PAST }];
    assert.equal(resolveEntitlement(rows, NOW).isPro, false);
  });

  await t.test("canceled but still within period → pro (access until period end)", () => {
    const rows: SubscriptionRow[] = [
      { provider: "revenuecat", status: "canceled", currentPeriodEnd: FUTURE, willRenew: false }
    ];
    const result = resolveEntitlement(rows, NOW);
    assert.equal(result.isPro, true);
    assert.equal(result.willRenew, false);
  });

  await t.test("lifetime → pro without period end, not stripe-portal manageable", () => {
    const rows: SubscriptionRow[] = [{ provider: "revenuecat", status: "active", isLifetime: true, plan: "lifetime" }];
    const result = resolveEntitlement(rows, NOW);
    assert.equal(result.isPro, true);
    assert.equal(result.isLifetime, true);
    assert.equal(result.canManageInStripePortal, false);
  });

  await t.test("free entitlement row never grants access", () => {
    const rows: SubscriptionRow[] = [{ provider: "stripe", status: "active", entitlement: "free", currentPeriodEnd: FUTURE }];
    assert.equal(isRowActive(rows[0], NOW), false);
    assert.equal(resolveEntitlement(rows, NOW).isPro, false);
  });

  await t.test("lifetime wins over an active shorter subscription", () => {
    const rows: SubscriptionRow[] = [
      { provider: "stripe", status: "active", currentPeriodEnd: FUTURE, plan: "weekly" },
      { provider: "revenuecat", status: "active", isLifetime: true, plan: "lifetime" }
    ];
    const result = resolveEntitlement(rows, NOW);
    assert.equal(result.isLifetime, true);
    assert.equal(result.plan, "lifetime");
  });

  await t.test("cross-surface: web stripe active grants pro even with no revenuecat row", () => {
    const rows: SubscriptionRow[] = [
      { provider: "stripe", status: "active", currentPeriodEnd: FUTURE, plan: "yearly" }
    ];
    assert.equal(resolveEntitlement(rows, NOW).isPro, true);
  });

  await t.test("billing_issue keeps access during grace period", () => {
    const rows: SubscriptionRow[] = [
      { provider: "revenuecat", status: "billing_issue", currentPeriodEnd: FUTURE }
    ];
    assert.equal(resolveEntitlement(rows, NOW).isPro, true);
  });
});
