import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { CONTENT_CANVAS_MAX_WIDTH, fitSquare } from "../src/domain/contentCanvas";
import {
  CANVAS_MAX_WIDTH,
  canvasMaxWidth,
  layoutModeFor,
  reservesBottomNav,
  resetsScrollOnRoute,
  showsScreenHeader,
  splitsColumns,
  WEB_LAYOUT_BREAKPOINT
} from "../src/domain/webLayout";
import { resolveEntryForPlatform, type ModulePlatform } from "./moduleGraph";

const ROOT = join(import.meta.dirname, "..");
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const entrada = (ruta: string, plataforma: ModulePlatform) => {
  const archivo = resolveEntryForPlatform(ruta, plataforma);
  return { rel: relative(ROOT, archivo), src: readFileSync(archivo, "utf8") };
};

const CANVAS = leer("src/components/orbita/ContentCanvas.tsx");
const CARTA = leer("src/screens/CartaScreen.tsx");
const CARTA_CARD = leer("src/components/home/CartaCard.tsx");
const PERFIL = leer("src/screens/PerfilScreen.tsx");
const WHEEL = leer("src/components/orbita/NatalWheel.tsx");

// --- El tamaño sale del contenedor, no del viewport -------------------------

test("sin medida del contenedor no se elige ningún tamaño", () => {
  assert.equal(fitSquare({ container: null, max: 360 }), null);
  assert.equal(fitSquare({ container: 0, max: 360 }), null);
  assert.equal(fitSquare({ container: -20, max: 360 }), null);
  assert.equal(fitSquare({ container: Number.NaN, max: 360 }), null);
});

test("el lado es el ancho medido, con el tope como techo", () => {
  // Contenedor angosto: manda el contenedor.
  assert.equal(fitSquare({ container: 272, max: 360 }), 272);
  // Contenedor ancho: manda el tope, no crece con la ventana.
  assert.equal(fitSquare({ container: 1400, max: 360 }), 360);
  assert.equal(fitSquare({ container: 360, max: 360 }), 360);
  // Sub-pixel del navegador: se trunca, nunca se pide más de lo que hay.
  assert.equal(fitSquare({ container: 271.6, max: 360 }), 271);
});

test("el inset descuenta padding real del contenedor", () => {
  assert.equal(fitSquare({ container: 320, max: 360, inset: 24 }), 272);
  assert.equal(fitSquare({ container: 40, max: 360, inset: 24 }), null, "sin espacio útil no se dibuja");
});

test("una columna ancha no hace crecer la rueda más allá de su tope", () => {
  // El caso del escritorio: el lienzo mide 720 —o 1200— y la rueda sigue
  // midiendo 360. La tipografía y las piezas NO escalan con el viewport.
  assert.equal(fitSquare({ container: CONTENT_CANVAS_MAX_WIDTH, max: 360 }), 360);
  assert.equal(fitSquare({ container: CANVAS_MAX_WIDTH.wide, max: 360 }), 360);
});

// --- El contrato de layout --------------------------------------------------

test("el modo sale de un único breakpoint y por defecto es móvil", () => {
  assert.equal(WEB_LAYOUT_BREAKPOINT, 900);
  for (const w of [320, 390, 400, 768, 899]) assert.equal(layoutModeFor(w), "mobile", `${w} es móvil`);
  for (const w of [900, 1024, 1440, 1920]) assert.equal(layoutModeFor(w), "desktop", `${w} es escritorio`);
  // Sin medida no se monta una composición de escritorio "por las dudas".
  assert.equal(layoutModeFor(null), "mobile");
  assert.equal(layoutModeFor(undefined), "mobile");
  assert.equal(layoutModeFor(Number.NaN), "mobile");
});

test("las columnas sólo se abren en escritorio: el móvil apila", () => {
  assert.equal(splitsColumns("desktop"), true);
  assert.equal(splitsColumns("mobile"), false);
});

test("el header interno se oculta SÓLO en escritorio web", () => {
  assert.equal(showsScreenHeader({ web: true, mode: "desktop" }), false, "en escritorio lo pone la navegación");
  assert.equal(showsScreenHeader({ web: true, mode: "mobile" }), true, "en móvil web es el único chrome");
  assert.equal(showsScreenHeader({ web: false, mode: "mobile" }), true, "el nativo no cambia");
  assert.equal(showsScreenHeader({ web: false, mode: "desktop" }), true, "el nativo no cambia ni en tablet");
});

test("sólo el escritorio web lleva el destino al tope al cambiar de ruta", () => {
  assert.equal(resetsScrollOnRoute({ web: true, mode: "desktop" }), true, "en la web un link empieza arriba");
  assert.equal(
    resetsScrollOnRoute({ web: true, mode: "mobile" }),
    false,
    "en móvil web la navegación es la barra inferior: conserva dónde estabas, como una pestaña"
  );
  assert.equal(resetsScrollOnRoute({ web: false, mode: "mobile" }), false, "el nativo no cambia");
  assert.equal(resetsScrollOnRoute({ web: false, mode: "desktop" }), false, "el nativo no cambia");
});

test("sólo la web angosta reserva el alto de la barra fija", () => {
  assert.equal(reservesBottomNav({ web: true, mode: "mobile" }), true);
  assert.equal(reservesBottomNav({ web: true, mode: "desktop" }), false, "en escritorio la barra es superior");
  assert.equal(reservesBottomNav({ web: false, mode: "mobile" }), false, "en nativo la pone el tab bar");
});

// --- Cableado ---------------------------------------------------------------

test("ninguna pantalla de la carta lee el ancho de la ventana", () => {
  for (const [rel, src] of [
    ["src/screens/CartaScreen.tsx", CARTA],
    ["src/components/home/CartaCard.tsx", CARTA_CARD],
    ["src/components/orbita/NatalWheel.tsx", WHEEL],
    ["src/components/orbita/ContentCanvas.tsx", CANVAS],
    // Las implementaciones web reales de las otras tres superficies que montan
    // la MISMA rueda. Las entradas de `app/` son wrappers neutros.
    [entrada("app/recepcion.tsx", "web").rel, entrada("app/recepcion.tsx", "web").src],
    [entrada("app/carta-full.tsx", "web").rel, entrada("app/carta-full.tsx", "web").src],
    [entrada("app/reading/rueda.tsx", "web").rel, entrada("app/reading/rueda.tsx", "web").src]
  ] as const) {
    const codigo = sinComentarios(src);
    assert.ok(!/useWindowDimensions/.test(codigo), `${rel} no puede dimensionar por viewport`);
    assert.ok(!/Dimensions\.get/.test(codigo), `${rel} no puede leer Dimensions`);
    assert.ok(!/window\.inner/.test(codigo), `${rel} no puede leer window.innerWidth`);
  }
});

test("la rueda y el radar reciben el lado del contenedor medido", () => {
  const codigo = sinComentarios(CARTA);
  assert.ok(/<MeasuredSquare max=\{360\}>/.test(codigo), "la rueda mide su contenedor");
  // Desde CORE-215 el radar (mapa de valores) vive en la carta completa.
  assert.ok(/<MeasuredSquare max=\{340\}>/.test(sinComentarios(leer("src/screens/CartaCompletaScreen.tsx"))), "el radar también");
  assert.ok(/size=\{size\}/.test(codigo), "el lado viene del callback de medición");
  assert.ok(/<MeasuredSquare max=\{232\}>/.test(sinComentarios(CARTA_CARD)), "la mini-rueda también");
});

test("en escritorio la rueda mide SU COLUMNA, no el lienzo ancho", () => {
  // Regresión concreta: con el lienzo en 1200, si la rueda leyera el lienzo en
  // vez de su contenedor real quedaría en su tope pero descentrada respecto de
  // la columna. `MeasuredSquare` mide el contenedor, así que dentro de una
  // columna de ~576 el lado es el que corresponde.
  assert.equal(fitSquare({ container: 576 - 24 * 2, max: 360 }), 360);
  assert.equal(fitSquare({ container: 300, max: 360 }), 300);
});

test("toda superficie que monta la rueda la mide por contenedor", () => {
  for (const ruta of ["app/recepcion.tsx", "app/carta-full.tsx", "app/reading/rueda.tsx"]) {
    const web = entrada(ruta, "web");
    const codigo = sinComentarios(web.src);
    assert.ok(/<MeasuredSquare max=\{\d+\}/.test(codigo), `${web.rel} tiene que medir su contenedor`);
    assert.ok(/size=\{size\}/.test(codigo), `${web.rel}: el lado viene de la medición`);

    const native = entrada(ruta, "native");
    const redirect = sinComentarios(native.src);
    assert.match(redirect, /<Redirect\b/, `${native.rel} debe ser una redirección nativa pura`);
    assert.doesNotMatch(
      redirect,
      /MeasuredSquare|NatalWheel|useWindowDimensions|Dimensions\.get|window\.inner/,
      `${native.rel} no puede arrastrar la rueda web ni su lógica de medida`
    );
  }
});

test("MeasuredSquare mide con onLayout y no dibuja hasta tener medida real", () => {
  const codigo = sinComentarios(CANVAS);
  assert.ok(/onLayout=\{onLayout\}/.test(codigo));
  assert.ok(/e\.nativeEvent\.layout\.width/.test(codigo), "la medida sale del layout del propio contenedor");
  assert.ok(/size === null \? null : children\(size\)/.test(codigo), "sin medida no se dibuja nada");
  assert.ok(/minHeight: size \?\? max/.test(codigo), "se reserva el alto para que el contenido no salte");
});

// --- El lienzo compartido ---------------------------------------------------

test("el lienzo es ancho completo en móvil y columna centrada en escritorio", () => {
  assert.equal(CONTENT_CANVAS_MAX_WIDTH, 720, "la columna de LECTURA sigue midiendo 720");
  const codigo = sinComentarios(CANVAS);
  assert.ok(/canvasMaxWidth\(variant\)/.test(codigo), "el tope sale del contrato de layout");
  assert.ok(/width: "100%"/.test(codigo), "en móvil ocupa todo el ancho");
  assert.ok(/alignSelf: "center"/.test(codigo), "en escritorio se centra");
});

test("el lienzo tiene tres variantes y ninguna depende del viewport", () => {
  // El bug que se arregla: TODAS las pantallas estaban clavadas en 720, así que
  // el escritorio era una pantalla de teléfono centrada en un monitor.
  assert.equal(CANVAS_MAX_WIDTH.wide, 1200);
  assert.equal(CANVAS_MAX_WIDTH.reading, 720);
  assert.equal(CANVAS_MAX_WIDTH.immersive, null, "inmersivo = sin tope");
  assert.equal(canvasMaxWidth("wide"), 1200);
  assert.equal(canvasMaxWidth("immersive"), null);
});

test("el lienzo no escala tipografía ni tarjetas con el ancho", () => {
  const codigo = sinComentarios(CANVAS);
  // Nada de breakpoints ni multiplicadores: es layout, no escalado.
  assert.ok(!/fontSize/.test(codigo), "el lienzo no toca tipografía");
  assert.ok(!/width < |width > /.test(codigo), "el lienzo no ramifica por ancho");
  // Y las pantallas siguen declarando tamaños fijos en tokens.
  assert.ok(!/fontSize: [a-z]+Size/.test(sinComentarios(CARTA)), "ninguna tipografía derivada de una medida");
});

test("Carta y Perfil montan el MISMO lienzo — ahora desde el shell compartido", () => {
  // El lienzo se consolidó en `OrbitaScreen`: lo monta una vez para TODAS sus
  // pantallas, en vez de que cada una lo repita (y algunas se lo olvidaran).
  // La cobertura real de qué pantalla queda dentro del lienzo está en
  // `test/responsiveShells.test.ts`, que lo resuelve por el grafo de imports.
  const kit = sinComentarios(leer("src/components/orbita/kit.tsx"));
  assert.ok(/from "@\/components\/orbita\/ContentCanvas"/.test(kit), "el shell importa el lienzo compartido");
  assert.ok(
    /<ContentCanvas variant=\{canvas\}>\{children\}<\/ContentCanvas>/.test(kit),
    "el shell lo monta alrededor del contenido, con la variante que pide la pantalla"
  );
  for (const [rel, src] of [
    ["src/screens/CartaScreen.tsx", CARTA],
    ["src/screens/PerfilScreen.tsx", PERFIL]
  ] as const) {
    const codigo = sinComentarios(src);
    assert.ok(/<OrbitaScreen/.test(codigo), `${rel} monta el shell que aplica el lienzo`);
    assert.ok(!/<ContentCanvas>/.test(codigo), `${rel} ya no lo repite por su cuenta`);
  }
});

test("la Carta pasa por un solo shell: ningún estado se queda fuera del lienzo", () => {
  const codigo = sinComentarios(CARTA);
  // Todos los estados (carga, error, invitado, vacío, stale, carta) montan
  // `CartaShell`, que es lo que aplica el lienzo una única vez.
  const shells = codigo.match(/<CartaShell>/g) ?? [];
  assert.ok(shells.length >= 6, `se esperaban todos los estados en el shell, hay ${shells.length}`);
  const directos = codigo.match(/<OrbitaScreen/g) ?? [];
  assert.equal(directos.length, 1, "OrbitaScreen se monta sólo dentro del shell");
});

test("el shell de la app web monta el provider del modo responsive", () => {
  // El lienzo va ADENTRO del contenido; no reemplaza ni duplica el chrome.
  const shell = sinComentarios(leer("src/components/web/web-app-shell.tsx"));
  assert.ok(/RequireSession/.test(shell), "la sesión sigue siendo requisito");
  assert.ok(/<WebNav active=\{active\} \/>/.test(shell));
  assert.ok(!/ContentCanvas/.test(shell), "el lienzo es del contenido, no del chrome");
  // El shell ya no mide la ventana por su cuenta: la mide el provider, que
  // también monta el alta. Un solo lector para los dos árboles.
  assert.ok(!/useWindowDimensions/.test(shell), "el shell ya no mide: lo hace el provider");
  assert.ok(/<WebLayoutProvider>/.test(shell), "monta el provider compartido");
  assert.ok(/const mode = useLayoutMode\(\)/.test(shell), "y consume el modo como todos");

  const provider = sinComentarios(leer("src/components/web/web-layout-provider.tsx"));
  assert.ok(/useWindowDimensions/.test(provider), "el provider mide la ventana");
  assert.ok(/layoutModeFor\(effective\)/.test(provider), "y la traduce con el contrato");
  assert.ok(/IS_WEB \? layoutModeFor\(effective\) : "mobile"/.test(provider), "en nativo el modo es siempre móvil");
  // El ancho sólo se puede forzar desde la vista combinada de revisión; sin
  // override manda el viewport real.
  assert.ok(/const effective = width \?\? win\.width;/.test(provider));
});
