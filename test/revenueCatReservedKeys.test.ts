/**
 * El webhook de RevenueCat no puede morir por una clave reservada de Convex.
 *
 * ## El defecto, encontrado contra Development el 2026-08-19
 *
 * `revenuecatWebhook` autentica, parsea el JSON y pasa el evento **crudo** como
 * argumento de la mutation. Convex valida los argumentos **antes** de entrar al
 * handler y rechaza cualquier nombre de campo que empiece con `$`:
 *
 * ```
 * 500 — Uncaught Error: Field name $displayName starts with a '$', which is reserved.
 *   at validateObjectField (convex/values/value.ts:163:11)
 * ```
 *
 * RevenueCat manda `subscriber_attributes` con claves reservadas —`$displayName`,
 * `$email`, `$idfa`— y las completa solo. **No es un artefacto del evento de
 * prueba: pasa con eventos reales.** Cada uno devolvía 500, RevenueCat reintenta
 * una cantidad acotada y abandona. Un `INITIAL_PURCHASE` perdido significa que
 * Apple cobró y Convex se quedó en Free.
 *
 * `sanitizeRevenueCatEvent` ya existía, pero corre DENTRO de la mutation —o sea,
 * después de la validación que explota—. Por eso el saneo tiene que pasar en el
 * httpAction, antes de cruzar la frontera.
 *
 * ## Qué NO puede hacer el arreglo
 *
 * Descartar el evento. La mutation necesita el payload completo para resolver
 * identidad, transfers y entitlements: lo único que se quita son las claves que
 * Convex no admite, y nada más.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { stripConvexReservedKeys } from "../convex/lib/revenueCatEvents";
import { ROOT } from "./moduleGraph";

describe("claves reservadas — el evento cruza la frontera sin romper", () => {
  it("REPRO: saca `$displayName` y conserva todo lo demás", () => {
    const evento = {
      id: "evt_1",
      type: "INITIAL_PURCHASE",
      app_user_id: "user_abc",
      subscriber_attributes: {
        $displayName: { value: "Ana", updated_at_ms: 1 },
        $email: { value: "a@orbita.test", updated_at_ms: 2 },
        favoritos: { value: "leo", updated_at_ms: 3 }
      }
    };

    const limpio: any = stripConvexReservedKeys(evento);

    assert.equal(limpio.id, "evt_1", "lo que la mutation necesita se conserva");
    assert.equal(limpio.type, "INITIAL_PURCHASE");
    assert.equal(limpio.app_user_id, "user_abc");
    assert.ok(!("$displayName" in limpio.subscriber_attributes));
    assert.ok(!("$email" in limpio.subscriber_attributes));
    assert.deepEqual(
      limpio.subscriber_attributes.favoritos,
      { value: "leo", updated_at_ms: 3 },
      "un atributo sin prefijo reservado NO se toca"
    );
  });

  it("las claves con `_` también se sacan: Convex las reserva igual", () => {
    const limpio: any = stripConvexReservedKeys({ _id: "x", id: "evt", ok: 1 });
    assert.ok(!("_id" in limpio));
    assert.equal(limpio.id, "evt");
    assert.equal(limpio.ok, 1);
  });

  it("limpia en profundidad, no sólo el primer nivel", () => {
    const limpio: any = stripConvexReservedKeys({
      a: { b: { $malo: 1, bueno: 2 } }
    });
    assert.deepEqual(limpio.a.b, { bueno: 2 });
  });

  it("atraviesa arrays sin aplastarlos", () => {
    const limpio: any = stripConvexReservedKeys({
      items: [{ $x: 1, y: 2 }, { z: 3 }]
    });
    assert.ok(Array.isArray(limpio.items));
    assert.equal(limpio.items.length, 2);
    assert.deepEqual(limpio.items[0], { y: 2 });
    assert.deepEqual(limpio.items[1], { z: 3 });
  });

  it("los primitivos y el null pasan tal cual", () => {
    assert.equal(stripConvexReservedKeys("texto"), "texto");
    assert.equal(stripConvexReservedKeys(42), 42);
    assert.equal(stripConvexReservedKeys(null), null);
    assert.equal(stripConvexReservedKeys(undefined), undefined);
    assert.equal(stripConvexReservedKeys(true), true);
  });

  it("un evento sin claves reservadas queda igual", () => {
    const evento = { id: "evt", type: "RENEWAL", entitlement_ids: ["orbita_pro"] };
    assert.deepEqual(stripConvexReservedKeys(evento), evento);
  });

  it("no explota con una estructura profunda", () => {
    let anidado: any = { $malo: 1, fondo: true };
    for (let i = 0; i < 40; i += 1) anidado = { nivel: anidado };
    const limpio: any = stripConvexReservedKeys(anidado);
    let cursor = limpio;
    for (let i = 0; i < 40; i += 1) cursor = cursor.nivel;
    assert.equal(cursor.fondo, true);
    assert.ok(!("$malo" in cursor));
  });
});

describe("el saneo ocurre ANTES de cruzar la frontera", () => {
  it("el httpAction limpia el evento antes del runMutation", () => {
    // Regresión estructural: si alguien vuelve a pasar el evento crudo, el
    // webhook devuelve 500 y RevenueCat termina abandonando el reintento.
    // `sanitizeRevenueCatEvent` NO sirve acá: corre dentro de la mutation, que
    // es justamente lo que nunca llega a ejecutarse.
    const fuente = readFileSync(join(ROOT, "convex/payments/revenuecat.ts"), "utf8");
    const accion = fuente.slice(
      fuente.indexOf("export const revenuecatWebhook"),
      fuente.indexOf("export const applyRevenueCatEvent")
    );

    // Lo que importa es la CONDUCTA: el argumento que cruza tiene que estar
    // saneado. Da igual si el saneo es una línea aparte o va en la llamada.
    const llamada = accion.match(/runMutation\([^;]*\)/s);
    assert.ok(llamada, "el webhook llama a la mutation");
    assert.ok(
      llamada[0].includes("stripConvexReservedKeys"),
      "el argumento que cruza a la mutation tiene que venir saneado"
    );
    assert.ok(
      !/runMutation\(\s*applyEventRef\s*,\s*\{\s*event\s*\}\s*\)/.test(accion),
      "el evento crudo no puede cruzar la frontera"
    );
  });
});
