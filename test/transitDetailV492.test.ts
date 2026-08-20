/**
 * El modelo del detalle del tránsito: la línea de tiempo como datos y la lectura
 * defensiva de los campos del sobre.
 *
 * Dos cosas, las dos puras y las dos probadas acá enteras:
 *
 * 1. **`transitTimeline`** — qué marcas tiene la ventana, dónde caen, cómo se
 *    rotulan y qué se anuncia. Lo que se fija es lo que la certificación
 *    reclamaba: los bordes como contexto, cada contacto exacto dibujado, HOY
 *    ubicado, la coincidencia `HOY · EXACTO` resuelta en UNA marca, el año cuando
 *    la ventana lo cruza y UN solo anuncio para VoiceOver.
 * 2. **`transitDetailExtras`** — los cinco campos que `ORB-TRN-001` publica
 *    además de la ventana (`previousExactAt`, `nextExactAt`, `rankingWindow`,
 *    `rankingReason`, `natalHouse`), leídos como OPCIONALES y validados aunque el
 *    contrato ya los declare obligatorios. Lo que la pantalla dibuja es un sobre
 *    PERSISTIDO, y uno guardado antes del cambio sigue siendo válido para leer
 *    sin traerlos: ahí cada bloque simplemente no se dibuja, en vez de mostrar un
 *    hueco o una fecha `undefined`. Y NUNCA se toman de otro sobre.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  TIMELINE_LABEL,
  transitDetailExtras,
  transitTimeline,
  type TimelineMark
} from "../src/domain/transitDetail";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const UTC = "UTC";
const BA = "America/Argentina/Buenos_Aires";

/** Una ventana de tres semanas de septiembre de 2026, con su pico al medio. */
const INICIO = Date.UTC(2026, 8, 12, 0, 0);
const PICO = Date.UTC(2026, 8, 20, 12, 0);
const CIERRE = Date.UTC(2026, 9, 2, 0, 0);

const tipos = (marks: readonly TimelineMark[]) => marks.map((mark) => mark.kind);
const rotulos = (marks: readonly TimelineMark[]) => marks.map((mark) => mark.label);

// ---------------------------------------------------------------------------
// Las marcas
// ---------------------------------------------------------------------------

test("la ventana se dibuja con sus bordes, su contacto y HOY, en orden", () => {
  const linea = transitTimeline({
    startsAt: INICIO,
    peakAt: PICO,
    endsAt: CIERRE,
    nowMs: Date.UTC(2026, 8, 22, 10, 0),
    timezone: UTC
  });

  assert.deepEqual(tipos(linea.marks), ["start", "contact", "today", "end"]);
  assert.deepEqual(rotulos(linea.marks), ["INICIO", "EXACTO", "HOY", "CIERRE"]);
  // Los bordes anclan la escala; lo de adentro cae donde le toca.
  assert.equal(linea.marks[0].ratio, 0);
  assert.equal(linea.marks[3].ratio, 1);
  for (const mark of linea.marks) {
    assert.ok(mark.ratio >= 0 && mark.ratio <= 1, `${mark.label} fuera de la escala`);
  }
  assert.ok(linea.marks[1].ratio < linea.marks[2].ratio, "el contacto ya pasó, HOY está después");
  assert.equal(linea.todayInside, true);
  assert.equal(linea.todayIsContact, false);
  assert.equal(linea.estimated, false);
});

test("sin contactos verificados el pico es el único contacto, y con ellos se dibujan todos", () => {
  const soloPico = transitTimeline({
    startsAt: INICIO,
    peakAt: PICO,
    endsAt: CIERRE,
    nowMs: 0,
    timezone: UTC
  });
  assert.deepEqual(tipos(soloPico.marks), ["start", "contact", "end"]);
  assert.equal(soloPico.marks[1].atMs, PICO);

  // Un tránsito retrógrado pasa dos o tres veces por el mismo punto: las tres
  // son parte del mismo proceso y las tres se dibujan.
  const tres = [Date.UTC(2026, 8, 14), PICO, Date.UTC(2026, 8, 28)];
  const conPasadas = transitTimeline({
    startsAt: INICIO,
    peakAt: PICO,
    endsAt: CIERRE,
    contacts: tres,
    nowMs: 0,
    timezone: UTC
  });
  assert.deepEqual(tipos(conPasadas.marks), ["start", "contact", "contact", "contact", "end"]);
  assert.deepEqual(
    conPasadas.marks.filter((mark) => mark.kind === "contact").map((mark) => mark.atMs),
    tres
  );
});

test("un contacto fuera de la ventana no se dibuja, y dos del mismo día son uno", () => {
  const linea = transitTimeline({
    startsAt: INICIO,
    peakAt: PICO,
    endsAt: CIERRE,
    contacts: [
      Date.UTC(2026, 7, 1), // antes del inicio
      Date.UTC(2026, 8, 20, 3, 0), // el mismo día civil que el pico
      PICO,
      Date.UTC(2026, 10, 5) // después del cierre
    ],
    nowMs: 0,
    timezone: UTC
  });
  const contactos = linea.marks.filter((mark) => mark.kind === "contact");
  assert.equal(contactos.length, 1, "una marca por día civil: dos puntos en la misma fecha se pisan");
  assert.equal(contactos[0].atMs, Date.UTC(2026, 8, 20, 3, 0), "gana el primero del día");
});

test("HOY no se dibuja fuera de la ventana: no hay dónde ponerlo sin mentir", () => {
  for (const nowMs of [Date.UTC(2026, 7, 1), Date.UTC(2026, 10, 20)]) {
    const linea = transitTimeline({
      startsAt: INICIO,
      peakAt: PICO,
      endsAt: CIERRE,
      nowMs,
      timezone: UTC
    });
    assert.deepEqual(tipos(linea.marks), ["start", "contact", "end"]);
    assert.equal(linea.todayInside, false);
    assert.doesNotMatch(linea.voice, /hoy/i, "y tampoco se anuncia");
  }
  // Los días borde cuentan enteros: el día del inicio y el del cierre son dentro.
  for (const nowMs of [Date.UTC(2026, 8, 12, 23, 59), Date.UTC(2026, 9, 2, 0, 1)]) {
    const linea = transitTimeline({
      startsAt: INICIO,
      peakAt: PICO,
      endsAt: CIERRE,
      nowMs,
      timezone: UTC
    });
    assert.equal(linea.todayInside, true, `${new Date(nowMs).toISOString()} cae dentro`);
  }
});

test("cuando hoy ES el contacto exacto, la marca es UNA y lo dice", () => {
  const linea = transitTimeline({
    startsAt: INICIO,
    peakAt: PICO,
    endsAt: CIERRE,
    nowMs: Date.UTC(2026, 8, 20, 23, 0),
    timezone: UTC
  });

  assert.deepEqual(tipos(linea.marks), ["start", "today", "end"], "no hay dos puntos superpuestos");
  assert.equal(linea.todayIsContact, true);
  const hoy = linea.marks[1];
  assert.equal(hoy.label, TIMELINE_LABEL.todayContact);
  assert.equal(hoy.label, "HOY · EXACTO");
  assert.equal(hoy.isTodayContact, true);
  // La marca queda en el INSTANTE del contacto, no en el de "ahora": la escala
  // dibuja el contacto, y hoy es el mismo día.
  assert.equal(hoy.atMs, PICO);
  assert.match(linea.voice, /es el contacto exacto/);
});

test("la coincidencia se decide por día civil y en la zona del aparato", () => {
  // 20 de septiembre 02:00 UTC es todavía el 19 en Buenos Aires (UTC−3).
  const pico = Date.UTC(2026, 8, 20, 2, 0);
  const ahora = Date.UTC(2026, 8, 20, 4, 0); // el 20 en las dos zonas
  const enUtc = transitTimeline({
    startsAt: INICIO,
    peakAt: pico,
    endsAt: CIERRE,
    nowMs: ahora,
    timezone: UTC
  });
  const enBuenosAires = transitTimeline({
    startsAt: INICIO,
    peakAt: pico,
    endsAt: CIERRE,
    nowMs: ahora,
    timezone: BA
  });
  assert.equal(enUtc.todayIsContact, true, "en UTC el contacto es hoy");
  assert.equal(enBuenosAires.todayIsContact, false, "en Buenos Aires el contacto fue ayer");
  assert.deepEqual(tipos(enBuenosAires.marks), ["start", "contact", "today", "end"]);
});

// ---------------------------------------------------------------------------
// Fechas y año
// ---------------------------------------------------------------------------

test("las fechas llevan el año sólo cuando la ventana lo cruza, y lo llevan todas", () => {
  const dentroDelAno = transitTimeline({
    startsAt: INICIO,
    peakAt: PICO,
    endsAt: CIERRE,
    nowMs: Date.UTC(2026, 8, 22),
    timezone: UTC
  });
  assert.equal(dentroDelAno.crossesYear, false);
  for (const mark of dentroDelAno.marks) {
    assert.doesNotMatch(mark.dateLabel, /\d{4}/, `${mark.label}: el año sobra dentro del mismo año`);
  }
  assert.match(dentroDelAno.marks[0].dateLabel, /^12 SEP$/);

  const cruzando = transitTimeline({
    startsAt: Date.UTC(2026, 11, 20),
    peakAt: Date.UTC(2026, 11, 31),
    endsAt: Date.UTC(2027, 0, 15),
    nowMs: Date.UTC(2027, 0, 3),
    timezone: UTC
  });
  assert.equal(cruzando.crossesYear, true);
  for (const mark of cruzando.marks) {
    assert.match(mark.dateLabel, /\b(?:2026|2027)$/, `${mark.label}: sin año, «20 DIC» y «15 ENE» mienten`);
  }
  assert.equal(cruzando.marks[0].dateLabel, "20 DIC 2026");
  assert.match(cruzando.voice, /de 2026/);
  assert.match(cruzando.voice, /de 2027/);

  // Un contacto en otro año también hace que el año aparezca, aunque los bordes
  // caigan en el mismo: es justo el caso que se lee mal.
  const contactoEnEnero = transitTimeline({
    startsAt: Date.UTC(2026, 11, 1),
    peakAt: Date.UTC(2026, 11, 15),
    endsAt: Date.UTC(2026, 11, 31, 20, 0),
    contacts: [Date.UTC(2026, 11, 31, 23, 30)],
    nowMs: 0,
    timezone: "Pacific/Kiritimati"
  });
  assert.equal(contactoEnEnero.crossesYear, true, "en esa zona el contacto ya es del año siguiente");
});

// ---------------------------------------------------------------------------
// El anuncio
// ---------------------------------------------------------------------------

test("la línea se anuncia UNA vez, entera y en orden", () => {
  const linea = transitTimeline({
    startsAt: INICIO,
    peakAt: PICO,
    endsAt: CIERRE,
    contacts: [Date.UTC(2026, 8, 14), PICO],
    nowMs: Date.UTC(2026, 8, 22),
    timezone: UTC
  });

  assert.equal(typeof linea.voice, "string");
  assert.match(linea.voice, /^Duración y momentos clave: /);
  assert.match(linea.voice, /\.$/);
  // Cada marca aparece, con su verbo, y en el mismo orden que el dibujo.
  const posiciones = [
    linea.voice.indexOf("empieza el 12 de septiembre"),
    linea.voice.indexOf("contacto exacto el 14 de septiembre"),
    linea.voice.indexOf("contacto exacto el 20 de septiembre"),
    linea.voice.indexOf("hoy es el 22 de septiembre"),
    linea.voice.indexOf("cierra el 2 de octubre")
  ];
  for (const posicion of posiciones) assert.ok(posicion >= 0, `falta un tramo: ${linea.voice}`);
  assert.deepEqual([...posiciones].sort((a, b) => a - b), posiciones, "el anuncio sigue el orden del dibujo");

  // Con la cronología estimada, el anuncio lo dice: no son contactos confirmados.
  const estimada = transitTimeline({
    startsAt: INICIO,
    peakAt: PICO,
    endsAt: CIERRE,
    nowMs: Date.UTC(2026, 8, 22),
    timezone: UTC,
    estimated: true
  });
  assert.match(estimada.voice, /fechas estimadas/);
  assert.equal(estimada.estimated, true);
});

test("el modelo es determinístico y aguanta una ventana degenerada", () => {
  const args = {
    startsAt: INICIO,
    peakAt: PICO,
    endsAt: CIERRE,
    contacts: [PICO],
    nowMs: Date.UTC(2026, 8, 22),
    timezone: UTC
  };
  assert.deepEqual(transitTimeline(args), transitTimeline(args));

  // Ventana de duración cero: no se divide por cero ni se dibuja fuera de escala.
  const puntual = transitTimeline({
    startsAt: PICO,
    peakAt: PICO,
    endsAt: PICO,
    nowMs: PICO,
    timezone: UTC
  });
  for (const mark of puntual.marks) {
    assert.ok(Number.isFinite(mark.ratio) && mark.ratio >= 0 && mark.ratio <= 1, mark.label);
  }
  assert.equal(puntual.todayIsContact, true, "el contacto es hoy: una sola marca");
  assert.deepEqual(tipos(puntual.marks), ["start", "today", "end"]);
});

// ---------------------------------------------------------------------------
// Los campos opcionales del sobre
// ---------------------------------------------------------------------------

/**
 * Un sobre `ORB-TRN-001` GUARDADO ANTES de que el contrato publicara los cinco
 * campos: sigue siendo válido para mostrar —tiene su ventana, sus pasadas y su
 * resumen— y es el caso que la lectura defensiva existe para atender.
 */
const ARCO_VIEJO = {
  kind: "transit_arc",
  arcId: "arc_v1_abc1234",
  transitPlanet: "Saturno",
  natalPoint: "Sol",
  aspect: "square",
  state: "exact",
  startsAt: INICIO,
  peakAt: PICO,
  endsAt: CIERRE,
  progress: 0.5,
  passes: [{ exactAt: PICO, direction: "direct", label: "1.º contacto" }],
  summary: "Saturno forma una cuadratura de 90° con tu Sol."
};

test("un sobre guardado antes del cambio no inventa ningún campo: todo `null`", () => {
  assert.deepEqual(transitDetailExtras(ARCO_VIEJO), {
    previousExactAt: null,
    nextExactAt: null,
    rankingWindow: null,
    rankingReason: null,
    natalHouse: null
  });
  // Y nada de lo que no es un sobre rompe la lectura.
  for (const basura of [null, undefined, 0, "", "x", [], true]) {
    const extras = transitDetailExtras(basura);
    assert.equal(extras.natalHouse, null, `${String(basura)}`);
    assert.equal(extras.previousExactAt, null);
    assert.equal(extras.rankingReason, null);
  }
});

test("cuando el sobre los trae, se leen tal cual y validados", () => {
  const previo = Date.UTC(2026, 8, 14);
  const proximo = Date.UTC(2026, 8, 28);
  const extras = transitDetailExtras({
    ...ARCO_VIEJO,
    previousExactAt: previo,
    nextExactAt: proximo,
    natalHouse: 7,
    rankingWindow: { startsAt: INICIO, endsAt: CIERRE },
    rankingReason: { key: "exactness", label: "Cercanía", explanation: "Está a 0,42° de su máxima precisión." }
  });
  assert.equal(extras.previousExactAt, previo);
  assert.equal(extras.nextExactAt, proximo);
  assert.equal(extras.natalHouse, 7);
  assert.deepEqual(extras.rankingWindow, { earliest: INICIO, latest: CIERRE });
  assert.deepEqual(extras.rankingReason, {
    label: "Cercanía",
    explanation: "Está a 0,42° de su máxima precisión."
  });

  // La otra forma de ventana que el contrato ya usa también se entiende.
  assert.deepEqual(
    transitDetailExtras({ rankingWindow: { earliest: INICIO, latest: CIERRE } }).rankingWindow,
    { earliest: INICIO, latest: CIERRE }
  );
  // Y una razón que llegue como frase suelta, también.
  assert.deepEqual(transitDetailExtras({ rankingReason: "  Encabeza por cercanía.  " }).rankingReason, {
    label: null,
    explanation: "Encabeza por cercanía."
  });
});

test("un campo malformado se descarta en vez de dibujarse mal", () => {
  // Instantes que no son fechas.
  for (const valor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "2026-09-14", null]) {
    assert.equal(transitDetailExtras({ nextExactAt: valor }).nextExactAt, null, String(valor));
  }
  // Casas fuera del rango real, o que no son enteros.
  for (const casa of [0, 13, -1, 1.5, Number.NaN, "7", null]) {
    assert.equal(transitDetailExtras({ natalHouse: casa }).natalHouse, null, String(casa));
  }
  // Dos raíces al revés no describen ningún contacto: se descartan LAS DOS.
  const invertidas = transitDetailExtras({
    previousExactAt: Date.UTC(2026, 8, 28),
    nextExactAt: Date.UTC(2026, 8, 14)
  });
  assert.equal(invertidas.previousExactAt, null);
  assert.equal(invertidas.nextExactAt, null);
  // Ventanas incompletas, al revés o con otra forma: se ignoran.
  for (const ventana of [
    { earliest: INICIO },
    { latest: CIERRE },
    { earliest: CIERRE, latest: INICIO },
    { from: INICIO, to: CIERRE },
    "12/09 al 02/10",
    42
  ]) {
    assert.equal(transitDetailExtras({ rankingWindow: ventana }).rankingWindow, null, JSON.stringify(ventana));
  }
  // Razones vacías o sin explicación: no hay nada que decir.
  for (const razon of ["", "   ", {}, { label: "Cercanía" }, { explanation: "  " }, 7]) {
    assert.equal(transitDetailExtras({ rankingReason: razon }).rankingReason, null, JSON.stringify(razon));
  }
});

// ---------------------------------------------------------------------------
// El cableado con la pantalla y el dibujo
// ---------------------------------------------------------------------------

test("la pantalla lee los opcionales del sobre del tránsito, nunca del ranking", () => {
  const pantalla = sinComentarios(leer("src/screens/v492/ArcoDetailScreen.tsx"));
  const cuerpo = pantalla.slice(pantalla.indexOf("function ArcoContent"));

  assert.match(cuerpo, /const extra = transitDetailExtras\(arco\)/, "los opcionales salen del arco");
  assert.match(cuerpo, /natalHouse: extra\.natalHouse/, "la casa del significado sale del mismo sobre");
  // El ranking publica `natalHouse` y `reasons`, y tomarlos prestados haría que
  // el detalle afirme con una trazabilidad lo que calculó otro análisis.
  for (const prohibido of ["transitRanking", "item.natalHouse", "item.reasons", "reasonLabel"]) {
    assert.ok(!cuerpo.includes(prohibido), `el detalle no puede usar «${prohibido}»`);
  }
  // Cada bloque que depende de un opcional se dibuja SÓLO si el campo existe.
  assert.match(cuerpo, /extra\.previousExactAt !== null \|\| extra\.nextExactAt !== null \?/);
  assert.match(cuerpo, /extra\.rankingReason \|\| extra\.rankingWindow \?/);
  // Y los contactos de la línea de tiempo son las pasadas más los opcionales.
  assert.match(cuerpo, /\.\.\.arco\.passes\.map\(\(pass\) => pass\.exactAt\)/);
  assert.match(cuerpo, /contacts=\{contactos\}/);
});

test("el dibujo toma el modelo y colorea por tipo de marca", () => {
  const layout = sinComentarios(leer("src/components/v492/Layout.tsx"));
  const linea = layout.slice(layout.indexOf("export function ArcTimeline"), layout.indexOf("export function AspectGlyph"));

  assert.match(linea, /transitTimeline\(\{/, "las marcas no se calculan en la pantalla");
  assert.ok(!/formatShortDayMonth|formatDayMonth/.test(linea), "las fechas ya vienen escritas del modelo");

  // Bordes: gris y HUECOS. Contacto: hueso. Hoy: cobre.
  const marca = layout.slice(layout.indexOf("function Marca("), layout.indexOf("function etiquetaColor("));
  assert.match(marca, /mark\.kind === "start" \|\| mark\.kind === "end"/);
  assert.match(marca, /fill="none"[\s\S]{0,80}stroke=\{v492\.colors\.textDim\}/, "los bordes son huecos y grises");
  assert.match(
    marca,
    /fill=\{mark\.kind === "today" \? v492\.colors\.copper : v492\.colors\.text\}/,
    "hoy en cobre y el contacto en hueso"
  );

  // Un solo anuncio: el dibujo lo lleva y los rótulos quedan ocultos.
  assert.match(linea, /accessibilityLabel=\{timeline\.voice\}/);
  assert.equal((linea.match(/accessibilityLabel=/g) ?? []).length, 1, "un anuncio, no seis fragmentos");
  assert.match(linea, /accessibilityElementsHidden[\s\S]{0,80}no-hide-descendants/);
});
