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
  "src/components/orbita/kit.tsx": /<ContentCanvas variant=\{canvas\}>\{children\}<\/ContentCanvas>/,
  "src/components/home/DetailScreen.tsx":
    /<ContentCanvas variant=\{canvas\}>\s*<View style=\{styles\.body\}>\{children\}<\/View>/,
  "src/components/void/VoidExperience.tsx": /<ContentCanvas variant="immersive" fill>/,
  "src/screens/HomeScreen.tsx": /<ContentCanvas variant="wide">/,
  "app/recepcion.tsx": /<ContentCanvas>/,
  "app/carta-full.tsx": /<ContentCanvas variant="immersive">/
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

/**
 * El alta NO usa el lienzo de la app: tiene su propia medida, la de un
 * formulario (480), más angosta que la columna de lectura de 720. Sigue siendo
 * un shell: ninguna de sus quince pantallas dibuja su propio marco, y ninguna
 * compone distinto según el ancho de la ventana.
 */
test("el alta compone en una columna de formulario, autocontenida", () => {
  const shell = sinComentarios(leer("src/onboarding/components/Screen.tsx"));
  // Autocontenido: la medida del alta no toca el contrato de layout compartido
  // ni el lienzo de la app. Esas dos superficies son de la app autenticada.
  assert.doesNotMatch(shell, /ContentCanvas/, "el alta no monta la columna de la app");
  assert.doesNotMatch(shell, /webLayout|canvasMaxWidth|CANVAS_MAX_WIDTH/, "ni le agrega una variante al contrato");
  assert.match(shell, /const FORM_COLUMN = 480;/, "su medida vive en el propio shell");
  assert.ok(480 < CONTENT_CANVAS_MAX_WIDTH, "y es más angosta que la columna de lectura de la app");
  assert.match(
    shell,
    /column: \{ alignSelf: "center", flex: 1, maxWidth: FORM_COLUMN, minHeight: 0, width: "100%" \}/,
    "una sola columna, centrada sobre el fondo full-bleed"
  );

  // La regresión que este test existe para impedir: el escenario ancho de 1200,
  // la segunda columna y el slot que mudaba controles de lugar en escritorio.
  // Con eso, en un viewport bajo el CTA quedaba cortado y el picker de la fecha
  // terminaba lejos de su título.
  for (const nombre of ["STAGE_MAX", "STAGE_COLUMN", "COPY_COLUMN", "ScreenLayout", "useSplitSlot", "aside"]) {
    assert.ok(!shell.includes(nombre), `el shell del alta volvió a la composición ancha: «${nombre}»`);
  }
  // Y no vuelve a mirar el modo de layout: debajo de 480 la columna es ancho
  // completo, así que el breakpoint del alta es implícito y el nativo no cambia.
  assert.doesNotMatch(shell, /useIsDesktop|useLayoutMode/, "el shell del alta no compone por viewport");
});

test("el Umbral envuelve TODAS sus fases, no sólo la de entrada", () => {
  // Entrada, escuchando, límite, error y respuesta: cinco ramas, cinco lienzos.
  // La respuesta es el párrafo más largo de la app y era la que más se estiraba.
  const codigo = sinComentarios(leer("src/components/void/VoidExperience.tsx"));
  const montajes = codigo.match(/<ContentCanvas variant="immersive"(\s+fill)?>/g) ?? [];
  assert.ok(montajes.length >= 6, `se esperaban las cinco fases + la barra, hay ${montajes.length}`);
});

test("el Umbral es inmersivo, y adentro el texto queda a ancho de lectura", () => {
  // El Umbral es una experiencia, no un documento: su lienzo no tiene tope y
  // el chrome (la barra de volver) acompaña a la superficie entera. Pero la
  // respuesta es el párrafo más largo de la app, así que va acotada.
  const codigo = sinComentarios(leer("src/components/void/VoidExperience.tsx"));
  assert.doesNotMatch(codigo, /<ContentCanvas(\s+fill)?>/, "ninguna fase puede quedar en el lienzo de lectura");
  assert.match(codigo, /from "@\/components\/orbita\/Layout"/, "el bloque de lectura sale de las primitivas");
  // Las cuatro fases con contenido anclado heredan el alto; si no, la barra de
  // preguntar sube al medio de la pantalla.
  const conFill = codigo.match(/<ReadingBlock fill center>/g) ?? [];
  assert.equal(conFill.length, 4, `entrada + escuchando + límite + error, hay ${conFill.length}`);
  // Y la respuesta larga, dentro del scroll, también.
  assert.match(
    codigo,
    /<ContentCanvas variant="immersive">\s*<ReadingBlock center>/,
    "la respuesta larga va acotada"
  );
});

test("la columna del Umbral se centra: el fondo es full-bleed, la experiencia no queda en un rincón", () => {
  // El bug: `ReadingBlock` tiene `maxWidth` pero ningún centrado propio, así que
  // dentro de un lienzo `immersive` (sin tope, `width: 100%`) el bloque se
  // apoyaba en el borde izquierdo. En el Umbral eso amontonaba la experiencia
  // entera —header, tabs, prompts, barra de preguntar, escuchando y respuesta—
  // en los primeros 720px de un monitor, con el fondo cósmico corriendo hasta
  // el otro extremo.
  const umbral = sinComentarios(leer("src/components/void/VoidExperience.tsx"));
  const bloques = umbral.match(/<ReadingBlock[^>]*>/g) ?? [];
  assert.equal(bloques.length, 5, `las cinco fases del Umbral, hay ${bloques.length}`);
  for (const b of bloques) {
    assert.match(b, /\bcenter\b/, `una fase del Umbral quedó sin centrar: ${b}`);
  }
  // El fondo sigue siendo full-bleed: el centrado es del bloque, no del lienzo.
  assert.match(umbral, /<ContentCanvas variant="immersive"/, "el lienzo del Umbral no puede volver a tener tope");

  // Y el centrado se implementa con `alignSelf` en el propio bloque: si fuera
  // `alignItems` en el lienzo afectaría a TODOS sus hijos y a todas las
  // pantallas.
  const layout = sinComentarios(leer("src/components/orbita/Layout.tsx"));
  assert.match(layout, /center: \{ alignSelf: "center" \}/, "el centrado es del bloque, no del padre");
  assert.match(layout, /center && styles\.center/, "y es opt-in");
});

test("centrar el bloque de lectura es opt-in: Carta y Tránsitos siguen alineadas a su gutter", () => {
  // Regresión al revés: si `ReadingBlock` se centrara siempre, la lectura natal
  // dejaría de alinearse con la columna de la rueda que tiene encima.
  const layout = sinComentarios(leer("src/components/orbita/Layout.tsx"));
  assert.doesNotMatch(
    layout,
    /reading: \{[^}]*alignSelf/,
    "el bloque no puede centrarse por defecto: rompe la alineación de Carta"
  );
  for (const rel of ["src/screens/CartaScreen.tsx", "src/screens/TransitosScreen.tsx"]) {
    const codigo = sinComentarios(leer(rel));
    const bloques = codigo.match(/<ReadingBlock[^>]*>/g) ?? [];
    assert.ok(bloques.length > 0, `${rel} tiene que seguir acotando su texto largo`);
    for (const b of bloques) {
      assert.doesNotMatch(b, /\bcenter\b/, `${rel} no debe centrar: acompaña a una composición en columnas`);
    }
  }
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

  const shells = new Set<string>([...SHELLS, "src/onboarding/components/Screen.tsx"]);
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
  // Un lienzo dentro de otro no rompe nada, pero es la señal de que alguien
  // volvió a montarlo por pantalla. La consolidación fue justamente sacarlo de
  // las pantallas: hoy la pantalla elige su VARIANTE, no monta su columna.
  const repetidores = [
    "src/screens/CartaScreen.tsx",
    "app/(tabs)/perfil.tsx",
    "src/screens/TransitosScreen.tsx",
    "src/screens/ValoresScreen.tsx",
    "src/screens/DiarioScreen.tsx"
  ];
  for (const rel of repetidores) {
    assert.doesNotMatch(sinComentarios(leer(rel)), /<ContentCanvas/, `${rel} vuelve a montar el lienzo por su cuenta`);
  }
});

// --- 1b. Cada pantalla declara su variante ----------------------------------

/**
 * El bug de esta tanda: TODAS las pantallas estaban clavadas en la columna de
 * 720, así que el escritorio era literalmente una pantalla de teléfono centrada
 * en un monitor. Ahora la variante es una decisión explícita por pantalla.
 */
const VARIANTE: Record<string, RegExp> = {
  "src/screens/HomeScreen.tsx": /<ContentCanvas variant="wide">/,
  "src/screens/CartaScreen.tsx": /<OrbitaScreen right="Carta" canvas="wide">/,
  "src/screens/TransitosScreen.tsx": /<OrbitaScreen canvas="wide">/,
  "src/screens/ValoresScreen.tsx": /<DetailScreen eyebrow="Mapa de valores" canvas="wide">/,
  // Y todos sus estados pasan por ese shell, no sólo el del mapa cargado.
  "src/screens/DiarioScreen.tsx": /<DetailScreen eyebrow="Tu diario" canvas="wide">/,
  // El Perfil es una columna de lectura a propósito: son datos y links.
  "app/(tabs)/perfil.tsx": /<OrbitaScreen canvas="reading">/,
  // La rueda a pantalla completa y el Umbral SON la pieza: sin tope.
  "app/carta-full.tsx": /<ContentCanvas variant="immersive">/,
  "src/components/void/VoidExperience.tsx": /<ContentCanvas variant="immersive"/
};

test("cada pantalla declara explícitamente su variante de lienzo", () => {
  for (const [rel, re] of Object.entries(VARIANTE)) {
    assert.match(sinComentarios(leer(rel)), re, `${rel} no declara su variante de lienzo`);
  }
});

test("ningún estado se queda con un lienzo distinto al de su pantalla", () => {
  // La trampa: declarar la variante sólo en el estado feliz y dejar carga,
  // error, invitado y vacío en el lienzo por defecto. La pantalla cambiaba de
  // ancho al terminar de cargar.
  const SHELL_UNICO: Record<string, { shell: RegExp; crudo: RegExp }> = {
    "src/screens/ValoresScreen.tsx": {
      shell: /function ValoresShell\(\{ children \}: \{ children: ReactNode \}\)/,
      crudo: /<DetailScreen(?! eyebrow="Mapa de valores" canvas="wide">)/
    },
    "src/screens/TransitosScreen.tsx": {
      shell: /function TransitosShell\(\{ children \}/,
      crudo: /<OrbitaScreen(?! canvas="wide">)/
    },
    "src/screens/CartaScreen.tsx": {
      shell: /function CartaShell\(\{ children \}/,
      crudo: /<OrbitaScreen(?! right="Carta" canvas="wide">)/
    }
  };
  for (const [rel, { shell, crudo }] of Object.entries(SHELL_UNICO)) {
    const codigo = sinComentarios(leer(rel));
    assert.match(codigo, shell, `${rel} necesita un shell único para todos sus estados`);
    assert.doesNotMatch(codigo, crudo, `${rel} monta el shell crudo en algún estado, salteando la variante`);
  }
});

test("las pantallas anchas componen en columnas, no estiran el texto", () => {
  // Una pantalla `wide` sin composición sería peor que antes: párrafos de
  // 1200px. Toda pantalla ancha tiene que usar `Columns`/`Column`.
  for (const rel of [
    "src/screens/HomeScreen.tsx",
    "src/screens/CartaScreen.tsx",
    "src/screens/TransitosScreen.tsx",
    "src/screens/ValoresScreen.tsx",
    "src/screens/DiarioScreen.tsx"
  ]) {
    const codigo = sinComentarios(leer(rel));
    assert.match(codigo, /from "@\/components\/orbita\/Layout"/, `${rel} no usa las primitivas de composición`);
    assert.match(codigo, /<Columns/, `${rel} declara lienzo ancho pero no compone`);
    assert.match(codigo, /<Column[ >]/, `${rel} no tiene columnas`);
  }
});

test("los párrafos más largos quedan a ancho de LECTURA aunque el lienzo sea ancho", () => {
  // La lectura natal (siete capítulos) y la lectura del tránsito son los textos
  // más largos de la app: a 1200px no se leen.
  for (const rel of ["src/screens/CartaScreen.tsx", "src/screens/TransitosScreen.tsx"]) {
    assert.match(sinComentarios(leer(rel)), /<ReadingBlock>/, `${rel} deja el texto largo a ancho de lienzo`);
  }
  const layout = sinComentarios(leer("src/components/orbita/Layout.tsx"));
  assert.match(layout, /maxWidth: CANVAS_MAX_WIDTH\.reading/, "el bloque de lectura sale del contrato");
});

test("la composición de escritorio no reordena la pantalla del teléfono", () => {
  // `Columns` en móvil no hace NADA: los hijos quedan apilados en el orden del
  // JSX. Es lo que garantiza que agregar la composición de escritorio no toque
  // el nativo ni la web angosta.
  const layout = sinComentarios(leer("src/components/orbita/Layout.tsx"));
  assert.match(layout, /const desktop = useIsDesktop\(\)/);
  assert.match(layout, /desktop && \{ alignItems: align, flexDirection: "row", gap \}/);
  assert.match(layout, /minWidth: 0/, "sin esto una columna con texto largo desborda la fila");
  // Y la Carta, que sí tiene dos órdenes distintos, mantiene el del teléfono
  // literalmente aparte.
  assert.match(
    sinComentarios(leer("src/screens/CartaScreen.tsx")),
    /if \(!desktop\) \{[\s\S]*?\{encabezado\}\s*\{triada\}\s*\{rueda\}/,
    "la Carta de teléfono tiene que conservar su orden aprobado"
  );
});

// --- 1c. El shell web: negro, navegación legible, sin colchón blanco --------

test("«También hoy» se monta UNA sola vez, y en móvil después de la lectura larga", () => {
  // Regresión de PR 4: la sección se renderizaba dentro de la segunda `Column`
  // de la composición de escritorio Y otra vez al final del scroll. En móvil
  // `Column` es transparente, así que aparecía DOS veces seguidas.
  const codigo = sinComentarios(leer("src/screens/HomeScreen.tsx"));

  // Una sola condición derivada del contexto de layout, usada invertida en los
  // dos puntos de montaje: por construcción no puede duplicarse ni faltar.
  assert.match(
    codigo,
    /const composed = !sessionPending && !userError && !guest && dayReady && heroTriad !== null;/,
    "la condición tiene que reflejar si el bloque compuesto llegó a montarse"
  );
  // Y el reveal: antes de sacar la carta el bloque compuesto SÍ se monta, pero
  // dentro del velo (opacidad 0.12 + `pointerEvents: "none"`). Los destinos
  // secundarios no pueden quedar ahí adentro —invisibles y sin poder tocarse—
  // mientras en móvil se ven y se tocan al final del scroll.
  assert.match(codigo, /const tambienHoyEnColumna = desktop && composed && revealed;/);
  assert.match(codigo, /<Column weight=\{2\}>\{tambienHoyEnColumna \? tambienHoy : null\}<\/Column>/);
  assert.match(codigo, /\{tambienHoyEnColumna \? null : tambienHoy\}/);

  // El velo sigue siendo lo que atenúa y bloquea; es la razón de la guarda.
  assert.match(
    codigo,
    /style=\{revealed \? undefined : styles\.veiled\} pointerEvents=\{revealed \? "auto" : "none"\}/,
    "el velo tiene que seguir atenuando y bloqueando el bloque compuesto"
  );

  // Ningún montaje suelto: un `{tambienHoy}` sin guarda es exactamente el bug.
  assert.doesNotMatch(codigo, /\{tambienHoy\}/, "la sección no puede montarse sin la guarda");

  // Y el orden del teléfono: la lectura larga primero, la sección al final.
  const longRead = codigo.indexOf("<LongReadEnd");
  const cierre = codigo.indexOf("{tambienHoyEnColumna ? null : tambienHoy}");
  assert.ok(longRead > 0 && cierre > longRead, "en móvil «También hoy» va DESPUÉS de la lectura larga");
});

test("el documento y el shell son el mismo negro", () => {
  const css = leer("global.css");
  assert.match(css, /html,\s*body,\s*#root \{\s*background-color: #07080a;/, "el documento tiene que ser oscuro");
  const shell = sinComentarios(leer("src/components/web/web-app-shell.tsx"));
  assert.match(shell, /backgroundColor: WEB_SHELL_BACKGROUND/, "el shell usa el mismo negro del contrato");
});

test("la navegación de escritorio es opaca, ancha y con estado activo visible", () => {
  const nav = sinComentarios(leer("src/components/web/web-nav.tsx"));
  // El bug: la barra no tenía fondo, así que se veía el blanco del documento y
  // los links quedaban en cobre sobre blanco.
  assert.match(nav, /backgroundColor: colors\.shell/, "la barra superior tiene que ser opaca");
  assert.match(nav, /maxWidth: CANVAS_MAX_WIDTH\.wide/, "alineada al mismo lienzo que el contenido");
  assert.match(nav, /navUnderlineOn/, "el estado activo necesita algo más que un peso de fuente");
  assert.doesNotMatch(nav, /boneDim,\s*fontFamily: "Inter_500Medium", fontSize: 14/, "el link inactivo era ilegible");
});

test("el header usa el ícono REAL de la app, no un glifo de librería", () => {
  const nav = sinComentarios(leer("src/components/web/web-nav.tsx"));
  // El mismo arte que se firma en iOS, no un anillo dibujado por lucide. Se
  // monta el derivado web: el master de 1024px pesa 1,72 MB y entraba entero al
  // export para dibujarse a 28px.
  assert.match(
    nav,
    /require\("\.\.\/\.\.\/\.\.\/assets\/orbita\/optimized\/brand\/orbita_app_icon_web\.png"\)/,
    "la marca sale del derivado web del ícono real"
  );
  assert.doesNotMatch(nav, /require\("\.\.\/\.\.\/\.\.\/assets\/icon\.png"\)/, "el master de 1,72 MB no puede volver al runtime web");
  assert.match(nav, /<Image source=\{APP_ICON\}/, "y se dibuja como imagen");
  assert.doesNotMatch(nav, /lucide-react-native/, "no puede volver el ícono genérico");
  assert.doesNotMatch(nav, /<Orbit\b/, "no puede volver el ícono genérico");
  // Tratamiento de ícono de app: cuadrado redondeado con recorte, y tamaño
  // chico contra un PNG de 192 (baja limpio en cualquier densidad).
  assert.match(nav, /markFrame: \{[^}]*borderRadius: \d+[^}]*overflow: "hidden"/s, "marco de ícono redondeado y recortado");
  assert.match(nav, /mark: \{ height: 2\d, width: 2\d \}/, "el ícono es chico: nunca se agranda por encima de su fuente");
  // Y la marca sigue siendo ícono + wordmark, con objetivo táctil accesible.
  assert.match(nav, /<Text style=\{styles\.brandText\}>Órbita<\/Text>/, "el wordmark se conserva");
  assert.match(nav, /brand: \{[^}]*minHeight: 44/, "44px de objetivo táctil");
});

test("el ícono nativo sigue intacto y el header monta su derivado web", () => {
  // El master no se toca: es el que declara `app.json` y el que se firma.
  assert.ok(statSync(join(ROOT, "assets/icon.png")).size > 0, "el ícono nativo sigue existiendo");
  const appJson = JSON.parse(leer("app.json"));
  assert.equal(appJson.expo.icon, "./assets/icon.png", "el build nativo sigue usando el ícono original");

  // Y el header web usa un derivado real del mismo arte, chico de verdad.
  const derivado = statSync(join(ROOT, "assets/orbita/optimized/brand/orbita_app_icon_web.png"));
  assert.ok(derivado.size > 0, "el header apunta a un archivo real");
  assert.ok(
    derivado.size < 500 * 1024,
    `el derivado web tiene que entrar en el límite de imagen del export (mide ${derivado.size} bytes)`
  );
});

test("la navegación de escritorio va arriba a la derecha, sin celda vacía", () => {
  const nav = sinComentarios(leer("src/components/web/web-nav.tsx"));
  // Antes eran tres celdas con `space-between` y la tercera SIEMPRE vacía, así
  // que la navegación quedaba centrada en el medio de la barra.
  assert.match(nav, /<View style=\{styles\.actions\}>\s*<View style=\{styles\.nav\}>/, "la navegación va en el grupo derecho");
  assert.match(nav, /actions: \{ alignItems: "center", flexDirection: "row"/, "el grupo derecho es una fila");
  assert.match(nav, /justifyContent: "space-between"/, "marca a la izquierda, acciones a la derecha");
  assert.doesNotMatch(nav, /styles\.right/, "la celda vacía de la derecha no puede volver");
  assert.doesNotMatch(nav, /right: \{ alignItems: "center", flexDirection: "row", gap: 14 \}/);
  // Y sigue sin atajos de cuenta: todo eso vive en /perfil.
  for (const prohibido of ["avatar", "AuthPill", "iniciar-sesion"]) {
    assert.ok(!new RegExp(prohibido, "i").test(nav), `la barra autenticada no puede tener ${prohibido}`);
  }
});

test("el Perfil no dibuja el hero en escritorio, y sí en móvil y nativo", () => {
  // El hero es una banda de 240px dentro de una columna de 720 sobre un fondo
  // cósmico full-bleed: en escritorio quedaba como una lámina rectangular con
  // los bordes cortados contra ese fondo. Fuera de escritorio se conserva.
  const perfil = sinComentarios(leer("app/(tabs)/perfil.tsx"));
  assert.match(perfil, /const desktop = useIsDesktop\(\);/, "el Perfil consume el contexto de layout");
  assert.match(
    perfil,
    /\{desktop \? null : \(\s*<FullBleedHero kind="perfil" height=\{240\}>/,
    "el hero tiene que quedar fuera SÓLO en escritorio"
  );
  // Y el dato que sólo vivía adentro del hero se conserva en el contenido, sin
  // duplicarse en móvil (donde ya se lee al pie del hero).
  const enHero = perfil.match(/\{birth\.status === "complete" \? <MonoLine>\{birth\.line\}<\/MonoLine> : null\}/g) ?? [];
  assert.equal(enHero.length, 1, "la línea del hero sigue siendo una sola");
  assert.match(
    perfil,
    /\{desktop && birth\.status === "complete" \? \(\s*<View style=\{styles\.birthLine\}>\s*<MonoLine>\{birth\.line\}<\/MonoLine>/,
    "en escritorio la línea de nacimiento se conserva en el contenido"
  );
});

test("cambiar de destino arranca arriba de todo en escritorio web", () => {
  const shell = sinComentarios(leer("src/components/web/web-app-shell.tsx"));
  assert.match(shell, /usePathname/, "el reset se dispara por cambio de ruta");
  assert.match(
    shell,
    /useRouteScrollTop\(\{ pathname, enabled: resetsScrollOnRoute\(\{ web: true, mode \}\), containerRef: contentRef \}\)/,
    "la decisión sale del contrato, no de un chequeo suelto"
  );
  // No alcanza con el documento: scrollean los ScrollView de cada pantalla.
  assert.match(shell, /node\.querySelectorAll\("\*"\)/, "hay que recorrer los scrollers internos");
  assert.match(shell, /el\.scrollTop = 0/, "y llevarlos a cero");
  assert.match(shell, /<View ref=\{contentRef\}/, "el contenedor del contenido se referencia");
});

test("el colchón de la barra inferior no puede volver a ser un View sin fondo", () => {
  const shell = sinComentarios(leer("src/components/web/web-app-shell.tsx"));
  assert.doesNotMatch(shell, /bottomSpacer/, "ese View sin fondo dejaba una banda BLANCA sobre la barra");
  assert.match(shell, /reservesBottomNav\(\{ web: true, mode \}\)/, "la reserva la decide el contrato");
  assert.match(shell, /contentSafeBottom/, "y se aplica como padding del contenido");
});

// --- 1d. El hero real se dibuja con medidas, no con porcentajes -------------

test("el hero usa un contenedor medido y no porcentajes", () => {
  // Regresión de Tránsitos en móvil: `orbita_transitos_visual_a` no pintaba y
  // quedaba un rectángulo negro de 300px que se comía el primer viewport.
  const hero = sinComentarios(leer("src/components/orbita/ImmersiveHero.tsx"));
  assert.match(hero, /<MeasuredBox height=\{h\}/, "el hero tiene que medir su caja");
  assert.match(hero, /style=\{\{ height: h, width \}\}/, "la imagen se dibuja con píxeles, no con %");
  assert.doesNotMatch(hero, /absoluteFillObject/, "el `absoluteFill` + % era exactamente el bug");
  assert.match(hero, /overflow: "hidden"/, "sin recorte la imagen se va a su tamaño intrínseco");
  assert.match(hero, /backgroundColor: orbita\.colors\.surface/, "color de respaldo: nunca un hueco negro");
  assert.match(hero, /orbita_transitos_visual_a/, "el asset real sigue siendo el del Figma");
  // Y el alto móvil deja el título de la pantalla dentro del primer viewport.
  assert.match(hero, /mobile: 2[23]0/, "en móvil el hero no puede volver a medir 300");
});

test("el asset real de Tránsitos existe en el árbol", () => {
  const ruta = join(ROOT, "assets/orbita/optimized/core/orbita_transitos_visual_a.jpg");
  assert.ok(statSync(ruta).size > 0, "el hero de Tránsitos apunta a un archivo real");
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

test("en la app autenticada el viewport lo lee UN solo archivo: el shell web", () => {
  // El modo responsive es una decisión centralizada. Si cada pantalla vuelve a
  // medir la ventana, vuelven los breakpoints divergentes que había antes: eso
  // era exactamente lo que pasaba con las pantallas web borradas.
  //
  // Las superficies PÚBLICAS e INTERNAS (landing, paywall, studio, lab,
  // backoffice) quedan fuera del contrato: no son la app autenticada y tienen
  // su propio layout. Se listan una por una para que sumar otra sea una
  // decisión explícita y no un descuido.
  const FUERA_DEL_CONTRATO = new Set([
    "src/components/backoffice/BackofficeLab.tsx",
    "src/components/web/immersive-bg.tsx",
    "src/components/web/orbita-lab.tsx",
    "src/components/web/orbita-landing.tsx",
    "src/components/web/orbita-paywall.tsx",
    "src/components/web/orbita-studio.tsx"
  ]);
  const lectores = [...archivos("src"), ...archivos("app")]
    .filter((rel) => /useWindowDimensions|window\.innerWidth/.test(sinComentarios(leer(rel))))
    .filter((rel) => !FUERA_DEL_CONTRATO.has(rel));
  assert.deepEqual(
    lectores.sort(),
    ["src/components/web/web-layout-provider.tsx"],
    "sólo el provider compartido mira la ventana: el resto consume `useLayoutMode()`"
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
