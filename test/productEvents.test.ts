import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createOpaqueId,
  enqueueProductEvent,
  isForegroundReturn,
  isOpaqueId,
  normalizePlatform,
  OPAQUE_ID_PATTERN,
  parseStoredQueue,
  PRODUCT_EVENT_MAX_AGE_MS,
  PRODUCT_EVENT_QUEUE_LIMIT,
  removeProductEvent,
  SESSION_ONCE_EVENTS,
  type ProductEventPayload
} from "../src/domain/productEvents";

const NOW = 1_800_000_000_000;

function event(overrides: Partial<ProductEventPayload> = {}): ProductEventPayload {
  return {
    eventId: "11111111-2222-4333-8444-555555555555",
    eventName: "app_opened",
    installationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    sessionId: "99999999-8888-4777-8666-555555555555",
    occurredAt: NOW,
    platform: "ios",
    ...overrides
  };
}

describe("createOpaqueId — ids opacos válidos para el backend", () => {
  it("cumple el patrón del contrato (8–160 chars, A-Za-z0-9._:-)", () => {
    for (let i = 0; i < 50; i++) {
      const id = createOpaqueId();
      assert.match(id, OPAQUE_ID_PATTERN);
      assert.ok(isOpaqueId(id));
      assert.equal(id.length, 36);
    }
  });
  it("es determinístico con RNG inyectado y varía con RNGs distintos", () => {
    const rngA = () => 0.5;
    const rngB = () => 0.25;
    assert.equal(createOpaqueId(rngA), createOpaqueId(rngA));
    assert.notEqual(createOpaqueId(rngA), createOpaqueId(rngB));
  });
  it("dos ids con Math.random no colisionan (humo)", () => {
    assert.notEqual(createOpaqueId(), createOpaqueId());
  });
});

describe("isForegroundReturn — solo background → active abre sesión nueva", () => {
  it("background → active es regreso real", () => {
    assert.equal(isForegroundReturn("background", "active"), true);
  });
  it("inactive → active NO (app switcher / centro de notificaciones en iOS)", () => {
    assert.equal(isForegroundReturn("inactive", "active"), false);
  });
  it("arranque en frío (sin estado previo) NO duplica: la sesión inicial ya existe", () => {
    assert.equal(isForegroundReturn(null, "active"), false);
    assert.equal(isForegroundReturn(undefined, "active"), false);
  });
  it("active → background no dispara nada", () => {
    assert.equal(isForegroundReturn("active", "background"), false);
  });
});

describe("normalizePlatform", () => {
  it("mapea ios/android/web y desconoce el resto", () => {
    assert.equal(normalizePlatform("ios"), "ios");
    assert.equal(normalizePlatform("android"), "android");
    assert.equal(normalizePlatform("web"), "web");
    assert.equal(normalizePlatform("windows"), "unknown");
    assert.equal(normalizePlatform("macos"), "unknown");
  });
});

describe("enqueueProductEvent — cola idempotente", () => {
  it("agrega al final y no muta la cola original", () => {
    const q0: ProductEventPayload[] = [];
    const q1 = enqueueProductEvent(q0, event());
    assert.equal(q0.length, 0);
    assert.equal(q1.length, 1);
  });
  it("el mismo eventId no entra dos veces (el reintento reutiliza el encolado)", () => {
    const q1 = enqueueProductEvent([], event());
    const q2 = enqueueProductEvent(q1, event({ occurredAt: NOW + 1 }));
    assert.equal(q2.length, 1);
    assert.equal(q2[0].occurredAt, NOW);
  });
  it("al rebalsar el límite cae lo más viejo, no lo nuevo", () => {
    let q: ProductEventPayload[] = [];
    for (let i = 0; i < PRODUCT_EVENT_QUEUE_LIMIT + 5; i++) {
      q = enqueueProductEvent(q, event({ eventId: `evento-numero-${i}-relleno` }));
    }
    assert.equal(q.length, PRODUCT_EVENT_QUEUE_LIMIT);
    assert.equal(q[0].eventId, "evento-numero-5-relleno");
    assert.equal(q[q.length - 1].eventId, `evento-numero-${PRODUCT_EVENT_QUEUE_LIMIT + 4}-relleno`);
  });
});

describe("removeProductEvent", () => {
  it("saca solo el eventId indicado", () => {
    const a = event({ eventId: "evento-aaaa-1" });
    const b = event({ eventId: "evento-bbbb-2" });
    const q = removeProductEvent([a, b], "evento-aaaa-1");
    assert.deepEqual(q.map((e) => e.eventId), ["evento-bbbb-2"]);
  });
  it("un id inexistente deja la cola igual", () => {
    const q = [event()];
    assert.equal(removeProductEvent(q, "no-existe-este-id").length, 1);
  });
});

describe("parseStoredQueue — hidratación defensiva entre arranques", () => {
  it("null / JSON roto / no-array → cola vacía", () => {
    assert.deepEqual(parseStoredQueue(null, NOW), []);
    assert.deepEqual(parseStoredQueue("{{{", NOW), []);
    assert.deepEqual(parseStoredQueue('{"a":1}', NOW), []);
  });
  it("conserva eventos válidos con todos sus campos", () => {
    const stored = [event({ eventName: "onboarding_step_viewed", onboardingStep: 5, entryPoint: "home" })];
    const parsed = parseStoredQueue(JSON.stringify(stored), NOW);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].eventName, "onboarding_step_viewed");
    assert.equal(parsed[0].onboardingStep, 5);
    assert.equal(parsed[0].entryPoint, "home");
    assert.equal(parsed[0].sessionId, stored[0].sessionId);
  });
  it("descarta entradas malformadas: sin eventId válido, evento desconocido, sin installationId", () => {
    const stored = [
      event(),
      { ...event({ eventId: "corto" }) },
      { ...event(), eventName: "evento_inventado" },
      { ...event(), installationId: 42 },
      "basura",
      null
    ];
    const parsed = parseStoredQueue(JSON.stringify(stored), NOW);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].eventId, event().eventId);
  });
  it("descarta lo más viejo que la ventana de 7 días (el backend lo rechazaría)", () => {
    const fresh = event({ eventId: "evento-fresco-01", occurredAt: NOW - PRODUCT_EVENT_MAX_AGE_MS + 1000 });
    const stale = event({ eventId: "evento-vencido-1", occurredAt: NOW - PRODUCT_EVENT_MAX_AGE_MS - 1000 });
    const parsed = parseStoredQueue(JSON.stringify([fresh, stale]), NOW);
    assert.deepEqual(parsed.map((e) => e.eventId), ["evento-fresco-01"]);
  });
  it("un sessionId inválido se omite sin tirar el evento (sessionId es opcional)", () => {
    const stored = [{ ...event(), sessionId: "x" }];
    const parsed = parseStoredQueue(JSON.stringify(stored), NOW);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].sessionId, undefined);
  });
  it("normaliza una plataforma desconocida a 'unknown'", () => {
    const stored = [{ ...event(), platform: "tvos" }];
    const parsed = parseStoredQueue(JSON.stringify(stored), NOW);
    assert.equal(parsed[0].platform, "unknown");
  });
  it("acota la cola hidratada al límite", () => {
    const stored = Array.from({ length: PRODUCT_EVENT_QUEUE_LIMIT + 10 }, (_, i) =>
      event({ eventId: `evento-numero-${i}-relleno` })
    );
    assert.equal(parseStoredQueue(JSON.stringify(stored), NOW).length, PRODUCT_EVENT_QUEUE_LIMIT);
  });
});

describe("SESSION_ONCE_EVENTS — dedupe por sesión del cliente", () => {
  it("app_opened, natal_chart_viewed y daily_guide_viewed son una vez por sesión", () => {
    assert.ok(SESSION_ONCE_EVENTS.has("app_opened"));
    assert.ok(SESSION_ONCE_EVENTS.has("natal_chart_viewed"));
    assert.ok(SESSION_ONCE_EVENTS.has("daily_guide_viewed"));
  });
  it("los eventos de onboarding NO (su dedupe es por ejecución del flujo)", () => {
    assert.equal(SESSION_ONCE_EVENTS.has("onboarding_started"), false);
    assert.equal(SESSION_ONCE_EVENTS.has("onboarding_step_viewed"), false);
  });
});
