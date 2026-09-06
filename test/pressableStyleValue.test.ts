/**
 * `style` siempre como VALOR en el árbol ejecutable de `app/**` y `src/**`.
 *
 * Por qué es un gate y no una convención: el proyecto compila el JSX con
 * `jsxImportSource: "nativewind"` (`babel.config.js`), así que en nativo cada
 * elemento pasa por `collectInlineRules` de `react-native-css-interop`. Esa
 * función sólo entiende arreglos y objetos; la FORMA FUNCIÓN de `Pressable`
 * —`style={({ pressed }) => [...]}`— cae en la rama de "objeto", se empuja cruda
 * al arreglo final y React Native la aplana a nada. El componente se dibuja
 * **sin ninguno de sus estilos**, sin warning y sin error de tipos: TypeScript
 * acepta la forma función porque es válida para `Pressable`.
 *
 * Fue la causa real del defecto D1 (la barra de pestañas amontonada a la
 * izquierda: perdía `flex: 1`) y de tarjetas, píldoras y botones que aparecían
 * como texto suelto. En web no pasa —la interoperación sólo toca `className`—,
 * así que un ojo puesto en el navegador no lo ve nunca.
 *
 * La forma correcta está en `src/components/v492/Touchable.tsx`:
 * `usePressedState()` saca el estado de "presionado" del render de `Pressable` y
 * deja `style` como arreglo.
 *
 * ## Por qué el detector mira el archivo entero
 *
 * La versión anterior escaneaba LÍNEA POR LÍNEA, así que sólo veía la forma
 * función cuando `style={` y `=>` caían en el mismo renglón. Esto pasaba limpio:
 *
 *     <Pressable
 *       style={({ pressed }) =>
 *         [styles.a, pressed && styles.b]
 *       }
 *     />
 *
 * …que es exactamente lo que escribe un formateador cuando la línea es larga —o
 * sea, el caso más probable en un componente real—. Ahora el archivo se analiza
 * ENTERO: se le quitan comentarios y strings —para que ni la documentación ni un
 * texto de UI puedan disparar un falso positivo ni esconder código— y se busca
 * la apertura de la prop; el `=>` puede estar varias líneas más abajo. La línea
 * se reporta contando saltos hasta el offset del hallazgo.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { test } from "node:test";

import { ROOT } from "./moduleGraph";

const SCAN_ROOTS = ["app", "src"];
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx"]);

/**
 * Deja el archivo con SÓLO código ejecutable, conservando las posiciones.
 *
 * Comentarios, strings y plantillas se reemplazan por espacios del mismo largo
 * (los saltos de línea se conservan) en vez de borrarse: así el número de línea
 * que se reporta sigue siendo el del archivo original y una prop dentro de un
 * string —`"style={(x) => y}"` en un texto de ayuda— no puede disparar el gate.
 *
 * Es un barrido de un solo paso sobre los caracteres, no una pila de expresiones
 * regulares: `/* … *\/` dentro de un string y comillas dentro de un comentario
 * se resuelven solos cuando el estado lo decide el carácter anterior.
 */
export function soloCodigo(source: string): string {
  const out: string[] = [];
  let i = 0;
  let estado: "codigo" | "linea" | "bloque" | "comilla" | "plantilla" = "codigo";
  let cierre = "";
  const blanquear = (ch: string) => out.push(ch === "\n" ? "\n" : " ");

  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];
    if (estado === "codigo") {
      if (ch === "/" && next === "/") {
        estado = "linea";
        blanquear(ch);
        blanquear(next!);
        i += 2;
        continue;
      }
      if (ch === "/" && next === "*") {
        estado = "bloque";
        blanquear(ch);
        blanquear(next!);
        i += 2;
        continue;
      }
      if (ch === '"' || ch === "'") {
        estado = "comilla";
        cierre = ch;
        blanquear(ch);
        i += 1;
        continue;
      }
      if (ch === "`") {
        estado = "plantilla";
        blanquear(ch);
        i += 1;
        continue;
      }
      out.push(ch);
      i += 1;
      continue;
    }
    if (estado === "linea") {
      if (ch === "\n") estado = "codigo";
      blanquear(ch);
      i += 1;
      continue;
    }
    if (estado === "bloque") {
      if (ch === "*" && next === "/") {
        estado = "codigo";
        blanquear(ch);
        blanquear(next!);
        i += 2;
        continue;
      }
      blanquear(ch);
      i += 1;
      continue;
    }
    if (estado === "comilla") {
      if (ch === "\\") {
        blanquear(ch);
        if (next !== undefined) blanquear(next);
        i += 2;
        continue;
      }
      if (ch === cierre || ch === "\n") estado = "codigo";
      blanquear(ch);
      i += 1;
      continue;
    }
    // plantilla
    if (ch === "\\") {
      blanquear(ch);
      if (next !== undefined) blanquear(next);
      i += 2;
      continue;
    }
    if (ch === "`") estado = "codigo";
    blanquear(ch);
    i += 1;
  }
  return out.join("");
}

/**
 * Cualquier prop `…style` / `…Style` cuyo valor abra una función, con el `=>` o
 * el `function` a CUALQUIER distancia: arrow con paréntesis
 * (`({ pressed }) =>`), arrow con un identificador suelto (`state =>`) o
 * `function`. Entre la llave y la flecha sólo se admite espacio en blanco y el
 * parámetro, así que `style={cond ? a : b}` y `style={[…]}` no casan.
 */
const FORMA_FUNCION =
  /\b[A-Za-z]*[Ss]tyle=\{\s*(?:\([^()]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>|function\b|async\s+(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*=>)/g;

/** Un hallazgo con su línea real dentro del archivo original. */
export type Hallazgo = { line: number; text: string };

/** Todos los `style` en forma función de un archivo, con su número de línea. */
export function estilosEnFormaFuncion(source: string): Hallazgo[] {
  const codigo = soloCodigo(source);
  const hallazgos: Hallazgo[] = [];
  const rx = new RegExp(FORMA_FUNCION.source, "g");
  let match: RegExpExecArray | null;
  while ((match = rx.exec(codigo)) !== null) {
    const line = codigo.slice(0, match.index).split("\n").length;
    // El texto se toma del ORIGINAL: el reporte tiene que mostrar lo que la
    // persona escribió, no la versión blanqueada.
    const original = source.split("\n")[line - 1] ?? "";
    hallazgos.push({ line, text: original.trim() });
  }
  return hallazgos;
}

function archivosDeCodigo(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) archivosDeCodigo(full, out);
    else if (CODE_EXT.has(extname(entry))) out.push(full);
  }
  return out;
}

const ARCHIVOS = SCAN_ROOTS.flatMap((r) => archivosDeCodigo(join(ROOT, r)));

test("el detector reconoce la forma función, incluso partida en varias líneas", () => {
  // Sin esta prueba el gate podría quedar mudo por un cambio de regex y seguir
  // en verde: un gate que no puede fallar no es un gate.
  const prohibidas: readonly [string, number][] = [
    ["<Pressable style={({ pressed }) => [styles.a, pressed && styles.b]} />", 1],
    ["<Pressable style={(state) => [styles.a]} />", 1],
    ["<Pressable style={state => styles.a} />", 1],
    ["<Pressable style={function (s) { return styles.a; }} />", 1],
    ["<ScrollView contentContainerStyle={({ pressed }) => [styles.a]} />", 1],
    // El caso que el gate anterior NO veía: la flecha en el renglón siguiente.
    ["<Pressable\n  style={({ pressed }) =>\n    [styles.a, pressed && styles.b]\n  }\n/>", 2],
    // Y con el parámetro también partido.
    ["<Pressable\n  style={(\n    { pressed }\n  ) => [styles.a]}\n/>", 2],
    // La línea que se reporta es la de la PROP, que es la que hay que cambiar,
    // no la del `=>` que la delata.
    ["<Pressable\n  contentContainerStyle={\n    state => styles.a\n  }\n/>", 2]
  ];
  for (const [fuente, linea] of prohibidas) {
    const hallazgos = estilosEnFormaFuncion(fuente);
    assert.equal(hallazgos.length, 1, `debería detectarse: ${JSON.stringify(fuente)}`);
    assert.equal(hallazgos[0]!.line, linea, `línea mal reportada en: ${JSON.stringify(fuente)}`);
  }
});

test("el detector no confunde las formas válidas ni la documentación", () => {
  const validas = [
    "<Pressable style={[styles.a, pressed ? styles.b : null]} />",
    "<Pressable style={styles.a} />",
    "<Pressable style={open ? styles.a : styles.b} />",
    "<View style={{ height: 12 }} />",
    "<Pressable onPress={() => go()} style={styles.a} />",
    "<Pressable\n  style={[\n    styles.a,\n    pressed && styles.b\n  ]}\n/>",
    // Un `style` que recibe el RESULTADO de una función sigue siendo un valor.
    "<View style={estiloDe(item)} />",
    "<View style={useMemo(() => styles.a, [])} />",
    // Documentación y texto de UI pueden nombrar la forma prohibida.
    "// nunca escribas style={({ pressed }) => [styles.a]}",
    "/* style={({ pressed }) => [styles.a]} rompe NativeWind */",
    "/**\n * style={({ pressed }) =>\n *   [styles.a]\n * }\n */\nconst x = 1;",
    'const aviso = "no uses style={({ pressed }) => [styles.a]}";',
    "const aviso = `no uses style={({ pressed }) => [styles.a]}`;"
  ];
  for (const fuente of validas) {
    assert.deepEqual(estilosEnFormaFuncion(fuente), [], `falso positivo: ${JSON.stringify(fuente)}`);
  }
});

test("blanquear comentarios y strings no puede esconder código ejecutable", () => {
  // El riesgo simétrico del punto anterior: si el barrido se comiera código de
  // más, el gate quedaría ciego sin que nadie lo note. Estos tres casos tienen
  // la forma prohibida FUERA de todo comentario o string, con comillas y
  // barras alrededor para confundir al barrido.
  const trampas = [
    'const t = "/*"; <Pressable style={({ pressed }) => [styles.a]} />',
    "const t = '\\''; <Pressable style={state => styles.a} />",
    "const url = `https://x/y`; // ojo\n<Pressable style={({ pressed }) =>\n  [styles.a]} />"
  ];
  for (const fuente of trampas) {
    assert.equal(
      estilosEnFormaFuncion(fuente).length,
      1,
      `el barrido escondió código ejecutable: ${JSON.stringify(fuente)}`
    );
  }
  // Y el largo se conserva carácter a carácter: es lo que hace que la línea
  // reportada sea la real.
  const fuente = 'const a = 1; // x\nconst b = "yz";\n<Pressable style={s => s} />';
  assert.equal(soloCodigo(fuente).length, fuente.length);
  assert.equal(estilosEnFormaFuncion(fuente)[0]!.line, 3);
});

test("el escaneo alcanza el árbol ejecutable entero", () => {
  // Un walker roto devolvería cero archivos y el gate pasaría vacío.
  assert.ok(ARCHIVOS.length > 200, `sólo se escanearon ${ARCHIVOS.length} archivos`);
  const rels = ARCHIVOS.map((f) => relative(ROOT, f));
  for (const esperado of [
    "src/components/orbita/TabBar.tsx",
    "src/components/orbita/TabBar.web.tsx",
    "src/components/void/VoidExperience.tsx",
    "src/screens/CartaScreen.tsx",
    "app/_layout.tsx"
  ]) {
    assert.ok(rels.includes(esperado), `el escaneo no alcanzó ${esperado}`);
  }
});

test("ningún archivo de app/ o src/ pasa `style` en forma función", () => {
  const ofensores: string[] = [];
  for (const file of ARCHIVOS) {
    for (const hallazgo of estilosEnFormaFuncion(readFileSync(file, "utf8"))) {
      ofensores.push(`${relative(ROOT, file)}:${hallazgo.line}  ${hallazgo.text}`);
    }
  }
  assert.deepEqual(
    ofensores,
    [],
    [
      "NativeWind descarta `style` en forma función y el componente se dibuja sin estilos.",
      "Usá `usePressedState()` de src/components/v492/Touchable.tsx y pasá `style` como arreglo.",
      ...ofensores
    ].join("\n")
  );
});

test("`usePressedState` entrega los handlers y `Touchable` pasa el estilo como arreglo", () => {
  const codigo = soloCodigo(readFileSync(join(ROOT, "src/components/v492/Touchable.tsx"), "utf8"));
  assert.match(codigo, /export function usePressedState\(\)/);
  // Los dos handlers son la única forma de saber que el dedo está apoyado sin
  // la forma función: si alguno desaparece, el estado "presionado" queda muerto.
  assert.match(codigo, /onPressIn/);
  assert.match(codigo, /onPressOut/);
  assert.match(codigo, /pressableProps:\s*\{\s*onPressIn,\s*onPressOut\s*\}/);
  assert.match(codigo, /style=\{\[style, pressed && !disabled \? pressedStyle : null\]\}/);
});

test("las superficies que perdían sus estilos usan el hook", () => {
  // Los archivos que la recertificación 2026-08-17 listó como pendientes. No
  // alcanza con que no tengan la forma función: tienen que tener el reemplazo,
  // o alguien podría "arreglarlos" borrando el estado de presionado.
  const migradas = [
    "src/screens/CartaScreen.tsx",
    "src/components/Tag.tsx",
    "src/components/ShareCardPreview.tsx",
    "src/components/orbita/GlyphRow.tsx",
    "src/components/AppButton.tsx",
    "src/components/orbita/kit.tsx",
    "src/components/home/CartaCard.tsx",
    "src/components/home/sections.tsx",
    "src/components/home/CartaBanner.tsx",
    "src/components/void/VoidExperience.tsx",
    "src/components/orbita/TabBar.web.tsx"
  ];
  for (const rel of migradas) {
    const codigo = soloCodigo(readFileSync(join(ROOT, rel), "utf8"));
    assert.match(codigo, /usePressedState/, `${rel} debería usar usePressedState`);
    assert.match(
      codigo,
      /pressableProps/,
      `${rel} debería propagar pressableProps al Pressable`
    );
  }
});
