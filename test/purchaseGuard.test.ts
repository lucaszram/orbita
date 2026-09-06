/**
 * Marcador de compra en vuelo (P1 7).
 *
 * El bloqueo anti-doble-cobro vivía en el estado de `PlusPaywallScreen`. Un
 * `router.back()` y volver a entrar —o que iOS descarte la pantalla mientras la
 * hoja de compra de StoreKit está arriba— lo borraba, y el botón volvía a decir
 * "comprar" con un cargo posiblemente ya hecho. El marcador tiene que
 * sobrevivir al desmontaje y ser por cuenta.
 *
 * Reglas: se escribe ANTES de iniciar la compra, sólo lo borra una respuesta
 * demostrada, y nunca concede acceso.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parsePurchaseGuardMarker,
  purchaseGuardHolds,
  serializePurchaseGuardMarker,
  type PurchaseGuardMarker
} from "../src/domain/purchaseGuard";
import { nativePrimaryAction } from "../src/domain/nativeCommerce";

const MARKER: PurchaseGuardMarker = { userId: "user_a", startedAt: 1_800_000_000_000 };

describe("marcador — es por cuenta y no concede nada", () => {
  it("bloquea sólo a la cuenta que inició la compra", () => {
    assert.equal(purchaseGuardHolds(MARKER, "user_a"), true);
    assert.equal(purchaseGuardHolds(MARKER, "user_b"), false);
  });

  it("sin marcador no bloquea", () => {
    assert.equal(purchaseGuardHolds(null, "user_a"), false);
  });

  it("sobrevive a un round-trip de almacenamiento", () => {
    assert.deepEqual(parsePurchaseGuardMarker(serializePurchaseGuardMarker(MARKER)), MARKER);
  });

  it("un marcador ilegible NO bloquea a nadie ni rompe el arranque", () => {
    // Un marcador roto no puede dejar a alguien sin poder comprar para siempre.
    for (const raw of [null, "", "{", "null", '{"userId":5}', "[]"]) {
      assert.equal(parsePurchaseGuardMarker(raw), null, `raw ${JSON.stringify(raw)}`);
    }
  });

  it("el marcador no transporta acceso, sólo la cuenta y el momento", () => {
    const claves = Object.keys(JSON.parse(serializePurchaseGuardMarker(MARKER))).sort();
    assert.deepEqual(claves, ["startedAt", "userId"]);
  });
});

describe("no existe ventana para comprar antes de leer el marcador", () => {
  const base = {
    offeringReady: true,
    backendIsPro: false as boolean | undefined,
    storeConfirmed: false,
    busy: false,
    lastOutcome: "none" as const,
    guardLoaded: true
  };

  it("mientras el marcador no se leyó, el botón primario espera", () => {
    assert.equal(nativePrimaryAction({ ...base, guardLoaded: false }), "wait");
  });

  it("con el marcador leído y limpio se puede comprar", () => {
    assert.equal(nativePrimaryAction(base), "purchase");
  });

  it("un marcador arrastrado de una sesión anterior manda a Restaurar", () => {
    assert.equal(nativePrimaryAction({ ...base, lastOutcome: "ambiguous" }), "restore");
  });

  it("la espera por marcador no depende del resto del estado", () => {
    assert.equal(
      nativePrimaryAction({ ...base, guardLoaded: false, lastOutcome: "ambiguous" }),
      "wait"
    );
    // Con acceso ya confirmado por el backend no hay nada que esperar.
    assert.equal(nativePrimaryAction({ ...base, guardLoaded: false, backendIsPro: true }), "leave");
  });
});
