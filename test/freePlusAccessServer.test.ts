/**
 * La regla Free/Plus de la app nativa, aplicada en el SERVIDOR (CORE-1043).
 *
 * Apple rechazó el binario por la norma 5.6: lo que la app abre no puede
 * depender de quién la mira. La regla pasó a ser UNA —la de la web— y a vivir
 * en el backend: las funciones `…WithAccess` deciden qué viaja, y una cuenta
 * Free no recibe contenido Plus aunque el cliente lo pida.
 *
 * Tres frentes:
 *
 * 1. **El corte, puro.** `layerBundleForPlan` y `relationshipComparisonForPlan`
 *    reciben el plan ya resuelto y deciden qué viaja. Se prueba que Free no
 *    recibe NI UN dato de Tránsitos ni de Tu momento, y que Plus recibe el
 *    sobre intacto.
 * 2. **Las funciones reales**, por `_handler` sobre una base en memoria, con el
 *    plan saliendo de una fila `subscriptions` de verdad: la misma cuenta se
 *    lee como Free, se le da Plus y se vuelve a leer.
 * 3. **La compatibilidad.** Las funciones sin sufijo —las que llaman el build
 *    40 y la web— siguen devolviendo exactamente lo mismo, sin corte.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  getForDate,
  getForDateWithAccess,
  getPlanAccess,
  getRefreshState,
  getTransitArcWithAccess,
  refreshForDateWithAccess,
  refreshTransitArcWithAccess,
} from "../convex/layers";
import type {
  AnalysisResult,
  LayerBundle,
  RelationshipComparisonResult,
} from "../convex/lib/layerContract";
import {
  FREE_HOY_TRANSIT_LIMIT,
  PLUS_REQUIRED_INPUT,
  PLUS_REQUIRED_LIMITATION,
  layerAccess,
  layerBundleForPlan,
  relationshipComparisonForPlan,
} from "../convex/lib/subscriptionAccess";
import { FREE_CONTACT_LIMIT, FREE_PERSON_LIMIT } from "../convex/lib/synastry";
import {
  getComparison,
  getComparisonRefreshState,
  getComparisonWithAccess,
  list,
  listWithAccess,
  refreshComparisonWithAccess,
  savePerson,
  savePersonWithAccess,
} from "../convex/relationships";
import { createMemoryDb, type MemoryDb } from "./convexMemoryDb";

const ROOT = process.cwd();
const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const HOUR_MS = 60 * 60 * 1000;
const OBSERVADO = 1_700_000_000_000;
const LEJOS = 4_102_444_800_000; // 2100-01-01: una suscripción que no vence durante la prueba.

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function sobre(analysisId: string, data: unknown, extra: Partial<AnalysisResult> = {}): any {
  return {
    analysisId,
    methodVersion: `metodo-${analysisId}`,
    providerVersion: "astrologyapi-planets-tropical-v1",
    inputHash: `hash-${analysisId}`,
    status: data ? "ready" : "unavailable",
    precision: data ? "exact" : "not_applicable",
    observedAt: OBSERVADO,
    validUntil: OBSERVADO + HOUR_MS,
    data,
    missingInputs: [],
    limitations: data ? [`Limitación propia de ${analysisId}`] : [],
    elaboration: "direct",
    sourceRefs: [],
    ...extra,
  };
}

function itemDeRanking(indice: number) {
  const planetas = ["moon", "venus", "mars", "jupiter", "saturn"];
  return {
    arcId: `${planetas[indice]}-trine-sun`,
    transitPlanet: planetas[indice],
    natalPoint: "sun",
    aspect: "trine" as const,
    aspectDegrees: 120,
    orbDegrees: 0.5 + indice,
    state: "approaching" as const,
    exactAt: OBSERVADO + (indice + 1) * HOUR_MS,
    startsAt: OBSERVADO - 6 * HOUR_MS,
    endsAt: OBSERVADO + 12 * HOUR_MS,
    natalHouse: 6,
    reasons: [{ key: "exactness" as const, label: "Cercanía", explanation: "Dentro de orbe." }],
    summary: `CONTACTO-${indice + 1}`,
  };
}

function datosDeRanking(cantidad: number) {
  return {
    kind: "transit_ranking" as const,
    items: Array.from({ length: cantidad }, (_, indice) => itemDeRanking(indice)),
    activeCount: cantidad,
    calculatedAt: OBSERVADO,
    summary: `${cantidad} contactos activos hoy.`,
  };
}

function datosDeArco() {
  return {
    kind: "transit_arc" as const,
    arcId: "moon-trine-sun",
    transitPlanet: "moon",
    natalPoint: "sun",
    natalHouse: 6,
    aspect: "trine" as const,
    state: "approaching" as const,
    startsAt: OBSERVADO - 6 * HOUR_MS,
    peakAt: OBSERVADO + HOUR_MS,
    endsAt: OBSERVADO + 12 * HOUR_MS,
    progress: 0.4,
    passes: [{ exactAt: OBSERVADO + HOUR_MS, direction: "direct" as const, label: "PASADA-SECRETA" }],
    summary: "ARCO-SECRETO",
  };
}

function bundleCompleto(itemsDeRanking = 5): LayerBundle {
  return {
    natal: {
      lunarType: sobre("ORB-LUN-001", { kind: "lunar_type", marca: "TIPO-LUNAR" }),
      elementMap: sobre("ORB-NAT-001", { kind: "element_map", marca: "MAPA-ELEMENTAL" }),
      relationshipPattern: sobre("ORB-REL-001", { kind: "relationship_pattern", marca: "PATRON" }),
    },
    today: {
      transitRanking: sobre("ORB-TRN-002", datosDeRanking(itemsDeRanking)),
      transitArc: sobre("ORB-TRN-001", datosDeArco()),
      moonOnChart: sobre("ORB-LUN-003", { kind: "moon_on_chart", summary: "LUNA-DE-HOY" }),
      cumpleluna: sobre("ORB-LUN-002", { kind: "cumpleluna", marca: "CUMPLELUNA-DE-HOY" }),
    },
    moment: {
      progressedLunation: sobre("ORB-CYC-002", { kind: "progressed_lunation", marca: "ESTACION-SECRETA" }),
      annualProfection: sobre("ORB-CYC-001", { kind: "annual_profection", house: 6, marca: "ANIO-SECRETO" }),
      temporalMandala: sobre("ORB-CYC-007", { kind: "temporal_mandala", marca: "MANDALA-SECRETO" }),
    },
  } as unknown as LayerBundle;
}

/** Los contactos de una comparación: tres dimensiones, cinco contactos únicos. */
function comparacion(opciones: { conDetalle?: boolean; generalOnly?: boolean } = {}): RelationshipComparisonResult {
  const conDetalle = opciones.conDetalle ?? true;
  const contacto = (id: string, weight: number) => ({
    id,
    text: `ORACION-${id}`,
    quality: "support" as const,
    weight,
    precision: "exact" as const,
  });
  const dimension = (key: string, contactos: ReturnType<typeof contacto>[]) => ({
    key,
    label: key,
    value: 0.7,
    summary: `RESUMEN-${key}`,
    drivers: contactos.map((c) => c.text),
    ...(conDetalle ? { driverDetails: contactos } : {}),
    precision: "exact" as const,
  });
  return sobre("ORB-REL-003", {
    kind: "relationship_comparison",
    relationshipType: "friendship",
    requestedLevel: "date_to_date",
    resolvedLevel: opciones.generalOnly ? "sign_to_sign" : "date_to_date",
    dimensions: [
      // `c` pesa 3 acá y 9 en la dimensión siguiente: cuenta UNA vez, con 9.
      dimension("communication", [contacto("a", 8), contacto("b", 5), contacto("c", 3)]),
      dimension("affection", [contacto("c", 9), contacto("d", 2)]),
      dimension("desire", [contacto("e", 1)]),
    ],
    includedTechniques: [],
    omittedTechniques: [],
    summary: "RESUMEN-GENERAL",
    disclaimer: "Aviso",
    generalOnly: opciones.generalOnly ?? false,
  }) as RelationshipComparisonResult;
}

// --- Base en memoria --------------------------------------------------------

const TOKEN = "token-de-prueba";

type Cuenta = { base: MemoryDb; userId: string; ctx: any; darPlus: () => void };

function cuenta(): Cuenta {
  const base = createMemoryDb();
  const userId = base.seed("users", {
    tokenIdentifier: TOKEN,
    clerkUserId: "user_prueba",
    name: "Persona de prueba",
  });
  return {
    base,
    userId,
    ctx: {
      auth: { getUserIdentity: async () => ({ tokenIdentifier: TOKEN, subject: "user_prueba" }) },
      db: base.db,
    },
    // Una fila de Stripe: no tiene entornos, así que concede Plus sin depender
    // de qué `ORBITA_ENVIRONMENT` tenga el proceso que corre la suite.
    darPlus: () => {
      base.seed("subscriptions", {
        userId,
        clerkUserId: "user_prueba",
        provider: "stripe",
        entitlement: "orbita_pro",
        status: "active",
        currentPeriodEnd: LEJOS,
      });
    },
  };
}

const SIN_SESION = (base: MemoryDb) => ({ auth: { getUserIdentity: async () => null }, db: base.db });

// ---------------------------------------------------------------------------
// 1 · El corte de las capas, puro
// ---------------------------------------------------------------------------

describe("capas — qué abre cada plan", () => {
  it("`access` declara las tres secciones: Hoy siempre abierto, lo demás según el plan", () => {
    assert.deepEqual(layerAccess(false), { isPro: false, hoy: "open", transitos: "locked", momento: "locked" });
    assert.deepEqual(layerAccess(true), { isPro: true, hoy: "open", transitos: "open", momento: "open" });
  });

  it("Plus recibe el sobre intacto: la misma referencia, sin copia ni recorte", () => {
    const bundle = bundleCompleto();
    const resultado = layerBundleForPlan(bundle, true);
    assert.equal(resultado.bundle, bundle);
    assert.deepEqual(resultado.access, layerAccess(true));
    assert.equal(resultado.bundle.today.transitRanking.data?.items.length, 5);
  });

  it("Free recibe Hoy: Luna sobre la carta, Cumpleluna y los tres primeros del ranking", () => {
    const bundle = bundleCompleto();
    const { access, bundle: free } = layerBundleForPlan(bundle, false);
    assert.deepEqual(access, layerAccess(false));
    // Hoy viaja tal cual: los mismos sobres, no copias degradadas.
    assert.equal(free.today.moonOnChart, bundle.today.moonOnChart);
    assert.equal(free.today.cumpleluna, bundle.today.cumpleluna);
    const ranking = free.today.transitRanking;
    assert.equal(ranking.status, "ready");
    assert.equal(FREE_HOY_TRANSIT_LIMIT, 3);
    assert.deepEqual(
      ranking.data?.items.map((item) => item.summary),
      ["CONTACTO-1", "CONTACTO-2", "CONTACTO-3"],
      "los primeros, en el orden del backend",
    );
    // Los conteos no se recortan: Hoy puede decir cuántos hay en total.
    assert.equal(ranking.data?.activeCount, 5);
  });

  it("Free conserva las capas natales: no dependen del día y la regla no las cierra", () => {
    const bundle = bundleCompleto();
    const { bundle: free } = layerBundleForPlan(bundle, false);
    assert.equal(free.natal, bundle.natal);
  });

  it("Free NO recibe el arco ni ninguna capa de Tu momento: sobres cerrados, sin datos", () => {
    const { bundle: free } = layerBundleForPlan(bundleCompleto(), false);
    const cerrados = [
      free.today.transitArc,
      free.moment.progressedLunation,
      free.moment.annualProfection,
      free.moment.temporalMandala,
    ];
    for (const capa of cerrados) {
      assert.equal(capa.data, null, capa.analysisId);
      assert.equal(capa.status, "unavailable", capa.analysisId);
      assert.equal(capa.precision, "not_applicable", capa.analysisId);
      assert.deepEqual(capa.missingInputs, [PLUS_REQUIRED_INPUT], capa.analysisId);
      assert.deepEqual(capa.limitations, [PLUS_REQUIRED_LIMITATION], capa.analysisId);
      assert.equal(capa.validUntil, null, capa.analysisId);
      assert.equal("providerVersion" in capa, false, `${capa.analysisId}: ni la versión del proveedor`);
    }
    // La identidad del análisis sí viaja: el cliente sigue sabiendo qué capa es.
    assert.deepEqual(
      cerrados.map((capa) => capa.analysisId),
      ["ORB-TRN-001", "ORB-CYC-002", "ORB-CYC-001", "ORB-CYC-007"],
    );
    assert.equal(PLUS_REQUIRED_INPUT, "orbita_plus");
  });

  it("nada de lo cerrado aparece en lo que viaja a Free, ni siquiera como texto", () => {
    const serializado = JSON.stringify(layerBundleForPlan(bundleCompleto(), false));
    for (const marca of [
      "ARCO-SECRETO",
      "PASADA-SECRETA",
      "ESTACION-SECRETA",
      "ANIO-SECRETO",
      "MANDALA-SECRETO",
      "CONTACTO-4",
      "CONTACTO-5",
      "Limitación propia de ORB-TRN-001",
      "Limitación propia de ORB-CYC-001",
    ]) {
      assert.equal(serializado.includes(marca), false, `viajó «${marca}»`);
    }
    // Y lo abierto sí está.
    for (const marca of ["LUNA-DE-HOY", "CUMPLELUNA-DE-HOY", "CONTACTO-1", "TIPO-LUNAR", "PATRON"]) {
      assert.equal(serializado.includes(marca), true, `falta «${marca}»`);
    }
  });

  it("un ranking que ya entra en Hoy, o que no tiene dato, viaja sin tocar", () => {
    const corto = bundleCompleto(2);
    assert.equal(layerBundleForPlan(corto, false).bundle.today.transitRanking, corto.today.transitRanking);
    const vacio = bundleCompleto();
    (vacio.today as any).transitRanking = sobre("ORB-TRN-002", null, { missingInputs: ["current_ephemeris"] });
    const free = layerBundleForPlan(vacio, false).bundle.today.transitRanking;
    assert.equal(free, vacio.today.transitRanking);
    // El motivo real de la ausencia no se pisa con el del plan: Hoy es abierto.
    assert.deepEqual(free.missingInputs, ["current_ephemeris"]);
  });

  it("el corte no muta el sobre original: Plus lo vuelve a leer completo", () => {
    const bundle = bundleCompleto();
    layerBundleForPlan(bundle, false);
    assert.equal(bundle.today.transitRanking.data?.items.length, 5);
    assert.equal((bundle.today.transitArc.data as any)?.summary, "ARCO-SECRETO");
    assert.equal(bundle.moment.temporalMandala.status, "ready");
  });
});

// ---------------------------------------------------------------------------
// 2 · El corte de la comparación de Vínculos, puro
// ---------------------------------------------------------------------------

describe("Vínculos — tres contactos visibles en Free", () => {
  it("usa las constantes de la web: 3 contactos, 1 persona", () => {
    assert.equal(FREE_CONTACT_LIMIT, 3);
    assert.equal(FREE_PERSON_LIMIT, 1);
  });

  it("Plus recibe la comparación intacta y sin tope", () => {
    const original = comparacion();
    const resultado = relationshipComparisonForPlan(original, true);
    assert.equal(resultado.comparison, original);
    assert.deepEqual(resultado.access, { isPro: true, contactLimit: null });
    assert.equal(resultado.hiddenContacts, 0);
  });

  it("Free recibe los tres contactos que más pesan y la cuenta de los que faltan", () => {
    const resultado = relationshipComparisonForPlan(comparacion(), false);
    assert.deepEqual(resultado.access, { isPro: false, contactLimit: FREE_CONTACT_LIMIT });
    // Únicos: a(8) b(5) c(9, su peso más alto) d(2) e(1) → visibles c, a, b.
    assert.equal(resultado.hiddenContacts, 2);
    const dimensiones = resultado.comparison.data?.dimensions ?? [];
    assert.deepEqual(
      dimensiones.map((d) => d.driverDetails?.map((detalle) => detalle.id)),
      [["a", "b", "c"], ["c"], []],
    );
    // `drivers` y `driverDetails` cuentan la misma historia.
    assert.deepEqual(
      dimensiones.map((d) => d.drivers),
      [["ORACION-a", "ORACION-b", "ORACION-c"], ["ORACION-c"], []],
    );
  });

  it("Free no recibe la evidencia de los contactos ocultos, pero sí valores y resúmenes", () => {
    const resultado = relationshipComparisonForPlan(comparacion(), false);
    const serializado = JSON.stringify(resultado);
    assert.equal(serializado.includes("ORACION-d"), false);
    assert.equal(serializado.includes("ORACION-e"), false);
    // Igual que en la web, los conteos se calculan sobre la lista entera.
    const dimensiones = resultado.comparison.data?.dimensions ?? [];
    assert.deepEqual(dimensiones.map((d) => d.value), [0.7, 0.7, 0.7]);
    assert.deepEqual(
      dimensiones.map((d) => d.summary),
      ["RESUMEN-communication", "RESUMEN-affection", "RESUMEN-desire"],
    );
    assert.equal(resultado.comparison.data?.summary, "RESUMEN-GENERAL");
  });

  it("un sobre anterior a `driverDetails` se recorta por oración, en orden de aparición", () => {
    const resultado = relationshipComparisonForPlan(comparacion({ conDetalle: false }), false);
    assert.equal(resultado.hiddenContacts, 2);
    assert.deepEqual(
      resultado.comparison.data?.dimensions.map((d) => d.drivers),
      [["ORACION-a", "ORACION-b", "ORACION-c"], ["ORACION-c"], []],
    );
    assert.equal(
      resultado.comparison.data?.dimensions.some((d) => "driverDetails" in d),
      false,
      "no se inventa un detalle que el sobre no traía",
    );
  });

  it("la lectura sólo por signo no tiene contactos entre planetas: no se recorta", () => {
    const original = comparacion({ generalOnly: true });
    const resultado = relationshipComparisonForPlan(original, false);
    assert.equal(resultado.comparison, original);
    assert.equal(resultado.hiddenContacts, 0);
    assert.deepEqual(resultado.access, { isPro: false, contactLimit: FREE_CONTACT_LIMIT });
  });

  it("una comparación sin dato o con tres contactos o menos viaja sin tocar", () => {
    const sinDato = sobre("ORB-REL-003", null) as RelationshipComparisonResult;
    assert.equal(relationshipComparisonForPlan(sinDato, false).comparison, sinDato);
    const corta = comparacion();
    corta.data!.dimensions = corta.data!.dimensions.slice(0, 1);
    const resultado = relationshipComparisonForPlan(corta, false);
    assert.equal(resultado.comparison, corta);
    assert.equal(resultado.hiddenContacts, 0);
  });

  it("el recorte no muta la comparación guardada", () => {
    const original = comparacion();
    relationshipComparisonForPlan(original, false);
    assert.equal(original.data?.dimensions[2].drivers.length, 1);
    assert.equal(original.data?.dimensions[1].driverDetails?.length, 2);
  });
});

// ---------------------------------------------------------------------------
// 3 · Las funciones reales de capas, con el plan saliendo de `subscriptions`
// ---------------------------------------------------------------------------

const HOY = "2026-10-04";
const ZONA = "America/Argentina/Buenos_Aires";

function filaDeSnapshot(userId: string, resultado: any, diaria: boolean) {
  return {
    userId,
    cacheKey: `v492:${userId}:${resultado.analysisId}:${resultado.inputHash}`,
    ...(diaria ? { localDate: HOY, timezone: ZONA } : {}),
    ...resultado,
    createdAt: OBSERVADO,
    updatedAt: OBSERVADO,
  };
}

/**
 * Siembra ranking y arco con los hashes que el PROPIO backend publica: se le
 * pregunta al handler sin corte y se guarda una fila para cada sobre. Así la
 * prueba no copia la identidad de caché.
 */
async function sembrarDia(escenario: Cuenta, arcId?: string) {
  const vacio = await (getForDate as any)._handler(escenario.ctx, { localDate: HOY, timezone: ZONA });
  const vigente = { validUntil: null, missingInputs: [], limitations: [] };
  escenario.base.seed(
    "analysisSnapshotsV492",
    filaDeSnapshot(
      escenario.userId,
      {
        ...vacio.today.transitRanking,
        ...vigente,
        status: "ready",
        precision: "exact",
        data: datosDeRanking(5),
      },
      true,
    ),
  );
  escenario.base.seed(
    "analysisSnapshotsV492",
    filaDeSnapshot(
      escenario.userId,
      {
        ...vacio.today.transitArc,
        ...vigente,
        status: "ready",
        precision: "exact",
        data: datosDeArco(),
      },
      true,
    ),
  );
  if (arcId) {
    // El arco pedido por id tiene su propio alcance y su propio hash: se le
    // pregunta a la función de Plus cuál es.
    escenario.darPlus();
    const pedido = await (getTransitArcWithAccess as any)._handler(escenario.ctx, {
      localDate: HOY,
      timezone: ZONA,
      arcId,
    });
    escenario.base.seed(
      "analysisSnapshotsV492",
      filaDeSnapshot(
        escenario.userId,
        {
          ...pedido.arc,
          ...vigente,
          status: "ready",
          precision: "exact",
          data: { ...datosDeArco(), arcId },
        },
        true,
      ),
    );
  }
}

describe("layers.getForDateWithAccess — la misma cuenta, como Free y como Plus", () => {
  it("sin sesión responde `null`, igual que `getForDate`", async () => {
    const escenario = cuenta();
    const args = { localDate: HOY, timezone: ZONA };
    assert.equal(await (getForDateWithAccess as any)._handler(SIN_SESION(escenario.base), args), null);
    assert.equal(await (getForDate as any)._handler(SIN_SESION(escenario.base), args), null);
  });

  it("Free: Hoy abierto con tres contactos, arco y Tu momento cerrados", async () => {
    const escenario = cuenta();
    await sembrarDia(escenario);
    const resultado = await (getForDateWithAccess as any)._handler(escenario.ctx, {
      localDate: HOY,
      timezone: ZONA,
    });
    assert.deepEqual(resultado.access, { isPro: false, hoy: "open", transitos: "locked", momento: "locked" });
    assert.equal(resultado.bundle.today.transitRanking.data.items.length, 3);
    assert.equal(resultado.bundle.today.transitRanking.data.activeCount, 5);
    assert.equal(resultado.bundle.today.transitArc.data, null);
    assert.deepEqual(resultado.bundle.today.transitArc.missingInputs, ["orbita_plus"]);
    for (const capa of Object.values(resultado.bundle.moment) as AnalysisResult[]) {
      assert.equal(capa.data, null);
      assert.deepEqual(capa.missingInputs, ["orbita_plus"]);
    }
    assert.equal(JSON.stringify(resultado).includes("ARCO-SECRETO"), false);
  });

  it("Plus: el mismo día, completo", async () => {
    const escenario = cuenta();
    await sembrarDia(escenario);
    escenario.darPlus();
    const resultado = await (getForDateWithAccess as any)._handler(escenario.ctx, {
      localDate: HOY,
      timezone: ZONA,
    });
    assert.deepEqual(resultado.access, { isPro: true, hoy: "open", transitos: "open", momento: "open" });
    assert.equal(resultado.bundle.today.transitRanking.data.items.length, 5);
    assert.equal(resultado.bundle.today.transitArc.data.summary, "ARCO-SECRETO");
    assert.equal(resultado.bundle.today.transitArc.missingInputs.includes("orbita_plus"), false);
    for (const capa of Object.values(resultado.bundle.moment) as AnalysisResult[]) {
      assert.equal(capa.missingInputs.includes("orbita_plus"), false, capa.analysisId);
    }
  });

  it("para Plus, `bundle` es EXACTAMENTE lo que devuelve `getForDate`", async () => {
    const escenario = cuenta();
    await sembrarDia(escenario);
    escenario.darPlus();
    const args = { localDate: HOY, timezone: ZONA };
    const reloj = Date.now;
    Date.now = () => OBSERVADO + 1;
    try {
      const conAcceso = await (getForDateWithAccess as any)._handler(escenario.ctx, args);
      const legado = await (getForDate as any)._handler(escenario.ctx, args);
      assert.deepEqual(conAcceso.bundle, legado);
    } finally {
      Date.now = reloj;
    }
  });

  it("`getForDate` no cambió: una cuenta Free lo sigue leyendo completo (build 40)", async () => {
    const escenario = cuenta();
    await sembrarDia(escenario);
    const legado = await (getForDate as any)._handler(escenario.ctx, { localDate: HOY, timezone: ZONA });
    assert.deepEqual(Object.keys(legado), ["natal", "today", "moment"], "sin `access`: misma forma");
    assert.equal(legado.today.transitRanking.data.items.length, 5);
    assert.equal(legado.today.transitArc.data.summary, "ARCO-SECRETO");
  });

  it("los mismos argumentos se validan igual que en `getForDate`", async () => {
    const escenario = cuenta();
    await assert.rejects(
      (getForDateWithAccess as any)._handler(escenario.ctx, { localDate: "ayer", timezone: ZONA }),
      /localDate must be a real date/,
    );
  });
});

describe("layers.getTransitArcWithAccess — el detalle de un arco es Plus", () => {
  const args = { localDate: HOY, timezone: ZONA, arcId: "venus-trine-sun" };

  it("Free recibe `locked` sin el arco, aunque esté calculado y guardado", async () => {
    const escenario = cuenta();
    await sembrarDia(escenario, args.arcId);
    // `sembrarDia` dio Plus para averiguar el hash: se lo quita para leer como Free.
    for (const fila of escenario.base.rows("subscriptions")) await escenario.base.db.delete(fila._id);
    const resultado = await (getTransitArcWithAccess as any)._handler(escenario.ctx, args);
    assert.deepEqual(resultado, { status: "locked", access: { isPro: false } });
  });

  it("Plus recibe `ready` con el sobre ORB-TRN-001 del arco pedido", async () => {
    const escenario = cuenta();
    await sembrarDia(escenario, args.arcId);
    const resultado = await (getTransitArcWithAccess as any)._handler(escenario.ctx, args);
    assert.equal(resultado.status, "ready");
    assert.deepEqual(resultado.access, { isPro: true });
    assert.equal(resultado.arc.analysisId, "ORB-TRN-001");
    assert.equal(resultado.arc.data.arcId, args.arcId);
    assert.equal(resultado.arc.data.summary, "ARCO-SECRETO");
  });

  it("sin sesión responde `null`; con un `arcId` inválido rechaza antes de mirar el plan", async () => {
    const escenario = cuenta();
    assert.equal(await (getTransitArcWithAccess as any)._handler(SIN_SESION(escenario.base), args), null);
    await assert.rejects(
      (getTransitArcWithAccess as any)._handler(escenario.ctx, { ...args, arcId: "no es un id" }),
    );
  });
});

describe("layers.getPlanAccess — el plan para las actions", () => {
  it("resuelve el plan real de la cuenta y falla sin fila `users`", async () => {
    const escenario = cuenta();
    assert.deepEqual(await (getPlanAccess as any)._handler(escenario.ctx, { tokenIdentifier: TOKEN }), {
      isPro: false,
    });
    escenario.darPlus();
    assert.deepEqual(await (getPlanAccess as any)._handler(escenario.ctx, { tokenIdentifier: TOKEN }), {
      isPro: true,
    });
    await assert.rejects(
      (getPlanAccess as any)._handler(escenario.ctx, { tokenIdentifier: "otro-token" }),
      /User record not found/,
    );
  });
});

/** Un contexto de action que anota qué pidió y deja decidir cada respuesta. */
function ctxDeAction(responder: (indice: number, args: any) => unknown) {
  const consultas: any[] = [];
  const escrituras: any[] = [];
  return {
    consultas,
    escrituras,
    ctx: {
      auth: { getUserIdentity: async () => ({ tokenIdentifier: TOKEN }) },
      runQuery: async (_ref: unknown, args: any) => {
        consultas.push(args);
        return responder(consultas.length - 1, args);
      },
      runMutation: async (_ref: unknown, args: any) => {
        escrituras.push(args);
        return { written: 0 };
      },
    },
  };
}

function hoyEn(zona: string) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const leerParte = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${leerParte("year")}-${leerParte("month")}-${leerParte("day")}`;
}

describe("layers.refreshTransitArcWithAccess — Free no gasta ni una consulta", () => {
  const args = () => ({ localDate: hoyEn(ZONA), timezone: ZONA, arcId: "venus-trine-sun" });

  it("Free sale con `locked` después de leer SÓLO el plan: ni estado, ni cielo, ni escritura", async () => {
    const accion = ctxDeAction(() => ({ isPro: false }));
    const resultado = await (refreshTransitArcWithAccess as any)._handler(accion.ctx, args());
    assert.deepEqual(resultado, { status: "locked", access: { isPro: false } });
    assert.deepEqual(accion.consultas, [{ tokenIdentifier: TOKEN }]);
    assert.equal(accion.escrituras.length, 0);
  });

  it("Plus sigue de largo hacia el recálculo real", async () => {
    // La segunda lectura es el estado del refresh: que se pida prueba que el
    // corte dejó pasar a Plus hacia el mismo motor de `refreshTransitArc`.
    const accion = ctxDeAction((indice) => {
      if (indice === 0) return { isPro: true };
      throw new Error("ESTADO-DEL-REFRESH");
    });
    await assert.rejects(
      (refreshTransitArcWithAccess as any)._handler(accion.ctx, args()),
      /ESTADO-DEL-REFRESH/,
    );
    assert.equal(accion.consultas.length, 2);
    assert.equal(accion.consultas[1].localDate, args().localDate);
  });

  it("sin sesión falla cerrado, antes de leer el plan", async () => {
    const accion = ctxDeAction(() => ({ isPro: true }));
    accion.ctx.auth.getUserIdentity = async () => null as never;
    await assert.rejects(
      (refreshTransitArcWithAccess as any)._handler(accion.ctx, args()),
      /Authentication required/,
    );
    assert.equal(accion.consultas.length, 0);
  });
});

describe("layers.refreshForDateWithAccess — recalcula igual, devuelve según el plan", () => {
  /**
   * Corre la action REAL contra la base en memoria, sin proveedor configurado:
   * el recálculo termina con sus sobres honestos (sin cielo no hay ranking) y
   * lo que se mira acá es la forma de lo que devuelve y qué quedó cerrado.
   */
  async function refrescar(escenario: Cuenta) {
    const previoUsuario = process.env.ASTROLOGY_API_USER_ID;
    const previaClave = process.env.ASTROLOGY_API_KEY;
    delete process.env.ASTROLOGY_API_USER_ID;
    delete process.env.ASTROLOGY_API_KEY;
    const localDate = hoyEn(ZONA);
    // `getRefreshState` filtra el cielo guardado por zona con `.filter`, que la
    // base en memoria no implementa. No hay cielo sembrado, así que el filtro
    // no tiene nada que descartar: se acepta y se ignora.
    const conFiltro = {
      ...escenario.ctx,
      db: {
        ...escenario.base.db,
        query: (tabla: string) => {
          const cursor = escenario.base.db.query(tabla);
          cursor.filter = () => cursor;
          return cursor;
        },
      },
    };
    const accion = ctxDeAction((indice, args) =>
      indice === 0
        ? (getPlanAccess as any)._handler(escenario.ctx, args)
        : (getRefreshState as any)._handler(conFiltro, args),
    );
    try {
      const resultado = await (refreshForDateWithAccess as any)._handler(accion.ctx, {
        localDate,
        timezone: ZONA,
      });
      return { resultado, accion };
    } finally {
      if (previoUsuario !== undefined) process.env.ASTROLOGY_API_USER_ID = previoUsuario;
      if (previaClave !== undefined) process.env.ASTROLOGY_API_KEY = previaClave;
    }
  }

  it("Free: `{ access, bundle }` con Tránsitos y Tu momento cerrados por plan", async () => {
    const { resultado, accion } = await refrescar(cuenta());
    assert.deepEqual(Object.keys(resultado), ["access", "bundle"]);
    assert.deepEqual(resultado.access, { isPro: false, hoy: "open", transitos: "locked", momento: "locked" });
    assert.deepEqual(Object.keys(resultado.bundle), ["natal", "today", "moment"]);
    for (const capa of [resultado.bundle.today.transitArc, ...Object.values(resultado.bundle.moment)] as AnalysisResult[]) {
      assert.equal(capa.data, null, capa.analysisId);
      assert.deepEqual(capa.missingInputs, ["orbita_plus"], capa.analysisId);
    }
    // Hoy conserva su motivo real: no se disfraza de bloqueo por plan.
    assert.equal(resultado.bundle.today.moonOnChart.missingInputs.includes("orbita_plus"), false);
    assert.equal(resultado.bundle.today.transitRanking.missingInputs.includes("orbita_plus"), false);
    // El recálculo corrió y persistió igual que `refreshForDate`: el corte es
    // sobre lo que se DEVUELVE, y el cache queda listo si la cuenta pasa a Plus.
    assert.equal(accion.escrituras.length, 1);
    assert.equal(
      accion.escrituras[0].results.some((fila: AnalysisResult) => fila.missingInputs.includes("orbita_plus")),
      false,
      "lo persistido nunca lleva la marca del plan",
    );
  });

  it("Plus: el mismo recálculo, sin ninguna capa cerrada por plan", async () => {
    const escenario = cuenta();
    escenario.darPlus();
    const { resultado } = await refrescar(escenario);
    assert.deepEqual(resultado.access, { isPro: true, hoy: "open", transitos: "open", momento: "open" });
    const capas = [
      ...Object.values(resultado.bundle.today),
      ...Object.values(resultado.bundle.moment),
    ] as AnalysisResult[];
    assert.equal(capas.length, 7);
    for (const capa of capas) {
      assert.equal(capa.missingInputs.includes("orbita_plus"), false, capa.analysisId);
    }
  });

  it("sin sesión falla cerrado, antes de leer nada", async () => {
    const accion = ctxDeAction(() => ({ isPro: true }));
    accion.ctx.auth.getUserIdentity = async () => null as never;
    await assert.rejects(
      (refreshForDateWithAccess as any)._handler(accion.ctx, { localDate: hoyEn(ZONA), timezone: ZONA }),
      /Authentication required/,
    );
    assert.equal(accion.consultas.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 4 · Vínculos: cupo de personas y comparación
// ---------------------------------------------------------------------------

const persona = (nombre: string, clave: string) => ({
  idempotencyKey: clave,
  name: nombre,
  birthTimePrecision: "unknown" as const,
  zodiacSign: "tauro",
});

const guardar = (escenario: Cuenta, args: Record<string, unknown>) =>
  (savePersonWithAccess as any)._handler(escenario.ctx, args);

describe("relationships.listWithAccess — el cupo viaja con la lista", () => {
  it("sin sesión: lista vacía y el cupo de Free", async () => {
    const escenario = cuenta();
    assert.deepEqual(await (listWithAccess as any)._handler(SIN_SESION(escenario.base), {}), {
      profiles: [],
      access: { isPro: false, limit: 1, remaining: 1, atLimit: false },
    });
  });

  it("Free sin personas puede guardar una; con una, el cupo está lleno", async () => {
    const escenario = cuenta();
    let lista = await (listWithAccess as any)._handler(escenario.ctx, {});
    assert.deepEqual(lista.access, { isPro: false, limit: 1, remaining: 1, atLimit: false });
    await guardar(escenario, persona("Martina", "alta-1"));
    lista = await (listWithAccess as any)._handler(escenario.ctx, {});
    assert.equal(lista.profiles.length, 1);
    assert.deepEqual(lista.access, { isPro: false, limit: 1, remaining: 0, atLimit: true });
  });

  it("Free con MÁS de una persona ya guardada no pierde a nadie: las ve todas", async () => {
    const escenario = cuenta();
    // Personas de antes del tope (el build 40 no lo aplicaba) o de un período Plus.
    await (savePerson as any)._handler(escenario.ctx, persona("Martina", "alta-1"));
    await (savePerson as any)._handler(escenario.ctx, persona("Joaquín", "alta-2"));
    await (savePerson as any)._handler(escenario.ctx, persona("Lola", "alta-3"));
    const lista = await (listWithAccess as any)._handler(escenario.ctx, {});
    assert.deepEqual(
      lista.profiles.map((perfil: any) => perfil.name),
      ["Martina", "Joaquín", "Lola"],
    );
    assert.deepEqual(lista.access, { isPro: false, limit: 1, remaining: 0, atLimit: true });
    // Y son los mismos perfiles, en el mismo orden, que publica `list`.
    assert.deepEqual(lista.profiles, await (list as any)._handler(escenario.ctx, {}));
  });

  it("Plus no tiene tope", async () => {
    const escenario = cuenta();
    escenario.darPlus();
    await guardar(escenario, persona("Martina", "alta-1"));
    await guardar(escenario, persona("Joaquín", "alta-2"));
    const lista = await (listWithAccess as any)._handler(escenario.ctx, {});
    assert.equal(lista.profiles.length, 2);
    assert.deepEqual(lista.access, { isPro: true, limit: null, remaining: null, atLimit: false });
  });
});

describe("relationships.savePersonWithAccess — una persona en Free", () => {
  it("Free guarda la primera y la segunda falla con el código de la web", async () => {
    const escenario = cuenta();
    const primera = await guardar(escenario, persona("Martina", "alta-1"));
    assert.equal(primera.name, "Martina");
    await assert.rejects(guardar(escenario, persona("Joaquín", "alta-2")), (error: Error) => {
      assert.equal(error.message, "RELATIONSHIP_LIMIT_REACHED");
      return true;
    });
    assert.equal(escenario.base.rows("relationshipProfiles").length, 1, "el rechazo no deja fila");
  });

  it("es el mismo código que tira `addPerson`, no uno nuevo", () => {
    const fuente = leer("convex/relationships.ts");
    const apariciones = fuente.match(/throw new Error\("RELATIONSHIP_LIMIT_REACHED"\)/g) ?? [];
    // `addPerson` (antes del proveedor), `persistPerson` (en la transacción) y
    // el alta nativa: tres puertas, un solo código.
    assert.equal(apariciones.length, 3);
    assert.doesNotMatch(fuente, /RELATIONSHIP_PLUS_REQUIRED/);
  });

  it("editar a una persona guardada no cuenta contra el cupo", async () => {
    const escenario = cuenta();
    const primera = await guardar(escenario, persona("Martina", "alta-1"));
    const editada = await guardar(escenario, {
      ...persona("Martina Paz", "edicion-1"),
      profileId: primera.profileId,
    });
    assert.equal(editada.profileId, primera.profileId);
    assert.equal(editada.name, "Martina Paz");
    assert.equal(escenario.base.rows("relationshipProfiles").length, 1);
  });

  it("reintentar un alta ya confirmada devuelve su fila, no un rechazo por cupo", async () => {
    const escenario = cuenta();
    const primera = await guardar(escenario, persona("Martina", "alta-1"));
    // El cupo ya está lleno, pero ésta no es una persona nueva: es la misma alta.
    const reintento = await guardar(escenario, persona("Martina", "alta-1"));
    assert.equal(reintento.profileId, primera.profileId);
    assert.equal(escenario.base.rows("relationshipProfiles").length, 1);
  });

  it("Free con varias personas ya guardadas no puede sumar otra, pero sí editarlas", async () => {
    const escenario = cuenta();
    const vieja = await (savePerson as any)._handler(escenario.ctx, persona("Martina", "alta-1"));
    await (savePerson as any)._handler(escenario.ctx, persona("Joaquín", "alta-2"));
    await assert.rejects(guardar(escenario, persona("Lola", "alta-3")), /RELATIONSHIP_LIMIT_REACHED/);
    const editada = await guardar(escenario, { ...persona("Marti", "edicion-1"), profileId: vieja.profileId });
    assert.equal(editada.name, "Marti");
    assert.equal(escenario.base.rows("relationshipProfiles").length, 2, "nadie se borró");
  });

  it("Plus guarda todas las que quiera", async () => {
    const escenario = cuenta();
    escenario.darPlus();
    await guardar(escenario, persona("Martina", "alta-1"));
    await guardar(escenario, persona("Joaquín", "alta-2"));
    await guardar(escenario, persona("Lola", "alta-3"));
    assert.equal(escenario.base.rows("relationshipProfiles").length, 3);
  });

  it("`savePerson` no cambió: sigue sin cupo para el build 40", async () => {
    const escenario = cuenta();
    await (savePerson as any)._handler(escenario.ctx, persona("Martina", "alta-1"));
    await (savePerson as any)._handler(escenario.ctx, persona("Joaquín", "alta-2"));
    assert.equal(escenario.base.rows("relationshipProfiles").length, 2);
  });
});

describe("relationships.getComparisonWithAccess — la comparación con el tope del plan", () => {
  /** Una persona guardada y su comparación completa en el cache real del backend. */
  async function conComparacionGuardada(escenario: Cuenta) {
    const perfil = await (savePerson as any)._handler(escenario.ctx, persona("Martina", "alta-1"));
    const estado = await (getComparisonRefreshState as any)._handler(escenario.ctx, {
      tokenIdentifier: TOKEN,
      profileId: perfil.profileId,
    });
    const completa = { ...comparacion(), inputHash: estado.inputHash, validUntil: null };
    escenario.base.seed("relationshipComparisonCachesV492", {
      userId: escenario.userId,
      profileId: perfil.profileId,
      requestedLevel: estado.requestedLevel,
      cacheKey: estado.cacheKey,
      ...completa,
      createdAt: OBSERVADO,
      updatedAt: OBSERVADO,
    });
    return { perfil, estado };
  }

  it("Free recibe tres contactos y la cuenta de los ocultos", async () => {
    const escenario = cuenta();
    const { perfil } = await conComparacionGuardada(escenario);
    const resultado = await (getComparisonWithAccess as any)._handler(escenario.ctx, {
      profileId: perfil.profileId,
    });
    assert.deepEqual(resultado.access, { isPro: false, contactLimit: 3 });
    assert.equal(resultado.hiddenContacts, 2);
    const visibles = new Set(
      resultado.comparison.data.dimensions.flatMap((d: any) => d.driverDetails.map((c: any) => c.id)),
    );
    assert.deepEqual([...visibles].sort(), ["a", "b", "c"]);
    assert.equal(JSON.stringify(resultado).includes("ORACION-e"), false);
  });

  it("Plus recibe la misma comparación entera, igual a la de `getComparison`", async () => {
    const escenario = cuenta();
    const { perfil } = await conComparacionGuardada(escenario);
    escenario.darPlus();
    const resultado = await (getComparisonWithAccess as any)._handler(escenario.ctx, {
      profileId: perfil.profileId,
    });
    assert.deepEqual(resultado.access, { isPro: true, contactLimit: null });
    assert.equal(resultado.hiddenContacts, 0);
    assert.deepEqual(
      resultado.comparison,
      await (getComparison as any)._handler(escenario.ctx, { profileId: perfil.profileId }),
    );
    assert.equal(JSON.stringify(resultado).includes("ORACION-e"), true);
  });

  it("`getComparison` no cambió: sin `access` y sin recorte (build 40)", async () => {
    const escenario = cuenta();
    const { perfil } = await conComparacionGuardada(escenario);
    const legado = await (getComparison as any)._handler(escenario.ctx, { profileId: perfil.profileId });
    assert.equal("access" in legado, false);
    assert.equal(legado.data.dimensions[2].drivers.length, 1);
  });

  it("sin sesión o con un perfil ajeno falla igual que `getComparison`", async () => {
    const escenario = cuenta();
    const { perfil } = await conComparacionGuardada(escenario);
    await assert.rejects(
      (getComparisonWithAccess as any)._handler(SIN_SESION(escenario.base), { profileId: perfil.profileId }),
      /Authentication required/,
    );
    const ajeno = escenario.base.seed("relationshipProfiles", {
      userId: "users:99999999",
      name: "De otra cuenta",
      birthTimePrecision: "unknown",
      createdAt: 1,
      updatedAt: 1,
    });
    await assert.rejects(
      (getComparisonWithAccess as any)._handler(escenario.ctx, { profileId: ajeno }),
      /RELATIONSHIP_PROFILE_NOT_FOUND/,
    );
  });
});

describe("relationships.refreshComparisonWithAccess — recalcula igual, devuelve según el plan", () => {
  /** El estado que lee la action: sólo signos, así el recálculo no toca al proveedor. */
  async function refrescar(escenario: Cuenta) {
    const perfil = await (savePerson as any)._handler(escenario.ctx, persona("Martina", "alta-1"));
    const consultas: any[] = [];
    const persistidos: any[] = [];
    const ctx = {
      auth: escenario.ctx.auth,
      runQuery: async (_ref: unknown, args: any) => {
        consultas.push(args);
        return "profileId" in args
          ? (getComparisonRefreshState as any)._handler(escenario.ctx, args)
          : { isPro: escenario.base.rows("subscriptions").length > 0 };
      },
      runMutation: async (_ref: unknown, args: any) => {
        persistidos.push(args.result);
        return args.result;
      },
    };
    const resultado = await (refreshComparisonWithAccess as any)._handler(ctx, {
      profileId: perfil.profileId,
    });
    return { resultado, consultas, persistidos };
  }

  it("Free: el mismo sobre de acceso que la lectura, con lo persistido sin recortar", async () => {
    const { resultado, consultas, persistidos } = await refrescar(cuenta());
    assert.deepEqual(Object.keys(resultado), ["access", "hiddenContacts", "comparison"]);
    assert.deepEqual(resultado.access, { isPro: false, contactLimit: 3 });
    assert.equal(typeof resultado.hiddenContacts, "number");
    // Primero el plan, después el estado del recálculo.
    assert.deepEqual(consultas[0], { tokenIdentifier: TOKEN });
    assert.equal(persistidos.length, 1);
    assert.equal(resultado.comparison.inputHash, persistidos[0].inputHash);
  });

  it("Plus: sin tope", async () => {
    const escenario = cuenta();
    escenario.darPlus();
    const { resultado } = await refrescar(escenario);
    assert.deepEqual(resultado.access, { isPro: true, contactLimit: null });
    assert.equal(resultado.hiddenContacts, 0);
  });
});

// ---------------------------------------------------------------------------
// 5 · El contrato es aditivo
// ---------------------------------------------------------------------------

describe("contrato — aditivo, sin tocar lo que usan la web y el build 40", () => {
  const capas = leer("convex/layers.ts");
  const vinculos = leer("convex/relationships.ts");

  it("las ocho funciones nuevas existen y las viejas siguen publicadas", () => {
    for (const nombre of [
      "getForDateWithAccess",
      "refreshForDateWithAccess",
      "getTransitArcWithAccess",
      "refreshTransitArcWithAccess",
      "getForDate",
      "refreshForDate",
      "getTransitArc",
      "refreshTransitArc",
      "getNatalBase",
      "getNatalChartBase",
    ]) {
      assert.match(capas, new RegExp(`export const ${nombre} = `), nombre);
    }
    for (const nombre of [
      "listWithAccess",
      "savePersonWithAccess",
      "getComparisonWithAccess",
      "refreshComparisonWithAccess",
      "list",
      "savePerson",
      "removePerson",
      "getComparison",
      "refreshComparison",
      "addPerson",
      "synastry",
      "listPeople",
    ]) {
      assert.match(vinculos, new RegExp(`export const ${nombre} = `), nombre);
    }
  });

  it("las funciones sin sufijo conservan su validador de retorno", () => {
    assert.match(
      capas,
      /export const getForDate = query\(\{[\s\S]{0,160}returns: v\.union\(layerBundleValidator, v\.null\(\)\),/,
    );
    assert.match(capas, /export const refreshForDate = action\(\{[\s\S]{0,160}returns: layerBundleValidator,/);
    assert.match(
      capas,
      /export const getTransitArc = query\(\{[\s\S]{0,200}returns: v\.union\(transitArcResultValidator, v\.null\(\)\),/,
    );
    assert.match(
      vinculos,
      /export const savePerson = mutation\(\{\s+args: savePersonArgs,\s+returns: relationshipProfileValidator,/,
    );
    assert.match(
      vinculos,
      /export const getComparison = query\(\{[\s\S]{0,120}returns: relationshipComparisonResultValidator,/,
    );
  });

  it("el alta nativa resuelve la idempotencia ANTES del cupo", () => {
    const alta = vinculos.slice(
      vinculos.indexOf("async function savePersonForPlan"),
      vinculos.indexOf("export const savePerson ="),
    );
    assert.ok(alta.indexOf("existingRequest") > 0);
    assert.ok(
      alta.indexOf("existingRequest") < alta.indexOf("RELATIONSHIP_LIMIT_REACHED"),
      "un reintento confirmado se devuelve antes de evaluar el cupo",
    );
    assert.match(alta, /if \(enforcePlan\) \{[\s\S]*personAccess\(/, "el cupo sale de la misma función que la web");
  });

  it("el cupo no agrega tablas ni campos persistidos", () => {
    assert.doesNotMatch(leer("convex/schema.ts"), /freeSlot|slotUsed|cupoFree|plusRequired/i);
  });

  it("ningún módulo del backend vuelve a leer la allowlist de Sandbox", () => {
    for (const rel of [
      "convex/lib/revenueCatEvents.ts",
      "convex/lib/subscriptionAccess.ts",
      "convex/lib/entitlements.ts",
      "convex/payments/revenuecat.ts",
      "convex/payments/revenuecatRest.ts",
    ]) {
      assert.doesNotMatch(leer(rel), /REVENUECAT_SANDBOX_REVIEW_USER_IDS|revenueCatSandboxReviewers/, rel);
    }
  });
});
