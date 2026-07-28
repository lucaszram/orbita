import assert from "node:assert/strict";
import test from "node:test";
import {
  CHECKOUT_POLL_TIMEOUT_MS,
  checkoutPollDecision,
  formatPlanPrice,
  offerPhase,
  planIntervalLabel,
  planTrialLabel,
  readCheckoutSessionId,
  sortedPlans,
  type OfferPlan,
  type WebOffer
} from "../src/domain/paywall";
import { isPublicWebRoute } from "../src/domain/webSession";

const WEEKLY: OfferPlan = { id: "weekly", currency: "USD", unitAmount: 499, interval: "week", trialDays: 0 };
const YEARLY: OfferPlan = { id: "yearly", currency: "USD", unitAmount: 2999, interval: "year", trialDays: 7 };

const OFF: WebOffer = { commerceMode: "off", checkoutEnabled: false, plans: [] };
const TEST_ON: WebOffer = { commerceMode: "test", checkoutEnabled: true, plans: [WEEKLY, YEARLY] };

// --- Oferta ----------------------------------------------------------------

test("con el comercio apagado se anuncia 'próximamente', nunca planes", () => {
  assert.equal(offerPhase({ offer: OFF, failed: false }), "proximamente");
  assert.equal(OFF.plans.length, 0);
});

test("checkoutEnabled sin planes tampoco ofrece comprar", () => {
  const raro: WebOffer = { commerceMode: "test", checkoutEnabled: true, plans: [] };
  assert.equal(offerPhase({ offer: raro, failed: false }), "proximamente");
});

test("con comercio y planes se puede comprar", () => {
  assert.equal(offerPhase({ offer: TEST_ON, failed: false }), "disponible");
});

test("un fallo de la oferta no se muestra como 'próximamente'", () => {
  assert.equal(offerPhase({ offer: undefined, failed: true }), "error");
});

// --- Precios: siempre desde Stripe, nunca hardcodeados ---------------------

test("el precio se formatea desde currency y unitAmount, en unidades mínimas", () => {
  assert.match(formatPlanPrice(YEARLY, "es-AR"), /29,99|29\.99/);
  assert.match(formatPlanPrice(WEEKLY, "es-AR"), /4,99|4\.99/);
});

test("otra moneda se respeta tal cual la devolvió Stripe", () => {
  const eur: OfferPlan = { ...YEARLY, currency: "EUR", unitAmount: 1000 };
  const out = formatPlanPrice(eur, "es-AR");
  assert.ok(out.includes("10") && !out.includes("$"), out);
});

test("una moneda desconocida muestra el código, no un símbolo inventado", () => {
  // Intl acepta cualquier código de tres letras bien formado y lo imprime tal
  // cual, así que acá no se ejercita el fallback: se verifica la garantía real.
  const out = formatPlanPrice({ ...YEARLY, currency: "XYZ" }, "es-AR");
  assert.ok(out.includes("XYZ"), out);
  assert.ok(!out.includes("$"), out);
});

test("un código de moneda inválido no rompe la pantalla", () => {
  // Estos SÍ hacen tirar a Intl (largo inválido / vacío) y entran al fallback.
  for (const currency of ["US", "USDD", ""]) {
    const out = formatPlanPrice({ ...YEARLY, currency }, "es-AR");
    assert.equal(out, `${currency} 29.99`);
  }
});

test("el trial se anuncia sólo si existe", () => {
  assert.equal(planTrialLabel(YEARLY), "7 días gratis");
  assert.equal(planTrialLabel(WEEKLY), null);
});

test("el intervalo sale del plan", () => {
  assert.equal(planIntervalLabel(WEEKLY), "por semana");
  assert.equal(planIntervalLabel(YEARLY), "por año");
});

test("el anual va primero", () => {
  assert.equal(sortedPlans([WEEKLY, YEARLY])[0].id, "yearly");
  assert.equal(sortedPlans([YEARLY, WEEKLY])[0].id, "yearly");
});

// --- Retorno del checkout --------------------------------------------------

test("con el comercio apagado no se consulta el estado de ninguna sesión", () => {
  assert.equal(
    checkoutPollDecision({ commerceEnabled: false, sessionId: "cs_test_abc123", lastStatus: null, elapsedMs: 0 }),
    "inhabilitado"
  );
});

test("sin session_id no se consulta nada", () => {
  assert.equal(
    checkoutPollDecision({ commerceEnabled: true, sessionId: null, lastStatus: null, elapsedMs: 0 }),
    "inhabilitado"
  );
});

test("se consulta la primera vez y se sigue mientras esté pending", () => {
  assert.equal(
    checkoutPollDecision({ commerceEnabled: true, sessionId: "cs_test_a1", lastStatus: null, elapsedMs: 0 }),
    "consultar"
  );
  assert.equal(
    checkoutPollDecision({ commerceEnabled: true, sessionId: "cs_test_a1", lastStatus: "pending", elapsedMs: 5_000 }),
    "esperar"
  );
});

test("active y failed son terminales: el polling se detiene", () => {
  assert.equal(
    checkoutPollDecision({ commerceEnabled: true, sessionId: "cs_test_a1", lastStatus: "active", elapsedMs: 5_000 }),
    "listo"
  );
  assert.equal(
    checkoutPollDecision({ commerceEnabled: true, sessionId: "cs_test_a1", lastStatus: "failed", elapsedMs: 5_000 }),
    "fallo"
  );
});

test("el polling está acotado en el tiempo", () => {
  assert.equal(
    checkoutPollDecision({
      commerceEnabled: true,
      sessionId: "cs_test_a1",
      lastStatus: "pending",
      elapsedMs: CHECKOUT_POLL_TIMEOUT_MS
    }),
    "timeout"
  );
});

test("un active ya confirmado gana sobre el timeout", () => {
  assert.equal(
    checkoutPollDecision({
      commerceEnabled: true,
      sessionId: "cs_test_a1",
      lastStatus: "active",
      elapsedMs: CHECKOUT_POLL_TIMEOUT_MS * 10
    }),
    "listo"
  );
});

test("sólo se aceptan session ids con forma de Stripe", () => {
  assert.equal(readCheckoutSessionId("cs_test_a1B2c3"), "cs_test_a1B2c3");
  assert.equal(readCheckoutSessionId("cs_live_XYZ789"), "cs_live_XYZ789");
  assert.equal(readCheckoutSessionId("../../etc/passwd"), null);
  assert.equal(readCheckoutSessionId("sub_123"), null);
  assert.equal(readCheckoutSessionId(""), null);
  assert.equal(readCheckoutSessionId(undefined), null);
  assert.equal(readCheckoutSessionId("cs_test_" + "a".repeat(300)), null);
});

// --- Rutas -----------------------------------------------------------------

test("paywall, retorno de checkout y perfil exigen sesión", () => {
  for (const route of ["/paywall", "/checkout/success", "/profile"]) {
    assert.equal(isPublicWebRoute(route), false, `${route} no debe ser pública`);
  }
});
