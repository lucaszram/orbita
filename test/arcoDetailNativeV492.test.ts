/**
 * Detalle de arco en la app nativa — de qué sobre sale lo que se ve.
 *
 * El defecto cerrado: con un `arcId` de la lista, la pantalla armaba una
 * pseudo-ventana con el ítem del ranking y le pasaba ESE sobre al acordeón de
 * trazabilidad. La captura mostraba `ORB-TRN-002 · transit-ranking-v1` dentro de
 * `ARCO DEL TRÁNSITO`: el método, la precisión y las fuentes de otro análisis.
 *
 * Acá se fija lo que la pantalla puede afirmar y con qué. Dos clases de prueba:
 *
 * - **comportamiento** del coordinador de pedidos, que es el que decide si una
 *   respuesta tardía puede escribir la pantalla;
 * - **estructura** del detalle: el cuerpo y el acordeón salen del MISMO sobre
 *   `ORB-TRN-001`, y el ranking no aporta fechas, pasadas ni trazabilidad.
 *
 * La garantía más fuerte no está acá sino en el tipo: `ArcoContent` declara
 * `data: TransitArcData | null`, así que pasarle el sobre del ranking no compila.
 * El gate de abajo protege esa anotación de convertirse en `unknown`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  TRANSIT_ARC_PENDING_INPUT,
  missingReasons,
  transitArcPending
} from "../src/domain/layers";
import { createLatestRequestGate, transitArcRequestKey } from "../src/domain/transitArcRequest";
import type { AnalysisEnvelope } from "../src/services/layersApi";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ARCO = "src/screens/v492/ArcoDetailScreen.tsx";
const VINCULOS = "src/screens/v492/VinculosResultScreen.tsx";
const HOOK = "src/hooks/useTransitArc.ts";

function seccion(source: string, desde: string, hasta?: string): string {
  const inicio = source.indexOf(desde);
  assert.ok(inicio >= 0, `no se encontró «${desde}»`);
  const fin = hasta ? source.indexOf(hasta, inicio + desde.length) : source.length;
  assert.ok(fin > inicio, hasta ? `no se encontró «${hasta}» después de «${desde}»` : desde);
  return source.slice(inicio, fin);
}

// ---------------------------------------------------------------------------
// Comportamiento: una respuesta tardía no puede escribir otra pantalla
// ---------------------------------------------------------------------------

test("una respuesta tardía del arco A no reemplaza lo que ya pidió el arco B", async () => {
  const gate = createLatestRequestGate();
  const claveA = transitArcRequestKey({
    arcId: "arc_v1_aaaaaaa",
    localDate: "2026-08-17",
    timezone: "UTC",
    civilHour: "2026-08-17T15",
    attempt: 0
  });
  const claveB = transitArcRequestKey({
    arcId: "arc_v1_bbbbbbb",
    localDate: "2026-08-17",
    timezone: "UTC",
    civilHour: "2026-08-17T15",
    attempt: 0
  });

  // Se simula el orden real del defecto: se abre A, se navega a B, y la respuesta
  // de A llega DESPUÉS de la de B.
  let pantalla: string | null = null;
  const escribir = (token: number, valor: string) => {
    if (gate.isCurrent(token)) pantalla = valor;
  };

  const tokenA = gate.start(claveA);
  const tokenB = gate.start(claveB);
  assert.ok(tokenA !== null && tokenB !== null);

  const lentoA = new Promise<void>((resolve) =>
    setTimeout(() => {
      escribir(tokenA, "arco A");
      resolve();
    }, 20)
  );
  const rapidoB = new Promise<void>((resolve) =>
    setTimeout(() => {
      escribir(tokenB, "arco B");
      resolve();
    }, 1)
  );
  await Promise.all([rapidoB, lentoA]);

  assert.equal(pantalla, "arco B", "la respuesta vieja no puede pisar el arco abierto");
  assert.equal(gate.isCurrent(tokenA), false);
  assert.equal(gate.isCurrent(tokenB), true);
});

test("el mismo pedido no larga dos acciones, y un reintento explícito lo vuelve a habilitar", () => {
  const gate = createLatestRequestGate();
  const base = {
    arcId: "arc_v1_aaaaaaa",
    localDate: "2026-08-17",
    timezone: "UTC",
    civilHour: "2026-08-17T15"
  };
  const clave = transitArcRequestKey({ ...base, attempt: 0 });

  assert.ok(gate.start(clave) !== null, "el primer pedido corre");
  assert.equal(gate.start(clave), null, "el segundo pedido idéntico no corre");
  assert.equal(gate.start(clave), null);

  // Un reintento explícito es un pedido NUEVO: sube `attempt` y por eso la clave
  // cambia sola. `release` cubre el caso de volver a habilitar la misma clave.
  const reintento = transitArcRequestKey({ ...base, attempt: 1 });
  assert.notEqual(reintento, clave);
  const tokenReintento = gate.start(reintento);
  assert.ok(tokenReintento !== null);
  gate.release(clave);
  const tokenViejo = gate.start(clave);
  assert.ok(tokenViejo !== null, "release vuelve a habilitar la clave");
  assert.equal(gate.isCurrent(tokenReintento), false, "el último pedido es el que manda");

  gate.reset();
  assert.ok(gate.start(clave) !== null, "reset olvida todo");
});

test("la clave del pedido separa arco, día, zona, hora civil e intento", () => {
  const base = {
    arcId: "arc_v1_aaaaaaa",
    localDate: "2026-08-17",
    timezone: "UTC",
    civilHour: "2026-08-17T15",
    attempt: 0
  };
  const claves = new Set([
    transitArcRequestKey(base),
    transitArcRequestKey({ ...base, arcId: "arc_v1_bbbbbbb" }),
    transitArcRequestKey({ ...base, localDate: "2026-08-18" }),
    transitArcRequestKey({ ...base, timezone: "America/Argentina/Buenos_Aires" }),
    transitArcRequestKey({ ...base, civilHour: "2026-08-17T16" }),
    transitArcRequestKey({ ...base, attempt: 1 })
  ]);
  assert.equal(claves.size, 6, "cambiar cualquiera de los cinco es otro pedido");
  assert.equal(transitArcRequestKey(base), transitArcRequestKey({ ...base }), "y es estable");
});

// ---------------------------------------------------------------------------
// Comportamiento: "todavía no calculado" no es "ya no está activo"
// ---------------------------------------------------------------------------

function sobre(overrides: Partial<AnalysisEnvelope> = {}): AnalysisEnvelope {
  return {
    analysisId: "ORB-TRN-001",
    methodVersion: "transit-arc-planets-tropical-roots-v2",
    inputHash: "hash",
    status: "unavailable",
    precision: "not_applicable",
    observedAt: 1,
    validUntil: null,
    data: null,
    missingInputs: [],
    limitations: [],
    elaboration: "direct",
    sourceRefs: [],
    ...overrides
  } as AnalysisEnvelope;
}

test("un arco sin cálculo se distingue de un arco que salió de la lista", () => {
  const pendiente = sobre({ missingInputs: [TRANSIT_ARC_PENDING_INPUT] });
  const fuera = sobre({ missingInputs: ["requested_transit_arc"] });

  assert.equal(transitArcPending(pendiente), true);
  assert.equal(transitArcPending(fuera), false);
  assert.match(missingReasons(pendiente).join(" "), /Todavía no calculamos/);
  assert.match(missingReasons(fuera).join(" "), /entre los activos de hoy/);

  // Un sobre CON dato nunca está pendiente, ni siquiera si arrastra el código.
  assert.equal(
    transitArcPending(sobre({ data: { kind: "transit_arc" }, missingInputs: [TRANSIT_ARC_PENDING_INPUT] })),
    false
  );
  // Y ningún código interno llega a pantalla.
  for (const linea of [...missingReasons(pendiente), ...missingReasons(fuera)]) {
    assert.doesNotMatch(linea, /requested_transit_arc/);
  }
});

// ---------------------------------------------------------------------------
// Estructura: un solo sobre manda en el detalle
// ---------------------------------------------------------------------------

test("el cuerpo del detalle y su trazabilidad salen del MISMO sobre ORB-TRN-001", () => {
  const source = sinComentarios(leer(ARCO));
  const cuerpo = seccion(source, "function ArcoContent", "function AdelantoDelTransito");

  // El sobre entra por prop tipada como arco: pasar el ranking no compilaría.
  assert.match(
    source,
    /envelope:\s*AnalysisEnvelope\s*&\s*\{\s*data:\s*TransitArcData\s*\|\s*null\s*\}/,
    "el detalle declara que su sobre es de arco; sin esa anotación el tipo dejaría pasar el ranking"
  );

  // El acordeón recibe ese mismo sobre, sin envolverlo ni sustituirlo.
  assert.match(
    cuerpo,
    /<TraceAccordion[\s\S]{0,200}?envelope=\{envelope\}/,
    "la trazabilidad tiene que ser la del sobre que dibuja el cuerpo"
  );

  // Y el cuerpo no conoce el ranking: ni el sobre, ni sus ítems, ni sus fechas.
  for (const prohibido of [
    "transitRanking",
    "rankingEnvelope",
    "TransitRankingItem",
    "item.exactAt",
    "item.startsAt",
    "item.endsAt",
    "item.reasons",
    "item.summary",
    "exactnessRatio"
  ]) {
    assert.ok(
      !cuerpo.includes(prohibido),
      `el cuerpo del arco no puede usar «${prohibido}»: es del ranking, no de este sobre`
    );
  }

  // Las fechas de la línea de tiempo salen del dato del arco.
  assert.match(
    cuerpo,
    /const inicio = arco\.startsAt/,
    "el inicio de la ventana es el del arco calculado"
  );
  assert.match(cuerpo, /const pico = arco\.peakAt/);
  assert.match(cuerpo, /const cierre = arco\.endsAt/);
  assert.match(
    cuerpo,
    /<ArcTimeline[\s\S]{0,300}?startsAt=\{inicio\}/,
    "la línea de tiempo dibuja la ventana del arco, no la del ranking"
  );
  assert.match(cuerpo, /arco\.passes\.map/, "las pasadas son las del arco calculado");
  // El resumen sigue siendo el del arco calculado; lo único que se le pone al día
  // es la frase de la etapa, para que no contradiga al chip (QA22-009).
  assert.match(
    cuerpo,
    /const resumen = summaryWithCanonicalState\(arco\.summary, estado\.state\)/,
    "el resumen sale del arco y se alinea con la etapa canónica"
  );
  assert.match(cuerpo, /<Body[^>]*>\{resumen\}<\/Body>/, "y es el que se dibuja");
});

test("el detalle pide el ORB-TRN-001 del arcId y sólo usa el ranking para el adelanto", () => {
  const source = sinComentarios(leer(ARCO));

  assert.match(source, /useTransitArc/, "un arcId que no es el principal necesita su propio sobre");
  const resolver = seccion(source, "function ArcoResolver", "function ArcoContent");

  // El ranking aparece UNA vez y sólo para el adelanto de QA22-011: título,
  // etapa, significado y acción mientras el cálculo del arco viaja.
  const usos = resolver.match(/transitRanking/g)?.length ?? 0;
  assert.equal(usos, 1, "el ranking sólo puede alimentar el adelanto, y una sola vez");
  assert.match(
    resolver,
    /transitRanking\.data\?\.items\.find\([\s\S]{0,120}?\)/,
    "del ranking se busca el ítem del arco abierto"
  );
  assert.match(
    resolver,
    /adelanto = enRanking \? transitPreviewFromRanking\(enRanking, nowMs, timezone\) : null/,
    "y de ese ítem sale el adelanto, resuelto por el dominio"
  );
  // El adelanto es una forma cerrada: la pantalla no puede sacarle una fecha a la
  // fila del ranking por otro camino.
  const adelanto = sinComentarios(leer("src/domain/transitDetail.ts"));
  const tipo = /export type TransitPreview = \{[\s\S]*?\n\};/.exec(adelanto)?.[0] ?? "";
  assert.ok(tipo, "no se encontró la forma del adelanto");
  for (const prohibido of ["At", "starts", "ends", "window", "passes"]) {
    assert.ok(!tipo.includes(prohibido), `el adelanto no puede publicar «${prohibido}»`);
  }

  // El sobre específico es el que se le pasa al cuerpo.
  assert.match(resolver, /envelope=\{especifico\.envelope\}/);
  assert.match(
    resolver,
    /const esPrincipal = !arcId \|\| principal\.data\?\.arcId === arcId/,
    "reutilizar el sobre del bundle exige que el arco sea EL principal"
  );

  // El adelanto no puede convertirse en el cuerpo del detalle: con el arco
  // calculado, todo sale del arco.
  const cuerpo = seccion(source, "function ArcoContent", "function AdelantoDelTransito");
  const conDato = cuerpo.slice(cuerpo.indexOf("const esExacto"));
  assert.ok(
    !conDato.includes("adelanto"),
    "con el arco calculado el titular sale del arco, no del ranking"
  );
  assert.match(conDato, /<Title>\{transitHeadline\(arco\)\}<\/Title>/);
});

test("el hook del arco lee la query reactiva y pide la acción una sola vez por pedido", () => {
  const source = sinComentarios(leer(HOOK));

  assert.match(source, /useQuery\(\s*layersApi\.getTransitArc/, "la lectura es la query tipada");
  assert.match(source, /useAction\(layersApi\.refreshTransitArc\)/, "el cálculo es la acción tipada");
  assert.match(source, /gate\.start\(key\)/, "cada pedido pasa por el coordinador");
  assert.match(
    source,
    /if \(token === null\) return;/,
    "un pedido ya hecho no larga una segunda acción"
  );
  assert.match(
    source,
    /gate\.isCurrent\(token\)/,
    "una respuesta sólo escribe estado si sigue siendo el pedido vigente"
  );
  assert.match(
    source,
    /if \(!necesitaCalculo && !forzar\.current\) return;/,
    "un reintento explícito dispara incluso si el sobre guardado parece vigente"
  );
  assert.match(source, /forzar\.current = true/, "y el botón es el que lo fuerza");
  assert.match(
    source,
    /\}, \[arcId\]\);/,
    "cambiar de arco limpia el estado del anterior en vez de arrastrarlo"
  );
  assert.ok(
    !/api\.layers|anyApi/.test(source),
    "el hook consume el binding generado, no una referencia a mano"
  );
});

test("Vínculos deja el método y su versión sólo dentro del acordeón", () => {
  const source = sinComentarios(leer(VINCULOS));

  assert.ok(
    !/MÉTODO\s*\$\{/.test(source) && !source.includes("comparison.methodVersion"),
    "el identificador crudo del método no puede quedar en el pie visible"
  );
  assert.match(
    source,
    /<TraceAccordion[\s\S]{0,200}?envelope=\{comparison\}/,
    "el sobre sigue llegando al acordeón, que es donde vive el método"
  );
  // El acordeón compartido es el único que publica método y versión.
  const trace = sinComentarios(leer("src/components/v492/Trace.tsx"));
  assert.match(trace, /MÉTODO Y VERSIÓN/);
  assert.match(trace, /envelope\.analysisId/);
  assert.match(trace, /envelope\.methodVersion/);

  // Y la fecha humana de la última verificación se conserva.
  assert.match(source, /ÚLTIMA COMPARACIÓN VERIFICADA/);
  assert.match(source, /TODAVÍA SIN COMPARACIÓN VERIFICADA/);
});

test("ninguna pantalla con acordeón repite la versión del método por fuera", () => {
  // El gate es exactamente el del defecto: si una pantalla YA publica método y
  // versión dentro del acordeón, imprimir el identificador crudo otra vez lo dice
  // dos veces y la segunda copia queda sin contexto.
  //
  // `CartaCompletaV492Screen` no entra: no tiene acordeón —su read-model no es un
  // `AnalysisResult`— y declara la versión en su módulo `Cómo se calculó`, con la
  // explicación de para qué sirve al lado. Ahí la versión es el dato, no una
  // repetición.
  const conAcordeon = [
    ARCO,
    VINCULOS,
    "src/screens/v492/TransitosLayersScreen.tsx",
    "src/screens/v492/CartaHubScreen.tsx",
    "src/screens/v492/TipoLunarDetailScreen.tsx",
    "src/screens/v492/MapaElementalDetailScreen.tsx",
    "src/screens/v492/CumplelunaDetailScreen.tsx",
    "src/screens/v492/LunaDetailScreen.tsx",
    "src/screens/v492/VinculosHubScreen.tsx"
  ] as const;
  for (const rel of conAcordeon) {
    const source = sinComentarios(leer(rel));
    assert.match(source, /<TraceAccordion/, `${rel} debería seguir publicando su trazabilidad`);
    assert.ok(
      !/\bmethodVersion\b/.test(source),
      `${rel} imprime la versión del método fuera de la trazabilidad`
    );
  }
});
