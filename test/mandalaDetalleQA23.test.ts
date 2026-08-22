/**
 * QA23-002 — `Tus cuatro ritmos` tiene UN acceso y una lectura propia.
 *
 * ## El defecto medido en el build 23
 *
 * `Tu momento` mostraba tres módulos —estación vital, tema del año y el mandala—
 * pero sólo los dos primeros tenían a dónde profundizar. Debajo del dibujo había
 * CUATRO salidas, una por anillo, hacia la estación, el año, el ciclo lunar y el
 * tránsito activo: dos de esos destinos son los módulos que la misma pantalla ya
 * muestra arriba y los otros dos viven en otra sección. El mandala funcionaba
 * como un índice de cosas que ya estaban a la vista, y lo único que esos cuatro
 * enlaces no contaban era justamente lo que el mandala agrega: qué significa ver
 * cuatro ciclos de escalas distintas en la misma imagen.
 *
 * ## Lo que se prueba acá
 *
 * 1. **La lectura del dibujo es pura y determinística.** Concepto, uso, pregunta
 *    y método son fijos; lo único que cambia con el día es QUÉ ANILLOS HAY, y de
 *    ahí salen la combinación y el límite. La misma configuración devuelve
 *    exactamente el mismo texto.
 * 2. **La teoría cubre los cuatro anillos**, en el orden del dibujo, sin incluir
 *    la clave de compatibilidad que el ensamblador ya no emite.
 * 3. **Honestidad del dato.** Un ritmo sin cálculo se nombra en vez de saltearse;
 *    con anillos vacíos o sin hora exacta, el límite se declara.
 * 4. **Guardrails.** Ni destino, ni salud, ni dinero, ni legal, y la coincidencia
 *    de dos anillos no se convierte en una causa.
 * 5. **Un acceso por módulo y ninguno más**, y el detalle no reparte enlaces
 *    hacia los cuatro ritmos: reconstruiría el mismo laberinto un nivel abajo.
 * 6. **La navegación de la sección se sostiene:** el detalle cuelga del stack de
 *    Tránsitos, el deep link resuelve y vuelve a `Tu momento`, la pestaña abre
 *    `Ahora` y un arco abierto desde `Ahora` vuelve a `Ahora`.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  MOMENTO_ROUTE,
  SECTION_LAYER_DETAILS,
  TRANSITOS_ROUTE,
  detailFallbackHref,
  layerDetailHref,
  sectionLayerDetail
} from "../src/domain/detailOrigin";
import { METHOD_HEADING } from "../src/domain/layerMeaning";
import {
  MANDALA_COMBINATION_HEADING,
  MANDALA_CONCEPT_HEADING,
  MANDALA_DETAIL_EYEBROW,
  MANDALA_METHOD,
  MANDALA_NOW_HEADING,
  MANDALA_RINGS,
  MANDALA_RINGS_HEADING,
  MANDALA_RING_ORDER,
  MANDALA_TRACE,
  READING_QUESTION_HEADING,
  READING_USE_HEADING,
  mandalaReading,
  type MandalaReading,
  type MandalaRingKey
} from "../src/domain/layerReading";
import { TAB_ROOT_SCREEN } from "../src/domain/tabPress";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const DETALLE = "src/screens/v492/MandalaDetailScreen.tsx";
const MOMENTO = "src/screens/v492/TransitosLayersScreen.tsx";
const RUTA_CAPA = "src/routes/v492/transitos-capa.tsx";

/** Los cuatro anillos del dibujo, en el orden de afuera hacia adentro. */
const CUATRO: readonly MandalaRingKey[] = [
  "progressed_lunation",
  "annual_profection",
  "cumpleluna",
  "transit_arc"
];

/** Un sobre de anillos: todos disponibles salvo los que se nombren. */
const anillos = (sin: readonly string[] = [], extra: readonly string[] = []) => [
  ...CUATRO.map((key) => ({ key, available: !sin.includes(key) })),
  ...extra.map((key) => ({ key, available: true }))
];

// ---------------------------------------------------------------------------
// Guardrails, los mismos que exige el resto de la capa editorial
// ---------------------------------------------------------------------------

const PROHIBIDO: readonly { patron: RegExp; familia: string }[] = [
  { patron: /\bdestino\b|\bestá escrito\b|\bpredice\b|\bpredicción\b/i, familia: "destino" },
  { patron: /\bva a (?:pasar|ocurrir|suceder|llegar)\b|\bte espera\b/i, familia: "hecho futuro" },
  { patron: /\bgarantiz|\bseguro que\b|\binevitable\b/i, familia: "promesa" },
  { patron: /\bsuerte\b|\bafortunad|\bmala racha\b|\bkarma\b/i, familia: "fortuna" },
  {
    patron: /\bmédic|\bdiagnóst|\bsíntoma|\benfermedad|\btratamiento\b|\bterapia\b|\bmedicaci|\bcurar\b|\bdepresi/i,
    familia: "salud"
  },
  {
    patron: /\binvertí\b|\binvertir\b|\binversión\b|\bcriptomoned|\bpréstamo\b|\bdeuda\b/i,
    familia: "dinero"
  },
  { patron: /\babogad|\bjuicio\b|\bdemand|\bdenunci|\bherencia\b|\bdivorci/i, familia: "legal" }
];

function assertTextoPublicable(texto: string, contexto: string, minimo = 20) {
  assert.equal(typeof texto, "string", `${contexto}: no devolvió texto`);
  assert.ok(texto.trim().length >= minimo, `${contexto}: texto demasiado corto («${texto}»)`);
  assert.doesNotMatch(
    texto,
    /\bundefined\b|\bnull\b|\bNaN\b|\[object/,
    `${contexto}: se filtró un valor sin resolver`
  );
  assert.match(texto.trim(), /[.!?…]$/, `${contexto}: la frase no cierra («${texto}»)`);
  for (const { patron, familia } of PROHIBIDO) {
    assert.doesNotMatch(texto, patron, `${contexto}: entra en «${familia}» → «${texto}»`);
  }
}

function assertLecturaPublicable(lectura: MandalaReading, contexto: string) {
  assertTextoPublicable(lectura.concept, `${contexto} · concepto`);
  assertTextoPublicable(lectura.combination, `${contexto} · combinación`);
  assertTextoPublicable(lectura.use, `${contexto} · cómo usarlo`);
  assertTextoPublicable(lectura.question, `${contexto} · para observar`);
  assert.match(lectura.question.trim(), /^¿[\s\S]+\?$/, `${contexto}: la pregunta no es una pregunta`);
  if (lectura.caveat !== null) assertTextoPublicable(lectura.caveat, `${contexto} · límite`);
  // Ningún bloque repite a otro: dos que dicen lo mismo ocupan el doble para
  // contar la mitad.
  const bloques = [lectura.concept, lectura.combination, lectura.use, lectura.question];
  assert.equal(new Set(bloques).size, bloques.length, `${contexto}: hay dos bloques idénticos`);
}

// ---------------------------------------------------------------------------
// La teoría de los cuatro anillos
// ---------------------------------------------------------------------------

test("la teoría cubre los cuatro anillos, en el orden del dibujo y sin la clave de compatibilidad", () => {
  assert.deepEqual([...MANDALA_RING_ORDER], [...CUATRO]);
  assert.deepEqual(
    MANDALA_RINGS.map((anillo) => anillo.key),
    [...CUATRO],
    "el orden es una propiedad del dibujo: afuera lo lento, adentro lo rápido"
  );

  // `current_lunation` es la clave que el contrato conserva para leer mandalas v1
  // ya persistidos y que el ensamblador actual no vuelve a emitir: la teoría
  // describe el dibujo de hoy, no el histórico.
  assert.ok(
    MANDALA_RINGS.every((anillo) => anillo.key !== ("current_lunation" as string)),
    "la teoría no puede explicar un anillo que ya no se dibuja"
  );

  for (const anillo of MANDALA_RINGS) {
    const contexto = `anillo ${anillo.key}`;
    assert.ok(anillo.label.trim().length > 0, `${contexto}: sin rótulo`);
    assertTextoPublicable(anillo.position, `${contexto} · dónde cae`, 15);
    assertTextoPublicable(anillo.measures, `${contexto} · qué mide`);
    assertTextoPublicable(anillo.pace, `${contexto} · a qué velocidad`);
  }

  // Cada anillo se explica UNA vez: cuatro rótulos distintos y cuatro
  // velocidades distintas, que es lo que hace que no se lean todos igual.
  assert.equal(new Set(MANDALA_RINGS.map((a) => a.label)).size, 4);
  assert.equal(new Set(MANDALA_RINGS.map((a) => a.pace)).size, 4);
  assert.equal(new Set(MANDALA_RINGS.map((a) => a.position)).size, 4);
});

// ---------------------------------------------------------------------------
// La lectura: qué cambia con el día y qué no
// ---------------------------------------------------------------------------

test("con los cuatro anillos y raíz exacta el dibujo está completo y no hay límite que declarar", () => {
  const lectura = mandalaReading({ rings: anillos(), exact: true });
  assertLecturaPublicable(lectura, "cuatro anillos · exacto");
  assert.equal(lectura.caveat, null, "sin anillos vacíos y con hora, no hay nada que acotar");
  assert.match(lectura.combination, /los cuatro anillos tienen cálculo/);
  // El guardrail del dibujo va en el CUERPO y no sólo en el acordeón: es la
  // frase que impide leer una coincidencia como una causa.
  assert.match(lectura.combination, /no se explican entre sí/);
  assert.match(lectura.combination, /no se convierte en una causa/);
});

test("un ritmo sin cálculo se NOMBRA, y el dibujo declara que está incompleto", () => {
  const lectura = mandalaReading({ rings: anillos(["transit_arc"]), exact: true });
  assertLecturaPublicable(lectura, "sin tránsito · exacto");

  // Se dice cuántos hay y cuáles son…
  assert.match(lectura.combination, /Hoy se pueden calcular 3 de los cuatro ritmos/);
  for (const presente of ["estación vital", "año personal", "tu ritmo lunar"]) {
    assert.ok(lectura.combination.includes(presente), `falta nombrar «${presente}»`);
  }
  // …y cuál queda vacío, en singular, porque el anillo apagado del dibujo tiene
  // que tener explicación. El motivo puntual lo dice su propia línea, con las
  // palabras del sobre: acá no se pide perdón dos veces.
  assert.match(lectura.combination, /El anillo de tránsito activo queda vacío/);
  assert.ok(lectura.caveat !== null, "con un anillo vacío la imagen está incompleta");
  assert.match(lectura.caveat ?? "", /la imagen de hoy está incompleta/);
});

test("dos ritmos vacíos se enumeran en plural, y ninguno se saltea", () => {
  const lectura = mandalaReading({ rings: anillos(["cumpleluna", "transit_arc"]), exact: true });
  assert.match(lectura.combination, /Hoy se pueden calcular 2 de los cuatro ritmos/);
  assert.match(lectura.combination, /Los anillos de tu ritmo lunar y tránsito activo quedan vacíos/);
  assertLecturaPublicable(lectura, "dos vacíos");
});

test("sin ningún cálculo el dibujo no finge tener anillos", () => {
  const lectura = mandalaReading({ rings: anillos([...CUATRO]), exact: true });
  assert.match(lectura.combination, /ninguno de los cuatro ritmos se puede calcular/);
  assert.ok(lectura.caveat !== null);
  // El concepto, el uso y la pregunta NO dependen del día: describen la imagen y
  // cómo leerla, y eso se puede decir igual con el dibujo vacío.
  const completo = mandalaReading({ rings: anillos(), exact: true });
  assert.equal(lectura.concept, completo.concept);
  assert.equal(lectura.use, completo.use);
  assert.equal(lectura.question, completo.question);
  assertLecturaPublicable(lectura, "sin anillos");
});

test("sin hora exacta el avance se afirma como tramo y no como punto", () => {
  const sinHora = mandalaReading({ rings: anillos(), exact: false });
  assert.ok(sinHora.caveat !== null, "la raíz inexacta cambia lo que se puede afirmar");
  assert.match(sinHora.caveat ?? "", /se calcula con un margen/);
  assert.match(sinHora.caveat ?? "", /el tramo del recorrido y no un punto/);

  // Los dos límites conviven —anillos vacíos Y sin hora— y se dicen en ese
  // orden, en una sola frase.
  const ambos = mandalaReading({ rings: anillos(["transit_arc"]), exact: false });
  const soloVacio = mandalaReading({ rings: anillos(["transit_arc"]), exact: true });
  assert.ok(ambos.caveat !== null);
  assert.ok(ambos.caveat?.startsWith(soloVacio.caveat ?? ""), "el límite de los anillos vacíos va primero");
  assert.ok(ambos.caveat?.endsWith(sinHora.caveat ?? ""), "y el de la hora, después");
  assertLecturaPublicable(ambos, "vacío + sin hora");
});

test("la clave de compatibilidad de los mandalas v1 no altera la lectura", () => {
  // Un sobre persistido puede traer `current_lunation`: la teoría no lo cuenta
  // entre los cuatro ritmos, así que ni suma un anillo ni tapa el que falta.
  const conLegacy = mandalaReading({
    rings: anillos(["transit_arc"], ["current_lunation"]),
    exact: true
  });
  const sinLegacy = mandalaReading({ rings: anillos(["transit_arc"]), exact: true });
  assert.deepEqual(conLegacy, sinLegacy);
});

test("la lectura del mandala es determinística: la misma configuración, el mismo texto", () => {
  const CONFIGURACIONES: readonly (readonly string[])[] = [
    [],
    ["transit_arc"],
    ["cumpleluna", "transit_arc"],
    ["annual_profection"],
    [...CUATRO]
  ];
  for (const sin of CONFIGURACIONES) {
    for (const exact of [true, false]) {
      const a = mandalaReading({ rings: anillos(sin), exact });
      const b = mandalaReading({ rings: anillos(sin), exact });
      assert.deepEqual(a, b, `sin=[${sin.join(",")}] exact=${exact}`);
      assertLecturaPublicable(a, `sin=[${sin.join(",")}] exact=${exact}`);
    }
  }
});

test("el método del dibujo se dice aparte, porque también vale con el sobre vacío", () => {
  // Va suelto y no adentro de `mandalaReading`: es cómo se arma la imagen, no
  // qué imagen hay hoy.
  assertTextoPublicable(MANDALA_METHOD, "método del mandala");
  assert.match(MANDALA_METHOD, /no calcula nada por su cuenta/);
  assert.match(MANDALA_METHOD, /del más lento afuera al más rápido adentro/);
  assert.match(MANDALA_METHOD, /se deja vacío/, "un ritmo sin cálculo no recibe un anillo estimado");

  // Y la trazabilidad del análisis es la MISMA que publica la portada: escrita en
  // los dos lados, corregir una y no la otra dejaría al producto explicando el
  // mismo cálculo de dos maneras.
  assertTextoPublicable(MANDALA_TRACE.calculatedDatum, "trazabilidad · qué se calculó");
  assertTextoPublicable(MANDALA_TRACE.interpretiveRule, "trazabilidad · con qué regla se lee");
});

test("los rótulos del detalle son los que declara el dominio", () => {
  assert.equal(MANDALA_DETAIL_EYEBROW, "TUS CUATRO RITMOS");
  assert.equal(MANDALA_CONCEPT_HEADING, "QUÉ ES ESTE DIBUJO");
  assert.equal(MANDALA_RINGS_HEADING, "LOS CUATRO ANILLOS");
  assert.equal(MANDALA_NOW_HEADING, "TU CONFIGURACIÓN DE HOY");
  assert.equal(MANDALA_COMBINATION_HEADING, "CÓMO SE COMBINAN HOY");
});

// ---------------------------------------------------------------------------
// La pantalla del detalle
// ---------------------------------------------------------------------------

test("el detalle del mandala existe y vuelve a Tu momento desde sus cinco superficies", () => {
  assert.ok(existsSync(join(ROOT, DETALLE)), `${DETALLE} no existe`);
  const source = sinComentarios(leer(DETALLE));

  // Un detalle que nace en esta sección vuelve a `Tu momento` incluso sin
  // historial: no hay ninguna otra raíz de la que pueda colgar.
  assert.match(source, /fallbackHref = "\/transitos\/momento"/);
  assert.ok(!/["'`]\/hoy\b/.test(source), "no puede caer en el stack de Hoy");

  // Carga, error, invitado, vacío y la lectura: si una se olvida, el "volver"
  // depende de con qué estado se abrió el detalle.
  const shells = source.match(/<DetailLayerScreen eyebrow=/g)?.length ?? 0;
  const conVuelta =
    source.match(/<DetailLayerScreen eyebrow=\{[A-Z_]+\} fallbackHref=\{fallbackHref\}>/g)?.length ?? 0;
  assert.ok(shells >= 5, "se esperaban las cinco superficies del detalle");
  assert.equal(conVuelta, shells, "hay superficies sin destino de vuelta");
});

test("el detalle se lee en su orden: concepto, anillos, hoy, combinación, uso, pregunta y método", () => {
  const source = sinComentarios(leer(DETALLE));
  const cuerpo = source.slice(source.indexOf("export function MandalaDetailScreen"));

  let anterior = -1;
  for (const ancla of [
    "MANDALA_CONCEPT_HEADING",
    "lectura.concept",
    "MANDALA_RINGS_HEADING",
    "MANDALA_RINGS.map",
    "MANDALA_NOW_HEADING",
    "<Configuracion",
    "MANDALA_COMBINATION_HEADING",
    "lectura.combination",
    "READING_USE_HEADING",
    "lectura.use",
    "READING_QUESTION_HEADING",
    "lectura.question",
    "lectura.caveat",
    "METHOD_HEADING",
    "MANDALA_METHOD",
    "<TraceAccordion"
  ]) {
    const posicion = cuerpo.indexOf(ancla);
    assert.ok(posicion > 0, `falta «${ancla}»`);
    assert.ok(posicion > anterior, `«${ancla}» quedó fuera de orden`);
    anterior = posicion;
  }

  // La teoría va ANTES del estado: sin saber qué mide cada anillo, la
  // configuración de hoy es una lista de cuatro frases sueltas.
  assert.ok(cuerpo.indexOf("MANDALA_RINGS_HEADING") < cuerpo.indexOf("MANDALA_NOW_HEADING"));

  // Ningún rótulo escrito a mano: si lo estuviera, cambiar el vocabulario
  // dejaría este detalle diciendo otra cosa que los otros cuatro.
  for (const rotulo of [
    READING_USE_HEADING,
    READING_QUESTION_HEADING,
    METHOD_HEADING,
    MANDALA_CONCEPT_HEADING,
    MANDALA_RINGS_HEADING,
    MANDALA_NOW_HEADING,
    MANDALA_COMBINATION_HEADING,
    MANDALA_DETAIL_EYEBROW
  ]) {
    assert.ok(!source.includes(`"${rotulo}"`), `«${rotulo}» está escrito a mano`);
  }
});

test("el detalle no dibuja una lectura cuando el cálculo no está, y no inventa nada", () => {
  const source = sinComentarios(leer(DETALLE));

  // La lectura cuelga del dato del sobre: sin `data` no hay texto que afirmar.
  assert.match(source, /const lectura = data \? mandalaReading\(\{/);
  assert.match(source, /\{data && lectura \?/);
  assert.match(source, /<MissingBlock envelope=\{envelope\}/);
  // Y el aviso de frescura sólo con dibujo: sin cálculo lo que corresponde no es
  // "probá de nuevo" sino el motivo real.
  assert.ok(
    source.indexOf("{data ? (") < source.indexOf("<FreshnessNotice"),
    "el aviso de frescura cuelga de que haya dibujo"
  );
  // Con las dos entradas que lo vuelven honesto —el fallo de esta sesión y el
  // día civil con el que se pidió el sobre— y fechando el dato que deja visible.
  assert.match(source, /envelopesFreshness\(\{ envelopes: \[envelope\], refreshFailed, localDate, timezone \}\)/);
  assert.match(source, /observedAt=\{latestObservedAt\(\[envelope\]\)\}/);

  // Ni modelo, ni dado, ni una query nueva: lee el MISMO sobre que la portada ya
  // trae en el bundle del día.
  assert.doesNotMatch(source, /Math\.random|openai|anthropic|prompt/i);
  assert.doesNotMatch(source, /useQuery|useMutation/, "lee el bundle que ya trae `useLayers`");
  assert.match(source, /bundle\.moment\.temporalMandala/);
});

test("adentro del detalle no hay enlaces a los cuatro ritmos", () => {
  const source = sinComentarios(leer(DETALLE));

  // Cada ritmo tiene su propio módulo hermano en `Tu momento`: repartir de nuevo
  // desde acá reconstruiría el mismo laberinto un nivel más abajo.
  for (const prohibido of [
    "layerDetailHref",
    "withDetailOrigin",
    "<LinkRow",
    "router",
    "/transitos/capa/",
    "/transitos/arco/"
  ]) {
    assert.ok(!source.includes(prohibido), `el detalle no puede navegar: aparece «${prohibido}»`);
  }
  // La única URL que nombra es su respaldo de "volver", y es la vista de la que
  // cuelga: el `pop` del stack sigue siendo el camino normal.
  assert.deepEqual(source.match(/"\/[a-z/-]+"/g), ['"/transitos/momento"']);

  // La lista de anillos de la configuración es texto: mismo criterio que la
  // portada —el estado ES el dato, y `detail` sólo cuando el ritmo no se puede
  // calcular, porque ahí es la única explicación de un anillo apagado—.
  const configuracion = source.slice(source.indexOf("function Configuracion("));
  assert.match(configuracion, /data\.rings\.map\(\(ring\)\s*=>/);
  assert.equal((configuracion.match(/ring\.state/g) ?? []).length, 2, "se dibuja y se anuncia, y no más");
  assert.equal((configuracion.match(/ring\.detail/g) ?? []).length, 2);
  const conCalculo = configuracion.slice(
    configuracion.indexOf("ring.available ? ("),
    configuracion.indexOf(") : (")
  );
  assert.doesNotMatch(conCalculo, /ring\.detail/, "un ritmo disponible no imprime el resumen entero");
  // Y cada renglón se anuncia solo, con su estado.
  assert.match(configuracion, /accessibilityLabel=\{`\$\{ring\.label\}: /);
});

// ---------------------------------------------------------------------------
// El acceso en la portada: uno por módulo, y ninguno más
// ---------------------------------------------------------------------------

test("Tu momento ofrece TRES accesos, uno por módulo, y el mandala tiene el suyo", () => {
  const momento = sinComentarios(leer(MOMENTO));

  const accesos = momento.match(/<AccesoDetalle acceso=\{DETALLES\.\w+\} \/>/g) ?? [];
  assert.equal(accesos.length, 3, "un acceso por módulo: estación, año y el dibujo");
  assert.equal(new Set(accesos).size, 3, "y ninguno repetido");
  assert.ok(accesos.includes("<AccesoDetalle acceso={DETALLES.mandala} />"), "falta el acceso del mandala");

  // El rótulo dice adónde va —no "ver más"— y la etiqueta accesible lo dice
  // entero, porque `VER TUS CUATRO RITMOS` en mayúsculas no informa a VoiceOver.
  assert.match(momento, /label: "VER TUS CUATRO RITMOS"/);
  assert.match(momento, /accessibilityLabel: "Ver el detalle integral de tus cuatro ritmos"/);
  assert.match(momento, /href: layerDetailHref\("mandala"\)/);

  // El acceso aparece SÓLO cuando hay dibujo: un enlace a una lectura que va a
  // abrir "no pudimos calcular esto" no es una salida.
  const bloque = momento.slice(momento.indexOf("temporalMandala.data ?"));
  const acceso = bloque.indexOf("<AccesoDetalle acceso={DETALLES.mandala} />");
  assert.ok(acceso > 0 && acceso < bloque.indexOf("<Falta"), "el acceso está en la rama con cálculo");
  assert.ok(acceso > bloque.indexOf("<Mandala "), "y va debajo del dibujo y de sus cuatro líneas");

  // La lista de anillos de la portada dejó de repartir: es la versión leíble del
  // dibujo, no una botonera.
  const mandala = momento.slice(momento.indexOf("function Mandala("));
  assert.ok(!mandala.includes("<LinkRow"), "el dibujo ya no reparte enlaces por anillo");
  assert.ok(!momento.includes("RitmoDestino"), "ni queda la tabla de destinos por ritmo");
  assert.ok(!momento.includes("destinos"), "ni la prop que la pasaba");
});

// ---------------------------------------------------------------------------
// La navegación de la sección, entera
// ---------------------------------------------------------------------------

test("el deep link a `/transitos/capa/mandala` resuelve y monta el detalle", () => {
  assert.equal(layerDetailHref("mandala"), "/transitos/capa/mandala");
  assert.equal(sectionLayerDetail("mandala"), "mandala");
  assert.ok((SECTION_LAYER_DETAILS as readonly string[]).includes("mandala"));

  // El slug viaja en la URL, así que va sin acentos: nada más resuelve a esta capa.
  for (const crudo of ["Mandala", "MANDALA", " mandala", "mándala", ["mandala"], null, undefined]) {
    assert.notEqual(sectionLayerDetail(crudo), "mandala", String(crudo));
  }

  const capa = sinComentarios(leer(RUTA_CAPA));
  assert.match(capa, /mandala: MandalaDetailScreen/);
  assert.match(capa, /Record<SectionLayerDetail,/, "la tabla es exhaustiva por tipo");
  assert.match(capa, /<DetalleScreen fallbackHref=\{MOMENTO_ROUTE\} \/>/);
  // Una URL inventada no monta nada: vuelve a la vista que abre estos detalles.
  assert.match(capa, /if \(!capa\) return <Redirect href=\{MOMENTO_ROUTE as never\} \/>;/);
});

test("volver del detalle es un pop, así que Tu momento conserva instancia y scroll", () => {
  // El detalle cuelga del stack de Tránsitos (`app/(tabs)/transitos/capa/[layer].tsx`),
  // que es el mismo en el que vive `Tu momento`: por eso `Atrás` es un `pop` de
  // ESE stack y la pantalla de abajo nunca se desmontó (QA22-027).
  assert.ok(existsSync(join(ROOT, "app/(tabs)/transitos/capa/[layer].tsx")));
  assert.equal(MOMENTO_ROUTE, "/transitos/momento");

  const screen = sinComentarios(leer("src/components/v492/Screen.tsx"));
  assert.match(
    screen,
    /onPress=\{\(\) => \(router\.canGoBack\(\) \? router\.back\(\) : router\.replace\(fallbackHref as never\)\)\}/,
    "con historial manda el pop; el respaldo es sólo para el deep link"
  );

  // Y el ancla del stack deja la raíz de la sección debajo cuando se entra por
  // deep link: sin eso, la pestaña quedaría con el detalle solo y sin "volver".
  assert.match(
    sinComentarios(leer("app/(tabs)/transitos/_layout.tsx")),
    /export const unstable_settings = \{ anchor: "index" \};/
  );
});

test("la pestaña Tránsitos abre Ahora, y un arco abierto desde Ahora vuelve a Ahora", () => {
  // Tocar la pestaña abre su raíz y no la vista en la que había quedado la
  // sección: `Tu momento` gana continuidad al volver de un detalle, no acá.
  assert.deepEqual(TAB_ROOT_SCREEN, { transitos: "index" });
  assert.match(sinComentarios(leer("src/routes/v492/transitos-index.tsx")), /mode="ahora"/);

  // Y la lista de `Ahora` abre el arco SIN declarar origen, así que el respaldo
  // del deep link es la raíz canónica de la sección: `Ahora`.
  const momento = sinComentarios(leer(MOMENTO));
  const lista = momento.slice(momento.indexOf("function ListaCompleta("));
  assert.match(lista, /router\.push\(`\/transitos\/arco\/\$\{encodeURIComponent\(item\.arcId\)\}` as never\)/);
  assert.ok(!lista.includes("desde="), "desde `Ahora` no hay origen que declarar");
  assert.equal(detailFallbackHref(null, TRANSITOS_ROUTE), TRANSITOS_ROUTE);
  assert.equal(TRANSITOS_ROUTE, "/transitos");
});
