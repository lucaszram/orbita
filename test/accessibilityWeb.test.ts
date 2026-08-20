/**
 * Accesibilidad de la app en web (PR 3, bloque 2).
 *
 * En nativo varias cosas venían gratis: `hitSlop` agranda el objetivo táctil, el
 * foco no existe y el sistema apaga las animaciones. En web ninguna de las tres
 * es cierta, y las pantallas son las MISMAS. Acá se fija lo que no puede
 * volver atrás.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { loopIterations, reducedMotionInitialState } from "../src/domain/reducedMotion";
import { ROOT, resolveEntryForPlatform } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

// --- Menos movimiento -------------------------------------------------------

test("en web la preferencia se lee en el primer render, sin un fotograma de más", () => {
  assert.equal(reducedMotionInitialState(() => ({ matches: true })), true);
  assert.equal(reducedMotionInitialState(() => ({ matches: false })), false);
});

test("sin media query (nativo) se arranca animando y se corrige después", () => {
  // Arrancar quieto y saltar a animado se ve como un tirón en cada montaje.
  assert.equal(reducedMotionInitialState(undefined), false);
  assert.equal(reducedMotionInitialState(() => null), false);
});

test("un lector que explota no rompe la pantalla", () => {
  assert.equal(
    reducedMotionInitialState(() => {
      throw new Error("matchMedia no disponible");
    }),
    false
  );
});

test("una animación en bucle se APAGA, no se ralentiza", () => {
  assert.equal(loopIterations(false), -1); // infinito
  assert.equal(loopIterations(true), null); // no arranca
});

test("el pulso del Umbral respeta la preferencia", () => {
  // Es la única animación de Órbita que no termina sola: la que la preferencia
  // existe para apagar.
  const codigo = sinComentarios(leer("src/components/void/VoidExperience.tsx"));
  assert.match(codigo, /useReducedMotion/, "el Umbral no consulta la preferencia");
  assert.match(codigo, /reducedMotion\s*\?\s*null/, "el bucle tiene que no arrancar con la preferencia activa");
  assert.match(codigo, /\[phase, pulse, ask, question, reducedMotion\]/, "cambiar la preferencia tiene que re-evaluar");
});

test("el CSS web apaga lo que anima el navegador", () => {
  const css = leer("global.css");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation-iteration-count: 1 !important/);
});

// --- Foco visible con teclado ----------------------------------------------

test("hay foco visible en web y sólo con teclado", () => {
  const css = leer("global.css");
  // react-native-web pone `outline: none` en todo lo enfocable: sin esta regla
  // se recorría la app entera con el tabulador sin ver dónde estabas.
  assert.match(css, /:focus-visible\s*\{[^}]*outline:/, "falta el anillo de foco");
  assert.doesNotMatch(css, /\n:focus\s*\{/, "`:focus` a secas también marcaría el click y el toque");
});

// --- Objetivos táctiles de 44px --------------------------------------------

/**
 * Controles que en nativo se agrandaban con `hitSlop` — que en web NO existe.
 * Cada uno tiene que declarar su tamaño real.
 */
const CONTROLES: Array<[string, string]> = [
  ["src/components/home/DetailScreen.tsx", "backBtn"], // volver, en todas las pantallas de detalle
  ["src/components/void/VoidExperience.tsx", "backBtn"], // volver, en el Umbral
  [relative(ROOT, resolveEntryForPlatform("app/carta-full.tsx", "web")), "closeBtn"], // cerrar la rueda web
  ["app/editar-datos.tsx", "backBtn"] // cancelar la edición de datos
];

test("los controles que dependían de hitSlop declaran 44px reales", () => {
  for (const [rel, estilo] of CONTROLES) {
    const codigo = sinComentarios(leer(rel));
    const decl = new RegExp(`${estilo}:\\s*\\{[^}]*\\}`).exec(codigo);
    assert.ok(decl, `${rel} no declara el estilo ${estilo}`);
    assert.match(decl[0], /minHeight: 44/, `${rel} · ${estilo}: alto táctil insuficiente`);
    assert.match(decl[0], /minWidth: 44/, `${rel} · ${estilo}: ancho táctil insuficiente`);
  }
});

test("la navegación web mantiene sus 44px de PR 1", () => {
  const nav = sinComentarios(leer("src/components/web/web-nav.tsx"));
  assert.match(nav, /navItem: \{[^}]*minHeight: 44/);
  assert.match(nav, /bottomItem: \{[^}]*minHeight: 56/);
});

// --- Campos con etiqueta ----------------------------------------------------

function camposSinEtiqueta(rel: string): number {
  const codigo = sinComentarios(leer(rel));
  let faltan = 0;
  for (const m of codigo.matchAll(/<TextInput\b([\s\S]*?)\/>/g)) {
    const props = m[1];
    // Un `placeholder` no es una etiqueta: desaparece al tipear y un lector de
    // pantalla no tiene después qué anunciar.
    if (!/accessibilityLabel|aria-label|accessibilityLabelledBy/.test(props)) faltan += 1;
  }
  return faltan;
}

test("todo campo de texto del producto tiene etiqueta accesible", () => {
  const dirs = ["src/onboarding", "src/components/void", "src/screens", "app"];
  const archivos: string[] = [];
  for (const d of dirs) {
    (function walk(dir: string) {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx$/.test(name)) archivos.push(relative(ROOT, p));
      }
    })(join(ROOT, d));
  }
  const culpables = archivos.filter((rel) => camposSinEtiqueta(rel) > 0);
  assert.deepEqual(culpables, [], "campos de texto sin etiqueta accesible");
});

// --- Los errores se anuncian ------------------------------------------------

/**
 * Pantallas donde un fallo aparece SIN mover el foco (el error se pinta arriba
 * del CTA que se acaba de tocar). Sin `alert` + región viva, un lector de
 * pantalla no lo menciona: la persona vuelve a tocar el botón sin saber qué pasó.
 */
const CON_ERROR: Array<[string, string]> = [
  // El alta ya no tiene formulario propio: el único fallo que le queda a la
  // pantalla es el del borrador remoto que se guarda ANTES de abrir Clerk, y es
  // el más importante de anunciar — sin él la cuenta se crearía sin datos.
  ["src/onboarding/screens/AccountScreen.tsx", "styles.error"],
  ["src/onboarding/screens/SignInScreen.tsx", "flow.error"],
  ["src/onboarding/components/CodeHelp.tsx", "feedback"],
  ["app/editar-datos.tsx", "saveError"]
];

test("el error de cada formulario se anuncia solo", () => {
  for (const [rel, variable] of CON_ERROR) {
    const codigo = sinComentarios(leer(rel));
    // El rol puede ser literal o condicional (`? "alert" : undefined` cuando el
    // mismo texto también sirve de confirmación).
    assert.match(codigo, /accessibilityRole=\{?[^}\n]*"alert"/, `${rel} no marca su error como alerta`);
    assert.match(codigo, /accessibilityLiveRegion="polite"/, `${rel} no lo pone en una región viva`);
    assert.match(codigo, new RegExp(variable.replace(".", "\\.")), `${rel} ya no muestra ${variable}`);
  }
});

test("los errores del alta con Clerk los anuncia Clerk, no una copia nuestra", () => {
  // `/crear-cuenta` tenía su propio `shownError` porque tenía su propio
  // formulario. Ahora monta la UI oficial, que trae sus mensajes accesibles: un
  // segundo cartel nuestro anunciaría el mismo fallo dos veces, o —peor— uno
  // desactualizado respecto del estado real de Clerk.
  const alta = sinComentarios(leer("src/onboarding/screens/SignUpGateScreen.tsx"));
  assert.match(alta, /<ClerkSignUp email=\{email\} \/>/, "el alta suelta monta la UI oficial");
  assert.doesNotMatch(alta, /shownError|<TextInput/, "no puede volver a tener formulario ni error propios");
});

// --- El contenido no queda debajo de la barra inferior ----------------------

test("el shell web reserva el alto de la barra fija como PADDING del contenido", () => {
  // La barra inferior es `position: fixed`: sin reservar espacio tapaba el
  // final del contenido en móvil. Antes la reserva era un `View` suelto al
  // final SIN fondo, así que dejaba una banda blanca del documento justo
  // encima de la barra. Ahora es padding del contenido, que hereda el negro.
  const shell = sinComentarios(leer("src/components/web/web-app-shell.tsx"));
  assert.match(shell, /WEB_BOTTOM_NAV_HEIGHT/);
  assert.match(shell, /paddingBottom: `calc\(\$\{WEB_BOTTOM_NAV_HEIGHT\}px \+ env\(safe-area-inset-bottom\)\)`/);
  assert.doesNotMatch(shell, /bottomSpacer/, "el colchón suelto sin fondo no puede volver");
  const nav = sinComentarios(leer("src/components/web/web-nav.tsx"));
  assert.match(nav, /paddingBottom: "env\(safe-area-inset-bottom\)"/, "falta el área segura del iPhone");
});
