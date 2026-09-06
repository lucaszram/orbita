import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeAstrologyApiTropicalPositions,
  runAstrologyApiPlanetsTropical,
} from "../convex/lib/astrologyApi";

const canonicalPlanetOrder = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
];

const documentedTropicalFixture = [
  {
    name: "Pluto",
    fullDegree: 303.1121,
    normDegree: 3.1121,
    speed: -0.0182,
    isRetro: "true",
    sign: "Aquarius",
  },
  {
    name: "Moon",
    fullDegree: 356.1704,
    normDegree: 26.1704,
    speed: 13.1764,
    isRetro: "false",
    sign: "Pisces",
  },
  {
    name: "Venus",
    fullDegree: 112.8347,
    normDegree: 22.8347,
    speed: 1.2213,
    isRetro: false,
    sign: "Cancer",
  },
  {
    name: "Saturn",
    fullDegree: 1.9482,
    normDegree: 1.9482,
    speed: -0.0731,
    isRetro: true,
    sign: "Aries",
  },
  {
    name: "Sun",
    fullDegree: 142.4062,
    normDegree: 22.4062,
    speed: 0.9581,
    isRetro: false,
    sign: "Leo",
  },
  {
    name: "Neptune",
    fullDegree: 1.9035,
    normDegree: 1.9035,
    speed: -0.0248,
    isRetro: true,
    sign: "Aries",
  },
  {
    name: "Mercury",
    fullDegree: 158.2207,
    normDegree: 8.2207,
    speed: 1.4312,
    isRetro: false,
    sign: "Virgo",
  },
  {
    name: "Jupiter",
    fullDegree: 117.2019,
    normDegree: 27.2019,
    speed: 0.2138,
    isRetro: false,
    sign: "Cancer",
  },
  {
    name: "Mars",
    fullDegree: 205.9701,
    normDegree: 25.9701,
    speed: 0.6421,
    isRetro: false,
    sign: "Libra",
  },
  {
    name: "Uranus",
    fullDegree: 61.1298,
    normDegree: 1.1298,
    speed: 0.0147,
    isRetro: false,
    sign: "Gemini",
  },
];

test("planets/tropical normalizes direct, root.planets and data.planets response shapes", () => {
  const direct = normalizeAstrologyApiTropicalPositions(documentedTropicalFixture);
  const root = normalizeAstrologyApiTropicalPositions({ planets: documentedTropicalFixture });
  const nested = normalizeAstrologyApiTropicalPositions({
    data: { planets: documentedTropicalFixture },
  });

  assert.equal(direct.length, 10);
  assert.deepEqual(root, direct);
  assert.deepEqual(nested, direct);
  assert.deepEqual(
    direct.map((position) => position.key),
    canonicalPlanetOrder,
  );
});

test("planets/tropical preserves documented longitude, speed, sign and retrograde fields", () => {
  const positions = normalizeAstrologyApiTropicalPositions(documentedTropicalFixture);
  const sun = positions.find((position) => position.key === "sun");
  const moon = positions.find((position) => position.key === "moon");
  const pluto = positions.find((position) => position.key === "pluto");

  assert.deepEqual(sun && { ...sun, degree: undefined }, {
    key: "sun",
    label: "Sol",
    sign: "Leo",
    signEs: "Leo",
    degree: undefined,
    fullDegree: 142.4062,
    speed: 0.9581,
    isRetrograde: false,
  });
  assert.ok(Math.abs((sun?.degree ?? 0) - 22.4062) < 1e-10);
  assert.equal(moon?.signEs, "Piscis");
  assert.equal(moon?.speed, 13.1764);
  assert.equal(pluto?.signEs, "Acuario");
  assert.equal(pluto?.isRetrograde, true);
  assert.equal(pluto?.speed, -0.0182);
});

test("planets/tropical rejects entries without a recognized body, longitude or speed", () => {
  const [pluto, moon, venus, saturn] = documentedTropicalFixture;
  const normalized = normalizeAstrologyApiTropicalPositions([
    { ...pluto, name: undefined },
    { ...moon, fullDegree: undefined },
    { ...venus, speed: undefined },
    { ...saturn, name: "North Node" },
    null,
    "not-a-position",
    documentedTropicalFixture[4],
  ]);

  assert.equal(normalized.length, 1);
  assert.deepEqual(normalized[0] && { ...normalized[0], degree: undefined }, {
    key: "sun",
    label: "Sol",
    sign: "Leo",
    signEs: "Leo",
    degree: undefined,
    fullDegree: 142.4062,
    speed: 0.9581,
    isRetrograde: false,
  });
  assert.ok(Math.abs((normalized[0]?.degree ?? 0) - 22.4062) < 1e-10);
});

test("planets/tropical rejects blank numeric fields instead of coercing them to zero", () => {
  const normalized = normalizeAstrologyApiTropicalPositions([
    {
      name: "Sun",
      fullDegree: "",
      normDegree: 0,
      speed: 0.9581,
      isRetro: false,
      sign: "Aries",
    },
    {
      name: "Moon",
      fullDegree: 1.2,
      normDegree: 1.2,
      speed: "   ",
      isRetro: false,
      sign: "Aries",
    },
  ]);

  assert.deepEqual(normalized, []);
});

test("planets/tropical derives retrograde state from negative speed when the flag is absent", () => {
  const normalized = normalizeAstrologyApiTropicalPositions([
    {
      name: "Pluto",
      fullDegree: 303.1121,
      normDegree: 3.1121,
      speed: -0.0182,
      sign: "Aquarius",
    },
    {
      name: "Sun",
      fullDegree: 142.4062,
      normDegree: 22.4062,
      speed: 0.9581,
      sign: "Leo",
    },
  ]);

  assert.equal(normalized.find((position) => position.key === "pluto")?.isRetrograde, true);
  assert.equal(normalized.find((position) => position.key === "sun")?.isRetrograde, false);
});

test("planets/tropical runner uses the captured instant in the requested timezone", async () => {
  const previousFetch = globalThis.fetch;
  const previousUserId = process.env.ASTROLOGY_API_USER_ID;
  const previousApiKey = process.env.ASTROLOGY_API_KEY;
  const previousHouseSystem = process.env.ASTROLOGY_API_HOUSE_SYSTEM;
  let requestUrl = "";
  let requestBody: Record<string, unknown> | null = null;

  process.env.ASTROLOGY_API_USER_ID = "fixture-user";
  process.env.ASTROLOGY_API_KEY = "fixture-key";
  delete process.env.ASTROLOGY_API_HOUSE_SYSTEM;
  globalThis.fetch = (async (input, init) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({ data: { planets: documentedTropicalFixture } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const instant = new Date("2026-08-15T18:30:00.000Z");
    const result = await runAstrologyApiPlanetsTropical({
      instant,
      localDate: "2026-08-15",
      timezone: "America/Argentina/Buenos_Aires",
      latitude: -34.6037,
      longitude: -58.3816,
    });

    assert.equal(result.status, "success");
    assert.equal(result.observedAt, instant.getTime());
    assert.equal(result.normalized?.positions.length, 10);
    assert.match(requestUrl, /\/planets\/tropical$/);
    assert.deepEqual(requestBody, {
      day: 15,
      month: 8,
      year: 2026,
      hour: 15,
      min: 30,
      lat: -34.6037,
      lon: -58.3816,
      tzone: -3,
      house_type: "placidus",
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUserId === undefined) delete process.env.ASTROLOGY_API_USER_ID;
    else process.env.ASTROLOGY_API_USER_ID = previousUserId;
    if (previousApiKey === undefined) delete process.env.ASTROLOGY_API_KEY;
    else process.env.ASTROLOGY_API_KEY = previousApiKey;
    if (previousHouseSystem === undefined) delete process.env.ASTROLOGY_API_HOUSE_SYSTEM;
    else process.env.ASTROLOGY_API_HOUSE_SYSTEM = previousHouseSystem;
  }
});

test("planets/tropical runner refuses a fixture that is missing a canonical planet", async () => {
  const previousFetch = globalThis.fetch;
  const previousUserId = process.env.ASTROLOGY_API_USER_ID;
  const previousApiKey = process.env.ASTROLOGY_API_KEY;

  process.env.ASTROLOGY_API_USER_ID = "fixture-user";
  process.env.ASTROLOGY_API_KEY = "fixture-key";
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify(documentedTropicalFixture.filter((planet) => planet.name !== "Pluto")),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;

  try {
    const result = await runAstrologyApiPlanetsTropical({
      instant: new Date("2026-08-15T18:30:00.000Z"),
      localDate: "2026-08-15",
      timezone: "America/Argentina/Buenos_Aires",
    });

    assert.equal(result.status, "error");
    assert.equal(result.normalized, undefined);
    assert.ok(result.warnings.includes("planets_tropical_contract_missing:pluto"));
    assert.match(result.error ?? "", /did not satisfy the verified V4\.9\.2 fixture contract/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUserId === undefined) delete process.env.ASTROLOGY_API_USER_ID;
    else process.env.ASTROLOGY_API_USER_ID = previousUserId;
    if (previousApiKey === undefined) delete process.env.ASTROLOGY_API_KEY;
    else process.env.ASTROLOGY_API_KEY = previousApiKey;
  }
});

test("planets/tropical runner refuses duplicate canonical planets and a non-canonical count", async () => {
  const previousFetch = globalThis.fetch;
  const previousUserId = process.env.ASTROLOGY_API_USER_ID;
  const previousApiKey = process.env.ASTROLOGY_API_KEY;

  process.env.ASTROLOGY_API_USER_ID = "fixture-user";
  process.env.ASTROLOGY_API_KEY = "fixture-key";
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify([...documentedTropicalFixture, documentedTropicalFixture[0]]),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;

  try {
    const result = await runAstrologyApiPlanetsTropical({
      instant: new Date("2026-08-15T18:30:00.000Z"),
      localDate: "2026-08-15",
      timezone: "America/Argentina/Buenos_Aires",
    });

    assert.equal(result.status, "error");
    assert.equal(result.normalized, undefined);
    assert.ok(result.warnings.includes("planets_tropical_contract_duplicate:pluto"));
    assert.ok(result.warnings.includes("planets_tropical_contract_count:11"));
    assert.match(result.error ?? "", /did not satisfy the verified V4\.9\.2 fixture contract/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUserId === undefined) delete process.env.ASTROLOGY_API_USER_ID;
    else process.env.ASTROLOGY_API_USER_ID = previousUserId;
    if (previousApiKey === undefined) delete process.env.ASTROLOGY_API_KEY;
    else process.env.ASTROLOGY_API_KEY = previousApiKey;
  }
});
