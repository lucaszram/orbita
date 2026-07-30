import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CONTENT_CANVAS_MAX_WIDTH, fitSquare } from "../src/domain/contentCanvas";

const ROOT = join(import.meta.dirname, "..");
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const CANVAS = leer("src/components/orbita/ContentCanvas.tsx");
const CARTA = leer("src/screens/CartaScreen.tsx");
const CARTA_CARD = leer("src/components/home/CartaCard.tsx");
const PERFIL = leer("app/(tabs)/perfil.tsx");
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

test("una columna de 720 no hace crecer la rueda más allá de su tope", () => {
  // El caso del escritorio: el lienzo mide 720 y la rueda sigue midiendo 360.
  assert.equal(fitSquare({ container: CONTENT_CANVAS_MAX_WIDTH, max: 360 }), 360);
});

// --- Cableado ---------------------------------------------------------------

test("ninguna pantalla de la carta lee el ancho de la ventana", () => {
  for (const [rel, src] of [
    ["src/screens/CartaScreen.tsx", CARTA],
    ["src/components/home/CartaCard.tsx", CARTA_CARD],
    ["src/components/orbita/NatalWheel.tsx", WHEEL],
    ["src/components/orbita/ContentCanvas.tsx", CANVAS],
    // Las otras tres superficies que montan la MISMA rueda.
    ["app/recepcion.tsx", leer("app/recepcion.tsx")],
    ["app/carta-full.tsx", leer("app/carta-full.tsx")],
    ["app/reading/rueda.tsx", leer("app/reading/rueda.tsx")]
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
  assert.ok(/<MeasuredSquare max=\{340\}>/.test(codigo), "el radar también");
  assert.ok(/size=\{size\}/.test(codigo), "el lado viene del callback de medición");
  assert.ok(/<MeasuredSquare max=\{232\}>/.test(sinComentarios(CARTA_CARD)), "la mini-rueda también");
});

test("toda superficie que monta la rueda la mide por contenedor", () => {
  for (const rel of ["app/recepcion.tsx", "app/carta-full.tsx", "app/reading/rueda.tsx"]) {
    const codigo = sinComentarios(leer(rel));
    assert.ok(/<MeasuredSquare max=\{\d+\}/.test(codigo), `${rel} tiene que medir su contenedor`);
    assert.ok(/size=\{size\}/.test(codigo), `${rel}: el lado viene de la medición`);
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

test("el lienzo es ancho completo en móvil y columna centrada de 720 en escritorio", () => {
  assert.equal(CONTENT_CANVAS_MAX_WIDTH, 720);
  const codigo = sinComentarios(CANVAS);
  assert.ok(/maxWidth: CONTENT_CANVAS_MAX_WIDTH/.test(codigo), "el tope sale del dominio");
  assert.ok(/width: "100%"/.test(codigo), "en móvil ocupa todo el ancho");
  assert.ok(/alignItems: "center"/.test(codigo), "en escritorio se centra");
});

test("el lienzo no escala tipografía ni tarjetas con el ancho", () => {
  const codigo = sinComentarios(CANVAS);
  // Nada de breakpoints ni multiplicadores: es layout, no escalado.
  assert.ok(!/fontSize/.test(codigo), "el lienzo no toca tipografía");
  assert.ok(!/width < |width > /.test(codigo), "el lienzo no ramifica por ancho");
  // Y las pantallas siguen declarando tamaños fijos en tokens.
  assert.ok(!/fontSize: [a-z]+Size/.test(sinComentarios(CARTA)), "ninguna tipografía derivada de una medida");
});

test("Carta y Perfil montan el MISMO lienzo", () => {
  for (const [rel, src] of [
    ["src/screens/CartaScreen.tsx", CARTA],
    ["app/(tabs)/perfil.tsx", PERFIL]
  ] as const) {
    const codigo = sinComentarios(src);
    assert.ok(/from "@\/components\/orbita\/ContentCanvas"/.test(codigo), `${rel} importa el lienzo compartido`);
    assert.ok(/<ContentCanvas>/.test(codigo), `${rel} lo monta`);
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

test("el shell de la app web sigue siendo el de PR 1", () => {
  // El lienzo va ADENTRO del contenido; no reemplaza ni duplica el chrome.
  const shell = sinComentarios(leer("src/components/web/web-app-shell.tsx"));
  assert.ok(/RequireSession/.test(shell), "la sesión sigue siendo requisito");
  assert.ok(/<WebNav active=\{active\} \/>/.test(shell));
  assert.ok(!/ContentCanvas/.test(shell), "el lienzo es del contenido, no del chrome");
});
