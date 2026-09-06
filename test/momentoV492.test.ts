/**
 * Tu momento V4.9.2: ruta real, estados honestos y cuatro ritmos sin mocks.
 *
 * Estas regresiones miran el contrato matemático y el grafo que Metro monta.
 * La pantalla puede cambiar de composición, pero no puede volver a elegir la
 * vista con estado local, inventar una etapa cuando falta la hora ni reunir
 * tres análisis distintos bajo una sola trazabilidad.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

import {
  buildAnnualProfectionLayerData,
  buildCumplelunaLayerData,
  buildProgressedLunationLayerData,
  buildTemporalMandalaData
} from "../convex/lib/layerAssembly";
import {
  formatShortMonthYear,
  hasData,
  missingReasons,
  precisionChip,
  statusChip
} from "../src/domain/layers";
import { MANDALA_SIZE, mandalaDrawnRings } from "../src/components/v492/mandalaGeometry";
import type { AnalysisEnvelope } from "../src/services/layersApi";
import {
  ROOT,
  pathTo,
  reachableFrom,
  resolveEntryForPlatform
} from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const relativo = (absolute: string) => relative(ROOT, absolute);

const ENTRY = "app/(tabs)/transitos/momento.tsx";
const NATIVE_ROUTE = "src/routes/v492/transitos-momento.tsx";
const WEB_ROUTE = "src/routes/v492/transitos-momento.web.tsx";
const SCREEN = "src/screens/v492/TransitosLayersScreen.tsx";

const DAY = 86_400_000;
const OBSERVED = Date.UTC(2026, 7, 15, 12);
const STARTED = Date.UTC(2024, 4, 1);
const NEXT = Date.UTC(2027, 10, 1);

test("/transitos/momento conserva una vista enlazable y no un selector local", () => {
  assert.equal(relativo(resolveEntryForPlatform(ENTRY, "native")), NATIVE_ROUTE);
  assert.equal(relativo(resolveEntryForPlatform(ENTRY, "web")), WEB_ROUTE);

  const nativeGraph = reachableFrom([ENTRY], "native");
  const webGraph = reachableFrom([ENTRY], "web");
  assert.ok(nativeGraph.has(SCREEN), "la ruta nativa debe llegar a la pantalla de capas");
  assert.ok(!webGraph.has(SCREEN), "la web no debe arrastrar la pantalla nativa");

  const route = sinComentarios(leer(NATIVE_ROUTE));
  const webRoute = sinComentarios(leer(WEB_ROUTE));
  const screen = sinComentarios(leer(SCREEN));
  assert.match(route, /<TransitosLayersScreen\s+mode="momento"\s*\/>/);
  assert.match(webRoute, /<Redirect\s+href="\/transito"\s*\/>/);
  assert.match(screen, /momento:\s*"\/transitos\/momento"/);
  assert.match(screen, /router\.replace\(RUTA_VISTA\[vista\]/);
  assert.doesNotMatch(screen, /useState\([^)]*(?:ahora|momento)/i);
});

test("la estación vital distingue hora exacta, estimación certificada y rango sin dato", () => {
  const exacta = buildProgressedLunationLayerData({
    birthTimePrecision: "known",
    progressedSunLongitude: 10,
    progressedMoonLongitude: 118,
    ageYears: 32.28,
    observedAt: OBSERVED,
    phaseStartedAt: STARTED,
    nextPhaseAt: NEXT
  });
  assert.equal(exacta.status, "ready");
  assert.equal(exacta.precision, "exact");
  assert.ok(exacta.data);
  assert.equal(exacta.data.phaseStartedAtRange, undefined);
  assert.equal(exacta.data.nextPhaseAtRange, undefined);

  const estimada = buildProgressedLunationLayerData({
    birthTimePrecision: "unknown",
    progressedSunLongitude: 10,
    progressedMoonLongitude: 118,
    ageYears: 32.28,
    observedAt: OBSERVED,
    phaseStartedAt: STARTED,
    nextPhaseAt: NEXT,
    phaseStartedAtRange: { earliest: STARTED - 180 * DAY, latest: STARTED + 180 * DAY },
    nextPhaseAtRange: { earliest: NEXT - 180 * DAY, latest: NEXT + 180 * DAY }
  });
  assert.equal(estimada.status, "partial");
  assert.equal(estimada.precision, "estimated");
  assert.ok(estimada.data?.phaseStartedAtRange);
  assert.ok(estimada.data?.nextPhaseAtRange);
  assert.equal(precisionChip(estimada.precision, estimada.status)?.label, "DATO ESTIMADO");

  const enRango = {
    analysisId: "ORB-CYC-002",
    methodVersion: "secondary-progressed-lunation-full-civil-day-v2",
    inputHash: "fixture-estacion-rango",
    status: "partial",
    precision: "range",
    observedAt: OBSERVED,
    validUntil: null,
    data: null,
    missingInputs: ["exact_birth_time_or_certified_progressed_phase"],
    limitations: [
      "Sin tu hora exacta, la fase puede cambiar durante el día de nacimiento y queda cerca de un límite."
    ],
    elaboration: "direct",
    sourceRefs: []
  } satisfies AnalysisEnvelope;
  assert.equal(hasData(enRango), false, "un rango que cruza de fase no fabrica una estación");
  assert.equal(precisionChip(enRango.precision, enRango.status)?.label, "DATO EN RANGO");
  assert.deepEqual(missingReasons(enRango), enRango.limitations);
});

test("la pantalla explica las fechas estimadas como rangos y nunca como contactos exactos", () => {
  const screen = sinComentarios(leer(SCREEN));
  assert.match(screen, /phaseStartedAtRange/);
  assert.match(screen, /nextPhaseAtRange/);

  // La rama honesta se escribe por la NEGATIVA de la precisión exacta y no
  // enumerando `estimated`: así cubre también `range` y cualquier precisión
  // futura que no sea exacta, en vez de dejarla caer en el camino del valor
  // suelto. Lo que se exige es que las dos ventanas cuelguen de esa negación.
  const exactFlag = /const\s+([A-Za-z][A-Za-z0-9]*)\s*=\s*precision\s*===\s*["']exact["']/.exec(
    screen
  )?.[1];
  assert.ok(exactFlag, "Tu momento necesita una rama visible para la precisión exacta");
  for (const campo of ["phaseStartedAtRange", "nextPhaseAtRange"]) {
    assert.match(
      screen,
      new RegExp(`data\\.${campo}\\s*&&\\s*!\\s*${exactFlag}`),
      `${campo} sólo puede reemplazar a la fecha suelta cuando la precisión no es exacta`
    );
  }
  assert.match(screen, /rango/i);
  assert.doesNotMatch(screen, /hora\s+(?:inventada|asumida)|12:00.*nacimiento/i);
});

test("la profección depende del sobre real y falta honestamente sin hora exacta", () => {
  const sinHora = buildAnnualProfectionLayerData({
    chart: {
      placements: [],
      houses: [],
      birth: {
        birthDate: "1994-05-04",
        birthTimePrecision: "unknown"
      }
    },
    asOfDate: "2026-08-15",
    civilDateToTimestamp: (date) => Date.parse(`${date}T12:00:00.000Z`)
  });
  assert.equal(sinHora.status, "needs_birth_time");
  assert.equal(sinHora.data, null);

  const envelope = {
    analysisId: "ORB-CYC-001",
    methodVersion: "annual-profection-whole-sign-v1",
    inputHash: "fixture-profeccion-sin-hora",
    status: sinHora.status,
    precision: sinHora.precision,
    observedAt: OBSERVED,
    validUntil: null,
    data: sinHora.data,
    missingInputs: sinHora.missingInputs,
    limitations: sinHora.limitations,
    elaboration: "direct",
    sourceRefs: []
  } satisfies AnalysisEnvelope;
  assert.equal(statusChip(envelope.status)?.label, "FALTA TU HORA DE NACIMIENTO");
  assert.deepEqual(missingReasons(envelope), ["Falta tu hora exacta de nacimiento."]);

  const screen = sinComentarios(leer(SCREEN));
  assert.match(screen, /envelope=\{annualProfection\}/);
  assert.match(screen, /annualProfection\.data/);
  assert.doesNotMatch(screen, /Casa\s+7\s*·\s*(?:el año de los acuerdos|vínculos y acuerdos)/i);
});

test("el mandala representa exactamente los cuatro anillos del contrato", () => {
  const cumpleluna = buildCumplelunaLayerData({
    natalSunLongitude: 10,
    natalMoonLongitude: 78,
    currentSunLongitude: 100,
    currentMoonLongitude: 333,
    previousExactAt: OBSERVED - 12 * DAY,
    nextExactAt: OBSERVED + 17.5 * DAY,
    observedAt: OBSERVED,
    natalPrecision: "exact"
  }).data;
  const data = buildTemporalMandalaData({
    observedAt: OBSERVED,
    cumpleluna
  });
  assert.deepEqual(
    data.rings.map((ring) => ring.key),
    ["progressed_lunation", "annual_profection", "cumpleluna", "transit_arc"]
  );
  assert.equal(data.rings.length, 4);
  assert.equal(data.rings[2].label, "Tu ritmo lunar");
  assert.equal(data.rings[2].cadence, "Cumpleluna personal");
  assert.equal(data.rings[2].cycleDay, 12);
  assert.equal(data.rings[2].daysRemaining, 17.5);
  assert.equal(data.rings[2].previousExactAt, OBSERVED - 12 * DAY);
  assert.equal(data.rings[2].nextExactAt, OBSERVED + 17.5 * DAY);
  assert.doesNotMatch(JSON.stringify(data.rings[2]), /ciclo lunar actual|fase de la Luna de hoy/i);

  const screen = sinComentarios(leer(SCREEN));
  const dial = sinComentarios(leer("src/components/v492/Dials.tsx"));
  assert.match(screen, /<TemporalMandalaDial\s+rings=\{data\.rings\}/);
  // Un ritmo sin cálculo no se dibuja: la disponibilidad decide el modo antes
  // que cualquier otra cosa, en la única función que resuelve ese modo.
  assert.match(dial, /if \(!ring\.available\) return "unavailable";/);
  assert.match(dial, /ring\.progress/);
  assert.doesNotMatch(dial, /reduce\([^)]*(?:sum|total)|promedi|average/i);
  // La etiqueta anuncia el número de anillos DIBUJADOS, que le llega calculado:
  // el ancla anterior (`mandalaLabel(rings)`) permitía que la etiqueta contara
  // por su cuenta, que es de dónde salía la divergencia con el SVG.
  assert.match(dial, /accessibilityLabel=\{mandalaLabel\(rings,\s*anillos\.length\)\}/);
});

test("el dibujo, la lista y el pie del mandala cuentan los MISMOS anillos", () => {
  // El defecto: el disco dibujaba los ritmos disponibles CON avance ubicable, la
  // lista declaraba los disponibles y el pie contaba una tercera cosa. Un ritmo
  // con cálculo pero sin avance ubicable salía en la lista y no en el dibujo.
  //
  // Ahora hay una sola definición —`mandalaDrawnRings`— y se prueba su
  // comportamiento, no su texto.
  const anillo = (key: string, available: boolean) => ({ key, available });

  // Cuatro ritmos, dos disponibles: el disco dibuja DOS.
  const dos = mandalaDrawnRings(
    [
      anillo("progressed_lunation", true),
      anillo("annual_profection", false),
      anillo("cumpleluna", true),
      anillo("transit_arc", false)
    ],
    MANDALA_SIZE
  );
  assert.equal(dos.length, 2);
  assert.deepEqual(
    dos.map((a) => a.ring.key),
    ["progressed_lunation", "cumpleluna"]
  );

  // El radio lo fija la POSICIÓN en el contrato, no el orden de los disponibles:
  // `cumpleluna` es el tercero, así que conserva el tercer radio aunque el
  // segundo no se dibuje. Si se corriera hacia afuera, el disco afirmaría un
  // orden de ciclos que no es el suyo.
  const todos = mandalaDrawnRings(
    ["progressed_lunation", "annual_profection", "cumpleluna", "transit_arc"].map((k) =>
      anillo(k, true)
    ),
    MANDALA_SIZE
  );
  assert.equal(dos[1]!.radius, todos[2]!.radius);
  // Y de afuera hacia adentro, sin superponerse.
  for (let i = 1; i < todos.length; i += 1) {
    assert.ok(todos[i]!.radius < todos[i - 1]!.radius, "cada anillo va más adentro que el anterior");
  }

  // Ninguno disponible: cero anillos, y el disco no dibuja un riel vacío suelto.
  assert.equal(
    mandalaDrawnRings(["a", "b", "c", "d"].map((k) => anillo(k, false)), MANDALA_SIZE).length,
    0
  );

  // Un disco chiquito no encoge ni superpone anillos: los que no entran quedan
  // afuera, y el conteo del pie sale de acá justamente para no prometerlos.
  assert.ok(
    mandalaDrawnRings(["a", "b", "c", "d"].map((k) => anillo(k, true)), 40).length < 4
  );
});


test("Estación vital, Tema del año y Mandala temporal tienen trazabilidad separada", () => {
  const screen = sinComentarios(leer(SCREEN));
  for (const envelope of ["progressedLunation", "annualProfection", "temporalMandala"]) {
    assert.equal(
      screen.match(new RegExp(`envelope=\\{${envelope}\\}`, "g"))?.length,
      2,
      `${envelope} debe usarse una vez en su módulo y una vez en su trazabilidad`
    );
  }
  assert.equal(
    screen.match(/<TraceAccordion/g)?.length,
    4,
    "hay una trazabilidad para Ahora y tres independientes en Tu momento"
  );
});

test("Tu momento conserva el copy aprobado y no expone frases internas ni datos de maqueta", () => {
  const screen = sinComentarios(leer(SCREEN));
  // El copy se busca sobre el texto con los espacios normalizados: en JSX una
  // frase aprobada se parte en varias líneas por el ancho del archivo, y ese
  // corte es formato, no un cambio de copy. Sin esto el gate falla —o pasa— según
  // dónde caiga el salto de línea.
  const plano = screen.replace(/\s+/g, " ");
  for (const phrase of [
    /Acá se reúnen los ciclos que cambian lentamente/i,
    /relación progresada entre el Sol y la Luna/i,
    /recorre ocho fases en un ciclo de unos 30 años/i,
    /La profección anual recorre una casa de tu carta por cada año de vida/i
  ]) {
    assert.match(plano, phrase);
  }

  // Debajo del mandala no queda NINGUNA explicación: ni el pie que repetía el
  // dibujo en prosa, ni el párrafo de método que quedó de más entre las cuatro
  // líneas y el acordeón. Qué es cada anillo lo dice `TraceAccordion`.
  assert.doesNotMatch(plano, /anillos ubican lo cotidiano dentro de procesos más largos/i);
  assert.doesNotMatch(plano, /Cada anillo representa un ciclo distinto/i);
  assert.doesNotMatch(plano, /<Metodo nombre="Mandala temporal">/);

  for (const phrase of [
    /El capítulo en el que estás/i,
    /Se mide en años, no en días/i,
    /corriendo a la vez/i,
    /Afuera lo lento, adentro lo de hoy/i,
    /se actualiza a diario/i,
    /v1 usa Whole Sign/i,
    /tabla fija de regentes/i,
    // Con límites de palabra: sin ellos, `demo` casa dentro de «po-demo-s` y el
    // gate falla por una palabra común del copy en vez de por un dato de maqueta.
    /\b(?:mock|fixture|sample|demo)\b/i,
    /Gibosa\s*·\s*(?:año|2,1)/i,
    /12\s+MAY|2\s+AGO|31\s+AGO/i
  ]) {
    assert.doesNotMatch(plano, phrase);
  }

  const caminoMock = pathTo(
    ENTRY,
    (rel) => /(?:^|\/)(?:content|domain|services)\/[^/]*(?:mock|fixture|sample|demo)/i.test(rel),
    "native"
  );
  assert.equal(caminoMock, null, caminoMock ? caminoMock.join(" -> ") : ENTRY);
});

test("la estación vital escribe mes y AÑO: una fase dura ~3,7 años", () => {
  // El defecto medido contra el frame: la pantalla escribía `EMPEZÓ 17 DIC` y
  // `PRÓXIMA FASE 8 NOV`. Una fase dura unos 3,7 años, así que sus dos bordes
  // caen en años distintos y sin el año `PRÓXIMA FASE 8 NOV` se lee como "este
  // 8 de noviembre". El frame escribe `EMPEZÓ MAY 2024` · `PRÓXIMA FASE NOV 2027`.
  const tz = "America/Argentina/Buenos_Aires";
  assert.equal(formatShortMonthYear(Date.UTC(2024, 4, 20, 15, 0), tz), "MAY 2024");
  assert.equal(formatShortMonthYear(Date.UTC(2027, 10, 8, 15, 0), tz), "NOV 2027");
  // La zona manda: un instante UTC de la madrugada del 1 de enero todavía es
  // diciembre del año anterior en Buenos Aires.
  assert.equal(formatShortMonthYear(Date.UTC(2025, 0, 1, 2, 0), tz), "DIC 2024");

  const pantalla = sinComentarios(leer("src/screens/v492/TransitosLayersScreen.tsx"));
  assert.match(pantalla, /EMPEZÓ \$\{inicio\}/);
  assert.match(pantalla, /formatShortMonthYear\(data\.phaseStartedAt, timezone\)/);
  assert.match(pantalla, /formatShortMonthYear\(data\.nextPhaseAt, timezone\)/);
  // El día ya no entra en esta capa: es la que se mide en años.
  assert.doesNotMatch(pantalla, /formatShortDayMonth\(data\.phaseStartedAt/);
  assert.doesNotMatch(pantalla, /formatShortDayMonth\(data\.nextPhaseAt/);
});

test("debajo del mandala hay UNA línea por ritmo, sin pie ni recuentos que puedan discrepar", () => {
  // Historia: el pie contaba anillos en prosa —"Ves 1 anillos de 4"— y tuvo que
  // aprender a concordar el número con el sustantivo y a contar exactamente lo
  // que el SVG dibuja. Ahora directamente no está: repetía el párrafo del método
  // y era la tercera vez que la pantalla explicaba el mismo dibujo. Sin frase no
  // hay recuento que pueda discrepar del SVG.
  const pantalla = sinComentarios(leer("src/screens/v492/TransitosLayersScreen.tsx"));
  assert.doesNotMatch(pantalla, /Ves \$\{dibujados\}/);
  assert.doesNotMatch(pantalla, /dibujados === 1 \? "anillo" : "anillos"/);
  assert.doesNotMatch(pantalla, /faltan === 1 \? "El que falta se agrega"/);
  assert.doesNotMatch(pantalla, /mandalaDrawnRings/, "la pantalla ya no recuenta anillos: los cuenta el disco");
  assert.doesNotMatch(pantalla, /numeroEnPalabras/);

  // Y lo que queda es la leyenda: un renglón por ritmo del contrato, con su
  // rótulo y su estado.
  const mandala = pantalla.slice(pantalla.indexOf("function Mandala("));
  assert.match(mandala, /data\.rings\.map\(\(ring\)\s*=>/);
  assert.match(mandala, /ring\.label\.toLocaleUpperCase\("es"\)/);
  assert.match(mandala, /\{ring\.state\}/);
});
