/**
 * Frescura del sobre: qué tan de ahora es lo que se está leyendo, y cuánto ruido
 * merece decirlo.
 *
 * El defecto que se cierra: cualquier recálculo que no salía bien pintaba el
 * MISMO cartel grande con borde de cobre arriba de todo. Tres situaciones muy
 * distintas —"no pudimos rehacer el cálculo de hace veinte minutos", "lo único
 * que hay es de anteayer" y "todavía no hay ningún cálculo"— se anunciaban
 * igual, así que la más leve, que es la más frecuente, se leía como una falla
 * del producto.
 *
 * Lo que se prueba acá:
 *
 * 1. **La clasificación**, entera y en los bordes: sin dato, con dato de hoy,
 *    con dato de otro día, con dato sin fecha, con zona rara y con el sobre
 *    marcado por el backend.
 * 2. **El peso de cada estado**: nada, línea, aviso compacto y bloque. Y que el
 *    bloque exista SÓLO cuando no hay dato.
 * 3. **El texto**: siempre publicable, siempre con reintento, y con la fecha
 *    cuando se la puede afirmar.
 * 4. **El cableado de las pantallas**: quién dibuja el aviso, con qué entradas y
 *    en qué lugar de la página.
 *
 * Es un modelo puro: no tiene reloj adentro —el instante y el día civil los pasa
 * quien llama—, así que todo esto se prueba sin simulador y sin viajar en el
 * tiempo.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  FRESHNESS_WEIGHT,
  envelopesFreshness,
  freshnessNotice,
  layerFreshness,
  type FreshnessInput,
  type LayerFreshness
} from "../src/domain/layerFreshness";
import type { AnalysisEnvelope } from "../src/services/layersApi";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ZONA = "America/Argentina/Buenos_Aires";
/** Mediodía del 20 de agosto de 2026 en Buenos Aires (UTC−3). */
const HOY_MEDIODIA = Date.UTC(2026, 7, 20, 15, 0);
/** 23:30 del 19 de agosto en Buenos Aires: el día civil ANTERIOR. */
const AYER_NOCHE = Date.UTC(2026, 7, 20, 2, 30);
const HOY = "2026-08-20";

const BASE: FreshnessInput = {
  hasData: true,
  observedAt: HOY_MEDIODIA,
  markedStale: false,
  refreshFailed: false,
  localDate: HOY,
  timezone: ZONA
};

const ESTADOS: readonly LayerFreshness[] = ["fresh", "cachedToday", "stale", "unavailable"];

// ---------------------------------------------------------------------------
// La clasificación
// ---------------------------------------------------------------------------

test("sin dato el estado es `unavailable`, pase lo que pase con el recálculo", () => {
  for (const refreshFailed of [true, false]) {
    for (const markedStale of [true, false]) {
      for (const observedAt of [null, HOY_MEDIODIA]) {
        assert.equal(
          layerFreshness({ ...BASE, hasData: false, refreshFailed, markedStale, observedAt }),
          "unavailable",
          "sin cálculo guardado no hay frescura que juzgar: no hay contenido"
        );
      }
    }
  }
});

test("con el recálculo hecho, el dato es de ahora y no se anuncia", () => {
  assert.equal(layerFreshness(BASE), "fresh");
  // Incluso si el último cálculo visible quedó fechado ayer: si el refresco de
  // esta sesión salió bien y el backend no marcó nada, lo que hay es lo vigente.
  assert.equal(layerFreshness({ ...BASE, observedAt: AYER_NOCHE }), "fresh");
  assert.equal(freshnessNotice("fresh", "14:05"), null, "el estado normal no se anuncia");
});

test("si no se pudo rehacer, el día civil del cálculo decide el peso del aviso", () => {
  // El fallo de esta sesión y la marca del backend son dos caminos al mismo
  // lugar: en los dos, lo que se lee es el último cálculo guardado.
  for (const motivo of [{ refreshFailed: true }, { markedStale: true }]) {
    assert.equal(
      layerFreshness({ ...BASE, ...motivo }),
      "cachedToday",
      "un dato calculado HOY sigue siendo de hoy: alcanza una línea"
    );
    assert.equal(
      layerFreshness({ ...BASE, ...motivo, observedAt: AYER_NOCHE }),
      "stale",
      "un dato de un día anterior ya no describe el día que se está mirando"
    );
  }
});

test("lo que no se puede fechar no se afirma como de hoy", () => {
  const roto = { refreshFailed: true };
  for (const observedAt of [null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(
      layerFreshness({ ...BASE, ...roto, observedAt }),
      "stale",
      `observedAt=${String(observedAt)}: sin instante válido no se puede decir que es de hoy`
    );
  }
  // Lo mismo sin día civil o sin zona: la comparación no se puede hacer, así que
  // el aviso es el conservador.
  assert.equal(layerFreshness({ ...BASE, ...roto, localDate: "" }), "stale");
  assert.equal(layerFreshness({ ...BASE, ...roto, timezone: "" }), "stale");
  assert.equal(layerFreshness({ ...BASE, ...roto, timezone: "Marte/Olympus" }), "stale");
});

test("el borde de la medianoche cae del lado correcto, en la zona del aparato", () => {
  // 20 de agosto a las 00:00 en Buenos Aires es todavía el 19 en UTC−3+3: el
  // día civil lo decide la ZONA que se pasa, no el reloj del que corre la prueba.
  const medianoche = Date.UTC(2026, 7, 20, 3, 0);
  assert.equal(
    layerFreshness({ ...BASE, refreshFailed: true, observedAt: medianoche }),
    "cachedToday"
  );
  assert.equal(
    layerFreshness({ ...BASE, refreshFailed: true, observedAt: medianoche - 1 }),
    "stale",
    "un milisegundo antes ya es el día anterior"
  );
  // Y la misma marca de tiempo, leída en otra zona, puede caer en otro día: por
  // eso la zona entra en la decisión.
  assert.equal(
    layerFreshness({
      ...BASE,
      refreshFailed: true,
      observedAt: medianoche - 1,
      timezone: "UTC",
      localDate: "2026-08-20"
    }),
    "cachedToday",
    "en UTC ese instante ya es el 20"
  );
});

// ---------------------------------------------------------------------------
// El peso y el texto
// ---------------------------------------------------------------------------

test("cada estado tiene un peso, y el bloque grande es sólo el de `sin datos`", () => {
  assert.deepEqual(FRESHNESS_WEIGHT, {
    fresh: "none",
    cachedToday: "line",
    stale: "compact",
    unavailable: "block"
  });
  const bloques = ESTADOS.filter((estado) => FRESHNESS_WEIGHT[estado] === "block");
  assert.deepEqual(bloques, ["unavailable"], "el error grande no puede tapar un dato legible");
});

test("el aviso de cada estado es publicable, tiene reintento y respeta su peso", () => {
  for (const estado of ESTADOS) {
    const aviso = freshnessNotice(estado, "14:05");
    if (estado === "fresh") {
      assert.equal(aviso, null);
      continue;
    }
    assert.ok(aviso, `${estado}: falta el aviso`);
    assert.equal(aviso.weight, FRESHNESS_WEIGHT[estado], `${estado}: el peso lo decide el estado`);
    assert.ok(aviso.body.trim().length >= 20, `${estado}: el texto no explica nada`);
    // El aviso y el bloque son frases y cierran como tales. La línea discreta no
    // lo es: es un estado fechado (`Actualizado 14:05 · …`), y ponerle un punto
    // al final la haría leer como una oración a medio escribir.
    if (estado !== "cachedToday") {
      assert.match(aviso.body.trim(), /[.!?]$/, `${estado}: la frase no cierra`);
    }
    assert.doesNotMatch(aviso.body, /\bundefined\b|\bnull\b|\bNaN\b/, `${estado}: valor sin resolver`);
    assert.ok(aviso.retryLabel.trim().length > 0, `${estado}: sin reintento no hay salida`);
    assert.equal(
      aviso.retryLabel,
      aviso.retryLabel.toLocaleUpperCase("es"),
      `${estado}: el rótulo del control va en versalita, como el resto`
    );
  }
});

// ---------------------------------------------------------------------------
// La línea de hoy: dos estados, dicho con las palabras exactas
// ---------------------------------------------------------------------------

test("un dato de hoy que no se pudo rehacer dice si se está intentando o si se agotó", () => {
  // Mientras la política reintenta (1500/4500/9000 ms, tope de 20 s).
  const intentando = freshnessNotice("cachedToday", "14:05", { retrying: true })!;
  assert.equal(intentando.body, "Actualizado 14:05 · intentando actualizar");
  assert.equal(intentando.weight, "line", "nunca una tarjeta grande: el dato de hoy sigue legible");
  assert.equal(intentando.retryable, false, "no hay nada que decidir hasta que ese intento termine");
  assert.equal(intentando.alert, false, "no le roba el foco al lector");

  // Agotados los tres reintentos.
  const agotado = freshnessNotice("cachedToday", "14:05", { retrying: false })!;
  assert.equal(agotado.body, "Actualizado 14:05 · no se pudo actualizar");
  assert.equal(agotado.weight, "line");
  assert.equal(agotado.retryable, true, "recién acá aparece el reintento");
  assert.equal(agotado.retryLabel, "REINTENTAR");

  // Sin opciones vale lo mismo que "no se está intentando": el estado por defecto
  // de una pantalla quieta es el que espera una acción de la persona.
  assert.equal(freshnessNotice("cachedToday", "14:05")!.body, agotado.body);

  // Y no hay un tercer estado: los dos textos son los únicos que la línea dice.
  for (const retrying of [true, false]) {
    const aviso = freshnessNotice("cachedToday", "14:05", { retrying })!;
    assert.ok(
      ["Actualizado 14:05 · intentando actualizar", "Actualizado 14:05 · no se pudo actualizar"].includes(
        aviso.body
      ),
      `retrying=${retrying}: la línea sólo tiene dos estados`
    );
  }
});

test("el reintento en vuelo no cambia el aviso compacto ni el bloque", () => {
  // `retrying` es del caso de hoy: los otros dos ya dicen `REINTENTANDO…` en su
  // propio control y su texto no depende de eso.
  for (const estado of ["stale", "unavailable"] as const) {
    const quieto = freshnessNotice(estado, "19 de agosto, 23:30")!;
    const enVuelo = freshnessNotice(estado, "19 de agosto, 23:30", { retrying: true })!;
    assert.deepEqual(enVuelo, quieto, `${estado}: el texto no cambia con el reintento`);
    assert.equal(quieto.retryable, true, `${estado}: el reintento siempre se ofrece`);
  }
});

test("la línea discreta no interrumpe al lector; el aviso y el bloque sí", () => {
  assert.equal(freshnessNotice("cachedToday", "14:05")?.alert, false);
  assert.equal(freshnessNotice("stale", "19 de agosto, 23:30")?.alert, true);
  assert.equal(freshnessNotice("unavailable", null)?.alert, true);
  // Y la línea discreta no lleva rótulo encima: es un dato de contexto, no un
  // cartel.
  assert.equal(freshnessNotice("cachedToday", "14:05")?.label, null);
  assert.ok(freshnessNotice("stale", null)?.label);
  assert.ok(freshnessNotice("unavailable", null)?.label);
});

test("la fecha entra en el aviso cuando existe, y no se inventa cuando no", () => {
  assert.match(freshnessNotice("cachedToday", "14:05")!.body, /14:05/);
  assert.match(freshnessNotice("stale", "19 de agosto, 23:30")!.body, /19 de agosto, 23:30/);

  for (const estado of ["cachedToday", "stale"] as const) {
    const sinFecha = freshnessNotice(estado, null)!;
    assert.doesNotMatch(sinFecha.body, /\d{1,2}:\d{2}/, `${estado}: sin dato no se inventa una hora`);
    assert.notEqual(sinFecha.body, freshnessNotice(estado, "14:05")!.body);
  }
  // El bloque no fecha nada: por definición no hay cálculo que fechar.
  assert.doesNotMatch(freshnessNotice("unavailable", "14:05")!.body, /14:05/);
});

test("el texto sirve para cualquier capa: no habla del cielo ni de «este momento»", () => {
  // El mismo aviso encabeza capas natales —tipo lunar, mapa elemental— que no
  // cambian con el día pero se vuelven a pedir en el mismo sobre.
  for (const estado of ESTADOS) {
    const aviso = freshnessNotice(estado, "14:05");
    if (!aviso) continue;
    for (const prohibido of [/cielo/i, /este momento/i, /tránsito/i, /luna/i]) {
      assert.doesNotMatch(aviso.body, prohibido, `${estado}: el aviso no puede asumir de qué capa es`);
    }
  }
});

// ---------------------------------------------------------------------------
// El adaptador sobre los sobres reales
// ---------------------------------------------------------------------------

/** Un sobre mínimo con lo único que la frescura mira. */
function sobre(input: {
  data: unknown;
  status?: AnalysisEnvelope["status"];
  observedAt?: number;
}): AnalysisEnvelope {
  return {
    analysisId: "ORB-TRN-002",
    status: input.status ?? "ready",
    precision: "exact",
    observedAt: input.observedAt ?? HOY_MEDIODIA,
    validUntil: null,
    methodVersion: "test",
    missingInputs: [],
    limitations: [],
    sourceRefs: [],
    data: input.data
  } as unknown as AnalysisEnvelope;
}

test("la frescura de una pantalla mira todos sus sobres, y fecha el más nuevo", () => {
  const conDatos = [
    sobre({ data: { kind: "a" }, observedAt: AYER_NOCHE }),
    sobre({ data: { kind: "b" }, observedAt: HOY_MEDIODIA })
  ];

  assert.equal(
    envelopesFreshness({ envelopes: conDatos, refreshFailed: false, localDate: HOY, timezone: ZONA }),
    "fresh"
  );
  // El más nuevo es de hoy: con el recálculo fallado sigue alcanzando la línea.
  assert.equal(
    envelopesFreshness({ envelopes: conDatos, refreshFailed: true, localDate: HOY, timezone: ZONA }),
    "cachedToday"
  );
  // Un sobre marcado por el backend basta, aunque el refresco de la sesión no
  // haya fallado.
  assert.equal(
    envelopesFreshness({
      envelopes: [sobre({ data: { kind: "a" }, status: "stale", observedAt: AYER_NOCHE })],
      refreshFailed: false,
      localDate: HOY,
      timezone: ZONA
    }),
    "stale"
  );
  // Sobres sin dato: no hay nada que leer, sea cual sea su estado.
  assert.equal(
    envelopesFreshness({
      envelopes: [sobre({ data: null }), sobre({ data: undefined, status: "unavailable" })],
      refreshFailed: false,
      localDate: HOY,
      timezone: ZONA
    }),
    "unavailable"
  );
  // Y una pantalla sin sobres tampoco tiene nada que mostrar.
  assert.equal(
    envelopesFreshness({ envelopes: [], refreshFailed: false, localDate: HOY, timezone: ZONA }),
    "unavailable"
  );
});

test("un sobre sin dato no arrastra a los que sí lo tienen", () => {
  const mezcla = [
    sobre({ data: null, status: "unavailable" }),
    sobre({ data: { kind: "b" }, observedAt: HOY_MEDIODIA })
  ];
  assert.equal(
    envelopesFreshness({ envelopes: mezcla, refreshFailed: true, localDate: HOY, timezone: ZONA }),
    "cachedToday",
    "la fecha visible es la del cálculo que la persona está leyendo"
  );
});

// ---------------------------------------------------------------------------
// El cableado de las pantallas
// ---------------------------------------------------------------------------

const PANTALLAS_CON_FRESCURA = [
  "src/screens/v492/HoyScreen.tsx",
  "src/screens/v492/TransitosLayersScreen.tsx",
  "src/screens/v492/ArcoDetailScreen.tsx",
  "src/screens/v492/LunaDetailScreen.tsx",
  "src/screens/v492/CumplelunaDetailScreen.tsx"
] as const;

test("las capas del día resuelven la frescura con el modelo, no con una condición propia", () => {
  for (const rel of PANTALLAS_CON_FRESCURA) {
    const source = sinComentarios(leer(rel));
    assert.match(source, /<FreshnessNotice/, `${rel} tiene que anunciar la frescura`);
    assert.match(source, /envelopesFreshness\(\{/, `${rel} no puede decidirlo a mano`);
    assert.ok(
      !/refreshFailed \|\| anyStale\(/.test(source),
      `${rel} conserva la condición vieja: dos avisos distintos con la misma cara`
    );
    assert.ok(
      !/<StaleNotice/.test(source),
      `${rel} ya no usa el cartel único: el peso lo decide la frescura`
    );
  }
});

test("el aviso se dibuja arriba de todo y con reintento en las cinco pantallas", () => {
  for (const rel of PANTALLAS_CON_FRESCURA) {
    const source = sinComentarios(leer(rel));
    const inicio = source.indexOf("<FreshnessNotice");
    const aviso = source.slice(inicio, inicio + 420);
    assert.match(aviso, /freshness=\{/, `${rel}: el aviso recibe el estado calculado`);
    assert.match(aviso, /observedAt=\{latestObservedAt\(/, `${rel}: y la fecha del último dato`);
    assert.match(aviso, /onRetry=\{/, `${rel}: sin reintento el aviso es una vía muerta`);
    assert.match(aviso, /retrying=\{/, `${rel}: y el control dice cuándo ya está reintentando`);
    // Arriba de todo: dentro de la sección que lo contiene, nada de contenido de
    // la capa antes del aviso. (Se toma la sección MÁS CERCANA hacia atrás: una
    // pantalla puede tener antes la rama sin dato, que es otra sección y no
    // dibuja el aviso porque ahí el bloque de error ya es el contenido.)
    const cuerpo = source.slice(source.lastIndexOf("<Section>", inicio), inicio);
    assert.ok(
      !/<Title|<Body|<Subtitle/.test(cuerpo),
      `${rel}: el aviso va antes del contenido, no en el medio de la lectura`
    );
  }
});

test("en un detalle sin cálculo, el motivo real gana sobre el bloque de error", () => {
  // El bloque grande promete una salida —"probá de nuevo en un momento"— y hay
  // ausencias que ningún reintento arregla: sin hora exacta de nacimiento, la
  // Luna no tiene casa y el ciclo no tiene raíz, hoy y dentro de un mes. En esas
  // pantallas, lo que corresponde es el motivo que declara el propio sobre.
  for (const rel of [
    "src/screens/v492/LunaDetailScreen.tsx",
    "src/screens/v492/CumplelunaDetailScreen.tsx"
  ]) {
    const source = sinComentarios(leer(rel));
    assert.match(
      source,
      /\{data \? \(\s*<FreshnessNotice/,
      `${rel}: el aviso de frescura se dibuja sólo cuando hay cálculo que fechar`
    );
    assert.match(source, /<MissingBlock envelope=\{envelope\} \/>/, `${rel}: y sin cálculo, el motivo`);
  }
  // El detalle del tránsito resuelve lo mismo por otro camino: su rama sin dato
  // devuelve antes de llegar al aviso, y trae su propio reintento.
  const arco = sinComentarios(leer("src/screens/v492/ArcoDetailScreen.tsx"));
  const sinDato = arco.slice(arco.indexOf("if (!arco) {"), arco.indexOf("const esExacto"));
  assert.ok(!sinDato.includes("<FreshnessNotice"), "la rama sin dato del tránsito no dibuja el aviso");
  assert.match(sinDato, /<PrimaryButton/, "pero sí ofrece volver a calcular");
});

test("el componente dibuja los tres pesos y sólo el bloque lleva botón grande", () => {
  const status = sinComentarios(leer("src/components/v492/Status.tsx"));
  const componente = status.slice(status.indexOf("export function FreshnessNotice"));

  assert.match(
    componente,
    /freshnessNotice\(freshness, fechado, \{ retrying \}\)/,
    "el texto lo decide el dominio, y el estado del reintento entra en la decisión"
  );
  // El control de la línea existe SÓLO cuando el dominio lo ofrece: mientras el
  // reintento corre, la línea ya dice que se está intentando.
  assert.match(componente, /\{onRetry && aviso\.retryable \?/);
  assert.match(componente, /if \(!aviso\) return null;/, "el estado normal no dibuja nada");
  assert.match(componente, /aviso\.weight === "line"/, "la línea discreta tiene su rama");
  assert.match(componente, /const bloque = aviso\.weight === "block"/, "y el bloque, la suya");
  assert.match(
    componente,
    /<PrimaryButton/,
    "el bloque usa el botón grande: es el único caso sin contenido debajo"
  );
  // El botón grande vive DENTRO de la rama del bloque.
  const antesDelBloque = componente.slice(0, componente.indexOf("const bloque ="));
  assert.ok(!/<PrimaryButton/.test(antesDelBloque), "la línea discreta no lleva un botón grande");
  // Alerta sólo cuando el dominio lo pide.
  assert.match(componente, /accessibilityRole=\{aviso\.alert \? "alert" : undefined\}/);
  // La hora alcanza para un dato de hoy; para otro día hace falta la fecha.
  assert.match(
    componente,
    /freshness === "cachedToday"\s*\?\s*formatLocalTime\(/,
    "un dato de hoy se fecha con la hora"
  );
  assert.match(componente, /:\s*formatDateTime\(/, "y uno de otro día, con su fecha");
});
