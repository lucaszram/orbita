/**
 * QA22-027 — volver desde un detalle de `Tu momento` vuelve a `Tu momento`.
 *
 * El defecto medido en el iPhone: `Hoy → Tu momento → Cumpleluna → Atrás`
 * devolvía a `Ahora`. No era el botón de volver: los detalles de las capas del
 * día vivían SÓLO en el stack de Hoy (`/hoy/cumpleluna`, `/hoy/luna`), así que
 * abrir uno desde `Tu momento` —que vive en el stack de Tránsitos— cambiaba de
 * sección. Un stack sólo puede devolver a lo que él mismo apiló.
 *
 * Por eso lo que se prueba acá es la RUTA, no una memoria: qué destino abre cada
 * origen, de qué stack cuelga y a dónde vuelve cuando no hay historial. La
 * continuidad de la instancia y del scroll es consecuencia de eso: si el detalle
 * se apila sobre `Tu momento`, `Atrás` es un `pop` y la pantalla de abajo nunca
 * se desmontó.
 *
 * Lo que NO cambia y se vuelve a fijar acá: tocar la pestaña Tránsitos sigue
 * abriendo `Ahora` (`TAB_ROOT_SCREEN`), y un deep link sin origen conserva su
 * respaldo canónico.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

import {
  DETAIL_ORIGIN_PARAM,
  MOMENTO_ROUTE,
  SECTION_LAYER_DETAILS,
  TRANSITOS_ROUTE,
  detailFallbackHref,
  detailOrigin,
  layerDetailHref,
  sectionLayerDetail,
  withDetailOrigin
} from "../src/domain/detailOrigin";
import { TAB_ROOT_SCREEN } from "../src/domain/tabPress";
import { ROOT, resolveEntryForPlatform } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const relativo = (absolute: string) => relative(ROOT, absolute);

const HOY = "src/screens/v492/HoyScreen.tsx";
const MOMENTO = "src/screens/v492/TransitosLayersScreen.tsx";
const RUTA_CAPA = "src/routes/v492/transitos-capa.tsx";
const RUTA_ARCO = "src/routes/v492/transitos-arco.tsx";
const CUMPLELUNA = "src/screens/v492/CumplelunaDetailScreen.tsx";
const LUNA = "src/screens/v492/LunaDetailScreen.tsx";

// ---------------------------------------------------------------------------
// El módulo puro: de dónde viene un detalle y a dónde vuelve
// ---------------------------------------------------------------------------

test("un origen declarado manda; cualquier otra cosa cae en el respaldo canónico", () => {
  assert.equal(detailOrigin("momento"), "momento");
  assert.equal(detailFallbackHref("momento", TRANSITOS_ROUTE), MOMENTO_ROUTE);

  // Sin origen —un deep link, un enlace viejo, la lista— vuelve a la raíz de la
  // sección. Nunca a `/hoy`: el detalle no cuelga de ese stack.
  for (const crudo of [undefined, null, "", "hoy", "ahora", "MOMENTO", " momento"]) {
    assert.equal(detailOrigin(crudo), null, String(crudo));
    assert.equal(detailFallbackHref(crudo, TRANSITOS_ROUTE), TRANSITOS_ROUTE, String(crudo));
  }

  // Un parámetro repetido llega como arreglo: un origen ambiguo no es un origen.
  assert.equal(detailOrigin(["momento"]), null);
  assert.equal(detailFallbackHref(["momento", "hoy"], TRANSITOS_ROUTE), TRANSITOS_ROUTE);

  // Y una clave del prototipo no puede colarse como origen válido.
  for (const crudo of ["toString", "constructor", "__proto__"]) {
    assert.equal(detailOrigin(crudo), null, crudo);
  }
});

test("el destino declara su origen en la URL, con el mismo nombre que lee la ruta", () => {
  assert.equal(DETAIL_ORIGIN_PARAM, "desde");
  assert.equal(withDetailOrigin("/transitos/arco/arc_v1_x", "momento"), "/transitos/arco/arc_v1_x?desde=momento");

  // Ida y vuelta: lo que escribe el enlace es exactamente lo que la ruta resuelve.
  const href = withDetailOrigin("/transitos/arco/arc_v1_x", "momento");
  const desde = new URL(href, "https://orbita.test").searchParams.get(DETAIL_ORIGIN_PARAM);
  assert.equal(detailFallbackHref(desde, TRANSITOS_ROUTE), MOMENTO_ROUTE);
});

test("las capas que abre la sección tienen destino propio dentro de Tránsitos", () => {
  // `mandala` se suma en QA23-002: el dibujo pasó a tener detalle propio, y ése
  // cuelga del mismo stack que los otros cuatro.
  assert.deepEqual([...SECTION_LAYER_DETAILS], ["estacion", "ano", "cumpleluna", "luna", "mandala"]);
  assert.equal(layerDetailHref("estacion"), "/transitos/capa/estacion");
  assert.equal(layerDetailHref("ano"), "/transitos/capa/ano");
  assert.equal(layerDetailHref("cumpleluna"), "/transitos/capa/cumpleluna");
  assert.equal(layerDetailHref("luna"), "/transitos/capa/luna");
  assert.equal(layerDetailHref("mandala"), "/transitos/capa/mandala");

  for (const capa of SECTION_LAYER_DETAILS) assert.equal(sectionLayerDetail(capa), capa);
  // El slug viaja en la URL, así que va sin acentos ni eñes: `año` obligaría a
  // escapar y decodificar cada enlace, y ahí es donde se cuelan los destinos que
  // no resuelven.
  for (const crudo of [undefined, null, "", "año", "estación", "arco", "toString", ["luna"]]) {
    assert.equal(sectionLayerDetail(crudo), null, String(crudo));
  }
});

// ---------------------------------------------------------------------------
// La matriz: cada detalle de la sección, desde los dos orígenes
// ---------------------------------------------------------------------------

/**
 * Qué abre cada origen y a dónde vuelve ese destino sin historial.
 *
 * `Tu momento` no ofrece la Luna del día ni el ciclo lunar —desde QA23-002 sus
 * accesos son TRES, uno por módulo—, pero sus detalles YA cuelgan del stack de
 * Tránsitos (`/transitos/capa/luna`, `/transitos/capa/cumpleluna`): el día que
 * la portada los enlace, no hay ruta que inventar ni "volver" que se pierda.
 *
 * Estación, año y mandala, en cambio, sólo existen en esta sección: no tienen
 * fila con origen `hoy` porque Hoy no los muestra.
 */
const MATRIZ = [
  {
    detalle: "estacion",
    origen: "momento",
    href: "/transitos/capa/estacion",
    archivo: "app/(tabs)/transitos/capa/[layer].tsx",
    vuelveA: MOMENTO_ROUTE
  },
  {
    detalle: "ano",
    origen: "momento",
    href: "/transitos/capa/ano",
    archivo: "app/(tabs)/transitos/capa/[layer].tsx",
    vuelveA: MOMENTO_ROUTE
  },
  {
    detalle: "mandala",
    origen: "momento",
    href: "/transitos/capa/mandala",
    archivo: "app/(tabs)/transitos/capa/[layer].tsx",
    vuelveA: MOMENTO_ROUTE
  },
  {
    detalle: "cumpleluna",
    origen: "hoy",
    href: "/hoy/cumpleluna",
    archivo: "app/(tabs)/hoy/cumpleluna.tsx",
    vuelveA: "/hoy"
  },
  {
    detalle: "cumpleluna",
    origen: "momento",
    href: "/transitos/capa/cumpleluna",
    archivo: "app/(tabs)/transitos/capa/[layer].tsx",
    vuelveA: MOMENTO_ROUTE
  },
  {
    detalle: "luna",
    origen: "hoy",
    href: "/hoy/luna",
    archivo: "app/(tabs)/hoy/luna.tsx",
    vuelveA: "/hoy"
  },
  {
    detalle: "luna",
    origen: "momento",
    href: "/transitos/capa/luna",
    archivo: "app/(tabs)/transitos/capa/[layer].tsx",
    vuelveA: MOMENTO_ROUTE
  },
  {
    detalle: "arco",
    origen: "hoy",
    href: "/transitos/arco/arc_v1_x",
    archivo: "app/(tabs)/transitos/arco/[arcId].tsx",
    vuelveA: TRANSITOS_ROUTE
  },
  {
    detalle: "arco",
    origen: "momento",
    // El nombre del parámetro se fija arriba (`DETAIL_ORIGIN_PARAM`): acá va
    // escrito, que es como viaja en la URL real.
    href: "/transitos/arco/arc_v1_x?desde=momento",
    archivo: "app/(tabs)/transitos/arco/[arcId].tsx",
    vuelveA: MOMENTO_ROUTE
  }
] as const;

/** El stack del que cuelga una ruta de `app/(tabs)/<stack>/…`. */
const stackDe = (archivo: string) => /^app\/\(tabs\)\/([^/]+)\//.exec(archivo)?.[1] ?? null;

test("cada detalle existe desde su origen y ninguno de Tu momento cae en Hoy", () => {
  for (const caso of MATRIZ) {
    const contexto = `${caso.detalle} desde ${caso.origen}`;
    assert.ok(existsSync(join(ROOT, caso.archivo)), `${contexto}: la ruta ${caso.archivo} no existe`);

    // El respaldo de un detalle de capa lo fija la ruta de la que cuelga; el del
    // arco —que comparten tres superficies— lo fija el origen declarado.
    const desde = new URL(caso.href, "https://orbita.test").searchParams.get(DETAIL_ORIGIN_PARAM);
    const vuelveA = caso.archivo.includes("/arco/")
      ? detailFallbackHref(desde, TRANSITOS_ROUTE)
      : stackDe(caso.archivo) === "hoy"
        ? "/hoy"
        : MOMENTO_ROUTE;
    assert.equal(vuelveA, caso.vuelveA, contexto);

    // Ésta es la regla que cierra QA22-027: lo que se abre desde `Tu momento`
    // cuelga del stack de Tránsitos, así que `Atrás` es un `pop` de ESE stack.
    // Un detalle en el stack de Hoy no tiene ninguna manera de volver acá.
    if (caso.origen === "momento") {
      assert.equal(stackDe(caso.archivo), "transitos", `${contexto}: el detalle sale de su stack`);
      assert.ok(!caso.vuelveA.startsWith("/hoy"), `${contexto}: el respaldo cae en Hoy`);
    }
  }
});

test("Hoy abre sus detalles en su propio stack y la puerta a Tu momento", () => {
  const hoy = sinComentarios(leer(HOY));

  assert.match(hoy, /router\.push\("\/hoy\/luna" as never\)/, "la Luna del día cuelga del stack de Hoy");
  assert.match(hoy, /router\.push\("\/hoy\/cumpleluna" as never\)/, "y el cumpleluna también");
  assert.match(
    hoy,
    /router\.push\("\/transitos\/momento" as never\)/,
    "«VER TU MOMENTO» es el primer paso del recorrido que cierra QA22-027"
  );
  // El arco desde Hoy no declara origen: su respaldo es la raíz canónica de la
  // sección en la que el detalle vive, que es la que la lista comparte.
  assert.match(hoy, /router\.push\(`\/transitos\/arco\/\$\{encodeURIComponent\(item\.arcId\)\}` as never\)/);
  assert.ok(!hoy.includes(`${DETAIL_ORIGIN_PARAM}=`), "Hoy no necesita declarar origen: no lo cambia");
});

test("Tu momento abre cada MÓDULO con detalle DENTRO del stack de Tránsitos", () => {
  const momento = sinComentarios(leer(MOMENTO));

  // Los tres accesos de la vista, uno por módulo, todos con ruta propia de la
  // sección: el origen lo dice la ruta y no hace falta declararlo (QA22-024,
  // QA23-002).
  assert.match(momento, /href: layerDetailHref\("estacion"\)/);
  assert.match(momento, /label: "VER TU ESTACIÓN"/);
  assert.match(momento, /href: layerDetailHref\("ano"\)/);
  assert.match(momento, /label: "VER TU AÑO"/);
  assert.match(momento, /href: layerDetailHref\("mandala"\)/);
  assert.match(momento, /label: "VER TUS CUATRO RITMOS"/);

  // Ya NO hay salidas por anillo (QA23-002): el ciclo lunar y el tránsito activo
  // se leían desde el dibujo, y sus rutas siguen existiendo para el día que otra
  // superficie las enlace, pero esta vista no las reparte.
  assert.ok(!momento.includes('label: "VER CICLO LUNAR"'), "el mandala no vuelve a ser un índice");
  assert.ok(!momento.includes('label: "VER TRÁNSITO"'), "ni a salir hacia otra sección");
  assert.ok(!momento.includes("withDetailOrigin"), "sin enlaces compartidos no hay origen que declarar");
  assert.ok(
    !momento.includes("bundle.today.transitArc"),
    "la vista de los ciclos largos no necesita el arco del día"
  );

  // La regla que cierra el defecto: ningún destino de esta sección cuelga del
  // stack de Hoy. El día que se enlace la Luna, tiene que ser `capa/luna`.
  assert.ok(!/["'`]\/hoy\b/.test(momento), "Tu momento no puede abrir un detalle del stack de Hoy");

  // Y el acceso vive FUERA del renglón accesible del ritmo: adentro, VoiceOver
  // absorbe el control y no queda forma de tocarlo. Ahora está un nivel más
  // arriba —lo pone el módulo, después del dibujo— así que la lista de anillos
  // no monta ningún control.
  const mandala = momento.slice(momento.indexOf("function Mandala("));
  assert.ok(!mandala.includes("<LinkRow"), "la lista de anillos es texto, no una botonera");
  assert.ok(!mandala.includes("router.push"), "ni navega por su cuenta");
  const bloque03 = momento.slice(momento.indexOf('index="03"'));
  assert.ok(
    bloque03.indexOf("<AccesoDetalle acceso={DETALLES.mandala} />") > bloque03.indexOf("<Mandala "),
    "el acceso del módulo va debajo del dibujo y de sus líneas"
  );
});

// ---------------------------------------------------------------------------
// Las rutas: de qué stack cuelga cada detalle
// ---------------------------------------------------------------------------

test("el detalle de capa de Tránsitos es un wrapper resuelto por plataforma fuera de app", () => {
  const ruta = "app/(tabs)/transitos/capa/[layer].tsx";
  assert.match(leer(ruta), /export \{ default \} from "@\/routes\/v492\/transitos-capa"/);
  assert.equal(relativo(resolveEntryForPlatform(ruta, "native")), RUTA_CAPA);
  assert.equal(relativo(resolveEntryForPlatform(ruta, "web")), "src/routes/v492/transitos-capa.web.tsx");
  // La web no tiene estos detalles: redirige, sin importar la pantalla nativa.
  assert.match(
    sinComentarios(leer("src/routes/v492/transitos-capa.web.tsx")),
    /<Redirect href="\/home" \/>/
  );
});

test("la ruta de capa monta la pantalla de cada capa y le da el volver de Tu momento", () => {
  const capa = sinComentarios(leer(RUTA_CAPA));

  assert.match(capa, /estacion: EstacionDetailScreen/);
  assert.match(capa, /ano: AnoDetailScreen/);
  assert.match(capa, /cumpleluna: CumplelunaDetailScreen/);
  assert.match(capa, /luna: LunaDetailScreen/);
  assert.match(capa, /mandala: MandalaDetailScreen/);
  assert.match(capa, /Record<SectionLayerDetail,/, "la tabla es exhaustiva por tipo");
  assert.match(capa, /<DetalleScreen fallbackHref=\{MOMENTO_ROUTE\} \/>/);
  // Una capa que la sección no abre no monta nada: vuelve a la vista que abre
  // estos detalles en vez de dejar una pantalla vacía.
  assert.match(capa, /const capa = sectionLayerDetail\(layer\);/);
  assert.match(capa, /if \(!capa\) return <Redirect href=\{MOMENTO_ROUTE as never\} \/>;/);
});

test("el detalle del arco resuelve su respaldo con el origen, y sin origen con la raíz", () => {
  const arco = sinComentarios(leer(RUTA_ARCO));

  assert.match(arco, /const \{ arcId, desde \} = useLocalSearchParams</);
  assert.match(
    arco,
    /<ArcoDetailScreen arcId=\{arcId\} fallbackHref=\{detailFallbackHref\(desde, "\/transitos"\)\} \/>/
  );
  // Sin `arcId` no hay detalle que abrir: eso no cambió.
  assert.match(arco, /<Redirect href="\/transitos" \/>/);
});

test("los dos detalles de capa reciben su volver de la ruta, con Hoy como valor por defecto", () => {
  for (const rel of [CUMPLELUNA, LUNA]) {
    const source = sinComentarios(leer(rel));
    assert.match(source, /fallbackHref = "\/hoy"/, `${rel}: la ruta de Hoy sigue funcionando sin pasar nada`);

    // Todas las superficies de la pantalla —carga, error, invitado, vacío y la
    // lectura— tienen que volver al mismo lado: si una se olvida, el "volver"
    // depende de con qué estado se abrió el detalle.
    const shells = source.match(/<DetailLayerScreen eyebrow=/g)?.length ?? 0;
    const conVuelta = source.match(/<DetailLayerScreen eyebrow="[^"]+" fallbackHref=\{fallbackHref\}>/g)?.length ?? 0;
    assert.ok(shells >= 5, `${rel}: se esperaban las cinco superficies del detalle`);
    assert.equal(conVuelta, shells, `${rel}: hay superficies sin destino de vuelta`);
  }
});

test("volver es un pop mientras el stack siga montado: por eso conserva instancia y scroll", () => {
  const screen = sinComentarios(leer("src/components/v492/Screen.tsx"));
  // `back()` devuelve a la pantalla que sigue montada abajo —con su ScrollView y
  // su offset—; `replace(fallbackHref)` monta una nueva y es el respaldo del
  // caso sin historial, no el camino normal.
  assert.match(
    screen,
    /onPress=\{\(\) => \(router\.canGoBack\(\) \? router\.back\(\) : router\.replace\(fallbackHref as never\)\)\}/
  );
});

// ---------------------------------------------------------------------------
// Lo que no se movió
// ---------------------------------------------------------------------------

test("tocar la pestaña Tránsitos sigue abriendo Ahora", () => {
  // La tabla de raíces no se toca: `Tu momento` gana continuidad al volver de un
  // detalle, no al tocar la pestaña. Desde la barra, Tránsitos abre su raíz.
  assert.deepEqual(TAB_ROOT_SCREEN, { transitos: "index" });

  const momento = sinComentarios(leer(MOMENTO));
  assert.match(momento, /ahora: "\/transitos"/);
  assert.match(momento, /momento: "\/transitos\/momento"/);
  assert.match(momento, /router\.replace\(RUTA_VISTA\[vista\] as never\)/, "las dos vistas no se apilan");
});

test("la ruta de Tu momento del selector y la del respaldo son la misma", () => {
  // Dos literales de la misma URL en dos archivos distintos: si uno se mueve sin
  // el otro, el detalle vuelve a una vista que ya no existe.
  const momento = sinComentarios(leer(MOMENTO));
  const ruta = /momento: "([^"]+)"/.exec(momento)?.[1];
  assert.equal(ruta, MOMENTO_ROUTE);
  assert.equal(TRANSITOS_ROUTE, /ahora: "([^"]+)"/.exec(momento)?.[1]);
});
