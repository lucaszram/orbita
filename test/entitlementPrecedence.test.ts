/**
 * Precedencia y honestidad del entitlement resuelto (P1 3, 5 y 6).
 *
 * Tres agujeros distintos que comparten una raíz: la resolución del acceso
 * afirmaba más de lo que podía demostrar.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isRowActive,
  resolveEntitlement,
  type SubscriptionRow
} from "../convex/lib/entitlements";
import {
  deriveRevenueCatEventDecision,
  guardLifetimePrecedence,
  type RevenueCatExistingState
} from "../convex/lib/revenueCatEvents";

const NOW = 1_800_000_000_000;
const FUTURE = 2_000_000_000_000;
const PAST = 1_700_000_000_000;

/**
 * Estas pruebas describen la semántica de la FILA (fechas, lifetime, ranking).
 * El gate de DEPLOYMENT —qué entorno de la tienda acepta este backend— tiene su
 * propia suite, y desde P1 2 `production` también hay que autorizarlo
 * explícitamente. Acá se autoriza para que ese corte no tape lo que se prueba.
 */
const CTX = { sandboxAllowed: true, productionAllowed: true };

describe("P1-3 — sólo lifetime puede conceder sin fecha de fin", () => {
  it("un checkout de Stripe que quedó en active sin fecha NO concede acceso", () => {
    // `stripeInternal.upsertStripeRow` escribe `entitlement/status: active` en
    // `checkout.session.completed` y la fecha llega recién con
    // `customer.subscription.updated`. Si ese segundo webhook nunca llega, la
    // fila vieja concedía Plus para siempre.
    const pendiente: SubscriptionRow = {
      entitlement: "orbita_pro",
      provider: "stripe",
      status: "active",
      plan: "monthly",
      isLifetime: false
    };
    assert.equal(isRowActive(pendiente, NOW), false);
    assert.equal(resolveEntitlement([pendiente], NOW, CTX).isPro, false);
  });

  it("tampoco concede un trialing sin fecha demostrable", () => {
    const row: SubscriptionRow = {
      entitlement: "orbita_pro",
      provider: "revenuecat",
      environment: "production",
      status: "trialing"
    };
    assert.equal(isRowActive(row, NOW), false);
  });

  it("lifetime sigue siendo la única excepción legítima", () => {
    const lifetime: SubscriptionRow = {
      entitlement: "orbita_pro",
      provider: "revenuecat",
      environment: "production",
      status: "active",
      isLifetime: true
    };
    assert.equal(isRowActive(lifetime, NOW, CTX), true);
  });

  it("con fecha demostrable el comportamiento no cambia", () => {
    const vigente: SubscriptionRow = {
      entitlement: "orbita_pro",
      provider: "stripe",
      status: "active",
      currentPeriodEnd: FUTURE
    };
    assert.equal(isRowActive(vigente, NOW, CTX), true);
    assert.equal(isRowActive({ ...vigente, currentPeriodEnd: PAST }, NOW), false);
  });
});

describe("P1-5 — un evento del mensual no borra un lifetime legado", () => {
  const LIFETIME_ROW: RevenueCatExistingState = {
    entitlement: "orbita_pro",
    status: "active",
    plan: "lifetime",
    productId: "orbita_lifetime",
    isLifetime: true,
    willRenew: false
  };
  const monthlyEvent = (type: string, extra: Record<string, unknown> = {}) => ({
    id: `rc_${type}`,
    app_user_id: "user_current",
    event_timestamp_ms: NOW,
    environment: "SANDBOX",
    entitlement_ids: ["orbita_pro"],
    type,
    product_id: "orbita_monthly",
    ...extra
  });

  const decidir = (type: string, extra?: Record<string, unknown>) =>
    guardLifetimePrecedence(
      deriveRevenueCatEventDecision(monthlyEvent(type, extra), LIFETIME_ROW),
      LIFETIME_ROW
    );

  it("la compra del mensual sobre una fila lifetime no apaga el lifetime", () => {
    const decision = decidir("INITIAL_PURCHASE", { expiration_at_ms: FUTURE });
    assert.equal(decision.kind, "apply");
    if (decision.kind !== "apply") return;
    assert.notEqual(decision.patch.isLifetime, false);
    assert.equal(decision.patch.entitlement, "orbita_pro");
  });

  it("la EXPIRACIÓN del mensual conserva el lifetime", () => {
    const decision = decidir("EXPIRATION", { expiration_at_ms: PAST });
    if (decision.kind === "apply") {
      assert.notEqual(decision.patch.entitlement, "free");
      assert.notEqual(decision.patch.isLifetime, false);
      assert.notEqual(decision.patch.status, "expired");
    }
    // Y el acceso sigue vigente después de aplicar lo que quede del patch.
    const after: SubscriptionRow = {
      ...LIFETIME_ROW,
      ...(decision.kind === "apply" ? decision.patch : {}),
      provider: "revenuecat",
      environment: "production"
    } as SubscriptionRow;
    assert.equal(isRowActive(after, NOW, CTX), true);
  });

  it("lifetime + mensual + expiración del mensual conserva lifetime", () => {
    const compra = decidir("INITIAL_PURCHASE", { expiration_at_ms: FUTURE });
    const conMensual: RevenueCatExistingState = {
      ...LIFETIME_ROW,
      ...(compra.kind === "apply" ? compra.patch : {})
    };
    const expiracion = guardLifetimePrecedence(
      deriveRevenueCatEventDecision(monthlyEvent("EXPIRATION", { expiration_at_ms: PAST }), conMensual),
      conMensual
    );
    const final: SubscriptionRow = {
      ...conMensual,
      ...(expiracion.kind === "apply" ? expiracion.patch : {}),
      provider: "revenuecat",
      environment: "production"
    } as SubscriptionRow;
    assert.equal(final.isLifetime, true);
    assert.equal(isRowActive(final, NOW, CTX), true);
    assert.equal(resolveEntitlement([final], NOW, CTX).isPro, true);
  });

  it("una CANCELACIÓN del mensual tampoco degrada el lifetime", () => {
    const decision = decidir("CANCELLATION", { expiration_at_ms: PAST });
    const after: SubscriptionRow = {
      ...LIFETIME_ROW,
      ...(decision.kind === "apply" ? decision.patch : {}),
      provider: "revenuecat",
      environment: "production"
    } as SubscriptionRow;
    assert.equal(isRowActive(after, NOW, CTX), true);
  });

  it("sin fila lifetime el guard no cambia nada", () => {
    const mensual: RevenueCatExistingState = {
      entitlement: "orbita_pro",
      status: "active",
      plan: "monthly",
      currentPeriodEnd: FUTURE,
      isLifetime: false
    };
    const original = deriveRevenueCatEventDecision(
      monthlyEvent("EXPIRATION", { expiration_at_ms: PAST }),
      mensual
    );
    assert.deepEqual(guardLifetimePrecedence(original, mensual), original);
  });

  it("un evento lifetime DECLARADO sí puede escribir el lifetime", () => {
    const evento = {
      id: "rc_lifetime",
      app_user_id: "user_current",
      event_timestamp_ms: NOW,
      environment: "SANDBOX",
      entitlement_ids: ["orbita_pro"],
      type: "NON_RENEWING_PURCHASE",
      product_id: "orbita_lifetime"
    };
    // P1 5: el catálogo permanente es configuración explícita, no una
    // convención de nombres. Sin declararlo, el evento falla cerrado.
    const previo = process.env.REVENUECAT_LIFETIME_PRODUCT_IDS;
    process.env.REVENUECAT_LIFETIME_PRODUCT_IDS = "orbita_lifetime";
    try {
      const decision = guardLifetimePrecedence(deriveRevenueCatEventDecision(evento), undefined);
      assert.equal(decision.kind, "apply");
      if (decision.kind !== "apply") return;
      assert.equal(decision.patch.isLifetime, true);
    } finally {
      if (previo === undefined) delete process.env.REVENUECAT_LIFETIME_PRODUCT_IDS;
      else process.env.REVENUECAT_LIFETIME_PRODUCT_IDS = previo;
    }
  });

  it("una fila lifetime YA demostrada sigue concediendo sin catálogo declarado", () => {
    // El cierre de P1 5 no puede romper el acceso legado que ya está escrito:
    // lo que se cierra es la puerta para escribir uno NUEVO sin prueba.
    const legada: SubscriptionRow = {
      entitlement: "orbita_pro",
      provider: "revenuecat",
      environment: "production",
      status: "active",
      plan: "lifetime",
      productId: "orbita_lifetime",
      isLifetime: true
    };
    assert.equal(isRowActive(legada, NOW, CTX), true);
    assert.equal(resolveEntitlement([legada], NOW, CTX).isPro, true);
  });
});

describe("P1-6 — dos proveedores activos exponen dos salidas", () => {
  const rcLifetime: SubscriptionRow = {
    entitlement: "orbita_pro",
    provider: "revenuecat",
    environment: "production",
    status: "active",
    plan: "lifetime",
    isLifetime: true
  };
  const stripeMensual: SubscriptionRow = {
    entitlement: "orbita_pro",
    provider: "stripe",
    status: "active",
    plan: "monthly",
    currentPeriodEnd: FUTURE,
    willRenew: true
  };

  it("declara los dos proveedores activos, no sólo el ganador", () => {
    const resolved = resolveEntitlement([rcLifetime, stripeMensual], NOW, CTX);
    assert.equal(resolved.isPro, true);
    // El ganador por rango es el lifetime de RevenueCat…
    assert.equal(resolved.provider, "revenuecat");
    assert.equal(resolved.isLifetime, true);
    // …pero Stripe sigue cobrando todos los meses y hay que poder cancelarlo.
    assert.equal(resolved.canManageInStripePortal, true);
    assert.equal(resolved.canManageInRevenueCat, true);
    assert.deepEqual([...resolved.activeProviders].sort(), ["revenuecat", "stripe"]);
  });

  it("con un solo proveedor sólo se ofrece esa salida", () => {
    const soloStripe = resolveEntitlement([stripeMensual], NOW, CTX);
    assert.equal(soloStripe.canManageInStripePortal, true);
    assert.equal(soloStripe.canManageInRevenueCat, false);
    assert.deepEqual(soloStripe.activeProviders, ["stripe"]);

    const soloRc = resolveEntitlement([rcLifetime], NOW, CTX);
    assert.equal(soloRc.canManageInStripePortal, false);
    assert.equal(soloRc.canManageInRevenueCat, true);
    assert.deepEqual(soloRc.activeProviders, ["revenuecat"]);
  });

  it("una fila inactiva no aporta una salida de gestión", () => {
    const vencida: SubscriptionRow = { ...stripeMensual, currentPeriodEnd: PAST };
    const resolved = resolveEntitlement([rcLifetime, vencida], NOW, CTX);
    assert.equal(resolved.canManageInStripePortal, false);
    assert.deepEqual(resolved.activeProviders, ["revenuecat"]);
  });

  it("sin acceso no hay ninguna gestión que ofrecer", () => {
    const libre = resolveEntitlement([], NOW, CTX);
    assert.equal(libre.canManageInStripePortal, false);
    assert.equal(libre.canManageInRevenueCat, false);
    assert.deepEqual(libre.activeProviders, []);
  });
});
