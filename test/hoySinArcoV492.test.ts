/**
 * Hoy sin el bloque del arco: qué quedó, en qué orden y adónde va cada salida.
 *
 * El defecto que se cierra: `ARCO DEL TRÁNSITO` mostraba, dentro de Hoy, la
 * ventana del MISMO tránsito que el ranking ya ponía primero. La fila de arriba
 * decía el contacto y el bloque de abajo repetía su titular con tres fechas: dos
 * bloques para un solo tránsito, y el segundo rotulado con una palabra —"arco"—
 * que es jerga interna del cálculo.
 *
 * Lo que se fija acá:
 *
 * 1. Hoy **no consume** el sobre del arco ni dibuja su línea de tiempo.
 * 2. Los bloques que quedan son tres, y el Cumpleluna sube al primero **sólo**
 *    cuando cae hoy; si no, lo principal es el primero del ranking.
 * 3. Las dos salidas: `VER TODOS LOS TRÁNSITOS` y la pestaña llegan a la MISMA
 *    lista (`/transitos`, vista `Ahora`), y el detalle se abre por `arcId`.
 * 4. `/hoy/arco` sigue existiendo **como redirección** al detalle canónico
 *    (`/transitos/arco/[arcId]`), sin montar la pantalla por segunda vez: los
 *    links que ya existen no se rompen y el detalle tiene un solo dueño.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const HOY = "src/screens/v492/HoyScreen.tsx";

test("Hoy no dibuja el arco: ni su bloque, ni su sobre, ni su línea de tiempo", () => {
  const source = sinComentarios(leer(HOY));

  assert.ok(!source.includes("ARCO DEL TRÁNSITO"), "el bloque del arco sale de Hoy");
  assert.ok(!source.includes("ArcoBloque"), "y su composición también");
  assert.ok(!/<ArcTimeline/.test(source), "la ventana se lee en el detalle, con su significado al lado");
  assert.ok(!/transitArc/.test(source), "Hoy ya no consume el sobre `ORB-TRN-001`");
  assert.ok(!/transitHeadline|TRANSIT_STATE_CHIP/.test(source), "ni su titular ni su chip de etapa");
  // Y no queda un import muerto del componente que dejó de usarse.
  const imports = source.slice(0, source.indexOf("export function HoyScreen"));
  assert.ok(!/StateChip/.test(imports), "el chip de etapa era sólo del bloque del arco");
});

test("quedan tres bloques y el Cumpleluna sólo encabeza cuando cae hoy", () => {
  const source = sinComentarios(leer(HOY));
  const contenido = source.slice(source.indexOf("function HoyContent"), source.indexOf("type BloqueHoy"));

  const empujes = contenido.match(/key: "(\w+)"/g) ?? [];
  assert.deepEqual(
    empujes,
    ['key: "cumpleluna"', 'key: "ranking"', 'key: "luna"', 'key: "cumpleluna"'],
    "tres bloques, con el cumpleluna en una de sus dos posiciones posibles"
  );
  // La primera aparición cuelga de que el evento sea HOY; la última, de que no.
  assert.match(contenido, /if \(cumplelunaHoyAt !== null\) \{\s*bloques\.push\(\{\s*key: "cumpleluna"/);
  assert.match(contenido, /if \(cumplelunaHoyAt === null\) \{\s*bloques\.push\(\{\s*key: "cumpleluna"/);

  // La numeración sigue al orden en que se ve, no a un catálogo fijo de capas.
  assert.match(source, /index=\{String\(index \+ 1\)\.padStart\(2, "0"\)\}/);
});

test("lo principal es el Cumpleluna de hoy y, si no, el primero del ranking", () => {
  const source = sinComentarios(leer(HOY));
  const principal = source.slice(source.indexOf("function Principal("), source.indexOf("function cumplelunaHoyTexto"));

  assert.match(principal, /topTransits\(ranking\.items, 1\)\[0\]/, "el titular es el primero de la lista");
  assert.match(
    principal,
    /const titular = cumpleluna[\s\S]{0,400}?:\s*primero[\s\S]{0,80}?primero\.summary/,
    "con cumpleluna hoy manda el evento; si no, la frase calculada del primer tránsito"
  );
  assert.match(principal, /if \(!titular\) return null;/, "sin ninguno de los dos no se inventa un titular");
  // El Cumpleluna sólo llega acá cuando ES hoy.
  assert.match(source, /cumpleluna=\{cumplelunaHoyAt !== null \? cumplelunaData : null\}/);
});

test("las dos salidas de Hoy: la lista completa y el detalle por arcId", () => {
  const source = sinComentarios(leer(HOY));
  const ranking = source.slice(source.indexOf("function RankingBloque"), source.indexOf("function LunaBloque"));

  assert.match(
    ranking,
    /router\.push\(`\/transitos\/arco\/\$\{encodeURIComponent\(item\.arcId\)\}` as never\)/,
    "cada fila abre el detalle de SU tránsito"
  );
  assert.match(
    ranking,
    /label="VER TODOS LOS TRÁNSITOS"[\s\S]{0,320}?router\.push\("\/transitos" as never\)/,
    "«ver todos» va a la lista completa"
  );
  assert.match(ranking, /accessibilityHint="Abre Tránsitos en la vista Ahora"/);

  // Y no queda ninguna salida hacia el detalle del arco principal desde Hoy.
  assert.ok(!source.includes("/hoy/arco"), "el arco del día ya no se abre desde Hoy");
});

test("la pestaña y «ver todos» llegan al mismo lugar: /transitos en vista Ahora", () => {
  const tabs = sinComentarios(leer("src/routes/v492/tabs-layout.tsx"));
  assert.match(tabs, /<Tabs\.Screen name="transitos"/, "la pestaña existe y apunta a la sección");

  // La raíz de la sección ES la vista `Ahora`.
  const raiz = sinComentarios(leer("src/routes/v492/transitos-index.tsx"));
  assert.match(raiz, /<TransitosLayersScreen mode="ahora" \/>/);
  // El selector conserva sus dos vistas y sus dos rutas.
  const pantalla = sinComentarios(leer("src/screens/v492/TransitosLayersScreen.tsx"));
  assert.match(pantalla, /\{ key: "ahora" as const, label: "AHORA" \}/);
  assert.match(pantalla, /\{ key: "momento" as const, label: "TU MOMENTO" \}/);
  assert.match(pantalla, /ahora: "\/transitos"/);
  assert.match(pantalla, /momento: "\/transitos\/momento"/);
  assert.match(pantalla, /router\.replace\(RUTA_VISTA\[vista\] as never\)/, "las vistas no se apilan");
});

test("/hoy/arco queda sólo como compatibilidad: redirige al detalle canónico", () => {
  const ruta = sinComentarios(leer("app/(tabs)/hoy/arco.tsx"));

  // No vuelve a montar el detalle: dos rutas dibujando la misma pantalla con dos
  // "volver" distintos es un duplicado que se desincroniza solo.
  assert.ok(!ruta.includes("ArcoDetailScreen"), "la ruta vieja no renderiza el detalle otra vez");

  // El destino es el canónico, con el `arcId` del tránsito principal del día.
  assert.match(
    ruta,
    /const arcId = bundle\?\.today\.transitArc\.data\?\.arcId \?\? null/,
    "el arco principal sale del sobre del día"
  );
  assert.match(
    ruta,
    /arcId \? `\/transitos\/arco\/\$\{encodeURIComponent\(arcId\)\}` : "\/transitos"/,
    "con arcId al detalle canónico; sin arcId, a la lista"
  );
  assert.match(ruta, /<Redirect href=\{destino as never\} \/>/);

  // Y mientras el sobre viaja no se resuelve el destino: mandar a la lista ahí
  // sería contestarle «no está» a alguien que pidió un detalle concreto.
  assert.match(ruta, /if \(phase === "cargando"\)[\s\S]{0,200}?<LoadingBlock \/>/);

  // El detalle por `arcId` es la ruta canónica, en su sección, y vuelve a la lista.
  const porArco = sinComentarios(leer("src/routes/v492/transitos-arco.tsx"));
  assert.match(porArco, /<ArcoDetailScreen arcId=\{arcId\} fallbackHref="\/transitos" \/>/);
  assert.match(porArco, /<Redirect href="\/transitos" \/>/, "sin arcId no hay detalle que abrir");
});
