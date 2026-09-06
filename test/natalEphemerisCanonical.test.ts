import assert from "node:assert/strict";
import test from "node:test";

import { getNatalBase, refreshForDate } from "../convex/layers";
import { resolveZonedCivilTime } from "../convex/lib/civilTime";
import type {
  BirthDataSnapshot,
  EphemerisPosition,
  NormalizedChartSnapshot,
} from "../convex/lib/layerContract";
import { stableInputHash } from "../convex/lib/stableHash";
import { secondaryProgressedInstant } from "../convex/lib/layersMath";

const METHOD_VERSION = "natal-ephemeris-planets-tropical-cache-v1";
const PROVIDER_VERSION = "astrologyapi-planets-tropical-v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const SYNODIC_DAYS = 29.530588853;
const ANCHOR_BIRTH: BirthDataSnapshot = {
  birthDate: "1994-05-04",
  birthTime: "08:37",
  birthTimePrecision: "known",
  birthPlaceLabel: "Buenos Aires",
  latitude: -34.6037,
  longitude: -58.3816,
  timezone: "America/Argentina/Buenos_Aires",
  updatedAt: 11,
};

type ProviderRequest = {
  day: number;
  month: number;
  year: number;
  hour: number;
  min: number;
  tzone: number;
};

function exactInstant(birthData: BirthDataSnapshot, time = birthData.birthTime ?? "12:00") {
  const resolution = resolveZonedCivilTime({
    localDate: birthData.birthDate,
    localTime: time,
    timezone: birthData.timezone,
  });
  if (resolution.status !== "exact") throw new Error(`Unexpected civil-time status: ${resolution.status}`);
  return resolution.instantMs;
}

const anchorInstant = exactInstant(ANCHOR_BIRTH);

function normalize(value: number) {
  return ((value % 360) + 360) % 360;
}

function signAt(value: number) {
  const names = [
    "Aries",
    "Taurus",
    "Gemini",
    "Cancer",
    "Leo",
    "Virgo",
    "Libra",
    "Scorpio",
    "Sagittarius",
    "Capricorn",
    "Aquarius",
    "Pisces",
  ];
  return names[Math.floor(normalize(value) / 30)];
}

function canonicalPositions(instantMs: number): EphemerisPosition[] {
  const moonSpeed = 360 / SYNODIC_DAYS;
  const moon = normalize(135 + ((instantMs - anchorInstant) / DAY_MS) * moonSpeed);
  const values = [
    ["sun", "Sol", 20, 0],
    ["moon", "Luna", moon, moonSpeed],
    ["mercury", "Mercurio", 45, 1.1],
    ["venus", "Venus", 75, 0.9],
    ["mars", "Marte", 225, 0.5],
    ["jupiter", "Júpiter", 165, 0.08],
    ["saturn", "Saturno", 195, 0.04],
    ["uranus", "Urano", 115, 0.02],
    ["neptune", "Neptuno", 255, 0.01],
    ["pluto", "Plutón", 285, 0.008],
  ] as const;
  return values.map(([key, label, fullDegree, speed]) => ({
    key,
    label,
    sign: signAt(fullDegree),
    signEs: signAt(fullDegree),
    degree: normalize(fullDegree) % 30,
    fullDegree: normalize(fullDegree),
    speed,
    isRetrograde: false,
  }));
}

function positionsAtElongation(elongationDegrees: number): EphemerisPosition[] {
  const sunLongitude = 20;
  const moonLongitude = normalize(sunLongitude + elongationDegrees);
  return canonicalPositions(anchorInstant).map((position) => {
    if (position.key !== "sun" && position.key !== "moon") return position;
    const fullDegree = position.key === "sun" ? sunLongitude : moonLongitude;
    return {
      ...position,
      sign: signAt(fullDegree),
      signEs: signAt(fullDegree),
      degree: normalize(fullDegree) % 30,
      fullDegree: normalize(fullDegree),
      speed: position.key === "sun" ? 1 : 13,
      isRetrograde: false,
    };
  });
}

function progressionPositions(
  referenceInstantMs: number,
  centerElongationDegrees: number,
) {
  return (instantMs: number): EphemerisPosition[] => {
    const elapsedDays = (instantMs - referenceInstantMs) / DAY_MS;
    const sunLongitude = normalize(elapsedDays);
    const moonLongitude = normalize(centerElongationDegrees + elapsedDays * 13);
    const values = [
      ["sun", "Sol", sunLongitude, 1],
      ["moon", "Luna", moonLongitude, 13],
      ["mercury", "Mercurio", 45, 1.1],
      ["venus", "Venus", 75, 0.9],
      ["mars", "Marte", 225, 0.5],
      ["jupiter", "Júpiter", 165, 0.08],
      ["saturn", "Saturno", 195, 0.04],
      ["uranus", "Urano", 115, 0.02],
      ["neptune", "Neptuno", 255, 0.01],
      ["pluto", "Plutón", 285, 0.008],
    ] as const;
    return values.map(([key, label, fullDegree, speed]) => ({
      key,
      label,
      sign: signAt(fullDegree),
      signEs: signAt(fullDegree),
      degree: normalize(fullDegree) % 30,
      fullDegree: normalize(fullDegree),
      speed,
      isRetrograde: false,
    }));
  };
}

function progressionReference(
  birthData: BirthDataSnapshot,
  observedAt = Date.now(),
) {
  return secondaryProgressedInstant(
    exactInstant(birthData, "12:00"),
    observedAt,
  ).progressedInstantMs;
}

function legacyChart(): NormalizedChartSnapshot {
  const labels = [
    ["sun", "Sol"],
    ["moon", "Luna"],
    ["mercury", "Mercurio"],
    ["venus", "Venus"],
    ["mars", "Marte"],
    ["jupiter", "Júpiter"],
    ["saturn", "Saturno"],
    ["uranus", "Urano"],
    ["neptune", "Neptuno"],
    ["pluto", "Plutón"],
  ] as const;
  return {
    placements: [
      ...labels.map(([key, label], index) => ({
        key,
        label,
        sign: "Pisces",
        signEs: "Piscis",
        degree: index,
        fullDegree: 330 + index,
        house: 12,
        isRetrograde: false,
      })),
      {
        key: "ascendant",
        label: "Ascendente",
        sign: "Aquarius",
        signEs: "Acuario",
        degree: 5,
        fullDegree: 305,
        house: 1,
        isRetrograde: false,
      },
    ],
    houses: [],
  };
}

function natalInputHash(birthData: BirthDataSnapshot) {
  return stableInputHash({
    methodVersion: METHOD_VERSION,
    providerVersion: PROVIDER_VERSION,
    birth: {
      birthDate: birthData.birthDate,
      birthTime: birthData.birthTime,
      birthTimePrecision: birthData.birthTimePrecision,
      latitude: birthData.latitude,
      longitude: birthData.longitude,
      timezone: birthData.timezone,
      updatedAt: birthData.updatedAt,
    },
  });
}

function natalCache(birthData: BirthDataSnapshot) {
  const times =
    birthData.birthTimePrecision === "known"
      ? [birthData.birthTime!]
      : ["00:00", "12:00", "23:59"];
  return {
    inputHash: natalInputHash(birthData),
    methodVersion: METHOD_VERSION,
    providerVersion: PROVIDER_VERSION,
    birthTimePrecision: birthData.birthTimePrecision,
    samples: times.map((time) => {
      const instantMs = exactInstant(birthData, time);
      return { instantMs, positions: canonicalPositions(instantMs) };
    }),
    calculatedAt: Date.now() - 1_000,
  };
}

function requestInstant(body: ProviderRequest) {
  return (
    Date.UTC(body.year, body.month - 1, body.day, body.hour, body.min) -
    body.tzone * 60 * 60 * 1000
  );
}

function providerPayload(
  instantMs: number,
  positionsAt: (instantMs: number) => EphemerisPosition[] = canonicalPositions,
) {
  return positionsAt(instantMs).map((position) => ({
    name: position.key,
    sign: position.sign,
    normDegree: position.degree,
    fullDegree: position.fullDegree,
    speed: position.speed,
    isRetro: position.isRetrograde,
  }));
}

async function withProvider<T>(
  run: (requests: ProviderRequest[]) => Promise<T>,
  positionsAt: (instantMs: number) => EphemerisPosition[] = canonicalPositions,
) {
  const requests: ProviderRequest[] = [];
  const keys = ["ASTROLOGY_API_BASE_URL", "ASTROLOGY_API_USER_ID", "ASTROLOGY_API_KEY"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const parsed = JSON.parse(String(init?.body ?? "{}")) as ProviderRequest;
    requests.push(parsed);
    return new Response(JSON.stringify(providerPayload(requestInstant(parsed), positionsAt)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  process.env.ASTROLOGY_API_BASE_URL = "https://fixture.invalid";
  process.env.ASTROLOGY_API_USER_ID = "fixture-user";
  process.env.ASTROLOGY_API_KEY = "fixture-key";
  try {
    return await run(requests);
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = previousFetch;
  }
}

function localDateIn(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function actionContext(state: Record<string, unknown>) {
  const writes: Array<Record<string, unknown>> = [];
  return {
    writes,
    ctx: {
      auth: { getUserIdentity: async () => ({ tokenIdentifier: "fixture-token" }) },
      runQuery: async () => state,
      runMutation: async (_reference: unknown, value: Record<string, unknown>) => {
        writes.push(value);
        return { written: 10 };
      },
    },
  };
}

function stateFor(args: {
  birthData: BirthDataSnapshot;
  natalEphemeris: ReturnType<typeof natalCache> | null;
}) {
  const now = Date.now();
  return {
    userId: "user-fixture",
    birthDataId: "birth-fixture",
    natalChartId: "chart-fixture",
    birthData: args.birthData,
    chart: legacyChart(),
    natalEphemeris: args.natalEphemeris,
    snapshots: [],
    sky: {
      providerVersion: "fixture-current-sky-v1",
      observedAt: now,
      validUntil: now + 30 * 60 * 1000,
      positions: canonicalPositions(now),
    },
  };
}

function natalQueryContext(args: {
  birthData: BirthDataSnapshot;
  natalEphemeris: ReturnType<typeof natalCache> | null;
}) {
  const birthDocument = { _id: "birth-fixture", userId: "user-fixture", ...args.birthData };
  const chartDocument = {
    _id: "chart-fixture",
    userId: "user-fixture",
    payload: { normalized: { ...legacyChart(), summary: {} } },
  };
  return {
    auth: { getUserIdentity: async () => ({ tokenIdentifier: "fixture-token" }) },
    db: {
      query(table: string) {
        const chain = {
          withIndex(_name: string, callback: (value: { eq: () => unknown }) => unknown) {
            callback({ eq: () => chain });
            return chain;
          },
          order() {
            return chain;
          },
          async first() {
            if (table === "users") return { _id: "user-fixture", tokenIdentifier: "fixture-token" };
            if (table === "birthData") return birthDocument;
            if (table === "natalCharts") return chartDocument;
            if (table === "natalEphemerisCachesV492" && args.natalEphemeris) {
              return {
                _id: "natal-cache-fixture",
                userId: "user-fixture",
                cacheKey: "fixture-key",
                ...args.natalEphemeris,
              };
            }
            return null;
          },
          async collect() {
            return [];
          },
        };
        return chain;
      },
    },
  };
}

function isBirthRequest(request: ProviderRequest, birthData: BirthDataSnapshot) {
  const [year, month, day] = birthData.birthDate.split("-").map(Number);
  return request.year === year && request.month === month && request.day === day;
}

test("planets/tropical reemplaza los planetas legacy en las cinco capas natales/personales", async () => {
  await withProvider(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const { ctx } = actionContext(
      stateFor({ birthData: ANCHOR_BIRTH, natalEphemeris: natalCache(ANCHOR_BIRTH) }),
    );
    const bundle = await (refreshForDate as any)._handler(ctx, { localDate, timezone });

    assert.equal(bundle.natal.lunarType.data?.elongationDegrees, 115);
    assert.deepEqual(bundle.natal.elementMap.data?.counts, {
      fire: 3,
      earth: 3,
      air: 2,
      water: 2,
    });
    const facets = Object.fromEntries(
      (bundle.natal.relationshipPattern.data?.facets ?? []).map((facet: any) => [facet.key, facet.signs]),
    );
    assert.deepEqual(facets.emotional_need, ["Leo"]);
    assert.deepEqual(facets.affection_style, ["Géminis"]);
    assert.deepEqual(facets.desire_style, ["Escorpio"]);
    assert.ok(
      bundle.today.transitRanking.data?.items.some(
        (item: any) => item.transitPlanet === "Sol" && item.natalPoint === "Sol" && item.aspect === "conjunction",
      ),
    );
    assert.equal(bundle.today.cumpleluna.data?.natalElongationDegrees, 115);
    assert.equal(bundle.natal.elementMap.providerVersion, PROVIDER_VERSION);
  });
});

test("getNatalBase sólo publica la base natal cuando encuentra el cache canónico vigente", async () => {
  const ready = await (getNatalBase as any)._handler(
    natalQueryContext({ birthData: ANCHOR_BIRTH, natalEphemeris: natalCache(ANCHOR_BIRTH) }),
    {},
  );
  assert.equal(ready.lunarType.data?.elongationDegrees, 115);
  assert.deepEqual(ready.elementMap.data?.counts, { fire: 3, earth: 3, air: 2, water: 2 });

  const unavailable = await (getNatalBase as any)._handler(
    natalQueryContext({ birthData: ANCHOR_BIRTH, natalEphemeris: null }),
    {},
  );
  assert.equal(unavailable.lunarType.status, "unavailable");
  assert.equal(unavailable.lunarType.data, null);
  assert.ok(unavailable.lunarType.missingInputs.includes("canonical_natal_ephemeris"));
});

test("tres muestras iguales cerca de un límite no se confunden con estabilidad entre muestras", async () => {
  const birthData: BirthDataSnapshot = {
    ...ANCHOR_BIRTH,
    birthTime: null,
    birthTimePrecision: "unknown",
    updatedAt: 14,
  };
  const cache = natalCache(birthData);
  cache.samples = cache.samples.map((sample) => ({
    ...sample,
    positions: sample.positions.map((placement) =>
      placement.key === "moon"
        ? {
            ...placement,
            sign: "Cancer",
            signEs: "Cáncer",
            degree: 29,
            fullDegree: 119,
          }
        : placement,
    ),
  }));
  const bundle = await (getNatalBase as any)._handler(
    natalQueryContext({ birthData, natalEphemeris: cache }),
    {},
  );

  assert.equal(bundle.elementMap.data, null);
  assert.ok(bundle.elementMap.missingInputs.includes("stable_natal_moon"));
  const emotionalNeed = bundle.relationshipPattern.data?.facets.find(
    (facet: any) => facet.key === "emotional_need",
  );
  assert.deepEqual(emotionalNeed?.signs, ["Cáncer", "Leo"]);
  assert.equal(emotionalNeed?.precision, "range");
});

test("hora conocida consulta una única muestra natal en el instante exacto y la persiste tipada", async () => {
  await withProvider(async (requests) => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const { ctx, writes } = actionContext(
      stateFor({ birthData: ANCHOR_BIRTH, natalEphemeris: null }),
    );
    await (refreshForDate as any)._handler(ctx, { localDate, timezone });

    const natalRequests = requests.filter((request) => isBirthRequest(request, ANCHOR_BIRTH));
    assert.equal(natalRequests.length, 1);
    assert.equal(natalRequests[0].hour, 8);
    assert.equal(natalRequests[0].min, 37);
    const persisted = writes[0].natalEphemeris as ReturnType<typeof natalCache>;
    assert.equal(persisted.samples.length, 1);
    assert.equal(persisted.samples[0].instantMs, exactInstant(ANCHOR_BIRTH));
    assert.equal(persisted.samples[0].positions.length, 10);
  });
});

test("sin hora consulta y conserva el intervalo civil 00:00 / 12:00 / 23:59", async () => {
  await withProvider(async (requests) => {
    const birthData: BirthDataSnapshot = {
      ...ANCHOR_BIRTH,
      birthTime: null,
      birthTimePrecision: "unknown",
      updatedAt: 12,
    };
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const { ctx, writes } = actionContext(stateFor({ birthData, natalEphemeris: null }));
    const bundle = await (refreshForDate as any)._handler(ctx, { localDate, timezone });

    const natalRequests = requests.filter((request) => isBirthRequest(request, birthData));
    assert.deepEqual(
      natalRequests.map((request) => `${String(request.hour).padStart(2, "0")}:${String(request.min).padStart(2, "0")}`),
      ["00:00", "12:00", "23:59"],
    );
    const persisted = writes[0].natalEphemeris as ReturnType<typeof natalCache>;
    assert.equal(persisted.samples.length, 3);
    assert.equal(bundle.natal.lunarType.status, "partial");
    assert.equal(bundle.natal.lunarType.precision, "estimated");
  });
});

test("Cumpleluna sin hora evalúa todo el día natal y publica ventanas, no un mediodía fingido", async () => {
  const birthData: BirthDataSnapshot = {
    ...ANCHOR_BIRTH,
    birthTime: null,
    birthTimePrecision: "unknown",
    updatedAt: 31,
  };
  const cache = natalCache(birthData);
  cache.samples = cache.samples.map((sample, index) => ({
    ...sample,
    positions: positionsAtElongation([60, 66, 72][index]),
  }));
  const reference = Date.now();
  const movingSky = (instantMs: number) =>
    positionsAtElongation(180 + ((instantMs - reference) / DAY_MS) * 12);
  await withProvider(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const state = stateFor({ birthData, natalEphemeris: cache });
    state.sky = {
      providerVersion: "fixture-current-sky-v1",
      observedAt: reference,
      validUntil: reference + 30 * 60 * 1000,
      positions: movingSky(reference),
    };
    const { ctx } = actionContext(state);
    const result = (await (refreshForDate as any)._handler(ctx, { localDate, timezone }))
      .today.cumpleluna;

    assert.equal(result.status, "partial");
    assert.equal(result.precision, "range");
    assert.ok(result.data);
    assert.deepEqual(result.data?.natalElongationRangeDegrees, {
      from: 60,
      to: 72.0127,
    });
    assert.ok(result.data?.previousExactAtRange);
    assert.ok(result.data?.nextExactAtRange);
    assert.ok(
      result.data!.previousExactAtRange!.latest <= result.observedAt,
      "toda la ventana previa debe quedar antes del snapshot",
    );
    assert.ok(
      result.data!.nextExactAtRange!.earliest >= result.observedAt,
      "toda la ventana siguiente debe quedar después del snapshot",
    );
    assert.equal(
      result.validUntil,
      state.sky?.validUntil,
      "los escalares vencen con el cielo antes que con la raíz del próximo ciclo",
    );
    assert.ok(result.missingInputs.includes("exact_birth_time"));
    assert.match(result.data?.summary ?? "", /intervalo completo.*ventana/i);
    assert.doesNotMatch(result.limitations.join(" "), /elegimos el mediodía/i);
  }, movingSky);
});

test("Cumpleluna retira la fecha central si el día natal cruza el inicio del ciclo", async () => {
  const birthData: BirthDataSnapshot = {
    ...ANCHOR_BIRTH,
    birthTime: null,
    birthTimePrecision: "unknown",
    updatedAt: 32,
  };
  const cache = natalCache(birthData);
  cache.samples = cache.samples.map((sample, index) => ({
    ...sample,
    positions: positionsAtElongation([354, 0, 6][index]),
  }));
  await withProvider(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const state = stateFor({ birthData, natalEphemeris: cache });
    state.sky = {
      providerVersion: "fixture-current-sky-v1",
      observedAt: Date.now(),
      validUntil: Date.now() + 30 * 60 * 1000,
      positions: positionsAtElongation(180),
    };
    const { ctx } = actionContext(state);
    const result = (await (refreshForDate as any)._handler(ctx, { localDate, timezone }))
      .today.cumpleluna;

    assert.equal(result.status, "partial");
    assert.equal(result.precision, "range");
    assert.equal(result.data, null);
    assert.ok(result.missingInputs.includes("exact_birth_time_or_stable_cumpleluna_cycle"));
    assert.match(result.limitations.join(" "), /cruza el comienzo de un ciclo/i);
  }, (instantMs) => positionsAtElongation(180 + ((instantMs - Date.now()) / DAY_MS) * 12));
});

test("el intervalo sin hora conserva la duración real de un día con cambio de reloj", async () => {
  await withProvider(async () => {
    const birthData: BirthDataSnapshot = {
      ...ANCHOR_BIRTH,
      birthDate: "2025-11-02",
      birthTime: null,
      birthTimePrecision: "unknown",
      timezone: "America/New_York",
      updatedAt: 13,
    };
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const { ctx, writes } = actionContext(stateFor({ birthData, natalEphemeris: null }));
    await (refreshForDate as any)._handler(ctx, { localDate, timezone });
    const persisted = writes[0].natalEphemeris as ReturnType<typeof natalCache>;
    assert.equal(persisted.samples.length, 3);
    assert.equal(
      persisted.samples[1].instantMs - persisted.samples[0].instantMs,
      13 * 60 * 60 * 1000,
    );
    assert.equal(
      persisted.samples[2].instantMs - persisted.samples[1].instantMs,
      11 * 60 * 60 * 1000 + 59 * 60 * 1000,
    );
  });
});

test("una hora exacta ambigua o inexistente por DST se rechaza sin elegir una ocurrencia", async () => {
  await withProvider(async (requests) => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    for (const [birthDate, birthTime] of [
      ["2025-03-09", "02:30"],
      ["2025-11-02", "01:30"],
    ] as const) {
      const birthData: BirthDataSnapshot = {
        ...ANCHOR_BIRTH,
        birthDate,
        birthTime,
        timezone: "America/New_York",
        updatedAt: birthDate === "2025-03-09" ? 15 : 16,
      };
      const { ctx, writes } = actionContext(stateFor({ birthData, natalEphemeris: null }));
      const bundle = await (refreshForDate as any)._handler(ctx, { localDate, timezone });
      assert.equal(bundle.natal.lunarType.status, "error");
      assert.equal(bundle.natal.lunarType.data, null);
      assert.equal(writes[0].natalEphemeris, null);
    }
    assert.equal(requests.length, 0);
  });
});

test("un fallo sin cache no publica posiciones legacy como si fueran canónicas", async () => {
  const keys = ["ASTROLOGY_API_USER_ID", "ASTROLOGY_API_KEY"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  try {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const { ctx } = actionContext(stateFor({ birthData: ANCHOR_BIRTH, natalEphemeris: null }));
    const bundle = await (refreshForDate as any)._handler(ctx, { localDate, timezone });
    assert.equal(bundle.natal.lunarType.status, "error");
    assert.equal(bundle.natal.lunarType.data, null);
    assert.ok(bundle.natal.lunarType.missingInputs.includes("canonical_natal_ephemeris"));
    assert.equal(bundle.natal.elementMap.data, null);
    assert.equal(bundle.natal.relationshipPattern.data, null);
    assert.equal(bundle.today.transitRanking.data, null);
    assert.equal(bundle.today.cumpleluna.data, null);
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("un cache natal vigente evita recalcular y un cambio de birthData lo invalida", async () => {
  await withProvider(async (requests) => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const cached = natalCache(ANCHOR_BIRTH);
    const hit = actionContext(stateFor({ birthData: ANCHOR_BIRTH, natalEphemeris: cached }));
    await (refreshForDate as any)._handler(hit.ctx, { localDate, timezone });
    assert.equal(
      requests.filter(
        (request) =>
          isBirthRequest(request, ANCHOR_BIRTH) && request.hour === 8 && request.min === 37,
      ).length,
      0,
    );
    assert.equal(hit.writes[0].natalEphemeris, null);

    requests.length = 0;
    const changedBirthData = { ...ANCHOR_BIRTH, updatedAt: ANCHOR_BIRTH.updatedAt + 1 };
    const miss = actionContext(
      stateFor({ birthData: changedBirthData, natalEphemeris: cached }),
    );
    await (refreshForDate as any)._handler(miss.ctx, { localDate, timezone });
    assert.equal(
      requests.filter(
        (request) =>
          isBirthRequest(request, changedBirthData) && request.hour === 8 && request.min === 37,
      ).length,
      1,
    );
    const persisted = miss.writes[0].natalEphemeris as ReturnType<typeof natalCache>;
    assert.notEqual(persisted.inputHash, cached.inputHash);
  });
});

test("Estación vital certifica una fase estable sobre todo el día civil y publica rangos", async () => {
  const birthData: BirthDataSnapshot = {
    ...ANCHOR_BIRTH,
    birthTime: null,
    birthTimePrecision: "unknown",
    updatedAt: 21,
  };
  const reference = progressionReference(birthData);
  await withProvider(async (requests) => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const { ctx } = actionContext(
      stateFor({ birthData, natalEphemeris: natalCache(birthData) }),
    );
    const bundle = await (refreshForDate as any)._handler(ctx, { localDate, timezone });
    const result = bundle.moment.progressedLunation;

    assert.equal(result.status, "partial");
    assert.equal(result.precision, "estimated");
    assert.equal(result.data?.phaseKey, "first_quarter");
    assert.ok(result.missingInputs.includes("exact_birth_time"));
    assert.match(result.limitations.join(" "), /día civil.*rangos/i);
    assert.ok(result.data?.phaseStartedAtRange);
    assert.ok(result.data?.nextPhaseAtRange);
    assert.ok(
      (result.data!.phaseStartedAtRange!.latest -
        result.data!.phaseStartedAtRange!.earliest) /
        DAY_MS >
        360,
    );
    assert.ok(
      result.validUntil <= result.data!.nextPhaseAtRange!.earliest,
    );
    assert.ok(requests.length >= 7, "debe consultar muestras y las dos fronteras canónicas");
  }, progressionPositions(reference, 112.5));
});

test("Estación vital trata una hora aproximada sin margen como día completo", async () => {
  const birthData: BirthDataSnapshot = {
    ...ANCHOR_BIRTH,
    birthTime: "08:37",
    birthTimePrecision: "approximate",
    updatedAt: 22,
  };
  const reference = progressionReference(birthData);
  await withProvider(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const { ctx } = actionContext(
      stateFor({ birthData, natalEphemeris: natalCache(birthData) }),
    );
    const result = (await (refreshForDate as any)._handler(ctx, { localDate, timezone }))
      .moment.progressedLunation;

    assert.equal(result.status, "partial");
    assert.equal(result.precision, "estimated");
    assert.match(result.limitations.join(" "), /aproximada.*desconocida/i);
    assert.ok(result.data?.phaseStartedAtRange);
  }, progressionPositions(reference, 112.5));
});

test("Estación vital retira el dato cuando el intervalo sin hora cruza una fase", async () => {
  const birthData: BirthDataSnapshot = {
    ...ANCHOR_BIRTH,
    birthTime: null,
    birthTimePrecision: "unknown",
    updatedAt: 23,
  };
  const reference = progressionReference(birthData);
  await withProvider(async (requests) => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const { ctx } = actionContext(
      stateFor({ birthData, natalEphemeris: natalCache(birthData) }),
    );
    const result = (await (refreshForDate as any)._handler(ctx, { localDate, timezone }))
      .moment.progressedLunation;

    assert.equal(result.status, "partial");
    assert.equal(result.precision, "range");
    assert.equal(result.data, null);
    assert.ok(result.missingInputs.includes("exact_birth_time_or_certified_progressed_phase"));
    assert.match(result.limitations.join(" "), /puede ser|cerca de un límite/i);
    const progressionRequests = requests.filter(
      (request) => Math.abs(requestInstant(request) - reference) < 30 * DAY_MS,
    );
    assert.equal(
      progressionRequests.length,
      3,
      "no debe buscar fechas exactas de una fase inestable",
    );
  }, progressionPositions(reference, 90));
});

test("Estación vital conserva las 25 horas reales de un día con DST", async () => {
  const birthData: BirthDataSnapshot = {
    ...ANCHOR_BIRTH,
    birthDate: "2025-11-02",
    birthTime: null,
    birthTimePrecision: "unknown",
    timezone: "America/New_York",
    updatedAt: 24,
  };
  const reference = progressionReference(birthData);
  await withProvider(async () => {
    const timezone = "UTC";
    const localDate = localDateIn(timezone);
    const { ctx } = actionContext(
      stateFor({ birthData, natalEphemeris: natalCache(birthData) }),
    );
    const result = (await (refreshForDate as any)._handler(ctx, { localDate, timezone }))
      .moment.progressedLunation;
    const range = result.data?.nextPhaseAtRange;

    assert.equal(result.precision, "estimated");
    assert.ok(range);
    const uncertaintyDays = (range!.latest - range!.earliest) / DAY_MS;
    assert.ok(uncertaintyDays > 375 && uncertaintyDays < 385, `${uncertaintyDays}`);
  }, progressionPositions(reference, 112.5));
});
