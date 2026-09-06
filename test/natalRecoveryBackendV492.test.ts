/**
 * El cálculo natal, visto desde el backend: qué se persiste, qué se agenda y
 * qué se le contesta a quien llamó.
 *
 * ## Los defectos que cierran estas pruebas
 *
 * **Primero (octava pasada).** La operación volvía a pedirle la carta al
 * proveedor cuando la guardada no alcanzaba —eso estaba bien— pero después
 * declaraba éxito pasara lo que pasara: si el proveedor fallaba reafirmaba la
 * carta parcial y RESOLVÍA con ella; si respondía `success` con un payload que
 * seguía sin casas ni ejes, lo persistía ENCIMA sin comprobar nada.
 *
 * **Y el que quedaba abierto (novena pasada).** La decisión seguía tomándose
 * con el estado que la corrida había visto ANTES de llamar al proveedor, y la
 * mutación parcheaba a ciegas lo que le llegara. Dos corridas que arrancan de
 * la misma carta A incompleta —dos toques, dos pantallas, el prewarm y la
 * persona— terminan en cualquier orden: la atrasada traía un snapshot viejo de
 * A, o una respuesta C que tampoco alcanzaba, y lo escribía encima de la B
 * completa que la otra ya había publicado. **La Carta empeoraba por una corrida
 * atrasada**, y `profileAstrologyCaches` se iba con ella.
 *
 * Acá se corre el cuerpo real (`runNatalChartCalculation`) y la mutación real
 * (`applyCalculatedNatalChart`) contra una base en memoria, con el orden de
 * resolución del proveedor bajo control de la prueba. Lo que se mide es qué
 * quedó escrito y qué desenlace recibió cada caller. Nada de buscar palabras en
 * el archivo, y ninguna prueba de concurrencia que no controle el orden real.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { getFunctionName } from "convex/server";

import {
  NATAL_BIRTH_DATA_CHANGED,
  applyCalculatedNatalChart,
  natalCalculationSucceeded,
  readNatalStateForRun,
  resolveFinalNatalOutcome,
  resolveNatalCalculationDecision,
  resolveNatalPersistDecision,
  runNatalChartCalculation
} from "../convex/charts";
import {
  buildBirthDataHash,
  buildNatalChartCacheKey,
  findCurrentBirthData
} from "../convex/lib/birthDataConsistency";
import { storedNatalChartIsSufficient } from "../convex/lib/natalGeometry";
import { chartMatchesCompletionBirthData } from "../convex/lib/onboardingCompletion";
import { ASTROLOGY_API_CHART_CALCULATION_VERSION } from "../convex/lib/orbita";
import { createMemoryDb } from "./convexMemoryDb";

// ---------------------------------------------------------------------------
// Fixtures — una carta completa y una carta a la que le falta la geometría
// ---------------------------------------------------------------------------

const SIGNOS = [
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
  "Pisces"
];

/** Las doce cúspides, numeradas 1–12 y con grados distintos. */
const doceCuspides = () =>
  Array.from({ length: 12 }, (_, index) => ({
    house: index + 1,
    sign: SIGNOS[index],
    signEs: SIGNOS[index],
    degree: index * 30 + 5,
    theme: null
  }));

const posiciones = () => [
  { key: "sun", label: "Sun", sign: "Leo", signEs: "Leo", degree: 12, fullDegree: 132, house: 5, isRetrograde: false },
  { key: "moon", label: "Moon", sign: "Aries", signEs: "Aries", degree: 3, fullDegree: 3, house: 1, isRetrograde: false }
];

/** El payload tal como lo entrega el normalizador y queda guardado. */
const comoPayload = (chart: unknown) => ({ normalized: { ...(chart as object), summary: {} } });

/** Una carta con los dos ejes y las doce cúspides: alcanza con hora exacta. */
function cartaCompleta(marca = "completa") {
  return comoPayload({
    marca,
    placements: [
      ...posiciones(),
      { key: "ascendant", label: "Ascendant", sign: "Aries", signEs: "Aries", degree: 5, fullDegree: 5, house: 1, isRetrograde: false },
      { key: "mc", label: "MC", sign: "Capricorn", signEs: "Capricornio", degree: 5, fullDegree: 275, house: 10, isRetrograde: false }
    ],
    houses: doceCuspides()
  });
}

/** Lo que deja una corrida en la que el proveedor no devolvió las casas. */
function cartaIncompleta(marca = "vieja") {
  return comoPayload({ marca, placements: posiciones(), houses: [] });
}

const marcaDe = (payload: unknown) => (payload as any)?.normalized?.marca;

// Las dos cartas son exactamente lo que dice su nombre según la MISMA regla que
// usa el read-model. Si esto dejara de ser cierto, el resto no probaría nada.
test("los fixtures son lo que dicen ser según la regla del read-model", () => {
  assert.equal(
    storedNatalChartIsSufficient({ birthTimePrecision: "known", payload: cartaCompleta() }),
    true
  );
  assert.equal(
    storedNatalChartIsSufficient({ birthTimePrecision: "known", payload: cartaIncompleta() }),
    false
  );
});

// ---------------------------------------------------------------------------
// La base en memoria, la mutación REAL y el proveedor bajo control
// ---------------------------------------------------------------------------

type ProviderScript =
  | { kind: "success"; payload: unknown }
  | { kind: "failure"; status?: string; error?: string };

/** Un proveedor que la prueba resuelve cuando quiere: sin esto no hay carrera. */
type Diferido = { resolver: (script: ProviderScript) => void };

const TOKEN = "token-1";

function escenario(options: {
  /** La carta ya guardada bajo el `cacheKey` vigente, si la hay. */
  existingChart?: { payload: unknown; providerVersion?: string } | null;
  birthTimePrecision?: "known" | "unknown" | "approximate";
} = {}) {
  const memoria = createMemoryDb();
  const userId = memoria.seed("users", {
    tokenIdentifier: TOKEN,
    clerkUserId: "clerk-1",
    createdAt: 1,
    updatedAt: 1
  });
  const datosNatales = {
    userId,
    birthDate: "1994-08-17",
    birthTime: "05:30",
    birthTimePrecision: options.birthTimePrecision ?? "known",
    birthPlaceLabel: "Buenos Aires",
    latitude: -34.6,
    longitude: -58.4,
    timezone: "America/Argentina/Buenos_Aires",
    source: "onboarding",
    createdAt: 1,
    updatedAt: 1
  };
  const birthDataId = memoria.seed("birthData", datosNatales);
  const birthDataHash = buildBirthDataHash(datosNatales as any);
  const cacheKey = buildNatalChartCacheKey(userId, birthDataHash);

  if (options.existingChart) {
    memoria.seed("natalCharts", {
      userId,
      birthDataId,
      birthDataHash,
      cacheKey,
      providerVersion: options.existingChart.providerVersion ?? "astrologyapi-v1",
      calculationVersion: ASTROLOGY_API_CHART_CALCULATION_VERSION,
      payload: options.existingChart.payload,
      createdAt: 1,
      updatedAt: 1
    });
  }

  const agendado: Array<Record<string, unknown>> = [];
  let llamadasAlProveedor = 0;
  let escrituras = 0;
  const consultas: string[] = [];

  const ctx: any = {
    db: memoria.db,
    // Las queries internas se despachan por su NOMBRE canónico, como en el
    // deployment: el cuerpo del arranque y el de la relectura son distintos y
    // una prueba que devolviera siempre lo mismo no probaría la relectura.
    runQuery: async (ref: unknown, argumentos: any) => {
      const nombre = getFunctionName(ref as any);
      consultas.push(nombre);
      if (nombre === "charts:recheckNatalStateForRun") {
        // El cuerpo REAL de la query interna, contra la misma base.
        return await readNatalStateForRun(ctx, argumentos);
      }
      assert.equal(nombre, "charts:getBirthDataForNatalCalculation", "query interna inesperada");
      // El mismo trabajo que hace `getBirthDataForNatalCalculation`: se lee el
      // estado de AHORA, que es justamente lo que puede quedar viejo mientras el
      // proveedor responde.
      const birthData = await findCurrentBirthData(ctx, userId);
      const hash = buildBirthDataHash(birthData);
      const clave = buildNatalChartCacheKey(userId, hash);
      const existing = await memoria.db
        .query("natalCharts")
        .withIndex("by_cacheKey", (q: any) => q.eq("cacheKey", clave))
        .first();
      return { userId, birthData, birthDataHash: hash, cacheKey: clave, existingChart: existing ?? null };
    },
    runMutation: async (_ref: unknown, args: any) => {
      escrituras += 1;
      return await applyCalculatedNatalChart(ctx, args);
    },
    scheduler: {
      runAfter: async (_ms: number, _ref: unknown, args: Record<string, unknown>) => {
        agendado.push(args);
      }
    }
  };

  const respuesta = (script: ProviderScript) =>
    script.kind === "failure"
      ? {
          status: script.status ?? "error",
          provider: "astrologyapi",
          providerVersion: "astrologyapi-v1",
          warnings: [],
          error: script.error
        }
      : {
          status: "success",
          provider: "astrologyapi",
          providerVersion: "astrologyapi-v2",
          warnings: [],
          normalized: { chart: script.payload }
        };

  /** Proveedor inmediato: para los casos secuenciales. */
  const proveedor = (script: ProviderScript) =>
    (async () => {
      llamadasAlProveedor += 1;
      return respuesta(script);
    }) as any;

  /** Proveedor suspendido: la prueba decide CUÁNDO y CON QUÉ responde. */
  const proveedorDiferido = () => {
    const pendientes: Diferido[] = [];
    const fn = (() =>
      new Promise((resolve) => {
        llamadasAlProveedor += 1;
        pendientes.push({ resolver: (script) => resolve(respuesta(script)) });
      })) as any;
    return { fn, pendientes };
  };

  return {
    ctx,
    memoria,
    userId,
    birthDataId,
    birthDataHash,
    cacheKey,
    agendado,
    proveedor,
    proveedorDiferido,
    consultas,
    /** Los datos natales, tal como quedaron sembrados. */
    datosNatales,
    /** Reemplaza los datos natales, como una edición de perfil en el medio. */
    cambiarDatosNatales: () =>
      memoria.seed("birthData", { ...datosNatales, birthTime: "21:15", updatedAt: 2 }),
    /**
     * Una fila natal MÁS NUEVA con exactamente los mismos campos: mismo hash y
     * mismo `cacheKey`, otra identidad de fila. Pasa al volver a cargar los
     * mismos datos o al reescribir el alta.
     */
    reescribirMismosDatosNatales: () =>
      memoria.seed("birthData", { ...datosNatales, updatedAt: 2 }),
    get llamadasAlProveedor() {
      return llamadasAlProveedor;
    },
    get escrituras() {
      return escrituras;
    },
    /** La fila natal tal como quedó. */
    get guardada() {
      return memoria.rows("natalCharts")[0] ?? null;
    },
    /** El cache de perfil tal como quedó. */
    get cache() {
      return memoria.rows("profileAstrologyCaches")[0] ?? null;
    }
  };
}

const cede = () => new Promise((resolve) => setTimeout(resolve, 0));

// ---------------------------------------------------------------------------
// 1 · cache incompleto + el proveedor falla
// ---------------------------------------------------------------------------

test("cache incompleto y proveedor caído: la carta anterior queda intacta y el caller recibe fallo", async () => {
  const previa = cartaIncompleta("vieja");
  const s = escenario({ existingChart: { payload: previa, providerVersion: "astrologyapi-v1" } });

  const result = await runNatalChartCalculation(
    s.ctx,
    TOKEN,
    s.proveedor({ kind: "failure", error: "provider down" })
  );

  assert.equal(s.llamadasAlProveedor, 1, "la carta guardada no alcanzaba: hay que volver a pedirla");
  assert.equal(result.outcome, "provider_failed");
  assert.equal(result.sufficient, false, "que la llamada haya vuelto no es éxito");
  assert.equal(result.detail, "provider down", "el motivo del proveedor viaja para quien lo necesite");
  // Lo que ya estaba publicado sigue publicado, byte por byte.
  assert.deepEqual(s.guardada?.payload, previa, "un intento fallido no borra ni empeora la carta");
  assert.equal(s.escrituras, 1, "sólo la reafirmación canónica");
  assert.equal(s.guardada?.providerVersion, "astrologyapi-v1", "y no se relabela");
  // Y sigue habiendo carta para mostrar: la Carta parcial no desaparece.
  assert.ok(result.chart, "la carta anterior se devuelve, no se pierde");
});

// ---------------------------------------------------------------------------
// 2 · cache incompleto + respuesta nueva que TAMPOCO alcanza
// ---------------------------------------------------------------------------

test("cache incompleto y respuesta nueva insuficiente: no se pisa la anterior y el caller no recibe éxito", async () => {
  const previa = cartaIncompleta("vieja");
  const nueva = cartaIncompleta("nueva");
  const s = escenario({ existingChart: { payload: previa, providerVersion: "astrologyapi-v1" } });

  const result = await runNatalChartCalculation(s.ctx, TOKEN, s.proveedor({ kind: "success", payload: nueva }));

  assert.equal(s.llamadasAlProveedor, 1);
  assert.equal(result.outcome, "still_insufficient");
  assert.equal(result.sufficient, false, "respondió, y falta exactamente lo mismo");
  // La distinción que importa: la respuesta nueva NO se escribió encima.
  assert.deepEqual(s.guardada?.payload, previa, "no hay forma de ordenar dos cálculos incompletos");
  assert.equal(marcaDe(s.guardada?.payload), "vieja");
  assert.equal(s.guardada?.providerVersion, "astrologyapi-v1", "tampoco se relabela la versión");
  assert.equal(marcaDe(s.cache?.payload?.chart), "vieja", "y el cache de perfil copia lo MISMO");
});

// ---------------------------------------------------------------------------
// 3 · cache incompleto + respuesta completa: se persiste la mejora
// ---------------------------------------------------------------------------

test("cache incompleto y respuesta completa: se persiste la mejora y se agenda lo que corresponde", async () => {
  const previa = cartaIncompleta("vieja");
  const mejor = cartaCompleta();
  const s = escenario({ existingChart: { payload: previa, providerVersion: "astrologyapi-v1" } });

  const result = await runNatalChartCalculation(s.ctx, TOKEN, s.proveedor({ kind: "success", payload: mejor }));

  assert.equal(s.llamadasAlProveedor, 1);
  assert.equal(result.outcome, "calculated");
  assert.equal(result.sufficient, true, "el read-model ya puede publicar la geometría");
  assert.deepEqual(s.guardada?.payload, mejor, "la mejora se escribe");
  assert.equal(s.guardada?.providerVersion, "astrologyapi-v2");
  assert.deepEqual(s.cache?.payload?.chart, mejor, "y el cache de perfil también");
  assert.equal(s.agendado.length, 1, "la lectura larga se agenda sobre la carta nueva");
  assert.deepEqual(s.agendado[0], { natalChartId: s.guardada?._id });
});

// ---------------------------------------------------------------------------
// 4 · cache completo: no se llama al proveedor
// ---------------------------------------------------------------------------

test("cache completo: no se llama al proveedor y el desenlace lo dice", async () => {
  const guardada = cartaCompleta();
  const s = escenario({ existingChart: { payload: guardada, providerVersion: "astrologyapi-v1" } });

  const result = await runNatalChartCalculation(
    s.ctx,
    TOKEN,
    s.proveedor({ kind: "success", payload: cartaCompleta() })
  );

  assert.equal(s.llamadasAlProveedor, 0, "una carta que alcanza no vuelve al proveedor");
  assert.equal(result.outcome, "cache_sufficient");
  assert.equal(result.sufficient, true);
  assert.deepEqual(s.guardada?.payload, guardada);
  assert.equal(s.agendado.length, 1, "la reafirmación canónica agenda igual que antes");
});

// ---------------------------------------------------------------------------
// 5 · sin hora exacta no hay geometría que exigir
// ---------------------------------------------------------------------------

test("sin hora exacta, la carta guardada alcanza aunque no traiga casas ni ejes", async () => {
  for (const precision of ["unknown", "approximate"] as const) {
    const guardada = cartaIncompleta("sin-hora");
    const s = escenario({
      existingChart: { payload: guardada, providerVersion: "astrologyapi-v1" },
      birthTimePrecision: precision
    });

    const result = await runNatalChartCalculation(
      s.ctx,
      TOKEN,
      s.proveedor({ kind: "success", payload: cartaCompleta() })
    );

    assert.equal(s.llamadasAlProveedor, 0, `${precision}: el contrato retira la geometría a propósito`);
    assert.equal(result.outcome, "cache_sufficient", precision);
    assert.equal(result.sufficient, true, precision);
    assert.deepEqual(s.guardada?.payload, guardada, precision);
  }
});

test("sin hora exacta y sin carta, una respuesta sin casas alcanza igual", async () => {
  const nueva = cartaIncompleta("recien-calculada");
  const s = escenario({ existingChart: null, birthTimePrecision: "unknown" });

  const result = await runNatalChartCalculation(s.ctx, TOKEN, s.proveedor({ kind: "success", payload: nueva }));

  assert.equal(s.llamadasAlProveedor, 1, "no había nada guardado");
  assert.equal(result.outcome, "calculated");
  assert.equal(result.sufficient, true, "no se exige una geometría que estos datos no permiten");
  assert.deepEqual(s.guardada?.payload, nueva);
});

// ---------------------------------------------------------------------------
// 6 · sin carta guardada, algo es mejor que nada — pero se dice la verdad
// ---------------------------------------------------------------------------

test("sin carta guardada y proveedor caído: no queda nada y el caller lo sabe", async () => {
  const s = escenario({ existingChart: null });

  const result = await runNatalChartCalculation(
    s.ctx,
    TOKEN,
    s.proveedor({ kind: "failure", status: "not_configured" })
  );

  assert.equal(result.outcome, "provider_failed");
  assert.equal(result.chart, null, "no hay carta que devolver");
  assert.equal(result.detail, "not_configured");
  assert.equal(s.escrituras, 0, "no se escribe nada");
  assert.equal(s.guardada, null);
});

test("sin carta guardada y respuesta insuficiente: se persiste, pero no se llama éxito", async () => {
  const nueva = cartaIncompleta("primera");
  const s = escenario({ existingChart: null });

  const result = await runNatalChartCalculation(s.ctx, TOKEN, s.proveedor({ kind: "success", payload: nueva }));

  // Algo es mejor que nada: la Carta ya sabe declararlo `partial` y ofrecer el
  // reintento. Pero lo que faltaba sigue faltando, y eso no es un éxito.
  assert.deepEqual(s.guardada?.payload, nueva, "se guarda: mejor una carta parcial que ninguna");
  assert.equal(result.outcome, "still_insufficient");
  assert.equal(result.sufficient, false);
  assert.ok(result.chart, "y se devuelve, para que el alta no quede sin carta");
});

// ---------------------------------------------------------------------------
// 7 · las tablas de decisión, enteras
// ---------------------------------------------------------------------------

test("la decisión cubre las ocho combinaciones y nunca empeora una carta guardada", () => {
  const casos = [
    // cache que alcanza: ni se mira al proveedor
    [{ hasExistingChart: true, existingIsSufficient: true, providerSucceeded: false, providerIsSufficient: false }, "reuse_existing", "cache_sufficient"],
    [{ hasExistingChart: true, existingIsSufficient: true, providerSucceeded: true, providerIsSufficient: true }, "reuse_existing", "cache_sufficient"],
    // cache que no alcanza
    [{ hasExistingChart: true, existingIsSufficient: false, providerSucceeded: false, providerIsSufficient: false }, "reuse_existing", "provider_failed"],
    [{ hasExistingChart: true, existingIsSufficient: false, providerSucceeded: true, providerIsSufficient: false }, "reuse_existing", "still_insufficient"],
    [{ hasExistingChart: true, existingIsSufficient: false, providerSucceeded: true, providerIsSufficient: true }, "persist_provider", "calculated"],
    // sin cache
    [{ hasExistingChart: false, existingIsSufficient: false, providerSucceeded: false, providerIsSufficient: false }, "fail", "provider_failed"],
    [{ hasExistingChart: false, existingIsSufficient: false, providerSucceeded: true, providerIsSufficient: false }, "persist_provider", "still_insufficient"],
    [{ hasExistingChart: false, existingIsSufficient: false, providerSucceeded: true, providerIsSufficient: true }, "persist_provider", "calculated"]
  ] as const;

  for (const [entrada, action, outcome] of casos) {
    const decision = resolveNatalCalculationDecision(entrada);
    assert.deepEqual(decision, { action, outcome }, JSON.stringify(entrada));
    // La invariante: con una carta guardada que no alcanza, sólo se escribe algo
    // nuevo si ese algo SÍ alcanza.
    if (entrada.hasExistingChart && decision.action === "persist_provider") {
      assert.equal(entrada.providerIsSufficient, true, "no se pisa una carta con otra igual de incompleta");
    }
  }
});

test("la decisión de persistencia es monotónica en las seis combinaciones", () => {
  const casos = [
    // sin fila: se inserta lo que haya, aunque sea parcial
    [{ hasExistingChart: false, existingIsSufficient: false, candidateIsSufficient: false }, "candidate"],
    [{ hasExistingChart: false, existingIsSufficient: false, candidateIsSufficient: true }, "candidate"],
    // fila suficiente: NADA la reemplaza, ni siquiera otro candidato completo
    [{ hasExistingChart: true, existingIsSufficient: true, candidateIsSufficient: false }, "existing"],
    [{ hasExistingChart: true, existingIsSufficient: true, candidateIsSufficient: true }, "existing"],
    // fila insuficiente: sólo la mejora entra
    [{ hasExistingChart: true, existingIsSufficient: false, candidateIsSufficient: false }, "existing"],
    [{ hasExistingChart: true, existingIsSufficient: false, candidateIsSufficient: true }, "candidate"]
  ] as const;

  for (const [entrada, keep] of casos) {
    const decision = resolveNatalPersistDecision(entrada);
    assert.equal(decision.keep, keep, JSON.stringify(entrada));
    // La invariante: una fila que alcanza nunca se pierde.
    if (entrada.existingIsSufficient) assert.equal(decision.keep, "existing", JSON.stringify(entrada));
    // Y una fila que no alcanza sólo se reemplaza por algo que sí.
    if (entrada.hasExistingChart && decision.keep === "candidate") {
      assert.equal(entrada.candidateIsSufficient, true, JSON.stringify(entrada));
    }
  }
});

test("éxito es exactamente cache_sufficient o calculated", () => {
  assert.equal(natalCalculationSucceeded("cache_sufficient"), true);
  assert.equal(natalCalculationSucceeded("calculated"), true);
  assert.equal(natalCalculationSucceeded("provider_failed"), false);
  assert.equal(natalCalculationSucceeded("still_insufficient"), false);
});

test("el desenlace final se mide sobre la fila que quedó, no sobre la intención", () => {
  // Otra corrida ganó con una carta que alcanza: no es un fallo.
  for (const intended of ["provider_failed", "still_insufficient"] as const) {
    assert.equal(
      resolveFinalNatalOutcome({ intended, storedCandidate: false, finalIsSufficient: true }),
      "cache_sufficient",
      intended
    );
  }
  // Traíamos una carta completa pero la mutación conservó la que ya estaba: el
  // éxito es `stored`, porque lo que se ve no lo escribió esta corrida.
  assert.equal(
    resolveFinalNatalOutcome({ intended: "calculated", storedCandidate: false, finalIsSufficient: true }),
    "cache_sufficient"
  );
  assert.equal(
    resolveFinalNatalOutcome({ intended: "calculated", storedCandidate: true, finalIsSufficient: true }),
    "calculated"
  );
  // Y si la fila final NO alcanza, el desenlace es el que esta corrida consiguió.
  for (const intended of ["provider_failed", "still_insufficient"] as const) {
    assert.equal(
      resolveFinalNatalOutcome({ intended, storedCandidate: true, finalIsSufficient: false }),
      intended,
      intended
    );
  }
});

// ---------------------------------------------------------------------------
// 8 · CONCURRENCIA — dos corridas que arrancan del mismo estado (P1-A)
//
// El orden de resolución lo controla la prueba: sin eso, una suite verde no
// prueba nada de esto.
// ---------------------------------------------------------------------------

test("B completa gana y la corrida atrasada FALLA después: B queda byte por byte y el segundo caller ve el estado suficiente", async () => {
  const parcial = cartaIncompleta("A-parcial");
  const completa = cartaCompleta("B-completa");
  const s = escenario({ existingChart: { payload: parcial, providerVersion: "astrologyapi-v1" } });
  const proveedor = s.proveedorDiferido();

  // Las dos arrancan del MISMO estado: las dos leen la carta A incompleta.
  const primera = runNatalChartCalculation(s.ctx, TOKEN, proveedor.fn);
  const segunda = runNatalChartCalculation(s.ctx, TOKEN, proveedor.fn);
  await cede();
  assert.equal(proveedor.pendientes.length, 2, "las dos están esperando al proveedor");

  // B termina primero, con la carta completa.
  proveedor.pendientes[1].resolver({ kind: "success", payload: completa });
  const resultadoB = await segunda;
  assert.equal(resultadoB.outcome, "calculated");
  assert.deepEqual(s.guardada?.payload, completa, "B queda publicada");

  // Y recién ahí la atrasada se cae.
  proveedor.pendientes[0].resolver({ kind: "failure", error: "provider down" });
  const resultadoA = await primera;

  // Lo que importa: B sobrevive, byte por byte, en las DOS tablas.
  assert.deepEqual(s.guardada?.payload, completa, "una corrida atrasada no puede reponer la parcial");
  assert.equal(s.guardada?.providerVersion, "astrologyapi-v2");
  assert.deepEqual(s.cache?.payload?.chart, completa, "y el cache de perfil no diverge");
  assert.equal(s.cache?.natalChartId, s.guardada?._id);
  // Y el caller atrasado NO recibe un fallo falso: la geometría está publicada.
  assert.equal(resultadoA.outcome, "cache_sufficient", "otra corrida ganó con una carta que alcanza");
  assert.equal(resultadoA.sufficient, true);
  assert.equal(resultadoA.detail, null, "no se reporta un motivo de fallo que ya no describe nada");
  assert.deepEqual(resultadoA.chart?.payload, completa);
});

test("mismo interleaving, pero la atrasada trae C parcial: B no se pisa", async () => {
  const parcial = cartaIncompleta("A-parcial");
  const completa = cartaCompleta("B-completa");
  const otraParcial = cartaIncompleta("C-parcial");
  const s = escenario({ existingChart: { payload: parcial, providerVersion: "astrologyapi-v1" } });
  const proveedor = s.proveedorDiferido();

  const primera = runNatalChartCalculation(s.ctx, TOKEN, proveedor.fn);
  const segunda = runNatalChartCalculation(s.ctx, TOKEN, proveedor.fn);
  await cede();

  proveedor.pendientes[1].resolver({ kind: "success", payload: completa });
  await segunda;
  proveedor.pendientes[0].resolver({ kind: "success", payload: otraParcial });
  const resultadoA = await primera;

  assert.equal(marcaDe(s.guardada?.payload), "B-completa", "una respuesta parcial atrasada no degrada la carta");
  assert.equal(marcaDe(s.cache?.payload?.chart), "B-completa");
  assert.equal(resultadoA.outcome, "cache_sufficient");
  assert.equal(resultadoA.sufficient, true);
});

test("sin fila inicial: la completa gana y la parcial que llega después no la degrada", async () => {
  const completa = cartaCompleta("B-completa");
  const parcial = cartaIncompleta("C-parcial");
  const s = escenario({ existingChart: null });
  const proveedor = s.proveedorDiferido();

  const primera = runNatalChartCalculation(s.ctx, TOKEN, proveedor.fn);
  const segunda = runNatalChartCalculation(s.ctx, TOKEN, proveedor.fn);
  await cede();

  proveedor.pendientes[1].resolver({ kind: "success", payload: completa });
  await segunda;
  assert.equal(s.memoria.rows("natalCharts").length, 1, "una sola fila por cacheKey");

  proveedor.pendientes[0].resolver({ kind: "success", payload: parcial });
  const resultadoA = await primera;

  assert.equal(s.memoria.rows("natalCharts").length, 1, "y sigue siendo una sola");
  assert.equal(marcaDe(s.guardada?.payload), "B-completa");
  assert.equal(marcaDe(s.cache?.payload?.chart), "B-completa");
  assert.equal(resultadoA.outcome, "cache_sufficient", "no es un fallo: la carta buena está publicada");
});

test("dos candidatas completas resueltas en orden inverso: la publicada no se reemplaza", async () => {
  const primeraCompleta = cartaCompleta("B-completa");
  const segundaCompleta = cartaCompleta("A-completa-atrasada");
  const s = escenario({ existingChart: { payload: cartaIncompleta("previa"), providerVersion: "astrologyapi-v1" } });
  const proveedor = s.proveedorDiferido();

  const primera = runNatalChartCalculation(s.ctx, TOKEN, proveedor.fn);
  const segunda = runNatalChartCalculation(s.ctx, TOKEN, proveedor.fn);
  await cede();

  proveedor.pendientes[1].resolver({ kind: "success", payload: primeraCompleta });
  const resultadoB = await segunda;
  assert.equal(resultadoB.outcome, "calculated", "la que llegó primero SÍ escribió");

  proveedor.pendientes[0].resolver({ kind: "success", payload: segundaCompleta });
  const resultadoA = await primera;

  // El `cacheKey` ya incorpora la versión de cálculo: dos completas describen lo
  // mismo, y pisar la que ya está publicada sólo agrega ruido.
  assert.equal(marcaDe(s.guardada?.payload), "B-completa", "la publicada no se reemplaza");
  assert.equal(marcaDe(s.cache?.payload?.chart), "B-completa");
  assert.equal(resultadoA.outcome, "cache_sufficient", "y el éxito es almacenado, no del proveedor");
  assert.equal(resultadoA.sufficient, true);
});

test("los datos natales cambian mientras el proveedor responde: no se publica ni se cuenta como éxito", async () => {
  const parcial = cartaIncompleta("A-parcial");
  const completa = cartaCompleta("calculada-para-datos-viejos");
  const s = escenario({ existingChart: { payload: parcial, providerVersion: "astrologyapi-v1" } });
  const proveedor = s.proveedorDiferido();

  const corrida = runNatalChartCalculation(s.ctx, TOKEN, proveedor.fn);
  await cede();

  // La persona edita su hora de nacimiento en el medio: la fila vigente es otra,
  // con otro hash y otro `cacheKey`.
  s.cambiarDatosNatales();
  proveedor.pendientes[0].resolver({ kind: "success", payload: completa });

  await assert.rejects(corrida, new RegExp(NATAL_BIRTH_DATA_CHANGED));

  // Nada de lo calculado para los datos anteriores quedó como carta vigente.
  assert.equal(s.memoria.rows("natalCharts").length, 1, "no se creó una carta para los datos viejos");
  assert.deepEqual(s.guardada?.payload, parcial, "y la que había no se tocó");
  assert.equal(s.memoria.rows("profileAstrologyCaches").length, 0, "tampoco se escribió el cache de perfil");
  assert.equal(s.agendado.length, 0, "ni se agendó una lectura larga sobre nada");
});

test("la revalidación de identidad rechaza también un cacheKey o un hash que ya no corresponden", async () => {
  const s = escenario({ existingChart: null });
  const base = {
    tokenIdentifier: TOKEN,
    birthDataId: s.birthDataId,
    birthDataHash: s.birthDataHash,
    cacheKey: s.cacheKey,
    providerVersion: "astrologyapi-v2",
    calculationVersion: ASTROLOGY_API_CHART_CALCULATION_VERSION,
    payload: cartaCompleta()
  };

  // Con la identidad completa, escribe.
  const ok = await applyCalculatedNatalChart(s.ctx, base);
  assert.equal(ok.stored, "candidate");

  for (const [nombre, args] of [
    ["hash viejo", { ...base, birthDataHash: "hash-de-otros-datos" }],
    ["cacheKey viejo", { ...base, cacheKey: "natal:v0:user-viejo:hash-viejo" }]
  ] as const) {
    await assert.rejects(applyCalculatedNatalChart(s.ctx, args), new RegExp(NATAL_BIRTH_DATA_CHANGED), nombre);
  }
});

// ---------------------------------------------------------------------------
// 9 · CONCURRENCIA — la corrida SIN CARTA que falla tarde (P1-A del décimo pase)
//
// El interleaving que faltaba: las dos corridas arrancan **sin ninguna carta**,
// así que la que falla nunca llega a la mutación —no tiene candidato— y decidía
// sola con el estado que había visto al empezar. Devolvía `provider_failed`,
// `sufficient:false` y `chart:null` aunque la otra ya hubiera publicado una
// carta suficiente: `recoverNatalChart` informaba un fallo falso y la action
// legacy lanzaba con una carta válida en la base.
// ---------------------------------------------------------------------------

test("sin carta inicial: B completa gana y A falla DESPUÉS — A ve el estado suficiente, no un fallo falso", async () => {
  const completa = cartaCompleta("B-completa");
  const s = escenario({ existingChart: null });
  const proveedor = s.proveedorDiferido();

  // Las dos arrancan del mismo estado: ninguna ve carta.
  const primera = runNatalChartCalculation(s.ctx, TOKEN, proveedor.fn);
  const segunda = runNatalChartCalculation(s.ctx, TOKEN, proveedor.fn);
  await cede();
  assert.equal(proveedor.pendientes.length, 2, "las dos están esperando al proveedor");

  // B publica una carta que alcanza.
  proveedor.pendientes[1].resolver({ kind: "success", payload: completa });
  const resultadoB = await segunda;
  assert.equal(resultadoB.outcome, "calculated");

  // Y recién ahí se cae la que no tiene nada que persistir.
  proveedor.pendientes[0].resolver({ kind: "failure", error: "provider down" });
  const resultadoA = await primera;

  assert.equal(resultadoA.outcome, "cache_sufficient", "otra corrida ganó con una carta que alcanza");
  assert.equal(resultadoA.sufficient, true);
  assert.equal(resultadoA.detail, null, "no se reporta un motivo de fallo que ya no describe nada");
  assert.deepEqual(resultadoA.chart?.payload, completa, "y devuelve la carta REAL, la de B");
  // La corrida que falló releyó el estado; la que escribió, no lo necesita.
  assert.equal(
    s.consultas.filter((nombre) => nombre === "charts:recheckNatalStateForRun").length,
    1,
    "la relectura ocurre exactamente en el camino sin candidato"
  );
  assert.equal(s.memoria.rows("natalCharts").length, 1, "y no se creó ninguna fila de más");
});

test("sin carta inicial: B deja una PARCIAL y A falla después — A la devuelve, pero sigue fallando honestamente", async () => {
  const parcial = cartaIncompleta("B-parcial");
  const s = escenario({ existingChart: null });
  const proveedor = s.proveedorDiferido();

  const primera = runNatalChartCalculation(s.ctx, TOKEN, proveedor.fn);
  const segunda = runNatalChartCalculation(s.ctx, TOKEN, proveedor.fn);
  await cede();

  proveedor.pendientes[1].resolver({ kind: "success", payload: parcial });
  const resultadoB = await segunda;
  assert.equal(resultadoB.outcome, "still_insufficient", "algo es mejor que nada, pero falta lo mismo");

  proveedor.pendientes[0].resolver({ kind: "failure", error: "provider down" });
  const resultadoA = await primera;

  // Lo que NO puede pasar: llamar éxito a esto.
  assert.equal(resultadoA.outcome, "provider_failed", "una carta parcial no vuelve exitosa a esta corrida");
  assert.equal(resultadoA.sufficient, false);
  assert.equal(resultadoA.detail, "provider down", "el motivo real del proveedor sigue viajando");
  // Y lo que tampoco: fingir que no hay carta cuando la Carta ya puede mostrarla.
  assert.ok(resultadoA.chart, "la carta parcial existe y se devuelve");
  assert.deepEqual(resultadoA.chart?.payload, parcial);
});

test("sin carta inicial y sin ganador concurrente: el fallo sigue siendo sin carta", async () => {
  const s = escenario({ existingChart: null });

  const result = await runNatalChartCalculation(
    s.ctx,
    TOKEN,
    s.proveedor({ kind: "failure", status: "not_configured" })
  );

  assert.equal(result.outcome, "provider_failed");
  assert.equal(result.sufficient, false);
  assert.equal(result.chart, null, "no hay nada que devolver, y se dice");
  assert.equal(result.detail, "not_configured");
  assert.equal(s.escrituras, 0, "no se escribe nada");
  assert.equal(
    s.consultas.filter((nombre) => nombre === "charts:recheckNatalStateForRun").length,
    1,
    "se releyó igual: la relectura es la que puede decir que no hay nada"
  );
});

test("sin carta inicial: si los datos natales cambian durante la espera, el fallo se vuelve rechazo estable", async () => {
  const s = escenario({ existingChart: null });
  const proveedor = s.proveedorDiferido();

  const corrida = runNatalChartCalculation(s.ctx, TOKEN, proveedor.fn);
  await cede();

  // La persona edita su hora de nacimiento mientras el proveedor no contesta.
  s.cambiarDatosNatales();
  proveedor.pendientes[0].resolver({ kind: "failure", error: "provider down" });

  await assert.rejects(corrida, new RegExp(NATAL_BIRTH_DATA_CHANGED));
  assert.equal(s.escrituras, 0, "no se escribió nada");
});

test("sin carta inicial: una carta de OTROS datos natales nunca se convierte en el éxito de esta corrida", async () => {
  const completa = cartaCompleta("de-los-datos-nuevos");
  const s = escenario({ existingChart: null });
  const proveedor = s.proveedorDiferido();

  const corrida = runNatalChartCalculation(s.ctx, TOKEN, proveedor.fn);
  await cede();

  // Otra corrida, con los datos YA editados, publica su carta completa bajo el
  // `cacheKey` NUEVO. La corrida vieja no puede adoptarla como propia.
  const nuevosDatos = s.cambiarDatosNatales();
  const filaNueva: any = await s.memoria.db.get(nuevosDatos);
  const hashNuevo = buildBirthDataHash(filaNueva);
  s.memoria.seed("natalCharts", {
    userId: s.userId,
    birthDataId: nuevosDatos,
    birthDataHash: hashNuevo,
    cacheKey: buildNatalChartCacheKey(s.userId, hashNuevo),
    providerVersion: "astrologyapi-v2",
    calculationVersion: ASTROLOGY_API_CHART_CALCULATION_VERSION,
    payload: completa,
    createdAt: 2,
    updatedAt: 2
  });

  proveedor.pendientes[0].resolver({ kind: "failure", error: "provider down" });

  await assert.rejects(corrida, new RegExp(NATAL_BIRTH_DATA_CHANGED), "rechazo estable, no éxito cruzado");
});

// ---------------------------------------------------------------------------
// 10 · IDENTIDAD — la carta ganadora se reafirma para la fila natal VIGENTE
//      (P1-B del décimo pase)
//
// El hash y el `cacheKey` describen los CAMPOS natales, no la fila que los
// guarda. Una fila natal más nueva y semánticamente idéntica —volver a cargar
// los mismos datos, reescribir el alta— produce el mismo `cacheKey`: la carta
// que ya existe gana y se quedaba apuntando al `birthDataId` HISTÓRICO.
// `chartMatchesCompletionBirthData` exige la fila vigente exacta, así que el
// alta se quedaba en `chart_pending` para siempre con el payload correcto.
// ---------------------------------------------------------------------------

test("una fila natal nueva con los mismos campos: la carta ganadora repara sus dos referencias sin tocar el payload", async () => {
  const guardada = cartaCompleta("la-que-ya-estaba");
  const s = escenario({ existingChart: { payload: guardada, providerVersion: "astrologyapi-v1" } });

  // El cache de perfil que dejó la corrida anterior, apuntando a la fila vieja.
  const chartViejo = s.guardada as any;
  s.memoria.seed("profileAstrologyCaches", {
    userId: s.userId,
    birthDataId: s.birthDataId,
    natalChartId: chartViejo._id,
    cacheKey: s.cacheKey,
    cacheVersion: ASTROLOGY_API_CHART_CALCULATION_VERSION,
    payload: { feature: "natal_chart", chart: guardada },
    createdAt: 1,
    updatedAt: 1
  });

  // Nace una fila natal nueva con EXACTAMENTE los mismos campos.
  const nuevaFila = s.reescribirMismosDatosNatales();
  const vigente: any = await s.memoria.db.get(nuevaFila);
  assert.notEqual(String(nuevaFila), String(s.birthDataId), "es otra fila…");
  assert.equal(buildBirthDataHash(vigente), s.birthDataHash, "…con el mismo hash");

  // El defecto, dicho antes de arreglarlo: el alta no puede cerrar.
  assert.equal(
    chartMatchesCompletionBirthData({ userId: s.userId, birthData: vigente, chart: chartViejo }),
    false,
    "la carta correcta apunta a la fila natal histórica: `chart_pending` para siempre"
  );

  // Y ahora la corrida normal: cache suficiente, ni se llama al proveedor.
  const result = await runNatalChartCalculation(
    s.ctx,
    TOKEN,
    s.proveedor({ kind: "success", payload: cartaCompleta("candidata-descartada") })
  );
  assert.equal(s.llamadasAlProveedor, 0);
  assert.equal(result.outcome, "cache_sufficient");

  // El payload y su procedencia quedan byte por byte: reafirmar identidad no es
  // relabelar la carta con la del candidato descartado.
  const chart = s.guardada as any;
  assert.equal(String(chart._id), String(chartViejo._id), "sigue siendo la MISMA fila natal");
  assert.deepEqual(chart.payload, guardada, "el payload no se toca");
  assert.equal(chart.providerVersion, "astrologyapi-v1", "ni la versión del proveedor");
  assert.equal(chart.calculationVersion, ASTROLOGY_API_CHART_CALCULATION_VERSION);

  // Las dos referencias quedan reparadas hacia la fila natal VIGENTE.
  assert.equal(String(chart.birthDataId), String(nuevaFila), "la carta apunta a la fila vigente");
  assert.equal(chart.userId, s.userId);
  assert.equal(chart.birthDataHash, s.birthDataHash);
  assert.equal(chart.cacheKey, s.cacheKey);

  const cache = s.cache as any;
  assert.equal(s.memoria.rows("profileAstrologyCaches").length, 1, "no se abrió una fila duplicada");
  assert.equal(String(cache.birthDataId), String(nuevaFila), "y el cache de perfil también");
  assert.equal(cache.userId, s.userId);
  assert.equal(String(cache.natalChartId), String(chart._id));
  assert.equal(cache.cacheKey, s.cacheKey);
  assert.equal(cache.cacheVersion, ASTROLOGY_API_CHART_CALCULATION_VERSION);
  assert.deepEqual(cache.payload.chart, guardada, "con el payload realmente elegido");

  // Y el alta ya puede cerrar.
  assert.equal(
    chartMatchesCompletionBirthData({ userId: s.userId, birthData: vigente, chart }),
    true,
    "el onboarding sale de `chart_pending` sin recalcular nada"
  );
});

test("cuando gana el candidato, la identidad vigente también queda escrita", async () => {
  const previa = cartaIncompleta("previa");
  const mejor = cartaCompleta("mejora");
  const s = escenario({ existingChart: { payload: previa, providerVersion: "astrologyapi-v1" } });

  const nuevaFila = s.reescribirMismosDatosNatales();
  const vigente: any = await s.memoria.db.get(nuevaFila);

  const result = await runNatalChartCalculation(s.ctx, TOKEN, s.proveedor({ kind: "success", payload: mejor }));
  assert.equal(result.outcome, "calculated");

  const chart = s.guardada as any;
  assert.deepEqual(chart.payload, mejor, "la mejora se escribe");
  assert.equal(String(chart.birthDataId), String(nuevaFila), "y apunta a la fila natal vigente");
  assert.equal(String((s.cache as any).birthDataId), String(nuevaFila));
  assert.equal(
    chartMatchesCompletionBirthData({ userId: s.userId, birthData: vigente, chart }),
    true
  );
});
