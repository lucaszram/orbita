import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { FunctionReturnType } from "convex/server";

import { api } from "../convex/_generated/api";
import { getNatalChartBase } from "../convex/layers";
import { resolveZonedCivilTime } from "../convex/lib/civilTime";
import type {
  BirthDataSnapshot,
  EphemerisPosition,
  NormalizedChartSnapshot,
} from "../convex/lib/layerContract";
import { resolveEntitlement } from "../convex/lib/entitlements";
import { natalChartBaseValidator } from "../convex/lib/natalChartBaseContract";
import { storedNatalChartIsSufficient } from "../convex/lib/natalGeometry";
import { stableInputHash } from "../convex/lib/stableHash";

const EPHEMERIS_METHOD = "natal-ephemeris-planets-tropical-cache-v1";
const EPHEMERIS_PROVIDER = "astrologyapi-planets-tropical-v1";
const PLANETS = [
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

type NatalChartBase = NonNullable<FunctionReturnType<typeof api.layers.getNatalChartBase>>;

const KNOWN_BIRTH: BirthDataSnapshot = {
  birthDate: "1994-05-04",
  birthTime: "08:37",
  birthTimePrecision: "known",
  birthPlaceLabel: "Buenos Aires",
  latitude: -34.6037,
  longitude: -58.3816,
  timezone: "America/Argentina/Buenos_Aires",
  updatedAt: 10,
};

function instantFor(birth: BirthDataSnapshot, time: string) {
  const resolved = resolveZonedCivilTime({
    localDate: birth.birthDate,
    localTime: time,
    timezone: birth.timezone,
  });
  assert.equal(resolved.status, "exact");
  return resolved.instantMs;
}

function natalInputHash(birth: BirthDataSnapshot) {
  return stableInputHash({
    methodVersion: EPHEMERIS_METHOD,
    providerVersion: EPHEMERIS_PROVIDER,
    birth: {
      birthDate: birth.birthDate,
      birthTime: birth.birthTime,
      birthTimePrecision: birth.birthTimePrecision,
      latitude: birth.latitude,
      longitude: birth.longitude,
      timezone: birth.timezone,
      updatedAt: birth.updatedAt,
    },
  });
}

function position(
  key: (typeof PLANETS)[number][0],
  label: string,
  fullDegree: number,
  speed = 0.1,
): EphemerisPosition {
  return {
    key,
    label,
    // El read-model debe derivar el signo de la longitud canónica, no confiar
    // en estos dos rótulos deliberadamente incorrectos.
    sign: "Pisces",
    signEs: "Piscis",
    degree: fullDegree % 30,
    fullDegree,
    speed,
    isRetrograde: speed < 0,
  };
}

function exactPositions(): EphemerisPosition[] {
  const degrees = [0, 90, 45, 75, 135, 165, 180, 225, 255, 315];
  return PLANETS.map(([key, label], index) => position(key, label, degrees[index], index === 1 ? 13 : 0.1));
}

function dayPositions(sampleIndex: number): EphemerisPosition[] {
  const degrees = [
    15 + sampleIndex * 0.3,
    [118.8, 119.5, 120.2][sampleIndex],
    45 + sampleIndex * 0.2,
    75 + sampleIndex * 0.1,
    135 + sampleIndex * 0.05,
    165 + sampleIndex * 0.02,
    195 + sampleIndex * 0.02,
    225 + sampleIndex * 0.01,
    255 + sampleIndex * 0.01,
    315 + sampleIndex * 0.01,
  ];
  return PLANETS.map(([key, label], index) =>
    position(key, label, degrees[index], key === "moon" ? 13 : key === "sun" ? 1 : 0.1),
  );
}

function natalCache(
  birth: BirthDataSnapshot,
  positionsAt: (sampleIndex: number) => EphemerisPosition[],
) {
  const times = birth.birthTimePrecision === "known"
    ? [birth.birthTime!]
    : ["00:00", "12:00", "23:59"];
  return {
    inputHash: natalInputHash(birth),
    methodVersion: EPHEMERIS_METHOD,
    providerVersion: EPHEMERIS_PROVIDER,
    birthTimePrecision: birth.birthTimePrecision,
    samples: times.map((time, sampleIndex) => ({
      instantMs: instantFor(birth, time),
      positions: positionsAt(sampleIndex),
    })),
    calculatedAt: 1_723_000_000_000,
  };
}

function legacyGeometry(): NormalizedChartSnapshot & { aspects: unknown[] } {
  return {
    placements: [
      ...PLANETS.map(([key, label], index) => ({
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
        sign: "Aries",
        signEs: "Aries",
        degree: 15,
        fullDegree: 15,
        house: 1,
        isRetrograde: null,
      },
      {
        key: "midheaven",
        label: "Medio Cielo",
        sign: "Capricorn",
        signEs: "Capricornio",
        degree: 10,
        fullDegree: 280,
        house: 10,
        isRetrograde: null,
      },
    ],
    houses: Array.from({ length: 12 }, (_, index) => ({
      house: index + 1,
      sign: "Aries",
      signEs: "Aries",
      degree: index * 30,
      theme: `Casa ${index + 1}`,
    })),
    // No debe atravesar el snapshot ni influir en los aspectos públicos.
    aspects: [{ from: "sun", to: "moon", type: "conjunction", orb: 0 }],
  };
}

function queryContext(args: {
  birth: BirthDataSnapshot | null;
  cache: ReturnType<typeof natalCache> | null;
  chart?: ReturnType<typeof legacyGeometry> | null;
  isPro?: boolean;
}) {
  const chart = args.chart === undefined ? legacyGeometry() : args.chart;
  return {
    auth: { getUserIdentity: async () => ({ tokenIdentifier: "fixture-token" }) },
    db: {
      query(table: string) {
        const chain = {
          withIndex(_name: string, callback: (query: { eq: (...values: unknown[]) => unknown }) => unknown) {
            callback({ eq: () => chain });
            return chain;
          },
          order() {
            return chain;
          },
          async first() {
            if (table === "users") return { _id: "user-fixture", tokenIdentifier: "fixture-token" };
            if (table === "birthData") {
              return args.birth ? { _id: "birth-fixture", userId: "user-fixture", ...args.birth } : null;
            }
            if (table === "natalCharts") {
              return chart
                ? {
                    _id: "chart-fixture",
                    userId: "user-fixture",
                    payload: { normalized: { ...chart, summary: {} } },
                  }
                : null;
            }
            if (table === "natalEphemerisCachesV492") {
              return args.cache
                ? {
                    _id: "cache-fixture",
                    userId: "user-fixture",
                    cacheKey: "fixture",
                    ...args.cache,
                  }
                : null;
            }
            return null;
          },
          async collect() {
            if (table === "subscriptions" && args.isPro) return [PRO_SUBSCRIPTION_ROW];
            return [];
          },
        };
        return chain;
      },
    },
  };
}

/**
 * Fila Pro de la fixture.
 *
 * `entitlement` NO es opcional: `convex/schema.ts` lo declara como
 * `v.union("free" | "plus" | "orbita_pro")` y toda fila real lo trae. La
 * fixture lo omitía y funcionaba de rebote, porque `isRowActive` sólo
 * descartaba `"free"`. Cuando el comercio nativo endureció ese predicado a
 * "sólo `orbita_pro` o el alias legacy `plus` conceden acceso", esta cuenta
 * dejó de ser Pro y cuatro pruebas de geometría fallaron lejos de la causa.
 * La fila ahora es representable en la base real.
 */
const PRO_SUBSCRIPTION_ROW = {
  entitlement: "orbita_pro" as const,
  status: "active" as const,
  provider: "stub" as const,
  isLifetime: true
};

async function read(args: Parameters<typeof queryContext>[0]) {
  return (await (getNatalChartBase as unknown as {
    _handler: (ctx: ReturnType<typeof queryContext>, args: Record<string, never>) => Promise<NatalChartBase>;
  })._handler(queryContext(args), {})) as NatalChartBase;
}

test("la fila Pro de la fixture es una fila que la base real podría tener", () => {
  // Guarda de la fixture, no del producto.
  //
  // `getNatalChartBase` decide casas y aspectos con `isUserPro`, que resuelve
  // el entitlement con las MISMAS funciones que producción. Si la fila sembrada
  // deja de conceder acceso, las cuatro pruebas de geometría de abajo fallan
  // con síntomas —"casa solar null", "0 casas", "sin oposición"— que no nombran
  // la causa. Esta prueba falla primero y la nombra.
  assert.equal(resolveEntitlement([PRO_SUBSCRIPTION_ROW], Date.now()).isPro, true);

  // Y el entitlement tiene que ser uno de los que el schema admite: una fila
  // sin `entitlement`, o con un valor inventado, no existe en la base real y
  // por eso tampoco puede sostener una prueba.
  const schema = readFileSync(`${process.cwd()}/convex/schema.ts`, "utf8");
  const declarado = /const entitlement = ([^;]+);/.exec(schema)?.[1] ?? "";
  assert.match(declarado, new RegExp(`v\\.literal\\("${PRO_SUBSCRIPTION_ROW.entitlement}"\\)`));
  assert.doesNotMatch(declarado, /v\.optional/, "la fila real siempre trae entitlement");
});

test("getNatalChartBase tiene contrato cerrado y binding generado", () => {
  const source = readFileSync(`${process.cwd()}/convex/layers.ts`, "utf8");
  const contract = readFileSync(`${process.cwd()}/convex/lib/natalChartBaseContract.ts`, "utf8");
  assert.match(source, /export const getNatalChartBase = query\(\{\s*args: \{\},\s*returns: v\.union\(natalChartBaseValidator, v\.null\(\)\)/s);
  assert.doesNotMatch(contract, /\bv\.any\s*\(/);
  assert.doesNotMatch(source.slice(source.indexOf("export const getNatalChartBase"), source.indexOf("export const getForDate")), /anyApi|\bv\.any\s*\(/);
  assert.ok(natalChartBaseValidator);
  const binding: typeof api.layers.getNatalChartBase = api.layers.getNatalChartBase;
  assert.ok(binding);
});

test("hora conocida publica Sol–Plutón y aspectos desde longitudes canónicas, con geometría legacy acotada", async () => {
  const model = await read({
    birth: KNOWN_BIRTH,
    cache: natalCache(KNOWN_BIRTH, exactPositions),
    isPro: true,
  });

  assert.equal(model.methodVersion, "canonical-natal-chart-base-v1");
  assert.equal(model.providerVersion, EPHEMERIS_PROVIDER);
  assert.equal(model.status, "ready");
  assert.equal(model.calculationTimeSource, "exact_birth_time");
  assert.equal(model.positions.length, 10);
  assert.ok(model.positions.every((item) => item.source === "planets/tropical"));
  assert.ok(model.positions.every((item) => item.precision === "exact"));
  assert.equal(model.positions.find((item) => item.key === "sun")?.fullDegree, 0);
  assert.equal(model.positions.find((item) => item.key === "sun")?.sign, "aries");
  assert.equal(model.positions.find((item) => item.key === "sun")?.house, 1);
  assert.equal(model.positions.some((item) => item.fullDegree === 330), false, "no filtrar planetas legacy");
  assert.deepEqual(model.angles.map((angle) => [angle.key, angle.fullDegree]), [
    ["ascendant", 15],
    ["mc", 280],
  ]);
  assert.equal(model.houses.length, 12);
  const sunMoon = model.aspects.find((aspect) => aspect.from === "sun" && aspect.to === "moon");
  assert.equal(sunMoon?.type, "square");
  assert.equal(sunMoon?.orb, 0);
  assert.equal(sunMoon?.precision, "exact");
  assert.equal(sunMoon?.source, "canonical_longitudes");
  assert.doesNotMatch(
    JSON.stringify(model),
    /1994-05-04|08:37|Buenos Aires|-34\.6037|-58\.3816/,
    "el read-model no expone los datos natales usados por el cálculo",
  );
});

test("sin hora no inventa grados: certifica signos estables, conserva rangos y retira geometría", async () => {
  const birth: BirthDataSnapshot = {
    ...KNOWN_BIRTH,
    birthTime: null,
    birthTimePrecision: "unknown",
    updatedAt: 20,
  };
  const model = await read({ birth, cache: natalCache(birth, dayPositions), isPro: true });

  assert.equal(model.status, "partial");
  assert.equal(model.calculationTimeSource, "full_civil_day");
  assert.equal(model.positions.find((item) => item.key === "sun")?.precision, "estimated");
  assert.equal(model.positions.find((item) => item.key === "sun")?.sign, "aries");
  assert.equal(model.positions.find((item) => item.key === "sun")?.fullDegree, null);
  const moon = model.positions.find((item) => item.key === "moon");
  assert.equal(moon?.precision, "range");
  assert.equal(moon?.sign, null);
  assert.deepEqual(moon?.possibleSignsEs, ["Cáncer", "Leo"]);
  assert.equal(moon?.degree, null);
  assert.equal(model.angles.length, 0);
  assert.equal(model.houses.length, 0);
  assert.equal(model.access.angles, false);
  assert.equal(model.access.houses, false);
  const stableOpposition = model.aspects.find(
    (aspect) => aspect.from === "sun" && aspect.to === "saturn" && aspect.type === "opposition",
  );
  assert.equal(stableOpposition?.precision, "range");
  assert.equal(stableOpposition?.orb, null);
  assert.ok(stableOpposition?.orbRange);
  assert.match(model.limitations.join(" "), /todo el día civil|día completo/i);
  assert.match(model.limitations.join(" "), /contacto.*omit/i);
});

test("una hora approximate se trata igual que unknown y nunca rescata Asc/MC/casas legacy", async () => {
  const birth: BirthDataSnapshot = {
    ...KNOWN_BIRTH,
    birthTime: "08:37",
    birthTimePrecision: "approximate",
    updatedAt: 30,
  };
  const model = await read({ birth, cache: natalCache(birth, dayPositions), isPro: true });

  assert.equal(model.birthTimePrecision, "approximate");
  assert.equal(model.calculationTimeSource, "full_civil_day");
  assert.equal(model.positions.find((item) => item.key === "sun")?.precision, "estimated");
  assert.ok(model.positions.every((item) => item.fullDegree === null));
  assert.deepEqual(model.angles, []);
  assert.deepEqual(model.houses, []);
  assert.match(model.limitations.join(" "), /aproximada.*desconocida/i);
});

test("sin cache canónico marca cada posición como omitted en vez de usar la carta legacy", async () => {
  const model = await read({ birth: KNOWN_BIRTH, cache: null, isPro: true });

  assert.equal(model.status, "unavailable");
  assert.equal(model.access.positions, false);
  assert.ok(model.positions.every((item) => item.precision === "omitted"));
  assert.ok(model.positions.every((item) => item.fullDegree === null));
  assert.equal(model.aspects.length, 0);
  assert.ok(model.missingInputs.includes("canonical_natal_ephemeris"));
});

test("access conserva Asc/MC para hora known y oculta casas/aspectos fuera de Pro", async () => {
  const model = await read({
    birth: KNOWN_BIRTH,
    cache: natalCache(KNOWN_BIRTH, exactPositions),
    isPro: false,
  });

  assert.deepEqual(model.access, {
    isPro: false,
    positions: true,
    angles: true,
    houses: false,
    aspects: false,
  });
  assert.equal(model.status, "ready");
  assert.equal(model.angles.length, 2);
  assert.equal(model.houses.length, 0);
  assert.equal(model.aspects.length, 0);
  assert.ok(model.positions.every((item) => item.house === null));
  assert.match(model.limitations.join(" "), /Órbita Plus/);
});


// ---------------------------------------------------------------------------
// La carta guardada y el cálculo que la repara tienen que medir lo MISMO
//
// El botón de recuperación de la Carta llama a
// `charts.calculateOrCreateNatalChart`. Esa action encuentra la carta por
// `cacheKey` —que se arma con los DATOS natales, no con lo que el cálculo llegó
// a publicar— y la reutilizaba tal cual. Con hora exacta y una corrida en la que
// el proveedor no devolvió las casas, eso significaba devolver para siempre la
// misma fila incompleta: el read-model seguía diciendo "falta una parte del
// cálculo" y el botón no podía cambiar nada.
//
// Estas pruebas atan las dos reglas: lo que el read-model declara faltante es
// exactamente lo que la action considera insuficiente.
// ---------------------------------------------------------------------------

/** El payload tal como queda guardado en `natalCharts`. */
const comoPayload = (chart: unknown) => ({ normalized: { ...(chart as object), summary: {} } });

/** La carta que deja una corrida en la que el proveedor no devolvió casas. */
function geometriaIncompleta() {
  const chart = legacyGeometry();
  // Sin casas no hay cúspides, y el Ascendente del normalizador sale de la casa
  // 1: es exactamente lo que persiste una respuesta parcial del proveedor.
  return {
    ...chart,
    houses: [],
    placements: chart.placements.filter(
      (placement) => placement.key !== "ascendant" && placement.key !== "midheaven",
    ),
  };
}

test("una carta guardada sin geometría es insuficiente, y el read-model declara lo mismo", async () => {
  const incompleta = geometriaIncompleta();

  // 1 · lo que el read-model publica: hay posiciones canónicas, pero faltan los
  // ejes verificados. Ese es el estado que ofrece "COMPROBAR DE NUEVO".
  const model = await read({
    birth: KNOWN_BIRTH,
    cache: natalCache(KNOWN_BIRTH, exactPositions),
    chart: incompleta as ReturnType<typeof legacyGeometry>,
    isPro: true,
  });
  assert.equal(model.status, "partial");
  assert.equal(model.access.positions, true, "el snapshot canónico existe: no es un muro de acceso");
  assert.deepEqual(model.angles, []);
  assert.ok(model.missingInputs.includes("verified_ascendant_mc_geometry"));
  assert.ok(model.missingInputs.includes("verified_twelve_house_geometry"));

  // 2 · y lo que la action mide sobre el MISMO payload: no alcanza. Sin esto, el
  // reintento devolvía esta fila idéntica y el botón no podía cambiar nada.
  assert.equal(
    storedNatalChartIsSufficient({
      birthTimePrecision: KNOWN_BIRTH.birthTimePrecision,
      payload: comoPayload(incompleta),
    }),
    false,
  );
});

test("una carta guardada COMPLETA se sigue reutilizando: el cache sano no se toca", async () => {
  const completa = legacyGeometry();

  const model = await read({
    birth: KNOWN_BIRTH,
    cache: natalCache(KNOWN_BIRTH, exactPositions),
    chart: completa,
    isPro: true,
  });
  assert.equal(model.status, "ready");
  assert.equal(model.angles.length, 2);
  assert.equal(model.houses.length, 12);
  assert.ok(!model.missingInputs.includes("verified_ascendant_mc_geometry"));
  assert.ok(!model.missingInputs.includes("verified_twelve_house_geometry"));

  assert.equal(
    storedNatalChartIsSufficient({
      birthTimePrecision: KNOWN_BIRTH.birthTimePrecision,
      payload: comoPayload(completa),
    }),
    true,
  );
});

test("sin hora exacta no hay geometría que exigir: cualquier carta guardada alcanza", async () => {
  const sinHora = { ...KNOWN_BIRTH, birthTime: null, birthTimePrecision: "unknown" as const };
  const incompleta = geometriaIncompleta();

  // El contrato retira ejes y casas a propósito, y NO las declara faltantes por
  // cálculo: pedirle otra corrida al proveedor no cambiaría nada.
  const model = await read({
    birth: sinHora,
    cache: natalCache(sinHora, dayPositions),
    chart: incompleta as ReturnType<typeof legacyGeometry>,
    isPro: true,
  });
  assert.ok(model.missingInputs.includes("exact_birth_time"));
  assert.ok(!model.missingInputs.includes("verified_ascendant_mc_geometry"));
  assert.ok(!model.missingInputs.includes("verified_twelve_house_geometry"));

  for (const precision of ["unknown", "approximate"]) {
    assert.equal(
      storedNatalChartIsSufficient({ birthTimePrecision: precision, payload: comoPayload(incompleta) }),
      true,
      precision,
    );
  }
});

test("un juego de casas a medias no cuenta como cache suficiente", () => {
  const chart = legacyGeometry();
  const once = { ...chart, houses: chart.houses.slice(0, 11) };
  const repetidas = {
    ...chart,
    houses: chart.houses.map((house) => ({ ...house, degree: 0 })),
  };
  const sinPayload = { birthTimePrecision: "known", payload: null };

  for (const [nombre, candidato] of [
    ["once cúspides", once],
    ["doce cúspides con el mismo grado", repetidas],
  ] as const) {
    assert.equal(
      storedNatalChartIsSufficient({ birthTimePrecision: "known", payload: comoPayload(candidato) }),
      false,
      nombre,
    );
  }
  assert.equal(storedNatalChartIsSufficient(sinPayload), false, "sin payload no hay geometría");
});

test("el cálculo mide la suficiencia ANTES de volver al proveedor, y el contrato público no crece", () => {
  const charts = readFileSync(`${process.cwd()}/convex/charts.ts`, "utf8");
  // El cuerpo compartido por las dos actions públicas. Que mida antes de pegarle
  // al proveedor está probado por comportamiento —contando llamadas— en
  // `test/natalRecoveryBackendV492.test.ts`; acá se ata el orden en la fuente
  // para que un refactor no lo invierta en silencio.
  const runner = charts.slice(
    charts.indexOf("export async function runNatalChartCalculation"),
    charts.indexOf("export const calculateOrCreateNatalChart"),
  );
  const suficiencia = runner.indexOf("storedNatalChartIsSufficient");
  const proveedor = runner.indexOf("await provider(");
  assert.ok(suficiencia >= 0, "el cálculo tiene que medir el cache");
  assert.ok(proveedor > suficiencia, "y medirlo antes de decidir si vuelve al proveedor");

  // Y no se agrega ningún interruptor público: la decisión es interna. Las dos
  // actions siguen siendo sin argumentos.
  const publico = charts.slice(charts.indexOf("export const calculateOrCreateNatalChart"));
  assert.doesNotMatch(publico, /\bforce\b/, "el contrato público no cambia");
  assert.equal(
    (publico.match(/^\s*args: \{\},$/gm) ?? []).length,
    2,
    "la de siempre y la de recuperación, las dos sin argumentos",
  );
});
