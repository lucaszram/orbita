/**
 * Paridad responsive del producto autenticado (PR 3, bloque 2).
 *
 * Lo que se cuida acá no es cómo está escrita una pantalla, sino qué ALCANZA:
 * qué shell la envuelve, si su contenido queda dentro del lienzo, y si desde
 * ella se puede llegar a contenido de maqueta. Todo eso se resuelve recorriendo
 * el grafo de imports (`test/moduleGraph.ts`), que es la misma pregunta que se
 * hace el bundler — no un `grep` sobre el archivo de turno.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { CONTENT_CANVAS_MAX_WIDTH, fitSquare } from "../src/domain/contentCanvas";
import { ROOT, importsOf, pathTo, reachableFrom } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function archivos(dir: string): string[] {
  const out: string[] = [];
  (function walk(d: string) {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name)) out.push(relative(ROOT, p));
    }
  })(join(ROOT, dir));
  return out;
}

const RUTAS = archivos("app");

// --- 1. El lienzo lo montan los shells, una sola vez -------------------------

/**
 * Los cuatro shells de Órbita. Cada pantalla del producto monta uno de estos, y
 * el lienzo vive adentro de ellos: así ninguna pantalla puede "olvidarse" de la
 * columna, que era exactamente lo que pasaba (Carta y Perfil la tenían;
 * Tránsitos, Umbral, Diario, Valores y los quince pasos del alta, no).
 */
const SHELLS = [
  "src/components/orbita/kit.tsx", // OrbitaScreen — Carta, Perfil, Tránsitos, Vínculo
  "src/components/home/DetailScreen.tsx", // detalles de la Home — Valores, Diario, lecturas
  "src/onboarding/components/Screen.tsx", // alta, login, recuperación, editar datos
  "src/components/void/VoidExperience.tsx", // el Umbral
  "src/screens/HomeScreen.tsx", // Inicio: shell propio (fondo full-bleed + ritual)
  "app/recepcion.tsx", // la ceremonia del día 1
  "app/carta-full.tsx" // la rueda a pantalla completa
] as const;

/**
 * Cada shell tiene que ENVOLVER su contenido con el lienzo, no sólo importarlo:
 * `kit.tsx` lo usa además para alinear la barra superior, así que "el archivo
 * menciona ContentCanvas" no prueba nada. Se afirma el envoltorio concreto.
 */
const ENVOLTORIO: Record<(typeof SHELLS)[number], RegExp> = {
  "src/components/orbita/kit.tsx": /<ContentCanvas>\s*\{children\}\s*<\/ContentCanvas>/,
  "src/components/home/DetailScreen.tsx": /<ContentCanvas>\s*<View style=\{styles\.body\}>\{children\}<\/View>/,
  "src/onboarding/components/Screen.tsx": /<ContentCanvas fill>\{children\}<\/ContentCanvas>/,
  "src/components/void/VoidExperience.tsx": /<ContentCanvas fill>/,
  "src/screens/HomeScreen.tsx": /<ContentCanvas>/,
  "app/recepcion.tsx": /<ContentCanvas>/,
  "app/carta-full.tsx": /<ContentCanvas>/
};

test("cada shell envuelve su contenido con el lienzo compartido", () => {
  for (const shell of SHELLS) {
    const codigo = sinComentarios(leer(shell));
    assert.match(
      codigo,
      /from "@\/components\/orbita\/ContentCanvas"/,
      `${shell} tiene que usar el lienzo compartido, no una columna propia`
    );
    assert.match(codigo, ENVOLTORIO[shell], `${shell} importa el lienzo pero no envuelve su contenido`);
  }
});

test("el Umbral envuelve TODAS sus fases, no sólo la de entrada", () => {
  // Entrada, escuchando, límite, error y respuesta: cinco ramas, cinco lienzos.
  // La respuesta es el párrafo más largo de la app y era la que más se estiraba.
  const codigo = sinComentarios(leer("src/components/void/VoidExperience.tsx"));
  const montajes = codigo.match(/<ContentCanvas(\s+fill)?>/g) ?? [];
  assert.ok(montajes.length >= 6, `se esperaban las cinco fases + la barra, hay ${montajes.length}`);
});

test("todas las rutas del producto llegan a un shell que aplica el lienzo", () => {
  // Rutas que NO son producto autenticado: superficies públicas (landing,
  // legal, checkout), herramientas internas y redirecciones puras.
  const FUERA = new Set([
    "app/_layout.tsx",
    "app/index.tsx",
    "app/backoffice.tsx",
    "app/studio.tsx",
    "app/lab.tsx",
    "app/privacy.tsx",
    "app/support.tsx",
    "app/paywall.tsx",
    "app/checkout/success.tsx",
    "app/reading/_layout.tsx"
  ]);

  const shells = new Set<string>(SHELLS);
  const sinLienzo: string[] = [];
  for (const ruta of RUTAS) {
    if (FUERA.has(ruta)) continue;
    // Una redirección pura no renderiza contenido: no necesita lienzo.
    const codigo = sinComentarios(leer(ruta));
    const soloRedirect = /<Redirect/.test(codigo) && !/<[A-Z][A-Za-z]*(Screen|Experience|Shell|Gate|Flow)/.test(codigo);
    if (soloRedirect) continue;

    // La ruta tiene que poder LLEGAR a alguno de los shells verificados arriba;
    // sólo por ahí se renderiza contenido dentro de la columna.
    if (!shells.has(ruta) && !pathTo(ruta, (rel) => shells.has(rel))) sinLienzo.push(ruta);
  }
  assert.deepEqual(sinLienzo, [], "estas rutas renderizan contenido fuera de todo shell con lienzo");
});

test("el lienzo no se anida consigo mismo dentro de un shell", () => {
  // Un lienzo dentro de otro no rompe nada (720 dentro de 720 es 720), pero es
  // la señal de que alguien volvió a montarlo por pantalla. La consolidación
  // fue justamente sacarlo de las pantallas.
  const repetidores = ["src/screens/CartaScreen.tsx", "app/(tabs)/perfil.tsx", "src/screens/TransitosScreen.tsx"];
  for (const rel of repetidores) {
    assert.doesNotMatch(sinComentarios(leer(rel)), /<ContentCanvas/, `${rel} vuelve a montar el lienzo por su cuenta`);
  }
});

// --- 2. La medida sale del contenedor, nunca de la ventana -------------------

const SUPERFICIE_PRODUCTO = [
  ...archivos("src/screens"),
  ...archivos("src/onboarding"),
  ...archivos("src/components/orbita"),
  ...archivos("src/components/home"),
  ...archivos("src/components/diario"),
  ...archivos("src/components/void")
];

test("ninguna pantalla del producto dimensiona su contenido con el viewport", () => {
  const culpables = SUPERFICIE_PRODUCTO.filter((rel) =>
    /useWindowDimensions|Dimensions\.get/.test(sinComentarios(leer(rel)))
  );
  assert.deepEqual(
    culpables,
    [],
    "en web el ancho de la VENTANA no es el ancho del contenedor: el lado sale de `MeasuredSquare`"
  );
});

test("el cuadrado medido no crece con la ventana y respeta las gutters", () => {
  // 320 (móvil chico) con las gutters de la sección: el lado es lo que sobra.
  assert.equal(fitSquare({ container: 320 - 24 * 2, max: 345 }), 272);
  // 1440: el contenedor es la columna (720 menos gutters), no la ventana.
  assert.equal(fitSquare({ container: 720 - 24 * 2, max: 345 }), 345);
  // Y nunca supera el tope, mida lo que mida el contenedor.
  for (const container of [400, 700, 1400, 4000]) {
    assert.ok(fitSquare({ container, max: 360 })! <= 360);
  }
});

test("la columna tiene un tope fijo, no un porcentaje del viewport", () => {
  assert.equal(CONTENT_CANVAS_MAX_WIDTH, 720);
  const canvas = sinComentarios(leer("src/components/orbita/ContentCanvas.tsx"));
  assert.doesNotMatch(canvas, /vw|useWindowDimensions|Dimensions/, "el tope no puede depender del viewport");
});

// --- 3. Nada de maqueta alcanzable como dato personal ------------------------

/**
 * Tipos que describen datos DE LA PERSONA (su carta, sus tránsitos). Un valor
 * literal de estos tipos es, por definición, inventado: no salió del backend.
 * Así se detecta el problema aunque el módulo se llame de otra manera — el mock
 * que había (`content/chartMock.ts`) estaba a tres saltos del Perfil.
 */
const TIPOS_PERSONALES = ["NatalChartPayload", "TransitDetailPayload", "TransitosData", "ValuesMapPayload"];

test("desde ninguna ruta se alcanza una carta o unos tránsitos inventados", () => {
  const alcanzables = reachableFrom(RUTAS);
  const fabricados: string[] = [];
  for (const rel of alcanzables) {
    if (!/^src\//.test(rel) || !/\.tsx?$/.test(rel)) continue;
    const codigo = sinComentarios(leer(rel));
    for (const tipo of TIPOS_PERSONALES) {
      // `const x: NatalChartPayload = {` — un literal, no un parámetro ni un
      // tipo de retorno de algo que mapea la respuesta del backend.
      if (new RegExp(`(const|let|var)\\s+\\w+\\s*:\\s*${tipo}\\s*=\\s*[{[]`).test(codigo)) {
        fabricados.push(`${rel} (${tipo})`);
      }
    }
  }
  assert.deepEqual(fabricados, [], "contenido astrológico literal alcanzable desde la app");
});

test("los módulos de maqueta del app core ya no existen ni se importan", () => {
  for (const rel of ["src/domain/appData.ts", "src/content/chartMock.ts"]) {
    assert.throws(() => leer(rel), `${rel} tiene que estar eliminado`);
  }
  const alcanzables = reachableFrom(RUTAS);
  for (const rel of alcanzables) {
    if (!/\.tsx?$/.test(rel)) continue;
    for (const spec of importsOf(join(ROOT, rel))) {
      assert.doesNotMatch(spec, /domain\/appData|content\/chartMock/, `${rel} importa un mock eliminado`);
    }
  }
});

test("el Perfil ya no arrastra el mock del app core para una frase fija", () => {
  const perfil = "app/(tabs)/perfil.tsx";
  assert.equal(pathTo(perfil, (rel) => /appData|chartMock/.test(rel)), null);
  // Y la frase sigue estando: el arreglo no fue borrar el microcopy.
  assert.match(leer(perfil), /No los compartimos con nadie\./);
});
