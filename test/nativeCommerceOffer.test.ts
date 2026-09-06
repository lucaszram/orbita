/**
 * Comercio nativo — decisiones puras de la oferta, la identidad y el paywall.
 *
 * Todo lo que puede COBRAR DE MÁS o PROMETER DE MÁS vive en funciones sin React
 * ni RevenueCat, y se prueba acá: qué prueba se anuncia, qué ofrece el botón
 * primario después de una compra ambigua, y de dónde viene el acceso que la
 * pantalla afirma. Renderizar RN en node no es posible; estas decisiones sí.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defaultNativePlan,
  isAnonymousRevenueCatUser,
  nativeActivationPhase,
  nativePrimaryAction,
  nativeStorePlan,
  nativeStoreTrial,
  nativeSubscriptionView,
  nextPurchaseOutcome,
  ORBITA_PRO_ENTITLEMENT,
  revenueCatIdentitySteps,
  storePeriodLabel,
  storeTrialPeriodLabel,
  type NativePurchaseOutcome,
  type StoreIntroOffer
} from "../src/domain/nativeCommerce";

/** La oferta introductoria vigente: una semana gratis, cero pesos. */
const FREE_WEEK: StoreIntroOffer = {
  price: 0,
  priceString: "$0,00",
  cycles: 1,
  period: "P1W"
};

const MONTHLY_PACKAGE = {
  id: "$rc_monthly",
  packageType: "MONTHLY",
  title: "Órbita Plus (Órbita)",
  priceString: "US$4,99",
  subscriptionPeriod: "P1M",
  pricePerMonthString: "US$4,99"
};

describe("prueba de la tienda — sólo con elegibilidad confirmada", () => {
  it("anuncia la prueba cuando la tienda informa oferta gratis Y elegibilidad", () => {
    const trial = nativeStoreTrial(FREE_WEEK, "eligible");
    assert.deepEqual(trial, { label: "7 días gratis", period: "P1W" });
  });

  it("no promete nada si la elegibilidad es UNKNOWN", () => {
    // UNKNOWN es lo que devuelve una consulta caída o una plataforma que no
    // sabe contestar. Prometer ahí es prometer algo que Apple va a desmentir.
    assert.equal(nativeStoreTrial(FREE_WEEK, "unknown"), null);
  });

  it("no promete nada a quien la tienda declara no elegible", () => {
    assert.equal(nativeStoreTrial(FREE_WEEK, "ineligible"), null);
  });

  it("no promete nada si el producto no tiene oferta introductoria", () => {
    assert.equal(nativeStoreTrial(null, "no_offer"), null);
    assert.equal(nativeStoreTrial(undefined, "eligible"), null);
  });

  it("un precio introductorio rebajado NO es una prueba gratis", () => {
    const descuento: StoreIntroOffer = { ...FREE_WEEK, price: 1.99, priceString: "US$1,99" };
    assert.equal(nativeStoreTrial(descuento, "eligible"), null);
  });

  it("sin período demostrable no se inventa una duración", () => {
    assert.equal(nativeStoreTrial({ ...FREE_WEEK, period: null }, "eligible"), null);
    assert.equal(nativeStoreTrial({ ...FREE_WEEK, period: "" }, "eligible"), null);
    assert.equal(nativeStoreTrial({ ...FREE_WEEK, period: "una semana" }, "eligible"), null);
  });

  it("por defecto, sin elegibilidad declarada, no hay prueba", () => {
    assert.equal(nativeStoreTrial(FREE_WEEK), null);
  });
});

describe("duración de la prueba — se traduce, no se inventa", () => {
  it("una semana son siete días exactos", () => {
    assert.equal(storeTrialPeriodLabel("P1W"), "7 días");
    assert.equal(storeTrialPeriodLabel("P2W"), "14 días");
  });

  it("los días se muestran tal cual, con concordancia", () => {
    assert.equal(storeTrialPeriodLabel("P1D"), "1 día");
    assert.equal(storeTrialPeriodLabel("P3D"), "3 días");
  });

  it("meses y años conservan su unidad porque su largo depende del calendario", () => {
    assert.equal(storeTrialPeriodLabel("P1M"), "1 mes");
    assert.equal(storeTrialPeriodLabel("P2M"), "2 meses");
    assert.equal(storeTrialPeriodLabel("P1Y"), "1 año");
  });

  it("los ciclos multiplican el período informado", () => {
    assert.equal(storeTrialPeriodLabel("P1M", 3), "3 meses");
    // Un `cycles` inválido no borra la prueba: el período sigue siendo la fuente.
    assert.equal(storeTrialPeriodLabel("P1W", 0), "7 días");
    assert.equal(storeTrialPeriodLabel("P1W", Number.NaN), "7 días");
  });

  it("un período que no se entiende no produce etiqueta", () => {
    assert.equal(storeTrialPeriodLabel("P1X"), null);
    assert.equal(storeTrialPeriodLabel(""), null);
  });
});

describe("plan mensual — precio, cadencia y prueba salen de la tienda", () => {
  it("arma el plan vigente con la prueba elegible", () => {
    const plan = nativeStorePlan({
      ...MONTHLY_PACKAGE,
      introOffer: FREE_WEEK,
      trialEligibility: "eligible"
    });
    assert.equal(plan.id, "$rc_monthly");
    assert.equal(plan.label, "Mensual");
    assert.equal(plan.price, "US$4,99");
    assert.equal(plan.cadence, "por mes");
    assert.deepEqual(plan.trial, { label: "7 días gratis", period: "P1W" });
    // Nunca se compara contra un mensual "equivalente" en un plan mensual.
    assert.equal(plan.comparison, null);
  });

  it("el mismo plan, sin elegibilidad, viaja sin promesa de prueba", () => {
    const plan = nativeStorePlan({
      ...MONTHLY_PACKAGE,
      introOffer: FREE_WEEK,
      trialEligibility: "ineligible"
    });
    assert.equal(plan.trial, null);
    // El precio localizado se sigue publicando: no hay oferta rota.
    assert.equal(plan.price, "US$4,99");
    assert.equal(plan.cadence, "por mes");
  });

  it("un paquete sin datos de prueba no arrastra ninguna", () => {
    assert.equal(nativeStorePlan(MONTHLY_PACKAGE).trial, null);
  });

  it("no hay importes ni product ids de respaldo en el contrato de UI", () => {
    const plan = nativeStorePlan({
      ...MONTHLY_PACKAGE,
      priceString: "",
      subscriptionPeriod: null
    });
    assert.equal(plan.price, "");
    assert.equal(plan.cadence, "pago único");
  });

  it("el orden del Offering decide el plan por defecto", () => {
    const plan = nativeStorePlan(MONTHLY_PACKAGE);
    assert.equal(defaultNativePlan([plan]), "$rc_monthly");
    assert.equal(defaultNativePlan([]), null);
  });

  it("traduce los períodos de suscripción sin inventar frecuencia", () => {
    assert.equal(storePeriodLabel("P1M"), "por mes");
    assert.equal(storePeriodLabel("P1Y"), "por año");
    assert.equal(storePeriodLabel("P3M"), "cada 3 meses");
    assert.equal(storePeriodLabel(null), "pago único");
    assert.equal(storePeriodLabel("loquesea"), "según la tienda");
  });
});

describe("identidad — A pasa a B en un solo paso", () => {
  // Corrección B8: `Purchases.logOut()` no cierra sesión, crea un usuario
  // ANÓNIMO del SDK. Estas pruebas afirmaban el logout intermedio como si fuera
  // la forma correcta; era el defecto. La batería conductual completa vive en
  // `test/nativeIdentityAndGuard.test.ts`.
  it("cambiar de cuenta es logIn(B) directo", () => {
    assert.deepEqual(revenueCatIdentitySteps("user_a", "user_b"), ["login"]);
  });

  it("la misma cuenta no toca el SDK", () => {
    assert.deepEqual(revenueCatIdentitySteps("user_a", "user_a"), []);
  });

  it("un anónimo del SDK se convierte con logIn", () => {
    assert.deepEqual(revenueCatIdentitySteps("$RCAnonymousID:abc", "user_b"), ["login"]);
  });

  it("cerrar sesión en la app no toca el SDK", () => {
    assert.deepEqual(revenueCatIdentitySteps("user_a", null), []);
  });

  it("sin identidad previa se entra directo", () => {
    assert.deepEqual(revenueCatIdentitySteps(null, "user_b"), ["login"]);
  });

  it("reconoce los ids anónimos del SDK", () => {
    assert.equal(isAnonymousRevenueCatUser("$RCAnonymousID:abc"), true);
    assert.equal(isAnonymousRevenueCatUser("user_clerk_123"), false);
    assert.equal(isAnonymousRevenueCatUser(null), false);
  });
});

describe("botón primario — después de una compra ambigua nunca se vuelve a cobrar", () => {
  const base = {
    offeringReady: true,
    backendIsPro: false as boolean | undefined,
    storeConfirmed: false,
    busy: false,
    lastOutcome: "none" as NativePurchaseOutcome,
    // El marcador persistido ya se leyó: estos casos ejercitan la decisión, no
    // la ventana de arranque (que tiene su propia prueba en purchaseGuard).
    guardLoaded: true
  };

  it("con la oferta lista y nada en curso, ofrece comprar", () => {
    assert.equal(nativePrimaryAction(base), "purchase");
  });

  it("un resultado ambiguo redirige a Restaurar, no a comprar de nuevo", () => {
    assert.equal(nativePrimaryAction({ ...base, lastOutcome: "ambiguous" }), "restore");
  });

  it("una compra cancelada por la persona no bloquea nada: no hubo cargo", () => {
    assert.equal(nativePrimaryAction({ ...base, lastOutcome: "cancelled" }), "purchase");
  });

  it("si la tienda ya confirmó, la salida NUNCA vuelve a ser comprar", () => {
    assert.equal(nativePrimaryAction({ ...base, storeConfirmed: true }), "wait");
    // Ni siquiera arrastrando un resultado ambiguo anterior.
    assert.equal(
      nativePrimaryAction({ ...base, storeConfirmed: true, lastOutcome: "ambiguous" }),
      "wait"
    );
  });

  it("con el entitlement sin resolver no se ofrece comprar a ciegas", () => {
    assert.equal(nativePrimaryAction({ ...base, backendIsPro: undefined }), "wait");
    assert.equal(
      nativePrimaryAction({ ...base, backendIsPro: undefined, lastOutcome: "ambiguous" }),
      "wait"
    );
  });

  it("con acceso confirmado por el backend no hay nada que comprar", () => {
    assert.equal(nativePrimaryAction({ ...base, backendIsPro: true }), "leave");
    assert.equal(
      nativePrimaryAction({ ...base, backendIsPro: true, lastOutcome: "ambiguous" }),
      "leave"
    );
  });

  it("sin oferta resuelta se espera en vez de ofrecer una compra imposible", () => {
    assert.equal(nativePrimaryAction({ ...base, offeringReady: false }), "wait");
  });

  it("con una acción en curso no se ofrece otra", () => {
    assert.equal(nativePrimaryAction({ ...base, busy: true }), "wait");
    assert.equal(nativePrimaryAction({ ...base, busy: true, lastOutcome: "ambiguous" }), "wait");
  });
});

describe("respuestas de la tienda — cuándo se levanta el bloqueo de recompra", () => {
  it("una cancelación de la persona no arrastra bloqueo", () => {
    assert.equal(nextPurchaseOutcome("none", "purchase_cancelled"), "cancelled");
    assert.equal(nextPurchaseOutcome("ambiguous", "purchase_cancelled"), "cancelled");
  });

  it("un resultado que no se entiende deja la pantalla en Restaurar", () => {
    assert.equal(nextPurchaseOutcome("none", "purchase_ambiguous"), "ambiguous");
    assert.equal(nextPurchaseOutcome("cancelled", "purchase_ambiguous"), "ambiguous");
  });

  it("una confirmación de la tienda limpia cualquier arrastre", () => {
    assert.equal(nextPurchaseOutcome("ambiguous", "store_confirmed"), "none");
  });

  it("Restaurar vacío ES definitivo: no deja a nadie sin poder comprar", () => {
    // `restorePurchases` fuerza el refresh del recibo. Si ahí no hay compra,
    // no hubo cargo, y seguir empujando a Restaurar sería un embudo muerto.
    assert.equal(nextPurchaseOutcome("ambiguous", "restore_empty"), "none");
  });

  it("un recheck vacío NO es definitivo: puede venir del caché del SDK", () => {
    assert.equal(nextPurchaseOutcome("none", "recheck_empty"), "ambiguous");
    assert.equal(nextPurchaseOutcome("ambiguous", "recheck_empty"), "ambiguous");
  });

  it("las dos respuestas vacías se tratan distinto a propósito", () => {
    assert.notEqual(
      nextPurchaseOutcome("ambiguous", "restore_empty"),
      nextPurchaseOutcome("ambiguous", "recheck_empty")
    );
  });
});

describe("activación — compra recibida no es acceso confirmado", () => {
  it("sin nada, no se afirma nada", () => {
    assert.equal(nativeActivationPhase({ backendIsPro: false, storeConfirmed: false }), "idle");
  });

  it("la tienda cobró pero Convex todavía no lo refleja", () => {
    assert.equal(nativeActivationPhase({ backendIsPro: false, storeConfirmed: true }), "activating");
    assert.equal(
      nativeActivationPhase({ backendIsPro: undefined, storeConfirmed: true }),
      "activating"
    );
  });

  it("sólo el backend confirma el acceso", () => {
    assert.equal(nativeActivationPhase({ backendIsPro: true, storeConfirmed: false }), "confirmed");
    assert.equal(nativeActivationPhase({ backendIsPro: true, storeConfirmed: true }), "confirmed");
  });

  it("mientras el entitlement no resuelve, sin señal de tienda, no se afirma acceso", () => {
    assert.equal(nativeActivationPhase({ backendIsPro: undefined, storeConfirmed: false }), "idle");
  });
});

describe("Perfil — qué gestión ofrecer según la autoridad combinada", () => {
  it("distingue cargando, Free y cada proveedor", () => {
    assert.equal(nativeSubscriptionView(undefined), "loading");
    assert.equal(nativeSubscriptionView(null), "unavailable");
    assert.equal(
      nativeSubscriptionView({ isPro: false, isLifetime: false, canManageInStripePortal: false }),
      "free"
    );
    assert.equal(
      nativeSubscriptionView({
        isPro: true,
        provider: "revenuecat",
        isLifetime: false,
        canManageInStripePortal: false
      }),
      "revenuecat"
    );
    assert.equal(
      nativeSubscriptionView({
        isPro: true,
        provider: "stripe",
        isLifetime: false,
        canManageInStripePortal: true
      }),
      "stripe"
    );
    assert.equal(
      nativeSubscriptionView({
        isPro: true,
        provider: "revenuecat",
        isLifetime: true,
        canManageInStripePortal: false
      }),
      "lifetime"
    );
  });

  it("un Stripe activo sin portal disponible no ofrece una gestión que fallaría", () => {
    assert.equal(
      nativeSubscriptionView({
        isPro: true,
        provider: "stripe",
        isLifetime: false,
        canManageInStripePortal: false
      }),
      "active"
    );
  });

  it("el entitlement canónico es el mismo en los tres sistemas", () => {
    assert.equal(ORBITA_PRO_ENTITLEMENT, "orbita_pro");
  });
});
