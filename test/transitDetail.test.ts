/**
 * Cada tránsito del ranking abre su propio detalle (profundización de CORE-191).
 *
 * Dos capas: el contrato puro del backend (`convex/lib/orbita.ts`: identidad
 * estable, búsqueda por id, detalle por contacto) se ejecuta de verdad; y la
 * superficie —la fila enlazada del ranking y la pantalla `/reading/transito`—
 * se afirma sobre el fuente, como el resto de la suite, porque React Native no
 * se renderiza en Node.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { composePayload } from "../convex/daily";
import {
  assignTransitIds,
  buildDailyReadingPayloadFromAstrology,
  buildWebB0TransitDetailPayload,
  buildWebB0TransitDetailPayloadFor,
  findTransitInPayload,
  selectRelevantTransits,
  transitCadence,
  transitIdFor,
  type NormalizedAstroTransit
} from "../convex/lib/orbita";
import type { TarotDraw } from "../convex/lib/tarot";
import { hoyRanking, pedidoDeRutaTransito, transitIdValido } from "../src/domain/hoyPrincipal";
import type { DailyGuidePayload } from "../src/services/appRefs";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function transito(partial: Partial<NormalizedAstroTransit> = {}): NormalizedAstroTransit {
  return {
    transitPlanet: "mars",
    transitPlanetEs: "Marte",
    natalPoint: "venus",
    natalPointEs: "Venus",
    aspectType: "square",
    aspectTypeEs: "cuadratura",
    startTime: "2026-09-04T10:00",
    exactTime: "2026-09-05T14:30",
    endTime: "2026-09-06T18:00",
    isRetrograde: false,
    transitSign: "cancer",
    transitSignEs: "Cáncer",
    natalHouse: 6,
    priority: 90,
    ...partial
  };
}

const saturno = transito({
  transitPlanet: "saturn",
  transitPlanetEs: "Saturno",
  natalPoint: "jupiter",
  natalPointEs: "Júpiter",
  transitSign: "aries",
  transitSignEs: "Aries",
  natalHouse: 3,
  priority: 80
});
const venus = transito({
  transitPlanet: "venus",
  transitPlanetEs: "Venus",
  natalPoint: "ascendant",
  natalPointEs: "Ascendente",
  transitSign: "libra",
  transitSignEs: "Libra",
  natalHouse: null,
  exactTime: null,
  startTime: null,
  endTime: null,
  priority: 70
});
const marteJupiter = transito({
  natalPoint: "jupiter",
  natalPointEs: "Júpiter",
  aspectType: "opposition",
  aspectTypeEs: "oposición",
  priority: 60
});

// --- 1. Identidad estable ----------------------------------------------------

describe("transitIdFor — identidad ligada al contacto, no a la posición", () => {
  it("es determinista y usa las claves canónicas del proveedor", () => {
    assert.equal(transitIdFor(transito()), "mars-square-venus");
    assert.equal(transitIdFor(transito()), transitIdFor(transito({ priority: 1, natalHouse: 12 })));
    assert.equal(transitIdFor(saturno), "saturn-square-jupiter");
    assert.equal(transitIdFor(venus), "venus-square-ascendant");
  });

  it("no depende del texto traducido ni de acentos", () => {
    const conAcentos = transito({ transitPlanet: "Júpiter Retro", aspectType: "Conjunción", natalPoint: "Medio Cielo" });
    assert.match(transitIdFor(conAcentos), /^[a-z0-9_-]+$/);
    assert.equal(transitIdFor(conAcentos), "jupiter_retro-conjuncion-medio_cielo");
  });

  it("dos contactos distintos nunca comparten identidad; el mismo par repetido lleva sufijo", () => {
    const ids = assignTransitIds([transito(), saturno, venus, marteJupiter, transito({ exactTime: "2026-09-05T23:00" })]).map(
      (t) => t.transitId
    );
    assert.deepEqual(ids, [
      "mars-square-venus",
      "saturn-square-jupiter",
      "venus-square-ascendant",
      "mars-opposition-jupiter",
      "mars-square-venus-2"
    ]);
    assert.equal(new Set(ids).size, ids.length);
  });
});

// --- 2. La lectura persistida y la búsqueda por id ---------------------------

describe("findTransitInPayload — exactamente el contacto pedido, o nada", () => {
  const payload = buildDailyReadingPayloadFromAstrology({
    localDate: "2026-09-05",
    timezone: "America/Argentina/Buenos_Aires",
    chart: null,
    transits: [venus, transito(), marteJupiter, saturno]
  });

  it("la lectura guarda los contactos con identidad, ordenados por prioridad", () => {
    const ranked = (payload as { rankedTransits: Array<{ transitId: string; displayText: string }> }).rankedTransits;
    assert.deepEqual(
      ranked.map((t) => t.transitId),
      ["mars-square-venus", "saturn-square-jupiter", "venus-square-ascendant", "mars-opposition-jupiter"]
    );
    assert.equal((payload.transits.highlighted as { transitId: string }).transitId, "mars-square-venus");
    assert.deepEqual(
      payload.transits.secondary.map((t: { transitId: string }) => t.transitId),
      ["saturn-square-jupiter", "venus-square-ascendant"]
    );
  });

  it("cada id abre su propio contacto: filas distintas, tránsitos distintos", () => {
    const abiertos = ["mars-square-venus", "saturn-square-jupiter", "venus-square-ascendant", "mars-opposition-jupiter"].map(
      (id) => findTransitInPayload(payload, id)
    );
    assert.deepEqual(
      abiertos.map((t) => t && `${t.transitPlanetEs} ${t.aspectTypeEs} tu ${t.natalPointEs}`),
      ["Marte cuadratura tu Venus", "Saturno cuadratura tu Júpiter", "Venus cuadratura tu Ascendente", "Marte oposición tu Júpiter"]
    );
    // El cuarto contacto no es el destacado: la búsqueda no colapsa al primero.
    assert.notEqual(abiertos[3]?.natalPoint, abiertos[0]?.natalPoint);
  });

  it("un id que no está en la lectura de hoy devuelve null, nunca otro tránsito", () => {
    assert.equal(findTransitInPayload(payload, "pluto-trine-sun"), null);
    assert.equal(findTransitInPayload(payload, "mars-square-venus-2"), null);
    assert.equal(findTransitInPayload(payload, ""), null);
    assert.equal(findTransitInPayload(null, "mars-square-venus"), null);
  });

  it("una lectura anterior (sin `rankedTransits`) reconstruye la identidad de lo que guardó", () => {
    const legacy = {
      highlightedTransit: transito(),
      selectedTransits: [transito(), saturno, venus],
      transits: { highlighted: transito(), secondary: [saturno, venus] }
    };
    assert.equal(findTransitInPayload(legacy, "saturn-square-jupiter")?.natalPointEs, "Júpiter");
    assert.equal(findTransitInPayload(legacy, "venus-square-ascendant")?.natalPointEs, "Ascendente");
    // El cuarto contacto del ranking nunca se guardó: no se inventa.
    assert.equal(findTransitInPayload(legacy, "mars-opposition-jupiter"), null);
  });
});

// --- 2b. La guía y la lectura coinciden contacto por contacto ---------------

describe("cada transitId que publica la guía resuelve al mismo contacto en la lectura", () => {
  const carta: TarotDraw = {
    id: 71,
    key: "pentacles_08",
    nombre: "Ocho de Oros",
    arcana: "minor",
    suit: "pentacles",
    rank: "08",
    correspondencia: "Oros · Tierra",
    orientacion: "derecho"
  };
  const generated = {
    headline: "Un día para sostener",
    body: "cuerpo",
    clima: "Constante.",
    destacadoLectura: "Lectura real del destacado."
  };
  // Cinco contactos, con uno repetido: la guía se queda con cuatro (su límite) y
  // la lectura conserva ocho. Ambas parten de la MISMA lista normalizada.
  const lista = [venus, transito(), marteJupiter, saturno, transito({ exactTime: "2026-09-05T23:00", priority: 10 })];

  it("la guía selecciona con el mismo algoritmo y publica identidades que la lectura resuelve", () => {
    const guia = composePayload({ carta, generated, transits: selectRelevantTransits(lista, 4) });
    const lectura = buildDailyReadingPayloadFromAstrology({
      localDate: "2026-09-05",
      timezone: "America/Argentina/Buenos_Aires",
      chart: null,
      transits: lista
    });
    const filas = [guia.destacado, ...guia.secundarios];
    assert.equal(filas.length, 4);
    for (const fila of filas) {
      assert.ok(fila.transitId, `la fila «${fila.aspecto}» viene sin identidad`);
      const resuelto = findTransitInPayload(lectura, fila.transitId as string);
      assert.ok(resuelto, `la lectura no resuelve ${fila.transitId}`);
      // El contacto resuelto es el mismo que la guía escribió en su línea.
      assert.ok(
        fila.aspecto.startsWith(resuelto.transitPlanetEs) && fila.aspecto.includes(`tu ${resuelto.natalPointEs}`),
        `${fila.transitId} abrió «${resuelto.transitPlanetEs} → ${resuelto.natalPointEs}» para la fila «${fila.aspecto}»`
      );
    }
    // Y dos filas nunca abren el mismo contacto.
    assert.equal(new Set(filas.map((f) => f.transitId)).size, filas.length);
  });

  it("el quinto contacto, que la guía no muestra, sigue existiendo en la lectura con su propia identidad", () => {
    const lectura = buildDailyReadingPayloadFromAstrology({
      localDate: "2026-09-05",
      timezone: "America/Argentina/Buenos_Aires",
      chart: null,
      transits: lista
    });
    assert.equal(findTransitInPayload(lectura, "mars-square-venus-2")?.exactTime, "2026-09-05T23:00");
  });
});

// --- 3. El detalle por contacto ---------------------------------------------

describe("buildWebB0TransitDetailPayloadFor — el detalle del contacto elegido", () => {
  it("publica identidad, cuerpos, aspecto, casa, ventana y cadencia sin rellenar", () => {
    const detalle = buildWebB0TransitDetailPayloadFor({ ...saturno, transitId: "saturn-square-jupiter" }, "2026-09-05");
    assert.equal(detalle.transitId, "saturn-square-jupiter");
    assert.equal(detalle.title, "Saturno cuadratura tu Júpiter");
    assert.equal(detalle.scene.transitingBody.label, "Saturno");
    assert.equal(detalle.scene.natalPoint.label, "Júpiter");
    assert.equal(detalle.aspect.angleLabel, "90 grados");
    assert.equal(detalle.natalHouse, 3);
    assert.equal(typeof detalle.houseTheme, "string");
    assert.equal(detalle.cadence, "Dura 2 días");
    assert.equal(detalle.window.label, "Pico estimado");
    assert.ok(detalle.earth.headline.length > 0);
    assert.ok(detalle.earth.suggestions.length > 0);
  });

  it("sin casa ni horas, lo dice: no fabrica una casa ni una ventana", () => {
    const detalle = buildWebB0TransitDetailPayloadFor({ ...venus, transitId: "venus-square-ascendant" }, "2026-09-05");
    assert.equal(detalle.natalHouse, null);
    assert.equal(detalle.houseTheme, null);
    assert.match(detalle.reading.plain, /casa natal queda pendiente/);
    assert.equal(detalle.window.label, "Fecha local");
    assert.deepEqual(detalle.frequency.timeline, [{ label: "2026-09-05", current: true }]);
  });

  it("la cadencia sale de la ventana real del contacto, o no se afirma", () => {
    assert.equal(transitCadence({ transitPlanet: "moon", startTime: "2026-09-05T02:00", endTime: "2026-09-05T20:00" }), "Cambia dentro del día");
    assert.equal(transitCadence({ transitPlanet: "mars", startTime: "2026-09-01T00:00", endTime: "2026-09-09T00:00" }), "Dura 8 días");
    assert.equal(transitCadence({ transitPlanet: "saturn", startTime: "2026-08-01T00:00", endTime: "2026-09-12T00:00" }), "Dura 6 semanas");
    assert.equal(transitCadence({ transitPlanet: "pluto", startTime: "2026-01-01T00:00", endTime: "2026-12-01T00:00" }), "Dura 11 meses");
    assert.equal(transitCadence({ transitPlanet: "venus", startTime: null, endTime: null }), undefined);
    assert.equal(transitCadence({ transitPlanet: "venus", startTime: "2026-09-09T00:00", endTime: "2026-09-01T00:00" }), undefined);
    assert.equal(buildWebB0TransitDetailPayloadFor({ ...saturno, transitId: "saturn-square-jupiter" }, "2026-09-05").cadence, "Dura 2 días");
    assert.equal(buildWebB0TransitDetailPayloadFor({ ...venus, transitId: "venus-square-ascendant" }, "2026-09-05").cadence, undefined);
  });

  it("el destacado del día conserva la identidad guardada en la lectura", () => {
    const payload = buildDailyReadingPayloadFromAstrology({
      localDate: "2026-09-05",
      timezone: "America/Argentina/Buenos_Aires",
      chart: null,
      transits: [saturno, transito()]
    });
    const destacado = buildWebB0TransitDetailPayload(payload, "2026-09-05");
    assert.equal(destacado.transitId, "mars-square-venus");
    assert.equal(destacado.title, "Marte cuadratura tu Venus");
    // Sin tránsito no hay identidad: el detalle pendiente no promete un contacto.
    assert.equal(buildWebB0TransitDetailPayload({}, "2026-09-05").transitId, undefined);
  });
});

// --- 4. Del ranking de Hoy a la ruta ------------------------------------------

describe("el ranking de Hoy lleva la identidad hasta la ruta", () => {
  function guia(partial: Partial<DailyGuidePayload> = {}): DailyGuidePayload {
    return {
      headline: "Un día para poner límites sin romper nada",
      body: "cuerpo",
      clima: "clima",
      destacado: { aspecto: "Marte en Cáncer cuadratura tu Venus (casa 6)", lectura: "Lectura real.", transitId: "mars-square-venus" },
      secundarios: [
        { aspecto: "Saturno en Aries cuadratura tu Júpiter (casa 3)", lectura: "", transitId: "saturn-square-jupiter" },
        { aspecto: "Venus en Libra cuadratura tu Ascendente (casa 10)", lectura: "" }
      ],
      basadoEn: [],
      disclaimer: "d",
      ...partial
    };
  }

  it("cada fila conserva su propio transitId y una fila legacy queda sin él", () => {
    const filas = hoyRanking(guia());
    assert.deepEqual(
      filas.map((f) => f.transitId),
      ["mars-square-venus", "saturn-square-jupiter", null]
    );
    assert.equal(new Set(filas.slice(0, 2).map((f) => f.transitId)).size, 2);
  });

  it("un transitId malformado no viaja: la fila queda sin detalle", () => {
    const filas = hoyRanking(guia({ destacado: { aspecto: "Marte cuadratura tu Venus", lectura: "", transitId: "../otro?id=1" } }));
    assert.equal(filas[0].transitId, null);
  });

  it("la ruta distingue «sin id» (destacado), id válido (contacto) e id inválido (nunca el destacado)", () => {
    assert.deepEqual(pedidoDeRutaTransito(undefined), { kind: "destacado" });
    assert.deepEqual(pedidoDeRutaTransito(null), { kind: "destacado" });
    assert.deepEqual(pedidoDeRutaTransito("mars-square-venus"), { kind: "contacto", transitId: "mars-square-venus" });
    assert.deepEqual(pedidoDeRutaTransito(["saturn-square-jupiter", "otro"]), { kind: "contacto", transitId: "saturn-square-jupiter" });
    for (const malo of ["", "   ", "Mars-Square-Venus", "marte-cuadratura-vénus", "mars square venus", "../otro?id=1", "a".repeat(121)]) {
      assert.deepEqual(pedidoDeRutaTransito(malo), { kind: "invalido" }, `«${malo}» tendría que ser inválido`);
      assert.equal(transitIdValido(malo), null);
    }
  });

  const RANKING = sinComentarios(leer("src/components/home/hoy/HoyRanking.tsx"));
  // La ruta es un wrapper (CORE-247): la implementación web vive en src/routes/v492.
  const DETALLE = sinComentarios(leer("src/routes/v492/reading-transito.web.tsx"));
  const APPREFS = sinComentarios(leer("src/services/appRefs.ts"));

  it("la fila con identidad es un enlace accesible a su propio detalle", () => {
    // CORE-238: la fila con identidad es la `PFila` del panorama (PanoramaUI),
    // que ya es el enlace accesible a `/reading/transito?id=…`; Hoy la monta
    // sólo cuando `filaDeHoyComoVista` devuelve una vista (con `transitId`).
    const PANORAMA = sinComentarios(leer("src/components/transitos/PanoramaUI.tsx"));
    assert.match(PANORAMA, /const href: Href = \{ pathname: "\/reading\/transito", params: \{ id: fila\.transitId \} \};/);
    assert.match(PANORAMA, /accessibilityRole="link"/);
    assert.match(PANORAMA, /Abrir el detalle de este tránsito\./);
    assert.match(PANORAMA, /onHoverIn=/);
    assert.match(PANORAMA, /onFocus=/);
    assert.match(RANKING, /const vista = filaDeHoyComoVista\(fila\);/);
    assert.match(RANKING, /vista \? \(\s*<PFila key=\{fila\.clave\} fila=\{vista\} conCuerpo=\{vista\.cuerpo\.length > 0\} ultima=/);
    assert.match(RANKING, /minHeight: 44/);
  });

  it("la fila legacy no promete un detalle inexistente y lo dice", () => {
    assert.match(RANKING, /<HoyRankingFilaFija fila=\{fila\} \/>/);
    assert.match(RANKING, /DETALLE NO DISPONIBLE/);
    assert.doesNotMatch(RANKING, /params: \{ id: fila\.clave/);
  });

  it("«Ver todos los tránsitos» sigue yendo a Tránsitos (RUTA_TRANSITOS: /transito en web, la pestaña en nativo)", () => {
    // CORE-238: con el panorama el pie dice «VER LOS N CONTACTOS ACTIVOS»; sin
    // total conocido, «VER TODOS LOS TRÁNSITOS». El destino no cambia.
    assert.match(RANKING, /<HoyEnlace href=\{RUTA_TRANSITOS\}>\{enlace \?\? "VER TODOS LOS TRÁNSITOS"\}<\/HoyEnlace>/);
  });

  it("la pantalla abre exactamente el id de la ruta con el contrato compartido por web y nativo", () => {
    assert.match(DETALLE, /useLocalSearchParams<\{ id\?: string \| string\[\] \}>\(\)/);
    assert.match(DETALLE, /const pedido = pedidoDeRutaTransito\(params\.id\);/);
    assert.match(DETALLE, /useAction\(proposedApi\.transitDetail\)/);
    assert.match(DETALLE, /getDetail\(\{ localDate, transitId \}\)/);
    assert.match(DETALLE, /pedido\.kind === "contacto" \? <TransitoContactoLive transitId=\{pedido\.transitId\} \/> : <TransitoDetalleLive \/>/);
    // Un id presente pero inválido tiene su propio estado y no cae al destacado.
    assert.match(DETALLE, /if \(pedido\.kind === "invalido"\) \{/);
    assert.match(DETALLE, /Este enlace no señala/);
    assert.match(APPREFS, /transitDetail: anyApi\.transits\.getDetail as FunctionReference</);
    assert.match(APPREFS, /\{ localDate: string; transitId: string \},\s*TransitDetailResult/);
  });

  it("cubre carga, error con reintento, dato ausente y vuelta", () => {
    assert.match(DETALLE, /kind: "not_found"/);
    assert.match(DETALLE, /Este tránsito no está/);
    assert.match(DETALLE, /<ErrorState onRetry=\{\(\) => setAttempt\(\(a\) => a \+ 1\)\} \/>/);
    assert.match(DETALLE, /Leyendo este tránsito…/);
    // El botón volver lo pone `DetailScreen`, que envuelve todos los estados.
    const detailScreen = sinComentarios(leer("src/components/home/DetailScreen.tsx"));
    assert.match(detailScreen, /accessibilityLabel="Volver"/);
    assert.equal((DETALLE.match(/<DetailScreen eyebrow="Tránsito · Hoy">/g) ?? []).length >= 8, true);
  });

  it("no hay mocks ni plantillas como lectura: el detalle sólo viene del backend", () => {
    assert.doesNotMatch(DETALLE, /mock|MOCK|appData/);
    assert.doesNotMatch(RANKING, /mock|appData/);
    assert.match(DETALLE, /r\?\.status === "ready" && r\.detail/);
  });
});
