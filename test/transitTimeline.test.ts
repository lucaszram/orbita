import assert from "node:assert/strict";
import test from "node:test";

import type { EphemerisPosition } from "../convex/lib/layerContract";
import { buildTransitArcs, type TransitContactInput } from "../convex/lib/transitLayers";
import {
  createTransitTimelineSingleFlight,
  resolveVerifiedTransitTimeline,
  type TransitTimelineEphemerisResult,
  type TransitTimelineResolution,
} from "../convex/lib/transitTimeline";

const DAY_MS = 86_400_000;
const CENTER = Date.parse("2026-08-02T12:00:00.000Z");

function saturnContact(observedAt = CENTER): TransitContactInput {
  const fixture = saturnFixtureAt(observedAt);
  assert.equal(fixture.status, "success");
  const saturn = fixture.positions[0];
  return {
    chartKey: "verified-chart-fixture",
    transitPlanet: "Saturno",
    transitLongitude: saturn.fullDegree,
    transitSpeed: saturn.speed,
    natalPoint: "Ascendente",
    natalLongitude: 0,
    natalHouse: 1,
    observedAt,
    previousOrb: 0.5,
    isRetrograde: true,
  };
}

function saturnFixtureAt(instantMs: number): TransitTimelineEphemerisResult {
  const day = (instantMs - CENTER) / DAY_MS;
  // Tres raíces exactas en -80 / 0 / +80 días. La tangente es positiva,
  // negativa y positiva respectivamente: directo, retrógrado, directo.
  const polynomial = day ** 3 - 6_400 * day;
  const normalized = Math.tanh(polynomial / 100_000);
  const error = 8 * normalized;
  const speed = (8 * (1 - normalized ** 2) * (3 * day ** 2 - 6_400)) / 100_000;
  const position: EphemerisPosition = {
    key: "saturn",
    label: "Saturno",
    sign: "Cancer",
    signEs: "Cáncer",
    degree: ((90 + error) % 30 + 30) % 30,
    fullDegree: ((90 + error) % 360 + 360) % 360,
    speed,
    isRetrograde: speed < 0,
  };
  return { status: "success", positions: [position] };
}

test("planets/tropical verifica y agrupa tres pasadas directa/retrógrada/directa", async () => {
  const result = await resolveVerifiedTransitTimeline({
    contact: saturnContact(),
    maxProviderCalls: 72,
    ephemerisAt: async (instantMs) => saturnFixtureAt(instantMs),
  });

  assert.equal(result.status, "verified");
  if (result.status !== "verified") return;
  assert.ok(result.providerCalls <= 72, `la búsqueda hizo ${result.providerCalls} llamadas`);
  assert.equal(result.contacts.length, 3);
  assert.deepEqual(
    result.contacts.map((contact) => contact.isRetrograde),
    [false, true, false],
  );
  const exactDays = result.contacts.map(
    (contact) => (Number(contact.exactAt) - CENTER) / DAY_MS,
  );
  assert.ok(Math.abs(exactDays[0] + 80) < 0.02);
  assert.ok(Math.abs(exactDays[1]) < 0.02);
  assert.ok(Math.abs(exactDays[2] - 80) < 0.02);
  assert.ok(result.windowStart < Number(result.contacts[0].exactAt));
  assert.ok(result.windowEnd > Number(result.contacts[2].exactAt));

  const arcs = buildTransitArcs(result.contacts, { referenceTime: CENTER });
  assert.equal(arcs.length, 1);
  assert.deepEqual(
    arcs[0].passes.map((pass) => pass.direction),
    ["direct", "retrograde", "direct"],
  );
  assert.equal(arcs[0].passes.length, 3);
  assert.ok(Math.abs(Date.parse(arcs[0].window.peakAt) - CENTER) < 0.02 * DAY_MS);

  const repeated = await resolveVerifiedTransitTimeline({
    contact: saturnContact(CENTER + DAY_MS),
    ephemerisAt: async (instantMs) => saturnFixtureAt(instantMs),
  });
  assert.equal(repeated.status, "verified");
  if (repeated.status !== "verified") return;
  assert.equal(
    buildTransitArcs(repeated.contacts, { referenceTime: CENTER })[0].arcId,
    arcs[0].arcId,
    "la misma carta y ventana conservan el arcId",
  );
});

test("un fallo en cualquier muestra no se convierte en una cronología personal", async () => {
  let calls = 0;
  const result = await resolveVerifiedTransitTimeline({
    contact: saturnContact(),
    ephemerisAt: async (instantMs) => {
      calls += 1;
      if (calls === 9) return { status: "error", reason: "fixture_provider_down" };
      return saturnFixtureAt(instantMs);
    },
  });

  assert.equal(result.status, "provider_error");
  assert.deepEqual(result.contacts, []);
  assert.match(result.reason, /fixture_provider_down/);
});

test("la raíz verificada cruza 359°/0° sin partir el arco", async () => {
  const result = await resolveVerifiedTransitTimeline({
    contact: {
      chartKey: "wrap-chart",
      transitPlanet: "Sol",
      transitLongitude: 359,
      transitSpeed: 1,
      natalPoint: "Sol",
      natalLongitude: 0,
      observedAt: CENTER,
      isRetrograde: false,
    },
    ephemerisAt: async (instantMs) => {
      const day = (instantMs - CENTER) / DAY_MS;
      const longitude = ((359 + day) % 360 + 360) % 360;
      return {
        status: "success" as const,
        positions: [
          {
            key: "sun",
            label: "Sol",
            sign: "Aries",
            signEs: "Aries",
            degree: longitude % 30,
            fullDegree: longitude,
            speed: 1,
            isRetrograde: false,
          },
        ],
      };
    },
  });

  assert.equal(result.status, "verified");
  if (result.status !== "verified") return;
  assert.equal(result.contacts.length, 1);
  assert.ok(Math.abs(Number(result.contacts[0].exactAt) - (CENTER + DAY_MS)) < 10 * 60 * 1000);
  assert.ok(result.windowStart < CENTER);
  assert.ok(result.windowEnd > CENTER + DAY_MS);
});

test("una ventana exterior lenta expande el radio sin romper el presupuesto", async () => {
  const speed = 0.005;
  const result = await resolveVerifiedTransitTimeline({
    contact: {
      chartKey: "slow-outer-chart",
      transitPlanet: "Neptuno",
      transitLongitude: 90,
      transitSpeed: speed,
      natalPoint: "Sol",
      natalLongitude: 0,
      observedAt: CENTER,
      isRetrograde: false,
    },
    ephemerisAt: async (instantMs) => {
      const day = (instantMs - CENTER) / DAY_MS;
      const longitude = ((90 + speed * day) % 360 + 360) % 360;
      return {
        status: "success" as const,
        positions: [
          {
            key: "neptune",
            label: "Neptuno",
            sign: "Cancer",
            signEs: "Cáncer",
            degree: longitude % 30,
            fullDegree: longitude,
            speed,
            isRetrograde: false,
          },
        ],
      };
    },
  });

  assert.equal(result.status, "verified");
  if (result.status !== "verified") return;
  assert.equal(result.contacts.length, 1);
  assert.ok(Math.abs((CENTER - result.windowStart) / DAY_MS - 600) < 0.1);
  assert.ok(Math.abs((result.windowEnd - CENTER) / DAY_MS - 600) < 0.1);
  assert.ok(result.providerCalls <= 96);
});

test("3° exactos entran; apenas por fuera no inicia consultas históricas", async () => {
  let exactCalls = 0;
  const exact = await resolveVerifiedTransitTimeline({
    contact: {
      chartKey: "orb-boundary-chart",
      transitPlanet: "Sol",
      transitLongitude: 3,
      transitSpeed: 1,
      natalPoint: "Sol",
      natalLongitude: 0,
      observedAt: CENTER,
    },
    ephemerisAt: async (instantMs) => {
      exactCalls += 1;
      const day = (instantMs - CENTER) / DAY_MS;
      const longitude = ((3 + day) % 360 + 360) % 360;
      return {
        status: "success" as const,
        positions: [
          {
            key: "sun",
            label: "Sol",
            sign: "Aries",
            signEs: "Aries",
            degree: longitude % 30,
            fullDegree: longitude,
            speed: 1,
            isRetrograde: false,
          },
        ],
      };
    },
  });
  assert.equal(exact.status, "verified");
  assert.ok(exactCalls > 0);

  let calls = 0;
  const result = await resolveVerifiedTransitTimeline({
    contact: {
      chartKey: "outside-orb-chart",
      transitPlanet: "Sol",
      transitLongitude: 3.0001,
      transitSpeed: 1,
      natalPoint: "Sol",
      natalLongitude: 0,
      observedAt: CENTER,
    },
    ephemerisAt: async () => {
      calls += 1;
      return { status: "error", reason: "must_not_run" };
    },
  });

  assert.equal(result.status, "not_active");
  assert.equal(calls, 0);
});

test("el presupuesto de consultas es un límite cerrado, no una timeline incompleta", async () => {
  const result = await resolveVerifiedTransitTimeline({
    contact: saturnContact(),
    maxProviderCalls: 5,
    ephemerisAt: async (instantMs) => saturnFixtureAt(instantMs),
  });

  assert.equal(result.status, "provider_budget_exhausted");
  assert.equal(result.providerCalls, 5);
  assert.deepEqual(result.contacts, []);
});

test("refrescos concurrentes idénticos comparten el barrido completo", async () => {
  let currentTime = 1_000;
  let calculations = 0;
  let finish!: (value: TransitTimelineResolution) => void;
  const pendingCalculation = new Promise<TransitTimelineResolution>((resolve) => {
    finish = resolve;
  });
  const singleFlight = createTransitTimelineSingleFlight({
    retentionMs: 60_000,
    now: () => currentTime,
  });
  const calculate = () => {
    calculations += 1;
    return pendingCalculation;
  };

  const first = singleFlight.run("same-chart:hour", calculate);
  await Promise.resolve();
  currentTime += 120_000;
  const second = singleFlight.run("same-chart:hour", calculate);
  assert.equal(first, second, "un barrido pendiente no vence aunque el proveedor tarde");
  assert.equal(calculations, 1);

  finish({
    status: "no_exact_contact",
    contacts: [],
    providerCalls: 12,
    reason: "fixture_complete",
  });
  assert.deepEqual(await Promise.all([first, second]), [await first, await first]);

  currentTime += 60_001;
  const third = singleFlight.run("same-chart:hour", async () => {
    calculations += 1;
    return {
      status: "no_exact_contact" as const,
      contacts: [] as [],
      providerCalls: 13,
      reason: "fixture_recalculated",
    };
  });
  assert.notEqual(third, first);
  assert.equal((await third).providerCalls, 13);
  assert.equal(calculations, 2);
});
