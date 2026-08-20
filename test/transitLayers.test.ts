import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_TRANSIT_ORB_DEGREES,
  TRANSIT_RANKING_VERSION,
  angularDistance,
  buildTransitArcs,
  buildTransitLayers,
  declaredArcWindowKey,
  matchMajorAspect,
  rankTransitContacts,
  transitSignature,
  type TransitContactInput
} from "../convex/lib/transitLayers";

const NOW = "2026-08-15T15:00:00.000Z";

function contact(overrides: Partial<TransitContactInput> = {}): TransitContactInput {
  return {
    chartKey: "chart-fixture",
    transitPlanet: "Saturno",
    transitLongitude: 91,
    transitSpeed: 0.03,
    natalPoint: "Sol",
    natalLongitude: 0,
    natalHouse: 2,
    observedAt: NOW,
    ...overrides
  };
}

test("la distancia angular y los aspectos cruzan 359°/0° sin discontinuidad", () => {
  assert.equal(angularDistance(359, 1), 2);
  assert.equal(angularDistance(-1, 361), 2);

  const conjunction = matchMajorAspect(1, 359);
  assert.ok(conjunction);
  assert.equal(conjunction.key, "conjunction");
  assert.equal(conjunction.separation, 2);
  assert.equal(conjunction.orb, 2);

  const opposition = matchMajorAspect(359, 179);
  assert.ok(opposition);
  assert.equal(opposition.key, "opposition");
  assert.equal(opposition.orb, 0);

  assert.equal(matchMajorAspect(30, 0), null);
  assert.equal(matchMajorAspect(ACTIVE_TRANSIT_ORB_DEGREES + 0.01, 0), null);
});

test("el estado visible sale de exactitud y tendencia, no de una frase fija", () => {
  const ranking = rankTransitContacts([
    contact({ contactId: "approaching", transitLongitude: 89, transitSpeed: 1, natalPoint: "Venus" }),
    contact({ contactId: "exact", transitLongitude: 90.05, natalPoint: "Mercurio" }),
    contact({ contactId: "integrating", transitLongitude: 91, transitSpeed: 1, natalPoint: "Marte" })
  ]);

  const byId = new Map(ranking.map((transit) => [transit.contactId, transit]));
  assert.equal(byId.get("approaching")?.stage, "approaching");
  assert.equal(byId.get("approaching")?.stageLabel, "Acercándose");
  assert.equal(byId.get("exact")?.stage, "exact");
  assert.equal(byId.get("exact")?.stageLabel, "Exacto");
  assert.equal(byId.get("integrating")?.stage, "integrating");
  assert.equal(byId.get("integrating")?.stageLabel, "Integrándose");
});

test("el ranking aplica casa angular y regencia, pero publica razones y nunca el score", () => {
  const ranking = rankTransitContacts([
    contact({
      contactId: "weighted",
      transitPlanet: "Marte",
      transitLongitude: 91,
      natalPoint: "Venus",
      natalHouse: 1,
      isNatalRuler: true
    }),
    contact({
      contactId: "plain",
      transitPlanet: "Marte",
      transitLongitude: 91,
      natalPoint: "Mercurio",
      natalHouse: 2
    })
  ]);

  assert.deepEqual(ranking.map((transit) => transit.contactId), ["weighted", "plain"]);
  assert.deepEqual(
    ranking[0].reasons.map((reason) => reason.code),
    ["exactness", "natal_point", "pace", "angular_house", "natal_ruler"]
  );
  assert.equal(JSON.stringify(ranking).includes("score"), false);
  assert.equal(JSON.stringify(ranking).includes("internalScore"), false);
});

test("una firma temática repetida se explica sin duplicar pasadas del mismo arco", () => {
  const ranking = rankTransitContacts([
    contact({ contactId: "saturn-sun", transitPlanet: "Saturno", natalPoint: "Sol", transitLongitude: 89.5 }),
    contact({ contactId: "uranus-sun", transitPlanet: "Urano", natalPoint: "Sol", transitLongitude: 119.5 })
  ]);

  assert.equal(ranking.length, 2);
  for (const transit of ranking) {
    assert.equal(transit.reasons.some((reason) => reason.code === "repeated_theme"), true);
  }
});

test("los empates se resuelven por menor orbe y después por arcId", () => {
  // Marte aporta cuatro puntos de ritmo más que la Luna. La diferencia de
  // orbe compensa exactamente esos cuatro puntos en la fórmula de exactitud.
  const lowerOrb = contact({
    contactId: "lower-orb",
    transitPlanet: "Luna",
    natalPoint: "Venus",
    transitLongitude: 90 + (1 - 12 / 55)
  });
  const higherOrb = contact({
    contactId: "higher-orb",
    transitPlanet: "Marte",
    natalPoint: "Venus",
    transitLongitude: 91
  });
  assert.equal(rankTransitContacts([higherOrb, lowerOrb])[0].contactId, "lower-orb");

  const exactTie = rankTransitContacts([
    contact({ contactId: "venus", transitPlanet: "Marte", natalPoint: "Venus", transitLongitude: 91 }),
    contact({ contactId: "mercury", transitPlanet: "Marte", natalPoint: "Mercurio", transitLongitude: 91 })
  ]);
  assert.deepEqual(
    exactTie.map((transit) => transit.arcId),
    exactTie.map((transit) => transit.arcId).toSorted()
  );
});

test("Hoy recibe exactamente los tres primeros y Tránsitos conserva la lista entera", () => {
  const layers = buildTransitLayers([
    contact({ contactId: "one", transitPlanet: "Plutón", natalPoint: "Ascendente", transitLongitude: 0.2 }),
    contact({ contactId: "two", transitPlanet: "Saturno", natalPoint: "Sol", transitLongitude: 90.5 }),
    contact({ contactId: "three", transitPlanet: "Júpiter", natalPoint: "Mercurio", transitLongitude: 60.4 }),
    contact({ contactId: "four", transitPlanet: "Marte", natalPoint: "Venus", transitLongitude: 179.2 }),
    contact({ contactId: "five", transitPlanet: "Luna", natalPoint: "Luna", transitLongitude: 119.1 })
  ]);

  assert.equal(layers.version, TRANSIT_RANKING_VERSION);
  assert.equal(layers.activeCount, 5);
  assert.equal(layers.ranking.length, 5);
  assert.equal(layers.topThree.length, 3);
  assert.deepEqual(layers.topThree.map((transit) => transit.rank), [1, 2, 3]);
  assert.deepEqual(layers.topThree, layers.ranking.slice(0, 3));
});

test("el ranking prioriza urgencia temporal: Marte mañana supera a Saturno de hace once días", () => {
  const referenceTime = "2026-08-20T15:00:00.000Z";
  const ranking = rankTransitContacts(
    [
      contact({
        contactId: "saturno-integrando",
        transitPlanet: "Saturno",
        natalPoint: "Júpiter",
        transitLongitude: 90.01,
        exactAt: "2026-08-09T15:00:00.000Z",
        windowStart: "2026-05-24T00:00:00.000Z",
        windowEnd: "2027-04-06T00:00:00.000Z",
        observedAt: referenceTime
      }),
      contact({
        contactId: "marte-manana",
        transitPlanet: "Marte",
        natalPoint: "Marte",
        transitLongitude: 60.5,
        exactAt: "2026-08-21T15:00:00.000Z",
        windowStart: "2026-08-18T00:00:00.000Z",
        windowEnd: "2026-08-24T00:00:00.000Z",
        observedAt: referenceTime
      })
    ],
    {
      referenceTime,
      localDate: "2026-08-20",
      timezone: "America/Argentina/Buenos_Aires"
    }
  );

  assert.deepEqual(ranking.map((item) => item.contactId), ["marte-manana", "saturno-integrando"]);
  assert.equal(ranking[0].rankingReason, "Pico mañana");
  assert.equal(ranking[1].rankingReason, "Activo hasta el 5 de abril");
  assert.equal(ranking[0].nextExactAt, "2026-08-21T15:00:00.000Z");
  assert.deepEqual(ranking[0].rankingWindow, {
    startAt: "2026-08-18T00:00:00.000Z",
    endAt: "2026-08-24T00:00:00.000Z"
  });
});

test("un contacto exacto en la fecha civil del usuario encabeza el ranking", () => {
  const referenceTime = "2026-08-20T02:00:00.000Z";
  const ranking = rankTransitContacts(
    [
      contact({
        contactId: "exacto-local",
        natalPoint: "Luna",
        exactAt: "2026-08-20T01:00:00.000Z",
        observedAt: referenceTime
      }),
      contact({
        contactId: "proximo",
        natalPoint: "Venus",
        exactAt: "2026-08-20T12:00:00.000Z",
        observedAt: referenceTime
      })
    ],
    {
      referenceTime,
      localDate: "2026-08-19",
      timezone: "America/Argentina/Buenos_Aires"
    }
  );

  assert.equal(ranking[0].contactId, "exacto-local");
  assert.equal(ranking[0].rankingReason, "Exacto hoy");
});

test("un contacto fuera del orbe de 3° no entra en ninguna capa", () => {
  const inactive = contact({ transitLongitude: 93.0001 });
  assert.equal(transitSignature(inactive), null);
  assert.deepEqual(rankTransitContacts([inactive]), []);
  assert.deepEqual(buildTransitArcs([inactive]), []);
});

test("tres contactos directos/retrógrados forman un solo arco estable", () => {
  const passes: TransitContactInput[] = [
    contact({
      contactId: "first-direct",
      arcWindowKey: "saturn-asc-2026",
      natalPoint: "Ascendente",
      transitLongitude: 89.95,
      isRetrograde: false,
      observedAt: "2026-05-12T12:00:00Z",
      windowStart: "2026-05-01T00:00:00Z",
      exactAt: "2026-05-12T12:00:00Z",
      windowEnd: "2026-05-20T00:00:00Z"
    }),
    contact({
      contactId: "middle-retrograde",
      arcWindowKey: "saturn-asc-2026",
      natalPoint: "Ascendente",
      transitLongitude: 90.02,
      isRetrograde: true,
      observedAt: "2026-08-02T12:00:00Z",
      exactAt: "2026-08-02T12:00:00Z"
    }),
    contact({
      contactId: "last-direct",
      arcWindowKey: "saturn-asc-2026",
      natalPoint: "Ascendente",
      transitLongitude: 90.08,
      isRetrograde: false,
      observedAt: "2026-10-31T12:00:00Z",
      exactAt: "2026-10-31T12:00:00Z",
      windowEnd: "2026-11-08T00:00:00Z"
    })
  ];

  const options = { referenceTime: "2026-11-20T00:00:00Z" } as const;
  const arcs = buildTransitArcs(passes, options);
  assert.equal(arcs.length, 1);
  assert.equal(arcs[0].passes.length, 3);
  assert.deepEqual(arcs[0].passes.map((pass) => pass.direction), ["direct", "retrograde", "direct"]);
  assert.equal(arcs[0].hasRetrogradePass, true);
  assert.equal(arcs[0].stage, "integrating");
  assert.equal(arcs[0].stageLabel, "Integrándose");

  const reversed = buildTransitArcs([...passes].reverse(), options);
  assert.equal(reversed.length, 1);
  assert.equal(reversed[0].arcId, arcs[0].arcId);
  assert.deepEqual(reversed[0].passes, arcs[0].passes);

  const inferredWindow = buildTransitArcs(
    passes.map(({ arcWindowKey: _arcWindowKey, ...pass }) => pass),
    options
  );
  assert.equal(inferredWindow.length, 1, "la cercanía temporal también permite inferir la ventana");
  assert.equal(inferredWindow[0].passes.length, 3);

  const ranking = rankTransitContacts(passes, options);
  assert.equal(ranking.length, 1, "el ranking no repite las tres pasadas como tres tránsitos");
  assert.equal(ranking[0].passCount, 3);
  assert.equal(ranking[0].arcId, arcs[0].arcId);
  assert.equal(JSON.stringify({ arcs, ranking }).includes("score"), false);
});

test("pasadas de la misma firma separadas por más de la ventana forman arcos distintos", () => {
  const oldPass = contact({
    contactId: "old",
    observedAt: "2024-01-01T00:00:00Z",
    exactAt: "2024-01-01T00:00:00Z"
  });
  const newPass = contact({
    contactId: "new",
    observedAt: "2026-01-01T00:00:00Z",
    exactAt: "2026-01-01T00:00:00Z"
  });

  const arcs = buildTransitArcs([newPass, oldPass]);
  assert.equal(arcs.length, 2);
  assert.notEqual(arcs[0].arcId, arcs[1].arcId);
});

test("una ventana verificada conserva el arcId aunque el límite ronde medianoche UTC", () => {
  const beforeMidnight = contact({
    arcWindowKey: "verified:2026-05-12",
    observedAt: "2026-05-13T12:00:00Z",
    exactAt: "2026-05-13T12:00:00Z",
    windowStart: "2026-05-12T23:59:00Z",
    windowEnd: "2026-05-14T00:00:00Z",
  });
  const afterMidnight = contact({
    arcWindowKey: "verified:2026-05-12",
    observedAt: "2026-05-13T12:00:00Z",
    exactAt: "2026-05-13T12:00:00Z",
    windowStart: "2026-05-13T00:01:00Z",
    windowEnd: "2026-05-14T00:00:00Z",
  });

  assert.equal(buildTransitArcs([beforeMidnight])[0].arcId, buildTransitArcs([afterMidnight])[0].arcId);
});

test("un `arcId` declarado es la identidad del arco, antes y después de verificar", () => {
  // Es lo que hace posible pedir el detalle de UN arco: la verificación de pasadas
  // corre los bordes de la ventana, y con ellos el identificador derivado. Sin una
  // identidad declarada, el mismo tránsito cambiaría de `arcId` al verificarse y
  // dejaría de corresponder al que publicó el ranking.
  const sinVerificar = contact({ contactId: "ranking" });
  const derivado = buildTransitArcs([sinVerificar])[0];
  assert.match(derivado.arcId, /^arc_v1_/);

  const verificado = contact({
    contactId: "verified",
    arcId: derivado.arcId,
    arcWindowKey: "verified:2026-05-12",
    windowStart: "2026-05-12T00:00:00Z",
    windowEnd: "2026-08-31T00:00:00Z"
  });
  const conIdentidad = buildTransitArcs([verificado]);
  assert.equal(conIdentidad.length, 1);
  assert.equal(conIdentidad[0].arcId, derivado.arcId, "la identidad declarada manda");
  // Y la ventana SÍ cambia: lo que se conserva es el identificador, no las fechas.
  assert.notEqual(conIdentidad[0].window.startAt, derivado.window.startAt);

  // Sin declararla, esa misma ventana produce otro identificador. Esa diferencia
  // es exactamente el problema que el campo resuelve.
  const sinIdentidad = buildTransitArcs([{ ...verificado, arcId: undefined }]);
  assert.notEqual(sinIdentidad[0].arcId, derivado.arcId);
});

test("los contactos que declaran el mismo `arcId` son pasadas de un solo arco", () => {
  const base = { arcId: "arc_v1_declarado", arcWindowKey: "verified:2025-06-01" };
  // Tres pasadas separadas por más de un año: sin identidad declarada el motor las
  // partiría por distancia temporal.
  const pasadas = ["2025-06-15T00:00:00Z", "2025-12-15T00:00:00Z", "2026-08-15T00:00:00Z"].map(
    (exactAt, index) =>
      contact({
        ...base,
        contactId: `pasada-${index}`,
        observedAt: "2026-08-15T15:00:00Z",
        exactAt,
        windowStart: "2025-06-01T00:00:00Z",
        windowEnd: "2026-09-01T00:00:00Z",
        isRetrograde: index === 1
      })
  );

  const arcs = buildTransitArcs(pasadas, { referenceTime: NOW, maxPassGapDays: 30 });
  assert.equal(arcs.length, 1, "una identidad declarada es un solo arco");
  assert.equal(arcs[0].arcId, "arc_v1_declarado");
  assert.equal(arcs[0].passes.length, 3);
  assert.deepEqual(
    arcs[0].passes.map((pass) => pass.direction),
    ["direct", "retrograde", "direct"]
  );

  const ranking = rankTransitContacts(pasadas, { referenceTime: NOW, maxPassGapDays: 30 });
  assert.equal(ranking.length, 1, "el ranking también las cuenta como un solo tránsito");
  assert.equal(ranking[0].passCount, 3);
});

test("un `arcId` vacío o en blanco no es una identidad: el motor calcula la suya", () => {
  const derivado = buildTransitArcs([contact({ contactId: "base" })])[0];
  for (const arcId of ["", "   "]) {
    const arcs = buildTransitArcs([contact({ contactId: "base", arcId })]);
    assert.equal(arcs.length, 1);
    assert.equal(arcs[0].arcId, derivado.arcId, `«${arcId}» no puede quedar como arcId`);
    assert.match(arcs[0].arcId, /^arc_v1_/);
  }
});

// ---------------------------------------------------------------------------
// Identidad del arco: la misma antes y después de verificar la cronología
// ---------------------------------------------------------------------------

/**
 * El defecto que cierran estas pruebas: el ranking publicaba `arc_v1_0pa9p2w`
 * para Saturno–Marte y el arco del MISMO contacto publicaba `arc_v1_19nh0r0`,
 * así que la pantalla de detalle no encontraba el arco que había abierto y caía
 * al ítem del ranking. La causa era la procedencia: verificar las pasadas
 * sembraba la identidad con la ventana verificada —y con la etiqueta
 * `verified:`—, mientras la lista la sembraba con la ventana extrapolada.
 *
 * La identidad V1 se deriva de carta + planeta en tránsito + aspecto + punto
 * natal + ventana lógica. Cómo se MIDIÓ esa ventana no es parte de la identidad.
 */

/** Lo que publica el ranking: ventana extrapolada con la velocidad del día. */
function estimado(overrides: Partial<TransitContactInput> = {}): TransitContactInput {
  return contact({
    transitPlanet: "Saturno",
    natalPoint: "Marte",
    transitLongitude: 91.4,
    natalLongitude: 0,
    transitSpeed: 0.03,
    observedAt: NOW,
    windowStart: "2026-06-01T00:00:00Z",
    exactAt: "2026-09-08T00:00:00Z",
    windowEnd: "2026-12-16T00:00:00Z",
    ...overrides
  });
}

/**
 * Lo que devuelve el seguimiento verificado del MISMO contacto: bordes corridos
 * meses y tres pasadas reales, con la ventana lógica que el contacto ya traía.
 * Es exactamente lo que arma `resolveVerifiedTransitTimeline`.
 */
function verificadas(
  base: TransitContactInput,
  windowKey: string,
  ventana: { start: string; end: string },
  exactos: readonly string[]
): TransitContactInput[] {
  return exactos.map((exactAt, index) => ({
    ...base,
    contactId: undefined,
    arcWindowKey: windowKey,
    exactAt,
    windowStart: ventana.start,
    windowEnd: ventana.end,
    isRetrograde: index === 1
  }));
}

test("el arco y el ranking nombran el mismo proceso: verificar no cambia el arcId", () => {
  const contacto = estimado();
  const publicado = rankTransitContacts([contacto], { referenceTime: NOW })[0];
  assert.match(publicado.arcId, /^arc_v1_/);
  assert.equal(buildTransitArcs([contacto], { referenceTime: NOW })[0].arcId, publicado.arcId);

  // La ventana lógica del contacto es la que viaja al seguimiento; sus bordes
  // reales caen meses fuera de la extrapolación.
  const clave = declaredArcWindowKey(contacto);
  assert.equal(clave, "2026-06-01");
  const pasadas = verificadas(contacto, clave!, { start: "2026-02-11T09:00:00Z", end: "2027-04-02T18:00:00Z" }, [
    "2026-04-19T04:00:00Z",
    "2026-09-08T12:00:00Z",
    "2027-01-28T22:00:00Z"
  ]);

  const arco = buildTransitArcs(pasadas, { referenceTime: NOW })[0];
  assert.equal(arco.passes.length, 3, "las tres pasadas son un solo arco");
  assert.deepEqual(arco.passes.map((pass) => pass.direction), ["direct", "retrograde", "direct"]);
  assert.equal(arco.arcId, publicado.arcId, "la identidad es del proceso, no de cómo se lo midió");
  // Y las FECHAS sí cambian: es lo único que aporta verificar.
  assert.notEqual(arco.window.startAt, buildTransitArcs([contacto], { referenceTime: NOW })[0].window.startAt);

  // El ranking de las pasadas verificadas cuenta un solo tránsito, con ese mismo
  // identificador: la lista y el detalle no pueden divergir tampoco acá.
  const rankingVerificado = rankTransitContacts(pasadas, { referenceTime: NOW });
  assert.equal(rankingVerificado.length, 1);
  assert.equal(rankingVerificado[0].passCount, 3);
  assert.equal(rankingVerificado[0].arcId, publicado.arcId);
});

test("la marca de procedencia no es identidad: `verified:FECHA` y `FECHA` son la misma ventana", () => {
  const contacto = estimado();
  const publicado = rankTransitContacts([contacto], { referenceTime: NOW })[0];
  const ventana = { start: "2026-02-11T09:00:00Z", end: "2027-04-02T18:00:00Z" };
  const exactos = ["2026-04-19T04:00:00Z", "2026-09-08T12:00:00Z", "2027-01-28T22:00:00Z"];

  for (const clave of ["2026-06-01", "verified:2026-06-01", "estimated:2026-06-01", "  verified:2026-06-01  "]) {
    const arco = buildTransitArcs(verificadas(contacto, clave, ventana, exactos), { referenceTime: NOW })[0];
    assert.equal(arco.arcId, publicado.arcId, `«${clave}» tiene que ser la misma ventana lógica`);
    assert.equal(arco.passes.length, 3);
  }

  // Y una ventana lógica DISTINTA sigue siendo otro arco, con o sin etiqueta.
  const otraVentana = buildTransitArcs(
    verificadas(contacto, "verified:2028-06-01", ventana, exactos),
    { referenceTime: NOW }
  )[0];
  assert.notEqual(otraVentana.arcId, publicado.arcId);
});

test("un arco que cruza 359°/0° conserva una sola identidad al verificarse", () => {
  // Conjunción a 1,4° del punto natal, con el aspecto exacto del otro lado del
  // cero: el arco no puede partirse ni renombrarse por el salto de coordenada.
  const contacto = estimado({
    transitPlanet: "Marte",
    natalPoint: "Venus",
    natalLongitude: 359.2,
    transitLongitude: 0.6,
    transitSpeed: 0.5,
    windowStart: "2026-07-26T00:00:00Z",
    exactAt: "2026-08-01T00:00:00Z",
    windowEnd: "2026-08-07T00:00:00Z"
  });
  const publicado = rankTransitContacts([contacto], { referenceTime: NOW })[0];
  assert.equal(publicado.aspect.key, "conjunction");

  const clave = declaredArcWindowKey(contacto);
  assert.equal(clave, "2026-07-26");
  const pasadas = verificadas(
    contacto,
    `verified:${clave}`,
    { start: "2026-07-19T11:00:00Z", end: "2026-08-14T05:00:00Z" },
    ["2026-07-24T02:00:00Z", "2026-08-01T06:00:00Z", "2026-08-09T10:00:00Z"]
  ).map((pasada, index) => ({
    ...pasada,
    // Las tres pasadas caen a los dos lados del cero: 359,9 · 0,0 · 0,3.
    transitLongitude: [359.9, 359.2, 0.3][index]
  }));

  const arcos = buildTransitArcs(pasadas, { referenceTime: NOW });
  assert.equal(arcos.length, 1, "el cruce de 359°/0° no parte el arco");
  assert.equal(arcos[0].passes.length, 3);
  assert.equal(arcos[0].arcId, publicado.arcId);
});

test("dos procesos realmente distintos no comparten identidad", () => {
  const base = estimado();
  const identidad = (contacto: TransitContactInput) =>
    buildTransitArcs([contacto], { referenceTime: NOW })[0].arcId;

  const distintos = {
    base: identidad(base),
    // Otra carta.
    otraCarta: identidad(estimado({ chartKey: "otra-carta" })),
    // Otro planeta en tránsito.
    otroPlaneta: identidad(estimado({ transitPlanet: "Júpiter" })),
    // Otro punto natal.
    otroPunto: identidad(estimado({ natalPoint: "Venus" })),
    // Otro aspecto sobre el mismo punto: trígono en vez de cuadratura.
    otroAspecto: identidad(estimado({ transitLongitude: 121.4 })),
    // El MISMO contacto, dos años después: es otro proceso, no esta ventana.
    otraVentana: identidad(
      estimado({
        observedAt: "2028-08-15T15:00:00.000Z",
        windowStart: "2028-06-01T00:00:00Z",
        exactAt: "2028-09-08T00:00:00Z",
        windowEnd: "2028-12-16T00:00:00Z"
      })
    )
  };

  const valores = Object.values(distintos);
  assert.equal(new Set(valores).size, valores.length, JSON.stringify(distintos, null, 2));

  // Y la desigualdad no se apoya en la procedencia: verificar cada uno mantiene
  // seis identidades distintas.
  const verificados = Object.fromEntries(
    Object.entries({
      base,
      otraCarta: estimado({ chartKey: "otra-carta" }),
      otroPlaneta: estimado({ transitPlanet: "Júpiter" }),
      otroPunto: estimado({ natalPoint: "Venus" }),
      otroAspecto: estimado({ transitLongitude: 121.4 }),
      otraVentana: estimado({
        observedAt: "2028-08-15T15:00:00.000Z",
        windowStart: "2028-06-01T00:00:00Z",
        exactAt: "2028-09-08T00:00:00Z",
        windowEnd: "2028-12-16T00:00:00Z"
      })
    }).map(([nombre, contacto]) => [
      nombre,
      buildTransitArcs(
        verificadas(
          contacto,
          `verified:${declaredArcWindowKey(contacto)}`,
          { start: "2026-02-11T09:00:00Z", end: "2027-04-02T18:00:00Z" },
          ["2026-04-19T04:00:00Z", "2026-09-08T12:00:00Z", "2027-01-28T22:00:00Z"]
        ),
        { referenceTime: NOW }
      )[0].arcId
    ])
  );
  assert.deepEqual(verificados, distintos, "verificar conserva las seis identidades");
});
