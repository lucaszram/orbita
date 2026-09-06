/**
 * Gestión con dos proveedores activos (P1 6), del lado del cliente.
 *
 * `resolveEntitlement` ya declara los dos, pero el Perfil mostraba una sola
 * salida —la del `provider` ganador— y el otro cobro seguía corriendo sin
 * ninguna forma visible de cancelarlo.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  nativeSubscriptionManagement,
  nativeSubscriptionView
} from "../src/domain/nativeCommerce";
import { ROOT } from "./moduleGraph";

const dobleCobro = {
  isPro: true,
  provider: "revenuecat",
  isLifetime: true,
  canManageInStripePortal: true,
  canManageInRevenueCat: true,
  activeProviders: ["revenuecat", "stripe"]
};

describe("dos proveedores activos exponen las dos salidas", () => {
  it("muestra la gestión de la tienda Y la del portal web", () => {
    const gestion = nativeSubscriptionManagement(dobleCobro);
    assert.equal(gestion.showStoreCenter, true);
    assert.equal(gestion.showStripePortal, true);
    assert.equal(gestion.dual, true);
  });

  it("un solo proveedor muestra sólo su salida", () => {
    const soloTienda = nativeSubscriptionManagement({
      isPro: true,
      provider: "revenuecat",
      isLifetime: false,
      canManageInStripePortal: false,
      canManageInRevenueCat: true,
      activeProviders: ["revenuecat"]
    });
    assert.equal(soloTienda.showStoreCenter, true);
    assert.equal(soloTienda.showStripePortal, false);
    assert.equal(soloTienda.dual, false);

    const soloWeb = nativeSubscriptionManagement({
      isPro: true,
      provider: "stripe",
      isLifetime: false,
      canManageInStripePortal: true,
      canManageInRevenueCat: false,
      activeProviders: ["stripe"]
    });
    assert.equal(soloWeb.showStoreCenter, false);
    assert.equal(soloWeb.showStripePortal, true);
  });

  it("un lifetime de la tienda con Stripe vivo sigue ofreciendo cancelar Stripe", () => {
    // Es exactamente el caso que dejaba un cobro mensual corriendo para siempre.
    assert.equal(nativeSubscriptionManagement(dobleCobro).showStripePortal, true);
  });

  it("Free no ofrece ninguna gestión", () => {
    const libre = nativeSubscriptionManagement({
      isPro: false,
      isLifetime: false,
      canManageInStripePortal: false,
      canManageInRevenueCat: false,
      activeProviders: []
    });
    assert.equal(libre.showStoreCenter, false);
    assert.equal(libre.showStripePortal, false);
    assert.equal(libre.view, "free");
  });

  it("mientras el entitlement no resolvió no se afirma ninguna salida", () => {
    const cargando = nativeSubscriptionManagement(undefined);
    assert.equal(cargando.view, "loading");
    assert.equal(cargando.showStoreCenter, false);
    assert.equal(cargando.showStripePortal, false);
  });

  it("un cliente anterior que sólo mira `view` sigue viendo lo mismo", () => {
    assert.equal(nativeSubscriptionManagement(dobleCobro).view, nativeSubscriptionView(dobleCobro));
  });
});

describe("B11 — las dos salidas se muestran sin importar quién gana el rango", () => {
  const conStripeGanador = {
    isPro: true,
    provider: "stripe",
    isLifetime: false,
    canManageInStripePortal: true,
    canManageInRevenueCat: true,
    activeProviders: ["revenuecat", "stripe"]
  };

  it("Stripe ganador + RevenueCat activo también muestra las dos", () => {
    const gestion = nativeSubscriptionManagement(conStripeGanador);
    assert.equal(gestion.showStoreCenter, true);
    assert.equal(gestion.showStripePortal, true);
    assert.equal(gestion.dual, true);
  });

  it("un provider `stub` con RevenueCat activo no esconde la tienda", () => {
    const gestion = nativeSubscriptionManagement({
      isPro: true,
      provider: "stub",
      isLifetime: false,
      canManageInStripePortal: false,
      canManageInRevenueCat: true,
      activeProviders: ["revenuecat", "stub"]
    });
    assert.equal(gestion.showStoreCenter, true);
    assert.equal(gestion.view, "active");
  });

  it("un provider `stub` sin nada más no ofrece gestión imposible", () => {
    const gestion = nativeSubscriptionManagement({
      isPro: true,
      provider: "stub",
      isLifetime: false,
      canManageInStripePortal: false,
      canManageInRevenueCat: false,
      activeProviders: ["stub"]
    });
    assert.equal(gestion.showStoreCenter, false);
    assert.equal(gestion.showStripePortal, false);
  });

  it("un lifetime de RevenueCat con Stripe ganador conserva las dos salidas", () => {
    const gestion = nativeSubscriptionManagement({
      ...conStripeGanador,
      isLifetime: true
    });
    assert.equal(gestion.showStoreCenter, true);
    assert.equal(gestion.showStripePortal, true);
  });
});

/**
 * P1 3 — que los flags existan no alcanzaba: el RENDER los ignoraba.
 *
 * `ManageSubscription` elegía una rama por `view`, que nombra a UN ganador por
 * rango: la rama `stripe` dibujaba sólo el portal —escondiendo el Customer
 * Center de una compra de Apple viva— y la rama de respaldo (`stub` ganador)
 * ignoraba los dos flags y sólo ofrecía soporte.
 *
 * Estas pruebas son estructurales a propósito: el componente es React Native y
 * no se puede montar en node. Lo que verifican no es una palabra suelta, sino
 * que la decisión de mostrar cada salida cuelgue de su FLAG y no de `view` ni
 * de `provider`, para los cuatro escenarios que rompían.
 */
describe("P1 3 — el bloque activo se compone por flags, no por el ganador", () => {
  const MANAGE = readFileSync(join(ROOT, "src/components/orbita/ManageSubscription.tsx"), "utf8");
  const PAYWALL = readFileSync(join(ROOT, "src/screens/v492/PlusPaywallScreen.tsx"), "utf8");

  /** Stripe gana por rango (fecha más lejana) pero RevenueCat sigue activo. */
  const stripeGanaConRevenueCatVivo = {
    isPro: true,
    provider: "stripe",
    isLifetime: false,
    canManageInStripePortal: true,
    canManageInRevenueCat: true,
    activeProviders: ["revenuecat", "stripe"]
  };

  it("cada salida cuelga de su flag", () => {
    assert.match(MANAGE, /\{management\.showStoreCenter \?/);
    assert.match(MANAGE, /\{management\.showStripePortal \?/);
  });

  it("ya no hay una rama que dibuje sólo un proveedor por `view`", () => {
    assert.doesNotMatch(MANAGE, /if \(view === "stripe"\)/);
    assert.doesNotMatch(MANAGE, /if \(view === "revenuecat" \|\| view === "lifetime"\)/);
  });

  it("el aviso de doble cobro sigue atado a `dual`", () => {
    assert.match(MANAGE, /management\.dual/);
    assert.match(MANAGE, /Revisá las dos para no pagar dos veces/);
  });

  it("el respaldo de soporte sólo aparece si NO hay ninguna salida real", () => {
    assert.match(MANAGE, /const sinSalidaReal =\s*!management\.showStoreCenter && !management\.showStripePortal/);
  });

  it("el portal web nunca se abre solo: siempre detrás de un toque", () => {
    // `openStripePortal` sólo se referencia desde el `onPress` de su Pill.
    const usos = [...MANAGE.matchAll(/openStripePortal\(\)/g)];
    assert.equal(usos.length, 1);
    assert.match(MANAGE, /onPress=\{\(\) => void openStripePortal\(\)\}/);
  });

  it("el paywall confirmado decide por el flag, no por el provider ganador", () => {
    assert.match(PAYWALL, /nativeSubscriptionManagement\(entitlement\)\.showStoreCenter/);
    assert.doesNotMatch(PAYWALL, /entitlement\?\.provider === "revenuecat"/);
  });

  it("los cuatro escenarios que rompían tienen la salida que corresponde", () => {
    // Stripe gana por rango pero RevenueCat sigue activo.
    const stripeGanador = nativeSubscriptionManagement(stripeGanaConRevenueCatVivo);
    assert.deepEqual(
      [stripeGanador.showStoreCenter, stripeGanador.showStripePortal],
      [true, true]
    );

    // Lifetime de RevenueCat con Stripe vivo.
    const lifetimeMasStripe = nativeSubscriptionManagement({
      ...stripeGanaConRevenueCatVivo,
      isLifetime: true
    });
    assert.deepEqual(
      [lifetimeMasStripe.showStoreCenter, lifetimeMasStripe.showStripePortal],
      [true, true]
    );

    // `stub` ganador con RevenueCat activo: antes caía en la rama de soporte.
    const stubMasRevenueCat = nativeSubscriptionManagement({
      isPro: true,
      provider: "stub",
      isLifetime: false,
      canManageInStripePortal: false,
      canManageInRevenueCat: true,
      activeProviders: ["stub", "revenuecat"]
    });
    assert.deepEqual(
      [stubMasRevenueCat.showStoreCenter, stubMasRevenueCat.showStripePortal],
      [true, false]
    );

    // Un solo proveedor sigue mostrando una sola salida.
    const soloRevenueCat = nativeSubscriptionManagement({
      isPro: true,
      provider: "revenuecat",
      isLifetime: false,
      canManageInStripePortal: false,
      canManageInRevenueCat: true,
      activeProviders: ["revenuecat"]
    });
    assert.deepEqual([soloRevenueCat.showStoreCenter, soloRevenueCat.showStripePortal], [true, false]);
  });

  it("la salida de Stripe existe aunque la tienda no esté disponible", () => {
    // Sólo Stripe activo (build sin comercio nativo, o SDK sin clave): el flag
    // del portal sigue en true, y el componente lo abre con el dueño de CLERK,
    // no con el de RevenueCat, que ahí es null.
    const soloStripe = nativeSubscriptionManagement({
      isPro: true,
      provider: "stripe",
      isLifetime: false,
      canManageInStripePortal: true,
      canManageInRevenueCat: false,
      activeProviders: ["stripe"]
    });
    assert.deepEqual([soloStripe.showStoreCenter, soloStripe.showStripePortal], [false, true]);
    const portal = MANAGE.indexOf("const openStripePortal =");
    const cuerpo = MANAGE.slice(portal, MANAGE.indexOf("const openCustomerCenter =", portal));
    assert.match(cuerpo, /const dueño = clerkOwner;/);
    assert.equal(
      /storeOwner/.test(cuerpo),
      false,
      "REPRO: el portal de Stripe no puede exigir identidad de RevenueCat"
    );
  });
});
