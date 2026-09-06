/**
 * La lectura larga de la Carta, atada a la carta que de verdad la generó.
 *
 * ## El defecto que cierran estas pruebas
 *
 * Una mejora de la carta natal reescribe el payload **sobre el mismo
 * `natalChartId`**: cuando el proveedor entrega por fin los ejes y las doce
 * cúspides, la fila no cambia de identidad. Y `natalInterpretations` se
 * identificaba sólo por carta + feature + `promptVersion`, así que:
 *
 * - una lectura `ready` escrita sobre la carta PARCIAL seguía pasando como
 *   cache hit después de instalar la geometría completa: el texto hablaba de una
 *   carta sin Ascendente ni casas mientras la pantalla ya mostraba las dos
 *   cosas;
 * - una generación A que arrancó con el payload parcial podía terminar DESPUÉS
 *   de la mejora B y persistir ese texto viejo encima del estado nuevo;
 * - un claim que perdió el lease podía volver y pisar la lectura del claim que
 *   lo reemplazó.
 *
 * Acá se corren las mutaciones REALES contra una base en memoria, con el orden
 * de resolución del generador bajo control de la prueba.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { getFunctionName } from "convex/server";

import {
  applyNatalReadingClaim,
  applyNatalReadingWrite,
  generateAndPersistNatalReading,
  natalReadingIsVerified,
  resolveNatalGenerationClaim,
  resolveNatalReadingPublicStatus,
  resolveNatalReadingWrite,
  resolveReadyPersonalityReading
} from "../convex/charts";
import { getAiGatewayNatalCacheVersion } from "../convex/lib/aiGateway";
import { natalPayloadRevision, natalStampMatches } from "../convex/lib/natalRevision";
import { createMemoryDb } from "./convexMemoryDb";

const PROMPT_VERSION = "v-prompt";
/**
 * La versión de caché que el deployment pide AHORA. Las mutaciones reales la
 * leen de la configuración, y el CAS la exige: por eso las pruebas que llaman
 * al claim y a la escritura directamente tienen que usar ésta y no una
 * inventada.
 */
const VERSION_VIGENTE = getAiGatewayNatalCacheVersion();

/**
 * La identidad vigente contra la que se resuelve una fila: revisión del payload
 * natal + versión de caché. Las dos, siempre: una fila que sólo puede demostrar
 * una de las dos no describe lo de ahora.
 */
const esperado = (chartRevision: string, cacheVersion: string = VERSION_VIGENTE) => ({
  chartRevision,
  cacheVersion
});

const cartaParcial = () => ({ normalized: { marca: "parcial", placements: [], houses: [] } });
const cartaCompleta = () => ({ normalized: { marca: "completa", placements: ["asc"], houses: [1] } });

const texto = (marca: string) => ({ headline: marca, sections: [], disclaimer: "" });

const cede = () => new Promise((resolve) => setTimeout(resolve, 0));

/** La fila guardada, vista como la ve el resolver público. */
const comoCache = (fila: Record<string, any> | null) =>
  fila as {
    status?: string;
    payload?: unknown;
    updatedAt?: number;
    chartRevision?: string;
    cacheVersion?: string;
    claimSeq?: number;
  } | null;

// ---------------------------------------------------------------------------
// La revisión es la identidad del PAYLOAD, no la de la fila
// ---------------------------------------------------------------------------

test("la revisión cambia cuando cambia el payload, y sólo entonces", () => {
  assert.equal(natalPayloadRevision(cartaParcial()), natalPayloadRevision(cartaParcial()));
  assert.notEqual(natalPayloadRevision(cartaParcial()), natalPayloadRevision(cartaCompleta()));
  // El orden de las claves no es parte del dato.
  assert.equal(
    natalPayloadRevision({ a: 1, b: 2 }),
    natalPayloadRevision({ b: 2, a: 1 }),
    "el hash es estable, no depende del orden de serialización"
  );
  assert.equal(natalPayloadRevision(null), natalPayloadRevision(undefined));
});

test("una fila sin revisión —o sin versión— no puede demostrar nada", () => {
  const rev = natalPayloadRevision(cartaCompleta());
  assert.equal(natalStampMatches(rev, rev), true);
  assert.equal(natalStampMatches(undefined, rev), false, "fila legada: no verificada");
  assert.equal(natalStampMatches("", rev), false);
  assert.equal(natalStampMatches(rev, undefined), false);

  const lista = { status: "ready", payload: texto("x") };
  assert.equal(natalReadingIsVerified(lista, esperado(rev)), false, "sin ninguna marca");
  assert.equal(
    natalReadingIsVerified({ ...lista, chartRevision: rev }, esperado(rev)),
    false,
    "con la revisión pero sin la versión, tampoco"
  );
  assert.equal(
    natalReadingIsVerified({ ...lista, cacheVersion: VERSION_VIGENTE }, esperado(rev)),
    false,
    "y con la versión pero sin la revisión, menos"
  );
  assert.equal(
    natalReadingIsVerified(
      { ...lista, chartRevision: rev, cacheVersion: VERSION_VIGENTE },
      esperado(rev)
    ),
    true,
    "las dos marcas, y recién ahí"
  );
});

// ---------------------------------------------------------------------------
// Lectura pública: una fila de otra revisión no es cache hit de nada
// ---------------------------------------------------------------------------

test("una lectura ready de la carta parcial deja de leerse cuando la carta mejora", () => {
  const revParcial = natalPayloadRevision(cartaParcial());
  const revCompleta = natalPayloadRevision(cartaCompleta());
  const fila = {
    status: "ready",
    payload: texto("escrito-sobre-la-parcial"),
    updatedAt: 1000,
    chartRevision: revParcial,
    cacheVersion: VERSION_VIGENTE
  };

  // Mientras la carta sigue siendo la parcial, se publica y no se regenera.
  assert.deepEqual(resolveReadyPersonalityReading(fila, esperado(revParcial)), fila.payload);
  assert.equal(resolveNatalReadingPublicStatus(fila, 2000, esperado(revParcial)), "ready");
  assert.equal(resolveNatalGenerationClaim(fila, 2000, esperado(revParcial)), "ready");

  // Instalada la geometría completa sobre el MISMO `natalChartId`, ese texto ya
  // no describe lo que la pantalla muestra.
  assert.equal(resolveReadyPersonalityReading(fila, esperado(revCompleta)), null, "no se publica");
  assert.equal(
    resolveNatalReadingPublicStatus(fila, 2000, esperado(revCompleta)),
    "pending",
    "no es `error`: lo que corresponde es regenerarla"
  );
  assert.equal(
    resolveNatalGenerationClaim(fila, 2000, esperado(revCompleta)),
    "claim",
    "y se puede regenerar"
  );
});

test("una fila legada sin revisión se regenera en vez de publicarse", () => {
  const rev = natalPayloadRevision(cartaCompleta());
  const legada = { status: "ready", payload: texto("legada"), updatedAt: 1000, cacheVersion: VERSION_VIGENTE };
  assert.equal(resolveReadyPersonalityReading(legada, esperado(rev)), null);
  assert.equal(resolveNatalReadingPublicStatus(legada, 2000, esperado(rev)), "pending");
  assert.equal(resolveNatalGenerationClaim(legada, 2000, esperado(rev)), "claim");
});

test("un pending vivo de OTRA revisión no frena la generación de la vigente", () => {
  const revParcial = natalPayloadRevision(cartaParcial());
  const revCompleta = natalPayloadRevision(cartaCompleta());
  const pendiente = {
    status: "pending",
    payload: null,
    updatedAt: 1000,
    chartRevision: revParcial,
    cacheVersion: VERSION_VIGENTE
  };
  assert.equal(
    resolveNatalGenerationClaim(pendiente, 1500, esperado(revParcial)),
    "pending",
    "el lease vale para SU carta"
  );
  assert.equal(
    resolveNatalGenerationClaim(pendiente, 1500, esperado(revCompleta)),
    "claim",
    "no para la nueva"
  );
});

// ---------------------------------------------------------------------------
// El CAS, como tabla
// ---------------------------------------------------------------------------

test("el CAS exige las tres cosas: misma revisión, mismo claim y misma versión", () => {
  const base = {
    currentChartRevision: "rev-1",
    generatedForRevision: "rev-1",
    currentClaimSeq: 2,
    ownedClaimSeq: 2,
    currentCacheVersion: "v2",
    generatedForCacheVersion: "v2"
  };
  assert.deepEqual(resolveNatalReadingWrite(base), { applied: true });
  assert.deepEqual(resolveNatalReadingWrite({ ...base, currentChartRevision: "rev-2" }), {
    applied: false,
    reason: "chart_revision_changed"
  });
  assert.deepEqual(resolveNatalReadingWrite({ ...base, currentClaimSeq: 3 }), {
    applied: false,
    reason: "claim_lost"
  });
  assert.deepEqual(resolveNatalReadingWrite({ ...base, currentClaimSeq: null }), {
    applied: false,
    reason: "claim_lost"
  });
  assert.deepEqual(resolveNatalReadingWrite({ ...base, currentChartRevision: null }), {
    applied: false,
    reason: "chart_revision_changed"
  });
  // Y la tercera: una generación que arrancó en la versión anterior no publica
  // después del bump. `currentCacheVersion` es la que la configuración pide
  // AHORA, no la que la fila declara.
  assert.deepEqual(resolveNatalReadingWrite({ ...base, generatedForCacheVersion: "v1" }), {
    applied: false,
    reason: "cache_version_changed"
  });
  assert.deepEqual(resolveNatalReadingWrite({ ...base, currentCacheVersion: null }), {
    applied: false,
    reason: "cache_version_changed"
  });
});

// ---------------------------------------------------------------------------
// La carrera real, contra la base y con el generador bajo control
// ---------------------------------------------------------------------------

type Diferido = { resolver: (payload: unknown | null) => void };

function escenario() {
  const memoria = createMemoryDb();
  const userId = memoria.seed("users", { tokenIdentifier: "t", clerkUserId: "c", createdAt: 1, updatedAt: 1 });
  const birthDataId = memoria.seed("birthData", { userId, createdAt: 1, updatedAt: 1 });
  const natalChartId = memoria.seed("natalCharts", {
    userId,
    birthDataId,
    calculationVersion: "v1",
    payload: cartaParcial(),
    createdAt: 1,
    updatedAt: 1
  });

  const pendientes: Diferido[] = [];
  const ctx: any = {
    db: memoria.db,
    runMutation: async (ref: unknown, args: any) => {
      const nombre = getFunctionName(ref as any);
      if (nombre.endsWith("claimNatalReadingGeneration")) return await applyNatalReadingClaim(ctx, args);
      if (nombre.endsWith("persistNatalReading")) return await applyNatalReadingWrite(ctx, args);
      throw new Error(`mutación inesperada: ${nombre}`);
    }
  };

  /** El generador suspendido: la prueba decide cuándo y con qué responde. */
  const generador = ((_args: { chartPayload: unknown }) =>
    new Promise((resolve) => {
      pendientes.push({
        resolver: (payload) =>
          resolve(
            payload
              ? { status: "success", payload, provider: "vercel-ai-gateway", model: "m", promptVersion: "p", cacheVersion: "c" }
              : { status: "error", gaps: [], warnings: [], provider: "vercel-ai-gateway", model: "m", promptVersion: "p", cacheVersion: "c" }
          )
      });
    })) as any;

  return {
    ctx,
    memoria,
    userId,
    natalChartId,
    pendientes,
    generador,
    /** Instala la carta completa sobre el MISMO id: la mejora real. */
    mejorarCarta: async () => {
      await memoria.db.patch(natalChartId, { payload: cartaCompleta(), updatedAt: 2 });
    },
    estado: (payload: unknown) => ({
      userId,
      chartId: natalChartId,
      chartPayload: payload,
      chartRevision: natalPayloadRevision(payload)
    }),
    get lectura() {
      return memoria.rows("natalInterpretations")[0] ?? null;
    }
  };
}

test("una generación suspendida sobre la carta parcial NO persiste después de la mejora", async () => {
  const s = escenario();

  const corrida = generateAndPersistNatalReading(s.ctx, s.estado(cartaParcial()), "client", s.generador);
  await cede();
  assert.equal(s.pendientes.length, 1, "el generador está en vuelo");
  assert.equal(s.lectura?.status, "pending", "el claim ya quedó tomado");
  const claimTomado = s.lectura?.claimSeq;

  // La carta mejora mientras el texto se escribe.
  await s.mejorarCarta();

  // Y recién ahí la generación vieja vuelve, con su texto de la carta parcial.
  s.pendientes[0].resolver(texto("texto-de-la-parcial"));
  const salida: any = await corrida;

  assert.equal(salida.status, "superseded", "no se cuenta como generada");
  assert.equal(salida.reason, "chart_revision_changed");
  assert.equal(s.lectura?.status, "pending", "no escribió nada encima del estado nuevo");
  assert.equal(s.lectura?.payload, null);
  assert.equal(s.lectura?.claimSeq, claimTomado, "y no tocó el turno");
  // Y la lectura pública no publica ese texto: ni siquiera llegó a la fila.
  assert.equal(
    resolveReadyPersonalityReading(comoCache(s.lectura), esperado(natalPayloadRevision(cartaCompleta()))),
    null
  );
});

test("un fallo tardío de una generación vieja tampoco marca error sobre el estado nuevo", async () => {
  const s = escenario();
  const corrida = generateAndPersistNatalReading(s.ctx, s.estado(cartaParcial()), "prewarm", s.generador);
  await cede();
  await s.mejorarCarta();
  s.pendientes[0].resolver(null);

  const salida: any = await corrida;
  assert.equal(salida.status, "superseded", "un fallo que ya no describe nada no se informa como fallo");
  assert.equal(s.lectura?.status, "pending", "la fila no queda marcada en error por una corrida vieja");
});

test("un claim que perdió el lease no puede pisar la lectura del claim nuevo", async () => {
  const s = escenario();
  const revision = natalPayloadRevision(cartaParcial());
  const comun = {
    userId: s.userId,
    natalChartId: s.natalChartId,
    locale: "es-AR",
    promptVersion: PROMPT_VERSION,
    cacheVersion: VERSION_VIGENTE,
    chartRevision: revision
  };

  const primero = await applyNatalReadingClaim(s.ctx, comun);
  assert.equal(primero.decision, "claimed");
  const seqViejo = (primero as any).claimSeq;

  // El lease vence y otra generación toma el turno.
  await s.memoria.db.patch(s.lectura!._id, { updatedAt: Date.now() - 10 * 60 * 1000 });
  const segundo = await applyNatalReadingClaim(s.ctx, comun);
  assert.equal(segundo.decision, "claimed", "un pending vencido se puede retomar");
  const seqNuevo = (segundo as any).claimSeq;
  assert.equal(seqNuevo, seqViejo + 1, "el turno es monótono");

  // El claim NUEVO escribe.
  const escrituraNueva = await applyNatalReadingWrite(s.ctx, {
    ...comun,
    status: "ready",
    payload: texto("del-claim-nuevo"),
    claimSeq: seqNuevo
  });
  assert.deepEqual((escrituraNueva as any).applied, true);
  assert.equal((s.lectura?.payload as any).headline, "del-claim-nuevo");

  // Y el viejo vuelve tarde: no puede pisarla.
  const escrituraVieja = await applyNatalReadingWrite(s.ctx, {
    ...comun,
    status: "ready",
    payload: texto("del-claim-viejo"),
    claimSeq: seqViejo
  });
  assert.deepEqual(escrituraVieja, { applied: false, reason: "claim_lost" });
  assert.equal((s.lectura?.payload as any).headline, "del-claim-nuevo", "la lectura vigente queda intacta");
  assert.equal(s.lectura?.claimSeq, seqNuevo);
});

test("una lectura generada con la revisión vigente SÍ se reutiliza y no se regenera", async () => {
  const s = escenario();
  const corrida = generateAndPersistNatalReading(s.ctx, s.estado(cartaParcial()), "client", s.generador);
  await cede();
  s.pendientes[0].resolver(texto("de-la-carta-vigente"));
  const salida: any = await corrida;

  assert.equal(salida.status, "generated");
  assert.equal(s.lectura?.status, "ready");
  assert.equal(s.lectura?.chartRevision, natalPayloadRevision(cartaParcial()));
  assert.deepEqual(
    resolveReadyPersonalityReading(comoCache(s.lectura), esperado(natalPayloadRevision(cartaParcial()))),
    texto("de-la-carta-vigente"),
    "se publica"
  );

  // Y un segundo pedido no vuelve a generar: es cache hit verificado.
  const segunda: any = await generateAndPersistNatalReading(
    s.ctx,
    s.estado(cartaParcial()),
    "prewarm",
    s.generador
  );
  assert.equal(segunda.status, "ready", "cache hit");
  assert.equal(s.pendientes.length, 1, "el generador no se volvió a llamar");
});

test("después de la mejora, la lectura se regenera y queda atada a la revisión nueva", async () => {
  const s = escenario();
  const primera = generateAndPersistNatalReading(s.ctx, s.estado(cartaParcial()), "client", s.generador);
  await cede();
  s.pendientes[0].resolver(texto("de-la-parcial"));
  await primera;

  await s.mejorarCarta();
  const revCompleta = natalPayloadRevision(cartaCompleta());
  // La fila `ready` de la carta parcial ya no publica ni frena.
  assert.equal(resolveReadyPersonalityReading(comoCache(s.lectura), esperado(revCompleta)), null);

  const segunda = generateAndPersistNatalReading(s.ctx, s.estado(cartaCompleta()), "client", s.generador);
  await cede();
  assert.equal(s.pendientes.length, 2, "se regeneró de verdad");
  s.pendientes[1].resolver(texto("de-la-completa"));
  const salida: any = await segunda;

  assert.equal(salida.status, "generated");
  assert.equal(s.lectura?.chartRevision, revCompleta);
  assert.deepEqual(
    resolveReadyPersonalityReading(comoCache(s.lectura), esperado(revCompleta)),
    texto("de-la-completa")
  );
  assert.equal(s.memoria.rows("natalInterpretations").length, 1, "sigue siendo una sola fila por carta");
});

test("el claim se rechaza si la carta ya cambió antes de tomarlo", async () => {
  const s = escenario();
  await s.mejorarCarta();
  const claim = await applyNatalReadingClaim(s.ctx, {
    userId: s.userId,
    natalChartId: s.natalChartId,
    locale: "es-AR",
    promptVersion: PROMPT_VERSION,
    cacheVersion: VERSION_VIGENTE,
    chartRevision: natalPayloadRevision(cartaParcial())
  });
  assert.deepEqual(claim, { decision: "stale_chart" });
  assert.equal(s.memoria.rows("natalInterpretations").length, 0, "no se crea una fila para una carta que ya no está");
});

// ---------------------------------------------------------------------------
// La versión de caché INVALIDA de verdad (P2-A del décimo pase)
//
// El defecto: `ORBITA_LLM_NATAL_CACHE_VERSION` se persistía en cada fila y no la
// miraba nadie. La lectura pública, el estado y el claim validaban sólo
// `chartRevision`, así que un bump v1 → v2 con el mismo prompt y la misma carta
// dejaba la fila v1 `ready` para siempre: la palanca que existe para retirar
// texto generado no retiraba nada.
// ---------------------------------------------------------------------------

/** Fija la versión de caché configurada y devuelve cómo restaurarla. */
function usarVersionDeCache(version: string): () => void {
  const anterior = process.env.ORBITA_LLM_NATAL_CACHE_VERSION;
  process.env.ORBITA_LLM_NATAL_CACHE_VERSION = version;
  return () => {
    if (anterior === undefined) delete process.env.ORBITA_LLM_NATAL_CACHE_VERSION;
    else process.env.ORBITA_LLM_NATAL_CACHE_VERSION = anterior;
  };
}

test("misma revisión y bump de versión: la fila v1 deja de publicarse, se toma un claim nuevo y v2 la reemplaza", async () => {
  const s = escenario();
  const rev = natalPayloadRevision(cartaParcial());
  const restaurar = usarVersionDeCache("natal-v1");
  try {
    // v1: se genera y se publica, exactamente como antes.
    const corrida = generateAndPersistNatalReading(s.ctx, s.estado(cartaParcial()), "client", s.generador);
    await cede();
    const claimV1 = s.lectura?.claimSeq as number;
    s.pendientes[0].resolver(texto("texto-v1"));
    assert.equal(((await corrida) as any).status, "generated");
    assert.equal(s.lectura?.status, "ready");
    assert.equal(s.lectura?.cacheVersion, "natal-v1", "la fila declara la versión con la que se generó");
    assert.deepEqual(
      resolveReadyPersonalityReading(comoCache(s.lectura), esperado(rev, "natal-v1")),
      texto("texto-v1"),
      "con la misma versión es cache hit"
    );

    // El bump. La carta NO cambió: misma revisión, mismo prompt.
    process.env.ORBITA_LLM_NATAL_CACHE_VERSION = "natal-v2";
    assert.equal(s.lectura?.chartRevision, rev, "la revisión de la carta es la misma");
    assert.equal(
      resolveNatalReadingPublicStatus(comoCache(s.lectura), 2000, esperado(rev, "natal-v2")),
      "pending",
      "el estado público deja de decir `ready`: lo que corresponde es regenerarla"
    );
    assert.equal(
      resolveReadyPersonalityReading(comoCache(s.lectura), esperado(rev, "natal-v2")),
      null,
      "y no se publica el texto de la versión retirada"
    );
    assert.equal(
      resolveNatalGenerationClaim(comoCache(s.lectura), 2000, esperado(rev, "natal-v2")),
      "claim",
      "una fila `ready` de otra versión no frena la generación nueva"
    );

    const segunda = generateAndPersistNatalReading(s.ctx, s.estado(cartaParcial()), "prewarm", s.generador);
    await cede();
    assert.equal(s.pendientes.length, 2, "se regeneró de verdad");
    assert.equal(s.lectura?.status, "pending", "el claim nuevo tomó la MISMA fila");
    assert.equal(s.lectura?.cacheVersion, "natal-v2");
    assert.equal(s.lectura?.claimSeq, claimV1 + 1, "turno nuevo y monótono");

    s.pendientes[1].resolver(texto("texto-v2"));
    assert.equal(((await segunda) as any).status, "generated");
    assert.equal(s.lectura?.status, "ready");
    assert.deepEqual(
      resolveReadyPersonalityReading(comoCache(s.lectura), esperado(rev, "natal-v2")),
      texto("texto-v2"),
      "la versión vigente sí se publica"
    );
    assert.equal(s.memoria.rows("natalInterpretations").length, 1, "sigue siendo una sola fila");
  } finally {
    restaurar();
  }
});

test("una generación que arrancó en v1 y vuelve después del bump no publica v1", async () => {
  const s = escenario();
  const rev = natalPayloadRevision(cartaParcial());
  const restaurar = usarVersionDeCache("natal-v1");
  try {
    const corrida = generateAndPersistNatalReading(s.ctx, s.estado(cartaParcial()), "client", s.generador);
    await cede();
    assert.equal(s.lectura?.cacheVersion, "natal-v1", "el claim quedó tomado para v1");
    // La barrera de versión del claim NO estorba a quien llega en la versión
    // vigente: v1 era la configurada cuando este turno se pidió.
    assert.equal(s.lectura?.claimSeq, 1, "el turno se tomó de verdad");
    assert.equal(s.lectura?.status, "pending");

    // El bump ocurre mientras el generador todavía escribe.
    process.env.ORBITA_LLM_NATAL_CACHE_VERSION = "natal-v2";
    s.pendientes[0].resolver(texto("texto-v1-tardio"));
    const salida: any = await corrida;

    assert.equal(salida.status, "superseded", "no se cuenta como generada");
    assert.equal(salida.reason, "cache_version_changed");
    assert.equal(s.lectura?.status, "pending", "no dejó v1 como estado vigente");
    assert.equal(s.lectura?.payload, null);
    assert.equal(
      resolveNatalGenerationClaim(comoCache(s.lectura), Date.now(), esperado(rev, "natal-v2")),
      "claim",
      "y la fila queda lista para que v2 la regenere: no hay bloqueo"
    );
  } finally {
    restaurar();
  }
});

test("un fallo tardío de una generación de otra versión tampoco marca error", async () => {
  const s = escenario();
  const restaurar = usarVersionDeCache("natal-v1");
  try {
    const corrida = generateAndPersistNatalReading(s.ctx, s.estado(cartaParcial()), "prewarm", s.generador);
    await cede();
    process.env.ORBITA_LLM_NATAL_CACHE_VERSION = "natal-v2";
    s.pendientes[0].resolver(null);
    const salida: any = await corrida;

    assert.equal(salida.status, "superseded");
    assert.equal(salida.reason, "cache_version_changed");
    assert.equal(s.lectura?.status, "pending", "la fila no queda en error por una versión retirada");
  } finally {
    restaurar();
  }
});

// ---------------------------------------------------------------------------
// La barrera de versión del CLAIM (P1-A del undécimo pase)
//
// El CAS final compara la versión configurada con la del texto, pero llega
// tarde: el claim se tomaba ANTES, midiendo la fila contra la versión que traía
// el claimant. Un claimant de v1 atrasado —su action arrancó antes del bump—
// veía una fila v2 como "de otra versión", la tomaba, incrementaba `claimSeq` y
// la dejaba `pending` v1 con el payload en null. Dos desenlaces reproducidos:
// una generación v2 en vuelo perdía su claim para nada, y una lectura v2 `ready`
// se destruía. La barrera está ahora antes de leer o escribir la fila.
// ---------------------------------------------------------------------------

/** El claimant atrasado: pide el turno con la versión que leyó su action. */
const claimCon = async (s: ReturnType<typeof escenario>, cacheVersion: string, payload: unknown) =>
  await applyNatalReadingClaim(s.ctx, {
    userId: s.userId,
    natalChartId: s.natalChartId,
    locale: "es-AR",
    promptVersion: PROMPT_VERSION,
    cacheVersion,
    chartRevision: natalPayloadRevision(payload)
  });

test("v2 en vuelo + claimant v1 tardío: el claim de v2 sigue siendo el dueño y llega a publicar", async () => {
  const s = escenario();
  const rev = natalPayloadRevision(cartaParcial());
  const restaurar = usarVersionDeCache("natal-v2");
  try {
    // v2 arranca y toma el turno.
    const corrida = generateAndPersistNatalReading(s.ctx, s.estado(cartaParcial()), "client", s.generador);
    await cede();
    const filaAntes = { ...(s.lectura as Record<string, any>) };
    assert.equal(filaAntes.status, "pending");
    assert.equal(filaAntes.cacheVersion, "natal-v2");
    assert.equal(filaAntes.claimSeq, 1);

    // Y llega el claimant atrasado, que todavía cree que la versión es v1.
    const tardio = await claimCon(s, "natal-v1", cartaParcial());
    assert.deepEqual(tardio, { decision: "stale_cache_version" }, "no toma el turno");
    assert.deepEqual({ ...(s.lectura as Record<string, any>) }, filaAntes, "y no tocó un solo campo");

    // v2 termina y publica, porque nadie le sacó el claim.
    s.pendientes[0].resolver(texto("texto-v2"));
    const salida: any = await corrida;
    assert.equal(salida.status, "generated");
    assert.equal(s.lectura?.status, "ready");
    assert.equal(s.lectura?.cacheVersion, "natal-v2");
    assert.equal(s.lectura?.claimSeq, 1, "el turno nunca se movió");
    assert.deepEqual(
      resolveReadyPersonalityReading(comoCache(s.lectura), esperado(rev, "natal-v2")),
      texto("texto-v2")
    );
    assert.equal(s.pendientes.length, 1, "el claimant viejo no programó ninguna generación");
  } finally {
    restaurar();
  }
});

test("v2 ready + claimant v1: la fila queda byte por byte como estaba", async () => {
  const s = escenario();
  const rev = natalPayloadRevision(cartaParcial());
  const restaurar = usarVersionDeCache("natal-v2");
  try {
    const corrida = generateAndPersistNatalReading(s.ctx, s.estado(cartaParcial()), "prewarm", s.generador);
    await cede();
    s.pendientes[0].resolver(texto("texto-v2"));
    assert.equal(((await corrida) as any).status, "generated");
    const filaReady = { ...(s.lectura as Record<string, any>) };
    assert.equal(filaReady.status, "ready");

    const tardio = await claimCon(s, "natal-v1", cartaParcial());
    assert.deepEqual(tardio, { decision: "stale_cache_version" });
    assert.deepEqual({ ...(s.lectura as Record<string, any>) }, filaReady, "la lectura vigente sobrevive entera");
    assert.deepEqual(
      resolveReadyPersonalityReading(comoCache(s.lectura), esperado(rev, "natal-v2")),
      texto("texto-v2"),
      "y se sigue publicando"
    );
    assert.equal(s.memoria.rows("natalInterpretations").length, 1);
  } finally {
    restaurar();
  }
});

test("la corrida entera de un claimant atrasado es un no-op: ni error, ni cache hit, ni fila tocada", async () => {
  const s = escenario();
  const restaurar = usarVersionDeCache("natal-v1");
  let abrirPuerta: () => void = () => undefined;
  const puerta = new Promise<void>((resolve) => {
    abrirPuerta = resolve;
  });
  // El mismo ctx, con el despacho del claim demorado: así la action de v1
  // arranca leyendo v1 y aterriza en la mutación cuando ya rige v2.
  const ctxDemorado: any = {
    db: s.ctx.db,
    runMutation: async (ref: unknown, args: any) => {
      if (getFunctionName(ref as any).endsWith("claimNatalReadingGeneration")) await puerta;
      return await s.ctx.runMutation(ref, args);
    }
  };
  // El generador de la corrida atrasada responde SOLO: sin la barrera, la
  // corrida sigue hasta el final y el defecto se ve entero —fila destruida y
  // escritura rechazada— en vez de quedar colgada esperando a la prueba.
  let generacionesAtrasadas = 0;
  const generadorAtrasado = (async () => {
    generacionesAtrasadas += 1;
    return {
      status: "success",
      payload: texto("texto-v1-atrasado"),
      provider: "vercel-ai-gateway",
      model: "m",
      promptVersion: "p",
      cacheVersion: "c"
    };
  }) as any;
  try {
    const atrasada = generateAndPersistNatalReading(
      ctxDemorado,
      s.estado(cartaParcial()),
      "prewarm",
      generadorAtrasado
    );
    await cede();
    assert.equal(s.lectura, null, "todavía no hay fila: el claim no salió");

    // El bump, y una generación v2 completa mientras la vieja espera la puerta.
    process.env.ORBITA_LLM_NATAL_CACHE_VERSION = "natal-v2";
    const vigente = generateAndPersistNatalReading(s.ctx, s.estado(cartaParcial()), "client", s.generador);
    await cede();
    s.pendientes[0].resolver(texto("texto-v2"));
    assert.equal(((await vigente) as any).status, "generated");
    const filaReady = { ...(s.lectura as Record<string, any>) };

    // Recién ahora aterriza el claim de v1.
    abrirPuerta();
    const salida: any = await atrasada;
    assert.equal(salida.status, "stale_cache_version", "desenlace interno, estable y cerrado");
    assert.notEqual(salida.status, "ready", "no se cuenta como cache hit");
    assert.deepEqual({ ...(s.lectura as Record<string, any>) }, filaReady, "y la fila quedó intacta");
    assert.equal(generacionesAtrasadas, 0, "ni siquiera programó una generación");
    assert.equal(s.pendientes.length, 1, "el único generador que corrió fue el de la versión vigente");
  } finally {
    restaurar();
  }
});

test("el claimant de la versión vigente conserva el flujo entero: toma, reutiliza y espera", async () => {
  const s = escenario();
  const restaurar = usarVersionDeCache("natal-v2");
  try {
    // Fila nueva: toma el turno.
    const primero = await claimCon(s, "natal-v2", cartaParcial());
    assert.deepEqual(primero, { decision: "claimed", claimSeq: 1 });
    assert.equal(s.lectura?.status, "pending");

    // Con el lease vivo, el segundo espera en vez de duplicar la generación.
    assert.deepEqual(await claimCon(s, "natal-v2", cartaParcial()), { decision: "pending" });
    assert.equal(s.lectura?.claimSeq, 1, "y no movió el turno");

    // Publicada la lectura, el claim siguiente es un cache hit.
    const escrito = await applyNatalReadingWrite(s.ctx, {
      userId: s.userId,
      natalChartId: s.natalChartId,
      locale: "es-AR",
      promptVersion: PROMPT_VERSION,
      cacheVersion: "natal-v2",
      status: "ready",
      payload: texto("texto-v2"),
      chartRevision: natalPayloadRevision(cartaParcial()),
      claimSeq: 1
    });
    assert.equal(escrito.applied, true);
    assert.deepEqual(await claimCon(s, "natal-v2", cartaParcial()), { decision: "ready" });

    // Y la carta que cambió sigue siendo `stale_chart`, no una versión vieja.
    assert.deepEqual(await claimCon(s, "natal-v2", cartaCompleta()), { decision: "stale_chart" });
    assert.equal(s.memoria.rows("natalInterpretations").length, 1);
  } finally {
    restaurar();
  }
});
