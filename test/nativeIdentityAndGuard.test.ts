/**
 * Identidad del SDK, carrera del Offering y marcador por dueño (B8, B9, B10).
 *
 * Pruebas CONDUCTUALES: promesas diferidas y máquinas de estado puras, no
 * búsquedas de texto en el fuente.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyStoreAnswer,
  backendConfirmsStorePurchase,
  emptyPurchaseSession,
  nativePrimaryAction,
  purchaseSessionForOwner,
  revenueCatIdentitySteps,
  type NativePurchaseSession
} from "../src/domain/nativeCommerce";
import { purchaseGuardBlocks, type PurchaseGuardRead } from "../src/domain/purchaseGuard";
import { runGuardedOfferingLoad } from "../src/domain/offeringRetry";

describe("B8 — RevenueCat sólo trabaja con IDs propios", () => {
  it("A → B hace logIn(B) DIRECTO, sin logout intermedio", () => {
    // `logOut()` crea un anónimo del SDK. Pasar por él abre una ventana en la
    // que una compra puede quedar atada a un usuario que no es nadie.
    assert.deepEqual(revenueCatIdentitySteps("user_a", "user_b"), ["login"]);
  });

  it("el logout de la app NO toca el SDK", () => {
    assert.deepEqual(revenueCatIdentitySteps("user_a", null), []);
    assert.deepEqual(revenueCatIdentitySteps(null, null), []);
  });

  it("la misma cuenta no reconfigura nada", () => {
    assert.deepEqual(revenueCatIdentitySteps("user_a", "user_a"), []);
  });

  it("sin identidad previa se entra directo", () => {
    assert.deepEqual(revenueCatIdentitySteps(null, "user_b"), ["login"]);
  });

  it("un anónimo del SDK se convierte con logIn, sin logout", () => {
    assert.deepEqual(revenueCatIdentitySteps("$RCAnonymousID:abc", "user_b"), ["login"]);
  });

  it("nunca se emite un paso `logout`", () => {
    const combinaciones: Array<[string | null, string | null]> = [
      ["user_a", "user_b"],
      ["user_a", null],
      [null, "user_b"],
      ["$RCAnonymousID:x", "user_b"],
      ["$RCAnonymousID:x", null]
    ];
    for (const [from, to] of combinaciones) {
      assert.equal(
        revenueCatIdentitySteps(from, to).includes("logout" as never),
        false,
        `${from} → ${to}`
      );
    }
  });
});

describe("B9 — el retry del Offering descarta resultados obsoletos", () => {
  const diferida = <T>() => {
    let resolver!: (value: T) => void;
    let rechazar!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolver = res;
      rechazar = rej;
    });
    return { promise, resolver, rechazar };
  };

  it("un ÉXITO que llega después de A → B no se publica", async () => {
    const load = diferida<string>();
    let guard = { generation: 1, userId: "user_a" as string | null };
    const publicados: string[] = [];
    const fallos: unknown[] = [];

    const corriendo = runGuardedOfferingLoad({
      load: () => load.promise,
      capture: () => guard,
      current: () => guard,
      publish: (offering) => publicados.push(offering),
      fail: (error) => fallos.push(error)
    });

    // Mientras la carga viaja, Clerk cambia de cuenta.
    guard = { generation: 2, userId: "user_b" };
    load.resolver("offering-de-A");
    await corriendo;

    assert.deepEqual(publicados, [], "el Offering de A no puede quedar en la pantalla de B");
    assert.deepEqual(fallos, []);
  });

  it("un ERROR que llega después de A → B tampoco se publica", async () => {
    const load = diferida<string>();
    let guard = { generation: 1, userId: "user_a" as string | null };
    const publicados: string[] = [];
    const fallos: unknown[] = [];

    const corriendo = runGuardedOfferingLoad({
      load: () => load.promise,
      capture: () => guard,
      current: () => guard,
      publish: (o) => publicados.push(o),
      fail: (e) => fallos.push(e)
    });

    guard = { generation: 2, userId: "user_b" };
    load.rechazar(new Error("offerings caído"));
    await corriendo;

    assert.deepEqual(fallos, [], "un error de A no puede pintar de rojo la pantalla de B");
    assert.deepEqual(publicados, []);
  });

  it("sin cambio de identidad, el resultado sí se publica", async () => {
    const guard = { generation: 1, userId: "user_a" as string | null };
    const publicados: string[] = [];
    await runGuardedOfferingLoad({
      load: async () => "offering",
      capture: () => guard,
      current: () => guard,
      publish: (o) => publicados.push(o),
      fail: () => undefined
    });
    assert.deepEqual(publicados, ["offering"]);
  });

  it("un cambio de generación con el MISMO usuario también invalida", async () => {
    // Remontar la pantalla sin cambiar de cuenta reinicia la generación: el
    // resultado viejo pertenece a un ciclo que ya no existe.
    const load = diferida<string>();
    let guard = { generation: 1, userId: "user_a" as string | null };
    const publicados: string[] = [];
    const corriendo = runGuardedOfferingLoad({
      load: () => load.promise,
      capture: () => guard,
      current: () => guard,
      publish: (o) => publicados.push(o),
      fail: () => undefined
    });
    guard = { generation: 2, userId: "user_a" };
    load.resolver("viejo");
    await corriendo;
    assert.deepEqual(publicados, []);
  });

  it("un error real con la identidad vigente sí se reporta", async () => {
    const guard = { generation: 1, userId: "user_a" as string | null };
    const fallos: unknown[] = [];
    await runGuardedOfferingLoad({
      load: async () => {
        throw new Error("offerings caído");
      },
      capture: () => guard,
      current: () => guard,
      publish: () => undefined,
      fail: (e) => fallos.push(e)
    });
    assert.equal(fallos.length, 1);
  });
});

describe("B10 — el marcador falla cerrado y es por dueño", () => {
  it("una lectura ilegible bloquea la compra, no la habilita", () => {
    // Un JSON roto o un fallo de IO pueden estar tapando un cargo real. La
    // salida segura es Restaurar; un restore vacío autoritativo lo limpia.
    const casos: Array<[PurchaseGuardRead, boolean]> = [
      [{ state: "empty" }, false],
      [{ state: "held", marker: { userId: "user_a", startedAt: 1 } }, true],
      [{ state: "unreadable" }, true]
    ];
    for (const [read, bloquea] of casos) {
      assert.equal(purchaseGuardBlocks(read), bloquea, read.state);
    }
  });

  it("el estado de compra se reinicia al cambiar de dueño", () => {
    const deA: NativePurchaseSession = {
      userId: "user_a",
      guard: "blocked",
      lastOutcome: "ambiguous",
      purchaseReceived: true
    };
    const paraB = purchaseSessionForOwner(deA, "user_b");
    assert.equal(paraB.userId, "user_b");
    assert.equal(paraB.guard, "loading", "B no puede heredar el `guardLoaded` de A");
    assert.equal(paraB.lastOutcome, "none");
    assert.equal(paraB.purchaseReceived, false);
  });

  it("con el mismo dueño, el estado se conserva", () => {
    const deA: NativePurchaseSession = {
      userId: "user_a",
      guard: "blocked",
      lastOutcome: "ambiguous",
      purchaseReceived: true
    };
    assert.deepEqual(purchaseSessionForOwner(deA, "user_a"), deA);
  });

  it("al cerrar sesión no queda estado de compra colgado", () => {
    const deA: NativePurchaseSession = {
      userId: "user_a",
      guard: "clear",
      lastOutcome: "ambiguous",
      purchaseReceived: true
    };
    const sinSesion = purchaseSessionForOwner(deA, null);
    assert.equal(sinSesion.userId, null);
    assert.equal(sinSesion.lastOutcome, "none");
    assert.equal(sinSesion.purchaseReceived, false);
  });

  it("una continuación vieja de A no publica estado en la sesión de B", () => {
    const sesionDeB = emptyPurchaseSession("user_b");
    // La compra de A termina tarde y quiere anunciar que la tienda confirmó.
    const despues = applyStoreAnswer(sesionDeB, "user_a", "store_confirmed");
    assert.deepEqual(despues, sesionDeB, "el dueño no coincide: se descarta");
  });

  it("una continuación vieja de A tampoco LIMPIA la UI de B", () => {
    const sesionDeB: NativePurchaseSession = {
      userId: "user_b",
      guard: "blocked",
      lastOutcome: "ambiguous",
      purchaseReceived: false
    };
    assert.deepEqual(applyStoreAnswer(sesionDeB, "user_a", "restore_empty"), sesionDeB);
  });

  it("la respuesta del dueño correcto sí se aplica", () => {
    const sesion = emptyPurchaseSession("user_a");
    const ambigua = applyStoreAnswer({ ...sesion, guard: "clear" }, "user_a", "purchase_ambiguous");
    assert.equal(ambigua.lastOutcome, "ambiguous");
    assert.equal(ambigua.guard, "blocked");
  });

  it("una compra confirmada por la tienda NO limpia el marcador todavía", () => {
    // El cargo existe; falta que Convex lo refleje. Limpiar acá volvería a
    // habilitar "comprar" con una compra sin confirmar.
    const sesion: NativePurchaseSession = {
      userId: "user_a",
      guard: "blocked",
      lastOutcome: "none",
      purchaseReceived: false
    };
    const despues = applyStoreAnswer(sesion, "user_a", "store_confirmed");
    assert.equal(despues.purchaseReceived, true);
    assert.equal(despues.guard, "blocked", "sólo Convex puede levantarlo");
  });

  it("una cancelación demostrada y un restore vacío autoritativo sí limpian", () => {
    const bloqueada: NativePurchaseSession = {
      userId: "user_a",
      guard: "blocked",
      lastOutcome: "ambiguous",
      purchaseReceived: false
    };
    assert.equal(applyStoreAnswer(bloqueada, "user_a", "purchase_cancelled").guard, "clear");
    assert.equal(applyStoreAnswer(bloqueada, "user_a", "restore_empty").guard, "clear");
  });

  it("un recheck vacío NO limpia: puede venir del caché del SDK", () => {
    const bloqueada: NativePurchaseSession = {
      userId: "user_a",
      guard: "blocked",
      lastOutcome: "ambiguous",
      purchaseReceived: false
    };
    assert.equal(applyStoreAnswer(bloqueada, "user_a", "recheck_empty").guard, "blocked");
  });
});

describe("B10 — sólo RevenueCat confirma una compra de RevenueCat", () => {
  it("un Plus de Stripe NO levanta el marcador de la tienda", () => {
    // Alguien con Stripe activo que además compró en la App Store: el
    // `isPro` de Stripe no dice NADA sobre ese cargo de Apple.
    assert.equal(
      backendConfirmsStorePurchase({
        isPro: true,
        provider: "stripe",
        isLifetime: false,
        canManageInStripePortal: true,
        canManageInRevenueCat: false,
        activeProviders: ["stripe"]
      }),
      false
    );
  });

  it("una confirmación de RevenueCat sí lo levanta", () => {
    assert.equal(
      backendConfirmsStorePurchase({
        isPro: true,
        provider: "revenuecat",
        isLifetime: false,
        canManageInStripePortal: false,
        canManageInRevenueCat: true,
        activeProviders: ["revenuecat"]
      }),
      true
    );
  });

  it("con los dos proveedores activos, también lo levanta", () => {
    assert.equal(
      backendConfirmsStorePurchase({
        isPro: true,
        provider: "stripe",
        isLifetime: false,
        canManageInStripePortal: true,
        canManageInRevenueCat: true,
        activeProviders: ["revenuecat", "stripe"]
      }),
      true
    );
  });

  it("sin entitlement resuelto no confirma nada", () => {
    assert.equal(backendConfirmsStorePurchase(undefined), false);
    assert.equal(
      backendConfirmsStorePurchase({
        isPro: false,
        isLifetime: false,
        canManageInStripePortal: false,
        canManageInRevenueCat: false,
        activeProviders: []
      }),
      false
    );
  });
});

describe("B10 — no hay ventana para comprar mientras el marcador carga", () => {
  const base = {
    offeringReady: true,
    backendIsPro: false as boolean | undefined,
    storeConfirmed: false,
    busy: false,
    lastOutcome: "none" as const,
    guardLoaded: true
  };

  it("`loading` espera; `blocked` manda a Restaurar; `clear` habilita comprar", () => {
    assert.equal(nativePrimaryAction({ ...base, guardLoaded: false }), "wait");
    assert.equal(nativePrimaryAction({ ...base, lastOutcome: "ambiguous" }), "restore");
    assert.equal(nativePrimaryAction(base), "purchase");
  });
});
