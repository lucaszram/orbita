/**
 * QA22 · bloque 2 — Tránsitos: título legible, un solo estado, dos hitos y una
 * pantalla que se lee antes de terminar de calcular.
 *
 * Cinco hallazgos del registro físico del build 22
 * (`native-v492/docs/QA-FISICA-BUILD22.md`), cada uno con su regresión:
 *
 * - **QA22-008** — la cabecera de cada fila era sólo símbolos y no se podía
 *   elegir un tránsito sin conocer los glifos.
 * - **QA22-009** — el mismo tránsito decía `ACERCÁNDOSE · EXACTO HOY` en la lista
 *   y `EXACTO` en su detalle, y encima anunciaba un "próximo contacto" que era el
 *   de hoy.
 * - **QA22-010** — `HOY` y `EXACTO` se fusionaban en un solo marcador cuando
 *   compartían fecha, justo en el caso más relevante.
 * - **QA22-011** — la primera apertura de un detalle reemplazaba TODA la pantalla
 *   por “Calculando la línea de tiempo de este tránsito…”.
 * - **QA22-012** — con tres contactos, los rótulos de la línea de tiempo saltaban
 *   a una segunda fila desde la izquierda y dejaban de corresponderse con sus
 *   marcas.
 *
 * Lo que se prueba corriendo es la decisión pura; lo estructural sólo cubre el
 * cableado que una prueba de dominio no puede ver (qué pantalla dibuja qué, y en
 * qué orden).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { transitHeadline, transitShortTitle } from "../src/domain/layers";
import { transitPreviewFromRanking, transitTimeline } from "../src/domain/transitDetail";
import {
  CANONICAL_STATE_CHIP,
  canonicalTransitState,
  contactWorthNaming,
  summaryWithCanonicalState
} from "../src/domain/transitState";
import type { TransitRankingItem } from "../src/services/layersApi";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const UTC = "UTC";
const ARCO = "src/screens/v492/ArcoDetailScreen.tsx";

/** El caso fotografiado: Luna–Marte el 20 de agosto, con el pico a las 16:00. */
const HOY_10 = Date.UTC(2026, 7, 20, 10, 0);
const PICO_16 = Date.UTC(2026, 7, 20, 16, 0);
const HOY_18 = Date.UTC(2026, 7, 20, 18, 0);
const MANANA_10 = Date.UTC(2026, 7, 21, 10, 0);

/**
 * La fila tal como la publica `ORB-TRN-002` en la captura del hallazgo: orbe
 * 0°07′ (0,1167°, por encima del umbral de 0,1° del backend) y por eso `state`
 * `approaching`, con el pico ese mismo día.
 */
const FILA: TransitRankingItem = {
  arcId: "arc_v2_luna_marte",
  transitPlanet: "Luna",
  natalPoint: "Marte",
  aspect: "square",
  aspectDegrees: 90,
  orbDegrees: 0.1167,
  state: "approaching",
  exactAt: PICO_16,
  previousExactAt: null,
  nextExactAt: PICO_16,
  rankingWindow: { startsAt: Date.UTC(2026, 7, 19), endsAt: Date.UTC(2026, 7, 21) },
  rankingReason: "Exacto hoy",
  startsAt: Date.UTC(2026, 7, 19),
  endsAt: Date.UTC(2026, 7, 21),
  natalHouse: 7,
  reasons: [{ key: "exactness", label: "Cercanía", explanation: "Está a 0,12° de su máxima precisión." }],
  summary:
    "Luna y tu Marte forman una cuadratura, un contacto de 90°. Todavía se está acercando al punto más preciso."
};

/**
 * El MISMO arco tal como lo publica `ORB-TRN-001`: su `state` es `exact` porque
 * `arcStage` llama exacto a cualquier contacto a menos de 6 h del instante de
 * referencia, y a las 10:00 el pico de las 16:00 entra en esa ventana.
 */
const RESUMEN_DEL_ARCO =
  "Luna forma una cuadratura de 90° con tu Marte. Ahora está en su momento más preciso. Esto señala un tema para observar, no un hecho que tenga que ocurrir.";

// ---------------------------------------------------------------------------
// QA22-008 — el título corto
// ---------------------------------------------------------------------------

test("cada tránsito tiene un título corto legible, y el completo sigue entero", () => {
  // El defecto: tres glifos eran todo lo que la línea de arriba decía. Lucas no
  // pudo encontrar Saturno–Júpiter en su propia lista y tuvo que leer los
  // párrafos de abajo uno por uno.
  assert.equal(transitShortTitle(FILA), "Luna cuadratura tu Marte");
  assert.equal(transitShortTitle(FILA).split(" ").length, 4, "tres o cuatro palabras, como pide el hallazgo");
  assert.ok(
    transitShortTitle(FILA).length < transitHeadline(FILA).length,
    "la forma corta tiene que ser más corta que el titular"
  );

  // Los cinco aspectos del contrato producen un título legible, sin jerga ni
  // claves internas.
  for (const aspect of ["conjunction", "sextile", "square", "trine", "opposition"] as const) {
    const titulo = transitShortTitle({ transitPlanet: "Saturno", aspect, natalPoint: "Júpiter" });
    assert.match(titulo, /^Saturno [a-záéíóúñ]+ tu Júpiter$/, aspect);
    assert.ok(!titulo.includes(aspect), "la clave interna no llega a pantalla");
  }
});

test("la fila dibuja el título junto a los glifos y VoiceOver conserva el nombre completo", () => {
  const card = sinComentarios(leer("src/components/v492/TransitCard.tsx"));

  // El título va en la fila, compuesto en el dominio: la plantilla no vive en el
  // JSX, así que la cabecera sigue sin escribir nombres a mano.
  assert.match(card, /const titulo = transitShortTitle\(item\);/);
  assert.match(card, /<Body style=\{styles\.titulo\}>\{titulo\}<\/Body>/);

  // Y va DEBAJO de la notación, no dentro de ella: en el renglón de la cabecera
  // tendría que compartir ancho con el ordinal y el orbe, que es el reparto que
  // rompía la versión con nombres.
  const cabecera = card.slice(card.indexOf("styles.head"), card.indexOf("styles.titulo"));
  assert.match(cabecera, /<BodyMark name=\{item\.transitPlanet\}/, "los símbolos se conservan");
  assert.match(cabecera, /<AspectGlyph aspect=\{item\.aspect\}/);
  assert.match(cabecera, /<BodyMark name=\{item\.natalPoint\}/);
  assert.ok(
    card.indexOf("styles.titulo") > card.indexOf("styles.orb"),
    "el título va después del renglón de los símbolos y el orbe, no adentro"
  );
  const notacion = /shorthand:\s*\{([^}]*)\}/s.exec(card)?.[1] ?? "";
  assert.ok(notacion, "no se encontró el estilo de la notación compacta");
  assert.doesNotMatch(notacion, /flexWrap/, "la notación sigue siendo un solo renglón");

  // El rótulo no puede recortarse: es justo el dato que vino a hacer legible.
  const titulo = /\btitulo:\s*\{([^}]*)\}/s.exec(card)?.[1] ?? "";
  assert.ok(titulo, "no se encontró el estilo del título corto");
  assert.doesNotMatch(titulo, /numberOfLines/);
  assert.ok(!/<Body style=\{styles\.titulo\} numberOfLines/.test(card));

  // VoiceOver sigue recibiendo el titular COMPLETO, no la secuencia de símbolos
  // ni la forma corta.
  const voz = /const voz = \[[\s\S]*?\.join\(" "\);/.exec(card)?.[0] ?? "";
  assert.ok(voz, "no se encontró la etiqueta accesible de la fila");
  assert.match(voz, /\$\{headline\}/);
});

// ---------------------------------------------------------------------------
// QA22-009 — un solo estado para el mismo arco y el mismo instante
// ---------------------------------------------------------------------------

test("la lista y el detalle derivan la MISMA etapa del mismo arco y el mismo instante", () => {
  // El defecto medido: `ORB-TRN-002` decide por orbe (0,1167° > 0,1° →
  // `approaching`) y `ORB-TRN-001` por tiempo (pico dentro de ±6 h → `exact`).
  // Dos reglas, dos respuestas y una sola persona mirando.
  const enLaLista = canonicalTransitState({
    published: FILA.state,
    contacts: [FILA.exactAt, FILA.previousExactAt, FILA.nextExactAt],
    nowMs: HOY_10,
    timezone: UTC
  });
  const enElDetalle = canonicalTransitState({
    published: "exact",
    contacts: [PICO_16, null],
    nowMs: HOY_10,
    timezone: UTC
  });

  assert.equal(enLaLista.state, enElDetalle.state, "el mismo arco no puede tener dos etapas");
  assert.equal(enLaLista.chip, enElDetalle.chip);
  assert.equal(enLaLista.state, "approaching", "hasta el pico, se está acercando");
  assert.equal(enLaLista.chip, "ACERCÁNDOSE");
  assert.equal(enElDetalle.corrected, true, "el detalle es el que decía otra cosa");
  assert.equal(enLaLista.corrected, false);
  // El pico es de hoy, y la etapa lo dice con la hora: es la forma
  // `ACERCÁNDOSE · EXACTO HOY` que el hallazgo pide.
  assert.equal(enLaLista.peakToday, true);
  assert.equal(enLaLista.peakAt, PICO_16);
  assert.match(enLaLista.label, /hoy a las 16:00/);

  // Y siguen juntas en los otros dos tramos del día: durante el minuto del pico
  // y después. La coherencia no es de un instante afortunado.
  for (const nowMs of [PICO_16, HOY_18]) {
    const lista = canonicalTransitState({
      published: FILA.state,
      contacts: [FILA.exactAt, FILA.previousExactAt, FILA.nextExactAt],
      nowMs,
      timezone: UTC
    });
    const detalle = canonicalTransitState({
      published: "exact",
      contacts: [PICO_16, null],
      nowMs,
      timezone: UTC
    });
    assert.equal(lista.state, detalle.state, String(nowMs));
    assert.equal(lista.chip, detalle.chip, String(nowMs));
    assert.equal(lista.label, detalle.label, String(nowMs));
  }
});

test("`EXACTO AHORA` dura el minuto del pico: ni antes, ni el resto del día", () => {
  // La regla, cerrada: antes del pico se acerca; durante su MINUTO civil es
  // exacto; pasado ese minuto se integra. Un `EXACTO AHORA` que durara hasta la
  // medianoche diría a las 23:40 que un contacto de las 16:00 está ocurriendo
  // *ahora*: la misma afirmación falsa de QA22-009, con otra ventana.
  const alas = (nowMs: number) =>
    canonicalTransitState({ published: "approaching", contacts: [PICO_16], nowMs, timezone: UTC });

  // ANTES — todavía se acerca, incluso a un minuto del pico.
  assert.equal(alas(HOY_10).state, "approaching");
  assert.equal(alas(PICO_16 - 60_000).state, "approaching", "a las 15:59 todavía falta");
  assert.equal(alas(PICO_16 - 1).state, "approaching", "el último milisegundo del minuto anterior");

  // EL MISMO MINUTO — es lo único que se dice `ahora`.
  assert.equal(alas(PICO_16).state, "exact", "el cambio ocurre EN ese instante, no antes");
  assert.equal(alas(PICO_16 + 59_999).state, "exact", "y el minuto vale entero, hasta el :59");

  // DESPUÉS — el minuto siguiente ya se está integrando, aunque siga siendo hoy.
  assert.equal(alas(PICO_16 + 60_000).state, "integrating", "16:01 ya no es «ahora»");
  assert.equal(alas(HOY_18).state, "integrating", "el resto del día NO es el pico");
  assert.equal(alas(MANANA_10).state, "integrating");

  // El minuto manda hacia los dos lados: un pico con segundos (16:00:45) ya es
  // exacto a las 16:00:10, porque el reloj de la persona marca las dos 16:00.
  assert.equal(
    canonicalTransitState({
      published: "approaching",
      contacts: [PICO_16 + 45_000],
      nowMs: PICO_16 + 10_000,
      timezone: UTC
    }).state,
    "exact",
    "el mismo minuto civil, aunque el instante exacto todavía no llegó"
  );

  // El vocabulario de cada tramo.
  assert.equal(alas(PICO_16).chip, "EXACTO AHORA");
  assert.equal(alas(PICO_16).label, "Está en su punto más exacto ahora");
  assert.equal(alas(HOY_10).chip, "ACERCÁNDOSE");
  assert.equal(alas(HOY_10).label, "Se acerca al punto exacto, hoy a las 16:00");
  assert.equal(alas(HOY_18).chip, "INTEGRÁNDOSE");
  assert.equal(CANONICAL_STATE_CHIP.approaching, "ACERCÁNDOSE");
  assert.equal(CANONICAL_STATE_CHIP.integrating, "INTEGRÁNDOSE");

  // Y el `EXACTO HOY` del ranking sigue siendo cierto todo el día: `peakToday` no
  // es la etapa. Por eso la frase de las 18:00 lleva la hora, así el chip
  // `INTEGRÁNDOSE` y el motivo `EXACTO HOY` dicen lo mismo en vez de pelearse.
  assert.equal(alas(HOY_18).peakToday, true, "el contacto siguió siendo el de hoy");
  assert.equal(alas(HOY_18).label, "Ya pasó el punto exacto, hoy a las 16:00");
  assert.equal(alas(MANANA_10).peakToday, false);
  assert.equal(alas(MANANA_10).label, "Ya pasó el punto exacto", "otro día no lleva hora");
});

test("el minuto se compara en la zona de la persona, no en UTC", () => {
  // 21 ago 01:00 UTC son las 22:00 del 20 en Buenos Aires: el contacto y el
  // instante son del mismo día civil para quien mira, y del mismo minuto.
  const BA = "America/Argentina/Buenos_Aires";
  const contacto = Date.UTC(2026, 7, 21, 1, 0); // 20 ago 22:00 en Buenos Aires
  const enSuMinuto = canonicalTransitState({
    published: "approaching",
    contacts: [contacto],
    nowMs: contacto + 30_000,
    timezone: BA
  });
  assert.equal(enSuMinuto.state, "exact");
  assert.equal(enSuMinuto.label, "Está en su punto más exacto ahora");
  assert.equal(enSuMinuto.peakToday, true, "para la persona los dos son del 20");

  // Un minuto más tarde se integra, y la hora que se dice es la SUYA (22:00), no
  // la de UTC.
  const despues = canonicalTransitState({
    published: "exact",
    contacts: [contacto],
    nowMs: contacto + 60_000,
    timezone: BA
  });
  assert.equal(despues.state, "integrating");
  assert.equal(despues.label, "Ya pasó el punto exacto, hoy a las 22:00");
  assert.equal(despues.corrected, true, "el sobre decía `exact` y el canon lo corrigió");
});

test("sin ningún instante que comparar, se respeta lo que publicó el sobre", () => {
  // Un sobre guardado antes del cambio de contrato no trae `previousExactAt` ni
  // `nextExactAt`, y puede no traer `exactAt`. Ahí no hay nada que derivar:
  // inventar una etapa sería peor que mostrar la que el cálculo publicó.
  for (const published of ["approaching", "exact", "integrating"] as const) {
    const estado = canonicalTransitState({
      published,
      contacts: [null, undefined, 0, Number.NaN],
      nowMs: HOY_10,
      timezone: UTC
    });
    assert.equal(estado.state, published, published);
    assert.equal(estado.peakAt, null);
    assert.equal(estado.corrected, false);
  }
});

test("el contacto que manda es el más cercano a ahora, y el empate es determinístico", () => {
  const previo = Date.UTC(2026, 7, 18, 16, 0);
  const proximo = Date.UTC(2026, 7, 22, 16, 0);
  const estado = canonicalTransitState({
    published: "approaching",
    contacts: [previo, proximo, PICO_16],
    nowMs: HOY_10,
    timezone: UTC
  });
  assert.equal(estado.peakAt, PICO_16, "el de hoy está a 6 h; los otros a más de 2 días");

  // Dos contactos a la misma distancia: gana el más temprano, siempre.
  const empate = canonicalTransitState({
    published: "approaching",
    contacts: [HOY_10 + 3_600_000, HOY_10 - 3_600_000],
    nowMs: HOY_10,
    timezone: UTC
  });
  assert.equal(empate.peakAt, HOY_10 - 3_600_000);
  assert.deepEqual(
    canonicalTransitState({ published: "exact", contacts: [PICO_16], nowMs: HOY_10, timezone: UTC }),
    canonicalTransitState({ published: "exact", contacts: [PICO_16], nowMs: HOY_10, timezone: UTC }),
    "la derivación es pura"
  );
});

test("el resumen del sobre se pone al día con la etapa canónica, sin reescribir el dato", () => {
  // Sin esto, el detalle mostraba `ACERCÁNDOSE` arriba y "Ahora está en su
  // momento más preciso" tres renglones abajo: el defecto mudado de lugar.
  const alDia = summaryWithCanonicalState(RESUMEN_DEL_ARCO, "approaching");
  assert.match(alDia, /^Luna forma una cuadratura de 90° con tu Marte\. /, "lo factual no se toca");
  assert.match(alDia, /Todavía se acerca al punto más preciso; la línea de tiempo ubica el proceso/);
  assert.ok(!alDia.includes("Ahora está en su momento más preciso"), "la frase vieja no queda");

  // La familia del ranking usa otras frases, y se reconoce igual.
  assert.match(
    summaryWithCanonicalState(FILA.summary, "exact"),
    /^Luna y tu Marte forman una cuadratura, un contacto de 90°\. Está en su momento de mayor exactitud\.$/
  );

  // Cuando ya coincide, el texto vuelve idéntico.
  assert.equal(summaryWithCanonicalState(FILA.summary, "approaching"), FILA.summary);
  // Y un resumen que no termina en ninguna frase conocida —un sobre viejo, otro
  // copy— se dibuja tal cual en vez de recortarse a ciegas.
  const ajeno = "Un resumen de otra época que no termina como los de ahora.";
  assert.equal(summaryWithCanonicalState(ajeno, "exact"), ajeno);
  assert.equal(summaryWithCanonicalState("", "exact"), "");
});

test("un contacto exacto que ya es hoy no se anuncia como «próximo»", () => {
  // La captura del hallazgo: `Próximo contacto exacto: 20 de agosto` en una
  // pantalla que en la misma vista ya trataba ese contacto como el de hoy.
  assert.equal(contactWorthNaming(PICO_16, HOY_10, UTC), false, "es el contacto de hoy");
  assert.equal(contactWorthNaming(PICO_16, HOY_18, UTC), false, "sigue siendo el de hoy");
  assert.equal(contactWorthNaming(Date.UTC(2026, 8, 12), HOY_10, UTC), true, "un contacto de otro día sí");
  assert.equal(contactWorthNaming(Date.UTC(2026, 6, 12), HOY_10, UTC), true, "y uno anterior también");
  for (const valor of [null, 0, -1, Number.NaN]) {
    assert.equal(contactWorthNaming(valor as number | null, HOY_10, UTC), false, String(valor));
  }

  // Y el día se decide en la zona de la persona, no en UTC. A las 22:00 del 20 en
  // Buenos Aires ya es el 21 en UTC: un contacto de las 23:00 UTC del 20 sigue
  // siendo el de HOY para quien lo mira, y en UTC sería "de ayer".
  const BA = "America/Argentina/Buenos_Aires";
  const ahora = Date.UTC(2026, 7, 21, 1, 0); // 20 ago 22:00 en Buenos Aires
  const contacto = Date.UTC(2026, 7, 20, 23, 0); // 20 ago 20:00 en Buenos Aires
  assert.equal(contactWorthNaming(contacto, ahora, BA), false, "para la persona los dos son del 20");
  assert.equal(contactWorthNaming(contacto, ahora, UTC), true, "en UTC ya cayeron en días distintos");
});

// ---------------------------------------------------------------------------
// QA22-010 y QA22-012 — la línea de tiempo con uno y con tres contactos
// ---------------------------------------------------------------------------

test("con UN contacto de hoy, la línea tiene los dos hitos y en orden", () => {
  const linea = transitTimeline({
    startsAt: Date.UTC(2026, 7, 19),
    peakAt: PICO_16,
    endsAt: Date.UTC(2026, 7, 21),
    contacts: [PICO_16],
    nowMs: HOY_10,
    timezone: UTC
  });

  assert.deepEqual(
    linea.marks.map((mark) => mark.label),
    ["INICIO", "HOY", "EXACTO 16:00", "CIERRE"],
    "a las 10:00, HOY va antes del pico de las 16:00"
  );
  // Proporcional: cada marca en su instante, en orden creciente.
  const ratios = linea.marks.map((mark) => mark.ratio);
  assert.deepEqual([...ratios].sort((a, b) => a - b), ratios);
  assert.equal(linea.marks[1].atMs, HOY_10, "HOY es el instante actual, no el día");
  assert.equal(linea.marks[2].atMs, PICO_16);
  assert.equal(linea.todayIsContact, true);
});

test("con TRES contactos, los seis hitos quedan en orden cronológico (QA22-012)", () => {
  // Saturno–Júpiter: tres contactos exactos, más Inicio, Hoy y Cierre. Es la
  // ventana de la captura, donde los rótulos saltaban a una segunda fila
  // empezando desde la izquierda.
  const inicio = Date.UTC(2026, 5, 1);
  const contactos = [Date.UTC(2026, 5, 20), Date.UTC(2026, 7, 5), Date.UTC(2026, 9, 12)];
  const cierre = Date.UTC(2026, 10, 30);
  const linea = transitTimeline({
    startsAt: inicio,
    peakAt: contactos[1],
    endsAt: cierre,
    contacts: contactos,
    nowMs: HOY_10,
    timezone: UTC
  });

  assert.equal(linea.marks.length, 6, "la persona ve seis hitos");
  assert.deepEqual(
    linea.marks.map((mark) => mark.kind),
    ["start", "contact", "contact", "today", "contact", "end"],
    "Inicio · dos picos pasados · Hoy · el pico que falta · Cierre"
  );

  // Cronología estricta: instantes y posiciones crecen juntos, así que cada
  // rótulo cae debajo de su marca sin depender de cómo envuelva la fila.
  const instantes = linea.marks.map((mark) => mark.atMs);
  assert.deepEqual([...instantes].sort((a, b) => a - b), instantes);
  const ratios = linea.marks.map((mark) => mark.ratio);
  assert.deepEqual([...ratios].sort((a, b) => a - b), ratios);

  // Ningún contacto es de hoy: ninguno lleva hora.
  assert.equal(linea.todayIsContact, false);
  for (const mark of linea.marks) assert.doesNotMatch(mark.label, /\d{2}:\d{2}/);

  // Y VoiceOver anuncia los seis, una sola vez y en el mismo orden.
  const posiciones = [
    linea.voice.indexOf("empieza el 1 de junio"),
    linea.voice.indexOf("contacto exacto el 20 de junio"),
    linea.voice.indexOf("contacto exacto el 5 de agosto"),
    linea.voice.indexOf("hoy es el 20 de agosto"),
    linea.voice.indexOf("contacto exacto el 12 de octubre"),
    linea.voice.indexOf("cierra el 30 de noviembre")
  ];
  for (const posicion of posiciones) assert.ok(posicion >= 0, linea.voice);
  assert.deepEqual([...posiciones].sort((a, b) => a - b), posiciones, "el anuncio sigue la cronología");
});

// ---------------------------------------------------------------------------
// QA22-011 — la primera apertura se lee entera menos la cronología
// ---------------------------------------------------------------------------

test("el adelanto compone título, etapa, significado y acción sin una sola fecha", () => {
  const adelanto = transitPreviewFromRanking(FILA, HOY_10, UTC);

  assert.equal(adelanto.headline, "Luna en cuadratura con tu Marte");
  assert.equal(adelanto.chip, "ACERCÁNDOSE", "la etapa es la canónica, no el `state` crudo");
  assert.ok(adelanto.meaning.length > 0 && adelanto.action.length > 0);
  // El significado usa la casa que la fila publica, que es un dato suyo.
  assert.match(adelanto.meaning, /casa 7/);
  // Y NADA de lo que sólo puede afirmar `ORB-TRN-001`: ni fechas, ni ventana, ni
  // trazabilidad. El adelanto es texto derivado, no una cronología prestada.
  assert.deepEqual(Object.keys(adelanto).sort(), ["action", "chip", "headline", "meaning"]);
  for (const valor of Object.values(adelanto)) {
    assert.doesNotMatch(valor, /\b(?:20|21) de agosto\b/, "el adelanto no fecha nada");
  }

  // Y sigue al canon cuando el instante cambia, tramo por tramo: el adelanto dice
  // exactamente lo que va a decir el detalle cuando llegue el sobre.
  assert.equal(transitPreviewFromRanking(FILA, PICO_16, UTC).chip, "EXACTO AHORA");
  assert.equal(transitPreviewFromRanking(FILA, HOY_18, UTC).chip, "INTEGRÁNDOSE");
});

test("mientras el ORB-TRN-001 viaja, la cronología es lo ÚNICO que carga o falla", () => {
  const source = sinComentarios(leer(ARCO));
  const adelanto = source.slice(
    source.indexOf("function AdelantoDelTransito"),
    source.indexOf("function tituloContactos")
  );
  assert.ok(adelanto.length > 0, "no se encontró el bloque de adelanto");

  // La misma composición y el mismo orden que la pantalla completa.
  const chip = adelanto.indexOf("<StateChip");
  const titulo = adelanto.indexOf("<Title>");
  const significado = adelanto.indexOf("TRANSIT_MEANING_HEADING");
  const accion = adelanto.indexOf("ACTION_HEADING");
  const cronologia = adelanto.indexOf("TRANSIT_TIMING_HEADING");
  assert.ok(chip >= 0 && titulo > chip, "el chip de etapa y el titular, arriba");
  assert.ok(significado > titulo, "después qué significa");
  assert.ok(accion > significado, "después qué hacer");
  assert.ok(cronologia > accion, "y recién ahí la cronología");

  // La carga, el fallo y el reintento viven DENTRO del bloque de cronología: son
  // lo único que todavía no se puede leer.
  for (const estado of ["<LoadingBlock", "PROBAR DE NUEVO", "ya no está entre los activos"]) {
    const posicion = adelanto.indexOf(estado);
    assert.ok(posicion > cronologia, `«${estado}» tiene que estar dentro de la cronología`);
  }
  assert.match(adelanto, /Calculando la línea de tiempo de este tránsito…/);
  assert.match(adelanto, /accessibilityLabel="Volver a calcular la línea de tiempo de este tránsito"/);

  // Y no afirma nada que sólo pueda afirmar el sobre del arco.
  for (const prohibido of ["<ArcTimeline", "TraceAccordion", "formatFullDate", "arco.", "FreshnessNotice"]) {
    assert.ok(!adelanto.includes(prohibido), `el adelanto no puede usar «${prohibido}»`);
  }

  // El cableado: la primera apertura —lectura en vuelo— y el sobre pendiente
  // dibujan el adelanto en vez del bloque grande.
  const resolver = source.slice(source.indexOf("function ArcoResolver"), source.indexOf("function ArcoContent"));
  assert.match(
    resolver,
    /especifico\.envelope === null && especifico\.loading && adelanto/,
    "con la lectura en vuelo y un adelanto, la pantalla ya se dibuja"
  );
  assert.match(resolver, /cronologia="calculando"/);
  const cuerpo = source.slice(source.indexOf("function ArcoContent"), source.indexOf("function AdelantoDelTransito"));
  assert.match(
    cuerpo,
    /if \(adelanto\) \{[\s\S]{0,400}?<AdelantoDelTransito/,
    "un sobre sin dato con adelanto no puede vaciar la pantalla"
  );
  assert.match(cuerpo, /cronologia=\{esperando \? "calculando" : fueraDeLaLista \? "fuera" : "fallo"\}/);
});
