/**
 * Contrato real de la REST v1 de RevenueCat (A4) y precedencia lifetime (A6).
 *
 * El intérprete anterior era optimista en tres direcciones peligrosas: trataba
 * el 404 como "cuenta sin compras" (cuando el endpoint es GET-or-create y un
 * 404 significa otra cosa), convertía cualquier `expires` ausente o ilegible en
 * lifetime, y aceptaba un sobre a medias como evidencia de Free.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PRO_ENTITLEMENT } from "../convex/lib/entitlements";
import { interpretRevenueCatSubscriber } from "../convex/lib/revenueCatRest";

const NOW = 1_800_000_000_000;
const FUTURE = 2_000_000_000_000;
const PAST = 1_700_000_000_000;

const sobre = (over: Record<string, unknown> = {}) => ({
  request_date_ms: NOW,
  subscriber: {
    original_app_user_id: "user_current",
    entitlements: {},
    subscriptions: {},
    non_subscriptions: {},
    ...over
  }
});

/**
 * La lectura SIEMPRE se interpreta contra una cuenta concreta (P1 1).
 *
 * `GET /v1/subscribers/{B}` devuelve el `CustomerInfo` del alias chain, no el
 * de B a secas: sin decir contra quién se está leyendo, el mismo pago se puede
 * proyectar a dos cuentas.
 */
const interpretar = (status: number, body: unknown, expectedAppUserId = "user_current") =>
  interpretRevenueCatSubscriber(status, body, { expectedAppUserId });

describe("A4 — códigos HTTP", () => {
  it("200 y 201 se validan igual (el endpoint es GET-or-create)", () => {
    const body = sobre({
      entitlements: { orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" } },
      subscriptions: { orbita_monthly: { expires_date_ms: FUTURE, period_type: "normal", is_sandbox: false } }
    });
    for (const status of [200, 201]) {
      const out = interpretar(status, body);
      assert.equal(out.kind, "resolved", `status ${status}`);
      assert.equal(out.kind === "resolved" && out.patch.entitlement, PRO_ENTITLEMENT);
    }
  });

  it("404 NO es un éxito documentado: no concede y NUNCA revoca", () => {
    // El endpoint crea el subscriber si no existe, así que un 404 no significa
    // "cuenta sin compras": significa que algo está mal (ruta, proyecto, id).
    const out = interpretar(404, {});
    assert.equal(out.kind, "unavailable");
  });

  it("5xx, 429, 401 y 403 nunca conceden ni revocan", () => {
    for (const status of [500, 502, 503, 429, 401, 403, 418]) {
      assert.equal(interpretar(status, sobre()).kind, "unavailable", `status ${status}`);
    }
  });
});

describe("A4 — shape profunda", () => {
  it("un sobre incompleto no alcanza para afirmar Free", () => {
    const incompletos: unknown[] = [
      null,
      "texto",
      42,
      {},
      { subscriber: 7 },
      { subscriber: {} },
      // Falta `request_date_ms`.
      { subscriber: { entitlements: {}, subscriptions: {}, non_subscriptions: {} } },
      // `request_date_ms` inválido.
      { request_date_ms: "ayer", subscriber: { entitlements: {}, subscriptions: {}, non_subscriptions: {} } },
      { request_date_ms: Number.NaN, subscriber: { entitlements: {}, subscriptions: {}, non_subscriptions: {} } },
      // Falta alguno de los mapas obligatorios.
      { request_date_ms: NOW, subscriber: { entitlements: {} } },
      { request_date_ms: NOW, subscriber: { entitlements: {}, subscriptions: {} } },
      { request_date_ms: NOW, subscriber: { entitlements: [], subscriptions: {}, non_subscriptions: {} } }
    ];
    for (const body of incompletos) {
      assert.equal(
        interpretar(200, body).kind,
        "unavailable",
        `body ${JSON.stringify(body)}`
      );
    }
  });

  it("un sobre COMPLETO sin orbita_pro sí es Free autoritativo", () => {
    const out = interpretar(200, sobre());
    assert.equal(out.kind, "resolved");
    assert.equal(out.kind === "resolved" && out.patch.entitlement, "free");
  });

  it("`orbita_pro: null` es inválido, no Free", () => {
    const out = interpretar(200, sobre({ entitlements: { orbita_pro: null } }));
    assert.equal(out.kind, "unavailable");
  });
});

describe("A4 — el vencimiento no se inventa", () => {
  it("un `expires_date` ausente NO se convierte en lifetime", () => {
    const out = interpretar(
      200,
      sobre({ entitlements: { orbita_pro: { product_identifier: "orbita_monthly" } } })
    );
    assert.equal(out.kind, "unavailable");
  });

  it("un `expires_date` malformado NO se convierte en lifetime ni en Free", () => {
    for (const expires of ["mañana", "", 0, false, {}]) {
      const out = interpretar(
        200,
        sobre({ entitlements: { orbita_pro: { expires_date: expires, product_identifier: "orbita_monthly" } } })
      );
      assert.equal(out.kind, "unavailable", `expires ${JSON.stringify(expires)}`);
    }
  });

  it("un vencimiento futuro concede con su fecha", () => {
    const out = interpretar(
      200,
      sobre({
        entitlements: { orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" } },
        subscriptions: { orbita_monthly: { expires_date_ms: FUTURE, period_type: "normal", is_sandbox: false } }
      })
    );
    assert.equal(out.kind === "resolved" && out.patch.currentPeriodEnd, FUTURE);
    assert.equal(out.kind === "resolved" && out.patch.isLifetime, false);
  });

  it("REPRO: un campo de lifecycle presente pero ILEGIBLE no se lee como «renueva»", () => {
    // P2: `optionalDate` colapsaba "ausente" e "inválido" en `undefined`, así
    // que un `unsubscribe_detected_at_ms: "ayer"` producía la afirmación más
    // optimista posible —`status: "active"`, `willRenew: true`— desde un campo
    // que no se entiende.
    for (const campo of ["unsubscribe_detected_at_ms", "billing_issues_detected_at_ms"]) {
      // `0` y los negativos entran acá a propósito: son finitos y "legibles",
      // pero la época Unix no marca una baja ni un problema de cobro. Colapsados
      // en "ausente" producían la afirmación más optimista posible.
      for (const corrupto of ["ayer", true, {}, Number.NaN, 0, -1]) {
        const out = interpretar(
          200,
          sobre({
            entitlements: { orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" } },
            subscriptions: {
              orbita_monthly: {
                expires_date_ms: FUTURE,
                period_type: "normal",
                is_sandbox: false,
                [campo]: corrupto
              }
            }
          })
        );
        const etiqueta = `${campo}=${String(corrupto)}`;
        assert.equal(out.kind, "unavailable", etiqueta);
        if (out.kind === "unavailable") {
          assert.equal(out.reason, "invalid_subscription_lifecycle", etiqueta);
        }
      }
    }
  });

  it("los mismos campos AUSENTES o en `null` siguen siendo normales", () => {
    const ausente = interpretar(
      200,
      sobre({
        entitlements: { orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" } },
        subscriptions: { orbita_monthly: { expires_date_ms: FUTURE, is_sandbox: false } }
      })
    );
    assert.equal(ausente.kind, "resolved");
    assert.equal(ausente.kind === "resolved" && ausente.patch.willRenew, true);

    const explicitoNulo = interpretar(
      200,
      sobre({
        entitlements: { orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" } },
        subscriptions: {
          orbita_monthly: {
            expires_date_ms: FUTURE,
            is_sandbox: false,
            unsubscribe_detected_at: null,
            unsubscribe_detected_at_ms: null,
            billing_issues_detected_at: null,
            billing_issues_detected_at_ms: null
          }
        }
      })
    );
    assert.equal(explicitoNulo.kind, "resolved");
    assert.equal(explicitoNulo.kind === "resolved" && explicitoNulo.patch.willRenew, true);
    assert.equal(explicitoNulo.kind === "resolved" && explicitoNulo.patch.status, "active");
  });

  it("un ISO válido también sirve para el lifecycle, sin sobreajustar formatos", () => {
    const out = interpretar(
      200,
      sobre({
        entitlements: { orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" } },
        subscriptions: {
          orbita_monthly: {
            expires_date_ms: FUTURE,
            is_sandbox: false,
            billing_issues_detected_at: "2026-01-01T00:00:00Z"
          }
        }
      })
    );
    assert.equal(out.kind, "resolved");
    assert.equal(out.kind === "resolved" && out.patch.status, "billing_issue");
  });

  it("y una baja LEGIBLE sigue apagando la renovación", () => {
    const out = interpretar(
      200,
      sobre({
        entitlements: { orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" } },
        subscriptions: {
          orbita_monthly: {
            expires_date_ms: FUTURE,
            is_sandbox: false,
            unsubscribe_detected_at_ms: NOW
          }
        }
      })
    );
    assert.equal(out.kind, "resolved");
    if (out.kind !== "resolved") return;
    assert.equal(out.patch.status, "canceled");
    assert.equal(out.patch.willRenew, false);
  });

  it("un vencimiento pasado retira el acceso", () => {
    const out = interpretar(
      200,
      sobre({
        entitlements: { orbita_pro: { expires_date_ms: PAST, product_identifier: "orbita_monthly" } },
        subscriptions: { orbita_monthly: { expires_date_ms: PAST, period_type: "normal", is_sandbox: false } }
      })
    );
    assert.equal(out.kind === "resolved" && out.patch.entitlement, "free");
  });
});

describe("A6 — permanente sólo con producto DECLARADO y evidencia inequívoca", () => {
  /** El catálogo V1 es mensual: sin declaración, ningún permanente se concede. */
  const CATALOGO = { REVENUECAT_LIFETIME_PRODUCT_IDS: "orbita_lifetime" };
  const conCatalogo = (body: unknown) =>
    interpretRevenueCatSubscriber(200, body, {
      expectedAppUserId: "user_current",
      env: CATALOGO
    });

  const lifetimeBody = (nonSub: Record<string, unknown>) =>
    sobre({
      entitlements: { orbita_pro: { expires_date: null, product_identifier: "orbita_lifetime" } },
      non_subscriptions: { orbita_lifetime: [nonSub] }
    });

  /** La forma documentada por la v1: `id`, `is_sandbox`, `purchase_date`, `store`. */
  const transaccion = (over: Record<string, unknown> = {}) => ({
    id: "tx_1",
    is_sandbox: false,
    purchase_date: "2025-01-01T00:00:00Z",
    store: "app_store",
    ...over
  });

  it("REPRO: sin el producto en la allowlist, `expires_date: null` NO concede", () => {
    // P1 4/5: el catálogo de lanzamiento no vende permanentes. Un cuerpo que
    // afirma un acceso sin vencimiento de un producto que este backend no
    // declara no se interpreta: no concede ni revoca.
    const out = interpretar(200, lifetimeBody(transaccion()));
    assert.equal(out.kind, "unavailable");
    if (out.kind === "unavailable") assert.equal(out.reason, "lifetime_product_not_allowlisted");
  });

  it("con el producto declarado y UNA transacción estricta, sí es lifetime", () => {
    const out = conCatalogo(lifetimeBody(transaccion()));
    assert.equal(out.kind, "resolved");
    if (out.kind !== "resolved") return;
    assert.equal(out.patch.isLifetime, true);
    assert.equal(out.patch.entitlement, PRO_ENTITLEMENT);
    assert.equal(out.environment, "production");
  });

  it("`expires_date: null` SIN una compra permanente que lo respalde no concede", () => {
    const out = conCatalogo(
      sobre({ entitlements: { orbita_pro: { expires_date: null, product_identifier: "orbita_lifetime" } } })
    );
    assert.equal(out.kind, "unavailable");
    if (out.kind === "unavailable") {
      assert.equal(out.reason, "lifetime_without_purchase_evidence");
    }
  });

  it("REPRO: un `refunded_at` fabricado en non_subscriptions NO revoca ni decide", () => {
    // P1 4: la v1 documenta `id`, `is_sandbox`, `purchase_date` y `store` en
    // `non_subscriptions`. `refunded_at` vive en `subscriptions`. Construir
    // "evidencia de reembolso" con ese campo era inventar autoridad sobre un
    // acceso pago desde algo que el proveedor no promete.
    //
    // Con el entitlement PRESENTE, el campo de más simplemente se ignora: la
    // transacción sigue siendo estricta y válida.
    const conCampoInventado = conCatalogo(
      lifetimeBody(transaccion({ refunded_at: "2026-01-01T00:00:00Z" }))
    );
    assert.equal(conCampoInventado.kind, "resolved");
    assert.equal(
      conCampoInventado.kind === "resolved" && conCampoInventado.patch.isLifetime,
      true,
      "un campo no documentado no puede retirar el acceso"
    );

    // Y sin el entitlement, el Free es autoritativo por la AUSENCIA del
    // entitlement — no por el campo inventado.
    const sinEntitlement = conCatalogo(
      sobre({ non_subscriptions: { orbita_lifetime: [transaccion({ refunded_at: "2026-01-01T00:00:00Z" })] } })
    );
    assert.equal(sinEntitlement.kind, "resolved");
    assert.equal(sinEntitlement.kind === "resolved" && sinEntitlement.patch.entitlement, "free");
    assert.deepEqual(
      sinEntitlement.kind === "resolved" ? sinEntitlement.revocation : null,
      { kind: "global" }
    );
  });

  it("DOS transacciones son ambiguas: la fila agregada no puede representarlas", () => {
    const out = conCatalogo(
      sobre({
        entitlements: { orbita_pro: { expires_date: null, product_identifier: "orbita_lifetime" } },
        non_subscriptions: {
          orbita_lifetime: [
            transaccion({ id: "tx_1", is_sandbox: false }),
            transaccion({ id: "tx_2", is_sandbox: true })
          ]
        }
      })
    );
    assert.equal(out.kind, "unavailable");
  });

  it("una transacción sin fecha de compra ni store NO sostiene un lifetime", () => {
    for (const parcial of [
      { id: "tx_1", is_sandbox: false, store: "app_store" }, // sin purchase_date
      { id: "tx_1", is_sandbox: false, purchase_date: "2025-01-01T00:00:00Z" }, // sin store
      { is_sandbox: false, purchase_date: "2025-01-01T00:00:00Z", store: "app_store" }, // sin id
      { id: "tx_1", purchase_date: "2025-01-01T00:00:00Z", store: "app_store" } // sin entorno
    ]) {
      const out = conCatalogo(lifetimeBody(parcial));
      assert.equal(out.kind, "unavailable", JSON.stringify(parcial));
    }
  });

  it("REPRO: `expires_date: null` con `expires_date_ms` corrupto es CONTRADICTORIO", () => {
    // P1 6: antes se prefería `_ms` y, si no se entendía, se caía al ISO. Un
    // `null` acompañado de basura terminaba leyéndose como "sin vencimiento" y
    // concedía acceso permanente desde un campo roto.
    for (const corrupto of ["corrupt", true, {}, Number.NaN]) {
      const out = conCatalogo(
        sobre({
          entitlements: {
            orbita_pro: {
              expires_date: null,
              expires_date_ms: corrupto,
              product_identifier: "orbita_lifetime"
            }
          },
          non_subscriptions: { orbita_lifetime: [transaccion()] }
        })
      );
      assert.equal(out.kind, "unavailable", String(corrupto));
      if (out.kind === "unavailable") assert.equal(out.reason, "invalid_expiration");
    }
  });

  it("dos variantes que se contradicen entre sí tampoco se interpretan", () => {
    const out = conCatalogo(
      sobre({
        entitlements: {
          orbita_pro: {
            // Un ISO y un `_ms` que hablan de instantes distintos.
            expires_date: "2033-05-18T03:33:20Z",
            expires_date_ms: 1_000_000_000_000,
            product_identifier: "orbita_monthly"
          }
        },
        subscriptions: { orbita_monthly: { expires_date_ms: FUTURE, is_sandbox: false } }
      })
    );
    assert.equal(out.kind, "unavailable");
    if (out.kind === "unavailable") assert.equal(out.reason, "invalid_expiration");
  });

  it("las dos variantes coherentes sí se aceptan", () => {
    const iso = "2033-05-18T03:33:20Z";
    const out = conCatalogo(
      sobre({
        entitlements: {
          orbita_pro: {
            expires_date: iso,
            expires_date_ms: Date.parse(iso),
            product_identifier: "orbita_monthly"
          }
        },
        subscriptions: { orbita_monthly: { expires_date_ms: Date.parse(iso), is_sandbox: false } }
      })
    );
    assert.equal(out.kind, "resolved");
    if (out.kind !== "resolved") return;
    assert.equal(out.patch.currentPeriodEnd, Date.parse(iso));
  });

  it("con el entitlement apuntando al mensual, la LECTURA informa el mensual", () => {
    // El nombre de un producto de `non_subscriptions` no puede convertir esto
    // en permanente. La protección del lifetime legado vive en la FILA:
    // `projectRevenueCatSubscriber` nunca degrada un `isLifetime: true`.
    const out = conCatalogo(
      sobre({
        entitlements: { orbita_pro: { expires_date_ms: FUTURE, product_identifier: "orbita_monthly" } },
        subscriptions: { orbita_monthly: { expires_date_ms: FUTURE, period_type: "normal", is_sandbox: false } },
        non_subscriptions: { orbita_lifetime: [transaccion()] }
      })
    );
    assert.equal(out.kind, "resolved");
    if (out.kind !== "resolved") return;
    assert.equal(out.patch.plan, "monthly");
    assert.equal(out.patch.isLifetime, false);
    assert.equal(out.patch.entitlement, PRO_ENTITLEMENT);
  });
});
