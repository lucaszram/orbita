import assert from "node:assert/strict";
import test from "node:test";
import { isRowActive, resolveEntitlement, type SubscriptionRow } from "../convex/lib/entitlements";

const NOW = 1_000_000_000_000;
const FUTURE = NOW + 7 * 24 * 60 * 60 * 1000;
const PAST = NOW - 7 * 24 * 60 * 60 * 1000;

// Corte de entorno (A2): una fila de RevenueCat sin `environment` ya no
// concede — no se puede demostrar de qué tienda vino. Las filas de estas
// pruebas declaran `production`, que es lo que tiene una fila real.
//
// Estas pruebas describen la semántica de la FILA (fechas, estados, ranking).
// El gate de DEPLOYMENT —qué entorno acepta este backend— tiene su propia
// suite; acá se autoriza explícitamente para que ese corte no las tape.
const CTX = { sandboxAllowed: true, productionAllowed: true };

// P1 12: `SubscriptionRow` describía menos campos de los que la tabla tiene y
// de los que la lógica compara. `productId` participa de la precedencia
// lifetime (un reembolso sólo retira el producto que demuestra) y estaba
// invisible para el compilador. Esta declaración falla el typecheck si vuelve
// a faltar.
const FILA_COMPLETA: SubscriptionRow = {
  entitlement: "orbita_pro",
  status: "active",
  provider: "revenuecat",
  plan: "monthly",
  productId: "orbita_monthly",
  isLifetime: false,
  willRenew: true,
  currentPeriodEnd: FUTURE,
  environment: "production",
  clerkUserId: "user_current"
};

test("el tipo de fila describe los campos que la lógica compara", () => {
  assert.equal(FILA_COMPLETA.productId, "orbita_monthly");
  assert.equal(isRowActive(FILA_COMPLETA, NOW, CTX), true);
});
test("entitlement resolution", async (t) => {
  await t.test("no rows → free", () => {
    const result = resolveEntitlement([], NOW, CTX);
    assert.equal(result.entitlement, "free");
    assert.equal(result.isPro, false);
    assert.equal(result.canManageInStripePortal, false);
  });

  await t.test("active subscription within period → pro", () => {
    const rows: SubscriptionRow[] = [
      {
        entitlement: "orbita_pro",
        provider: "stripe",
        status: "active",
        currentPeriodEnd: FUTURE,
        plan: "monthly",
        willRenew: true
      }
    ];
    const result = resolveEntitlement(rows, NOW, CTX);
    assert.equal(result.isPro, true);
    assert.equal(result.entitlement, "orbita_pro");
    assert.equal(result.provider, "stripe");
    assert.equal(result.canManageInStripePortal, true);
  });

  await t.test("monthly trial grants the complete Pro entitlement", () => {
    const rows: SubscriptionRow[] = [
      {
        entitlement: "orbita_pro",
        provider: "stripe",
        status: "trialing",
        currentPeriodEnd: FUTURE,
        plan: "monthly",
        willRenew: true
      }
    ];
    const result = resolveEntitlement(rows, NOW, CTX);
    assert.equal(result.isPro, true);
    assert.equal(result.status, "trialing");
    assert.equal(result.plan, "monthly");
  });

  await t.test("expired subscription past period → free", () => {
    const rows: SubscriptionRow[] = [
      { entitlement: "orbita_pro", provider: "revenuecat",
        environment: "production", status: "active", currentPeriodEnd: PAST }
    ];
    assert.equal(resolveEntitlement(rows, NOW, CTX).isPro, false);
  });

  await t.test("canceled but still within period → pro (access until period end)", () => {
    const rows: SubscriptionRow[] = [
      {
        entitlement: "orbita_pro",
        provider: "revenuecat",
        environment: "production",
        status: "canceled",
        currentPeriodEnd: FUTURE,
        willRenew: false
      }
    ];
    const result = resolveEntitlement(rows, NOW, CTX);
    assert.equal(result.isPro, true);
    assert.equal(result.willRenew, false);
  });

  await t.test("lifetime → pro without period end, not stripe-portal manageable", () => {
    const rows: SubscriptionRow[] = [
      {
        entitlement: "orbita_pro",
        provider: "revenuecat",
        environment: "production",
        status: "active",
        isLifetime: true,
        plan: "lifetime"
      }
    ];
    const result = resolveEntitlement(rows, NOW, CTX);
    assert.equal(result.isPro, true);
    assert.equal(result.isLifetime, true);
    assert.equal(result.canManageInStripePortal, false);
  });

  await t.test("free entitlement row never grants access", () => {
    const rows: SubscriptionRow[] = [{ provider: "stripe", status: "active", entitlement: "free", currentPeriodEnd: FUTURE }];
    assert.equal(isRowActive(rows[0], NOW, CTX), false);
    assert.equal(resolveEntitlement(rows, NOW, CTX).isPro, false);
  });

  await t.test("lifetime wins over an active shorter subscription", () => {
    const rows: SubscriptionRow[] = [
      {
        entitlement: "orbita_pro",
        provider: "stripe",
        status: "active",
        currentPeriodEnd: FUTURE,
        plan: "weekly"
      },
      {
        entitlement: "orbita_pro",
        provider: "revenuecat",
        environment: "production",
        status: "active",
        isLifetime: true,
        plan: "lifetime"
      }
    ];
    const result = resolveEntitlement(rows, NOW, CTX);
    assert.equal(result.isLifetime, true);
    assert.equal(result.plan, "lifetime");
    assert.equal(result.canManageInStripePortal, true);
  });

  await t.test("cross-surface: web stripe active grants pro even with no revenuecat row", () => {
    const rows: SubscriptionRow[] = [
      {
        entitlement: "orbita_pro",
        provider: "stripe",
        status: "active",
        currentPeriodEnd: FUTURE,
        plan: "yearly"
      }
    ];
    assert.equal(resolveEntitlement(rows, NOW, CTX).isPro, true);
  });

  await t.test("billing_issue keeps access during grace period", () => {
    const rows: SubscriptionRow[] = [
      {
        entitlement: "orbita_pro",
        provider: "revenuecat",
        environment: "production",
        status: "billing_issue",
        currentPeriodEnd: FUTURE
      }
    ];
    assert.equal(resolveEntitlement(rows, NOW, CTX).isPro, true);
  });

  await t.test("una fila incompleta o con entitlement desconocido no concede Pro", () => {
    const rows: SubscriptionRow[] = [
      { provider: "revenuecat",
        environment: "production", status: "active", currentPeriodEnd: FUTURE },
      { entitlement: "otro_producto", provider: "revenuecat",
        environment: "production", status: "active", currentPeriodEnd: FUTURE }
    ];
    assert.equal(resolveEntitlement(rows, NOW, CTX).isPro, false);
  });

  await t.test("el alias plus legacy sigue siendo compatible durante la migración", () => {
    const rows: SubscriptionRow[] = [
      { entitlement: "plus", provider: "revenuecat",
        environment: "production", status: "active", currentPeriodEnd: FUTURE }
    ];
    assert.equal(resolveEntitlement(rows, NOW, CTX).isPro, true);
  });
});
