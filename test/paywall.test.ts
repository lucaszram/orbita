import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHECKOUT_POLL_TIMEOUT_MS,
  checkoutCtaLabel,
  checkoutPollDecision,
  checkoutStartErrorKind,
  formatPlanPrice,
  manageSubscription,
  monthlyPlan,
  offerPhase,
  planIntervalLabel,
  planTrialLabel,
  readCheckoutSessionId,
  type OfferPlan,
  type WebOffer
} from "../src/domain/paywall";
import { isPublicWebRoute } from "../src/domain/webSession";

// El importe del fixture es arbitrario a propósito: el precio real es el del
// Price de Stripe y nunca se escribe en el cliente.
const MONTHLY: OfferPlan = { id: "monthly", currency: "USD", unitAmount: 2999, interval: "month", trialDays: 7 };
const MONTHLY_SIN_TRIAL: OfferPlan = { ...MONTHLY, trialDays: 0 };

const OFF: WebOffer = { commerceMode: "off", checkoutEnabled: false, plans: [] };
const TEST_ON: WebOffer = { commerceMode: "test", checkoutEnabled: true, plans: [MONTHLY] };

// --- Oferta ----------------------------------------------------------------

test("con el comercio apagado se anuncia 'próximamente', nunca planes", () => {
  assert.equal(offerPhase({ offer: OFF, failed: false }), "proximamente");
  assert.equal(OFF.plans.length, 0);
});

test("checkoutEnabled sin planes tampoco ofrece comprar", () => {
  const raro: WebOffer = { commerceMode: "test", checkoutEnabled: true, plans: [] };
  assert.equal(offerPhase({ offer: raro, failed: false }), "proximamente");
});

test("con comercio y el plan mensual se puede comprar", () => {
  assert.equal(offerPhase({ offer: TEST_ON, failed: false }), "disponible");
});

test("la oferta vigente es una sola suscripción mensual", () => {
  assert.equal(monthlyPlan([MONTHLY]), MONTHLY);
  assert.equal(monthlyPlan([]), null);
  // Un id retirado que llegara del backend no se ofrece.
  const retirado = { id: "yearly", currency: "USD", unitAmount: 2999, interval: "year", trialDays: 3 } as unknown as OfferPlan;
  assert.equal(monthlyPlan([retirado]), null);
  assert.equal(offerPhase({ offer: { ...TEST_ON, plans: [retirado] }, failed: false }), "proximamente");
});

test("un fallo de la oferta no se muestra como 'próximamente'", () => {
  assert.equal(offerPhase({ offer: undefined, failed: true }), "error");
});

// --- Precios: siempre desde Stripe, nunca hardcodeados ---------------------

test("el precio se formatea desde currency y unitAmount, en unidades mínimas", () => {
  assert.match(formatPlanPrice(MONTHLY, "es-AR"), /29,99|29\.99/);
});

test("otra moneda se respeta tal cual la devolvió Stripe", () => {
  const eur: OfferPlan = { ...MONTHLY, currency: "EUR", unitAmount: 1000 };
  const out = formatPlanPrice(eur, "es-AR");
  assert.ok(out.includes("10") && !out.includes("$"), out);
});

test("una moneda desconocida muestra el código, no un símbolo inventado", () => {
  // Intl acepta cualquier código de tres letras bien formado y lo imprime tal
  // cual, así que acá no se ejercita el fallback: se verifica la garantía real.
  const out = formatPlanPrice({ ...MONTHLY, currency: "XYZ" }, "es-AR");
  assert.ok(out.includes("XYZ"), out);
  assert.ok(!out.includes("$"), out);
});

test("un código de moneda inválido no rompe la pantalla", () => {
  // Estos SÍ hacen tirar a Intl (largo inválido / vacío) y entran al fallback.
  for (const currency of ["US", "USDD", ""]) {
    const out = formatPlanPrice({ ...MONTHLY, currency }, "es-AR");
    assert.equal(out, `${currency} 29.99`);
  }
});

test("el trial se anuncia sólo si existe", () => {
  assert.equal(planTrialLabel(MONTHLY), "7 días gratis");
  assert.equal(planTrialLabel(MONTHLY_SIN_TRIAL), null);
});

test("el intervalo sale del plan", () => {
  assert.equal(planIntervalLabel(MONTHLY), "por mes");
});

test("el CTA anuncia exactamente los días de prueba que van a Stripe", () => {
  assert.equal(checkoutCtaLabel(MONTHLY), "Probar 7 días gratis");
  assert.equal(checkoutCtaLabel({ ...MONTHLY, trialDays: 1 }), "Probar 1 día gratis");
  // Sin prueba, el botón no promete días gratis que no existen.
  assert.equal(checkoutCtaLabel(MONTHLY_SIN_TRIAL), "Suscribirme");
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

// --- Inicio del checkout ----------------------------------------------------

test("el mensaje exacto del backend se reconoce como cuenta ya Plus", () => {
  assert.equal(
    checkoutStartErrorKind(new Error("This account already has Plus access")),
    "ya_plus"
  );
});

test("el mismo texto envuelto por Convex en un mensaje más largo también se reconoce", () => {
  const wrapped = new Error(
    '[Request ID: abc123] Server Error\nUncaught Error: This account already has Plus access\n    at handler (../convex/payments/stripeActions.ts:196:11)'
  );
  assert.equal(checkoutStartErrorKind(wrapped), "ya_plus");
});

test("un error desconocido o de red usa el mensaje genérico", () => {
  assert.equal(checkoutStartErrorKind(new Error("Network request failed")), "generico");
  assert.equal(checkoutStartErrorKind(new Error("Complete account setup before starting checkout")), "generico");
});

test("un valor que no es un Error usa el mensaje genérico", () => {
  assert.equal(checkoutStartErrorKind("This account already has Plus access"), "generico");
  assert.equal(checkoutStartErrorKind(undefined), "generico");
  assert.equal(checkoutStartErrorKind(null), "generico");
  assert.equal(checkoutStartErrorKind({ message: "This account already has Plus access" }), "generico");
});

// --- Rutas -----------------------------------------------------------------

test("paywall, retorno de checkout y perfil exigen sesión", () => {
  for (const route of ["/paywall", "/checkout/success", "/profile"]) {
    assert.equal(isPublicWebRoute(route), false, `${route} no debe ser pública`);
  }
});

// --- Gestión de la suscripción --------------------------------------------

test("un Free nunca ve la gestión de suscripción", () => {
  assert.equal(
    manageSubscription({ entitlement: { canManageInStripePortal: false }, commerceEnabled: true }),
    "oculto"
  );
});

test("RevenueCat y lifetime quedan fuera porque el backend ya los excluye", () => {
  // `canManageInStripePortal = provider === "stripe" && !isLifetime`.
  assert.equal(
    manageSubscription({ entitlement: { canManageInStripePortal: false }, commerceEnabled: true }),
    "oculto"
  );
});

test("con Stripe y comercio activo se ofrece el portal", () => {
  assert.equal(
    manageSubscription({ entitlement: { canManageInStripePortal: true }, commerceEnabled: true }),
    "portal"
  );
});

test("con una suscripción viva y el comercio apagado se ofrece soporte, no un portal que va a fallar", () => {
  // Rollback: `createPortalSession` no puede construir el cliente de Stripe con
  // `COMMERCE_MODE=off`, así que el botón mandaría a un error garantizado.
  assert.equal(
    manageSubscription({ entitlement: { canManageInStripePortal: true }, commerceEnabled: false }),
    "soporte"
  );
});

test("no se afirma nada mientras el plan o el comercio no resolvieron", () => {
  assert.equal(manageSubscription({ entitlement: undefined, commerceEnabled: true }), "cargando");
  assert.equal(
    manageSubscription({ entitlement: { canManageInStripePortal: true }, commerceEnabled: undefined }),
    "cargando"
  );
});

// --- Nav de escritorio en el paywall standalone -----------------------------

const ROOT = join(import.meta.dirname, "..");
const paywallSrc = readFileSync(join(ROOT, "src/components/web/orbita-paywall.tsx"), "utf8");

test("el paywall monta WebLayoutProvider alrededor de RequireSession", () => {
  // El paywall es una pantalla standalone: monta WebNav (dentro de Shell) fuera
  // de WebAppShell. Sin WebLayoutProvider, useIsDesktop() cae al default del
  // contexto ("mobile") y la barra de escritorio nunca aparece, aunque el
  // comercio esté prendido o apagado.
  assert.match(paywallSrc, /from "@\/components\/web\/web-layout-provider"/);
  assert.match(paywallSrc, /<WebLayoutProvider>\s*<RequireSession>\s*<PaywallWithBackend \/>\s*<\/RequireSession>\s*<\/WebLayoutProvider>/);
});

test("OrbitaPaywall monta un solo provider de layout", () => {
  const aperturas = paywallSrc.match(/<WebLayoutProvider>/g) ?? [];
  assert.equal(aperturas.length, 1, "un solo punto de entrada standalone, un solo provider");
});

// --- Oferta única mensual ---------------------------------------------------

test("el paywall no conserva restos del picker de dos planes", () => {
  // La oferta es una sola suscripción mensual: sin planes retirados, sin radio
  // de selección y sin importes escritos en el cliente.
  assert.doesNotMatch(paywallSrc, /weekly|yearly|Anual|Semanal/);
  assert.doesNotMatch(paywallSrc, /accessibilityRole="radio"/);
  assert.doesNotMatch(paywallSrc, /setSelected|sortedPlans/);
});

test("la promesa del trial: cancelar antes del fin de la prueba no cobra nada", () => {
  // La divulgación de la rama con trial promete explícitamente que cancelar
  // antes de que termine la prueba no genera ningún cobro, con los días
  // dinámicos del plan (nunca un "7" hardcodeado), y conserva la divulgación
  // de renovación mensual automática hasta que el usuario cancele.
  assert.match(
    paywallSrc,
    /Si cancelás antes de que terminen los \$\{plan\.trialDays\} días de prueba, no se te cobra nada\. Al terminar la prueba, la suscripción se renueva sola cada mes al precio de arriba, hasta que la cancelés\./
  );
  // La rama sin trial mantiene su propia divulgación de renovación automática.
  assert.match(paywallSrc, /La suscripción se renueva sola cada mes hasta que la cancelés\./);
  // Los días de prueba nunca se escriben a mano en la divulgación.
  assert.doesNotMatch(paywallSrc, /los 7 días de prueba/);
});

test("el CTA y el precio salen del plan que devolvió Stripe", () => {
  assert.match(paywallSrc, /checkoutCtaLabel\(plan\)/);
  assert.match(paywallSrc, /formatPlanPrice\(plan\)/);
  // Ningún importe hardcodeado en el componente (el precio es el de Stripe).
  assert.doesNotMatch(paywallSrc, /\$\s?\d|USD\s?\d/);
});
