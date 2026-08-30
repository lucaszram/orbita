import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { ROOT } from "./moduleGraph";

/**
 * Las marcas de Apple y de Google del acceso: procedencia, geometría y colores.
 *
 * Todo lo que se afirma acá se verifica contra los ARCHIVOS OFICIALES que viven
 * en `assets/orbita/auth/vendor/`, no contra un número copiado a mano. Si
 * alguien recolorea la manzana, recorta un `viewBox`, mueve el slot o vuelve a
 * meter una tipografía de íconos, esto cae.
 */

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const sha256 = (rel: string) =>
  createHash("sha256").update(readFileSync(join(ROOT, rel))).digest("hex");

const VENDOR = "assets/orbita/auth/vendor";
const APPLE_BLACK = `${VENDOR}/apple/Logo - SIWA - Left-aligned - Black - Large.svg`;
const APPLE_WHITE = `${VENDOR}/apple/Logo - SIWA - Left-aligned - White - Large.svg`;
const GOOGLE = `${VENDOR}/google/g_dk_sq_sl.svg`;

const componente = leer("src/components/brand/ProviderMarks.tsx");
const readme = leer(`${VENDOR}/README.md`);
const appleBlackSvg = leer(APPLE_BLACK);
const appleWhiteSvg = leer(APPLE_WHITE);
const googleSvg = leer(GOOGLE);
/** Los `fill` de la G, en el orden del archivo: son cuatro y son distintos. */
const GOOGLE_FILLS = [...googleSvg.matchAll(/<path\s+[^>]*fill="([^"]+)"/g)].map(([, fill]) => fill);

const seccion = (inicio: string, fin: string) => {
  const desde = componente.indexOf(inicio);
  const hasta = componente.indexOf(fin, desde);
  assert.ok(desde >= 0 && hasta > desde, `no se encontró ${inicio}`);
  return componente.slice(desde, hasta);
};

const atributo = (source: string, nombre: string) => {
  const match = source.match(new RegExp(`${nombre}="([^"]+)"`));
  assert.ok(match, `falta ${nombre} en el SVG oficial`);
  return match[1];
};

/** El `<path>` del glifo de un SVG de Apple: `d`, `fill` y `fill-rule`. */
const pathApple = (svg: string) => {
  const match = svg.match(/<path\s+d="([^"]+)"\s+id="[^"]*"\s+fill="([^"]+)"\s+fill-rule="([^"]+)"/);
  assert.ok(match, "falta el <path> del glifo en el SVG oficial de Apple");
  return { d: match[1], fill: match[2], fillRule: match[3] };
};

/**
 * Extremos en x de un `d` con comandos ABSOLUTOS (`M`/`L`/`C`/`H`/`V`/`Z`), que
 * es lo que usan los dos archivos. Se toma el casco de puntos —anclas más puntos
 * de control—, la misma cota para las dos marcas, así que la comparación entre
 * ellas es de igual a igual.
 */
const extremosX = (d: string) => {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const xs: number[] = [];
  let cmd = "";
  let i = 0;
  let x = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) {
      cmd = tokens[i++];
      continue;
    }
    if (cmd === "M" || cmd === "L") {
      x = num();
      num();
    } else if (cmd === "C") {
      const [x1, , x2, , x3] = [num(), num(), num(), num(), num(), num()];
      xs.push(x1, x2);
      x = x3;
    } else if (cmd === "H") {
      x = num();
    } else if (cmd === "V") {
      num();
    } else {
      return assert.fail(`comando de path no soportado: ${cmd}`);
    }
    xs.push(x);
  }
  assert.ok(xs.length > 0, "el path no trae coordenadas");
  return { min: Math.min(...xs), max: Math.max(...xs), ancho: Math.max(...xs) - Math.min(...xs) };
};

/** Cuerpo del objeto literal que abre después de `token`, con llaves balanceadas. */
const objeto = (source: string, token: string) => {
  const inicio = source.indexOf(token);
  assert.ok(inicio >= 0, `no se encontró ${token}`);
  const desde = source.indexOf("{", inicio);
  let nivel = 0;
  for (let i = desde; i < source.length; i += 1) {
    if (source[i] === "{") nivel += 1;
    else if (source[i] === "}" && (nivel -= 1) === 0) return source.slice(desde + 1, i);
  }
  return assert.fail(`${token} no cierra`);
};

/** Pares `clave: valor` de un objeto de estilo plano. */
const props = (cuerpo: string): Record<string, string> =>
  Object.fromEntries(
    [...cuerpo.matchAll(/([A-Za-z]+):\s*([^,\n}]+)/g)].map(([, k, v]) => [k, v.trim()])
  );

/** Un desplazamiento óptico es cualquiera de estas claves: acá no va ninguna. */
const OFFSET_OPTICO = [
  "transform",
  "translateX",
  "translateY",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginStart",
  "marginEnd",
  "marginVertical",
  "marginHorizontal",
  "top",
  "bottom",
  "left",
  "right"
];

const sinOffsetOptico = (nombre: string, estilo: Record<string, string>) => {
  for (const clave of Object.keys(estilo)) {
    assert.ok(!OFFSET_OPTICO.includes(clave), `${nombre} no puede llevar ${clave}: sin offset óptico`);
  }
};

// ---------------------------------------------------------------------------
// Procedencia
// ---------------------------------------------------------------------------

test("el directorio vendor tiene EXACTAMENTE los tres archivos oficiales", () => {
  const recorrer = (dir: string): string[] =>
    readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entrada) =>
      entrada.isDirectory() ? recorrer(join(dir, entrada.name)) : [join(dir, entrada.name)]
    );
  const archivos = recorrer(VENDOR)
    .filter((rel) => rel.endsWith(".svg"))
    .sort();
  // Ni una variante re-exportada, ni un "optimizado", ni un PNG de respaldo.
  assert.deepEqual(archivos, [APPLE_BLACK, APPLE_WHITE, GOOGLE].sort());
  assert.ok(readme.length > 0, "el vendor necesita su README de procedencia");

  // El DMG trae Small, Medium y Large; acá vive UNA sola medida, la Large. Los
  // dos Medium que portó la primera pasada se eliminaron: convivir con ellos
  // dejaría dos fuentes de verdad para el mismo glifo.
  for (const medida of ["Medium", "Small"]) {
    assert.deepEqual(
      archivos.filter((rel) => rel.includes(medida)),
      [],
      `el vendor no puede conservar la variante ${medida}`
    );
  }
  assert.equal(archivos.filter((rel) => rel.includes("Large")).length, 2, "sólo el par Large de Apple");
});

test("el README registra ruta y SHA-256 reales de cada archivo oficial", () => {
  const bloque = (titulo: string) => {
    const desde = readme.indexOf(titulo);
    assert.ok(desde >= 0, `el README no documenta ${titulo}`);
    const resto = readme.slice(desde + titulo.length);
    const fin = resto.search(/\n#{2,3} /);
    return fin >= 0 ? resto.slice(0, fin) : resto;
  };

  const apple = [
    {
      titulo: "### `apple/Logo - SIWA - Left-aligned - Black - Large.svg`",
      rel: APPLE_BLACK,
      dmg: "Sign in with Apple - Left Aligned/SVG/Logo - SIWA - Left-aligned - Black - Large.svg",
      fill: "#000000"
    },
    {
      titulo: "### `apple/Logo - SIWA - Left-aligned - White - Large.svg`",
      rel: APPLE_WHITE,
      dmg: "Sign in with Apple - Left Aligned/SVG/Logo - SIWA - Left-aligned - White - Large.svg",
      fill: "#FFFFFF"
    }
  ];

  for (const archivo of apple) {
    const texto = bloque(archivo.titulo);
    assert.ok(texto.includes(`| Ruta dentro del DMG | \`${archivo.dmg}\` |`), `${archivo.rel}: ruta en el DMG`);
    assert.ok(texto.includes(`| SHA-256 | \`${sha256(archivo.rel)}\` |`), `${archivo.rel}: SHA-256 real`);
    assert.ok(texto.includes("| `viewBox` | `0 0 39 44` |"), `${archivo.rel}: viewBox`);
    assert.ok(texto.includes(`| \`fill\` del \`<path>\` | \`${archivo.fill}\` |`), `${archivo.rel}: fill`);
  }

  // El DMG es uno solo y la descarga es la oficial de Apple.
  assert.match(readme, /Logo-Sign-in-with-Apple\.dmg/);
  assert.match(
    readme,
    /<https:\/\/devimages-cdn\.apple\.com\/design\/resources\/download\/Logo-Sign-in-with-Apple\.dmg>/
  );

  const google = bloque("## Google — `google/g_dk_sq_sl.svg`");
  assert.ok(google.includes(`| SHA-256 | \`${sha256(GOOGLE)}\` |`), "Google: SHA-256 real");
  assert.ok(google.includes("| `viewBox` | `0 0 40 40` |"), "Google: viewBox");
  assert.match(readme, /<https:\/\/developers\.google\.com\/static\/identity\/images\/signin-assets\.zip>/);
});

test("los dos archivos de Apple son el MISMO vector: sólo cambia el color", () => {
  // Es lo que hace legítimo tener dos tonos en vez de recolorear uno: Apple
  // publica el par, y el par comparte geometría carácter por carácter.
  const negro = pathApple(appleBlackSvg);
  const blanco = pathApple(appleWhiteSvg);

  assert.equal(atributo(appleBlackSvg, "viewBox"), "0 0 39 44");
  assert.equal(atributo(appleWhiteSvg, "viewBox"), atributo(appleBlackSvg, "viewBox"));
  assert.equal(atributo(appleBlackSvg, "width"), "39px");
  assert.equal(atributo(appleBlackSvg, "height"), "44px");
  assert.equal(atributo(appleWhiteSvg, "width"), atributo(appleBlackSvg, "width"));
  assert.equal(atributo(appleWhiteSvg, "height"), atributo(appleBlackSvg, "height"));

  assert.equal(negro.d, blanco.d);
  assert.equal(negro.fillRule, "nonzero");
  assert.equal(blanco.fillRule, "nonzero");

  // Lo único distinto: el glifo y su tile están invertidos entre los archivos.
  assert.equal(negro.fill, "#000000");
  assert.equal(blanco.fill, "#FFFFFF");
  assert.equal(atributo(appleBlackSvg, "rect id=\"Rectangle\" fill"), "#FFFFFF");
  assert.equal(atributo(appleWhiteSvg, "rect id=\"Rectangle\" fill"), "#000000");

  // Y ese tile cubre el canvas entero de la variante Large: 39x44 en los dos.
  for (const svg of [appleBlackSvg, appleWhiteSvg]) {
    const rect = svg.match(/<rect id="Rectangle"[^>]*>/);
    assert.ok(rect, "falta el <rect> de fondo del archivo oficial");
    assert.equal(atributo(rect[0], "width"), "39");
    assert.equal(atributo(rect[0], "height"), "44");
  }
});

// ---------------------------------------------------------------------------
// Geometría y color del componente
// ---------------------------------------------------------------------------

test("Apple conserva viewBox, path y canvas 39x44, y un fill oficial por tono", () => {
  const apple = sinComentarios(seccion("export const APPLE_MARK", "export const GOOGLE_MARK"));
  const negro = pathApple(appleBlackSvg);
  const blanco = pathApple(appleWhiteSvg);

  assert.match(apple, new RegExp(`viewBox: "${atributo(appleBlackSvg, "viewBox")}"`));
  // Canvas intacto: 39x44, los mismos px que declara el archivo Large.
  assert.match(apple, /height: 44/);
  assert.match(apple, /width: 39/);
  assert.doesNotMatch(apple, /width: 31|0 0 31 44/, "el canvas Medium ya no vive en el componente");

  const implementado = apple.match(/\bd:\s*"([^"]+)"/);
  assert.ok(implementado, "falta el path Apple implementado");
  assert.equal(implementado[1], negro.d);
  assert.equal(implementado[1], blanco.d);

  // Un fill por tono, cada uno el de SU archivo. Ni un token de Órbita, ni un
  // hexadecimal inventado, ni el mismo color repetido.
  assert.deepEqual(props(objeto(apple, "fill: {")), { black: `"${negro.fill}"`, white: `"${blanco.fill}"` });
});

test("la manzana Large y la G quedan del mismo ancho visible, sin escalar nada", () => {
  // Éste es el desbalance que la inspección en simulador dejó a la vista: con la
  // variante Medium la manzana medía ~15.46 de ancho visible contra los ~19.6 de
  // la G, y se leía chica al lado de Google. La Large es el MISMO vector oficial
  // en la medida de al lado y cierra esa diferencia a menos de un décimo de pt.
  //
  // Nada de esto se logra escalando: los dos anchos se miden sobre los archivos
  // tal como vienen, con los dos canvas intactos (Apple 39x44, Google 40x40).
  const manzana = extremosX(pathApple(appleBlackSvg).d);
  const gPaths = [...googleSvg.matchAll(/<path\s+[^>]*d="([^"]+)"/g)].map(([, d]) => extremosX(d));
  const ge = {
    min: Math.min(...gPaths.map((e) => e.min)),
    max: Math.max(...gPaths.map((e) => e.max))
  };
  const g = { ...ge, ancho: ge.max - ge.min };

  // El glifo de la Large: 9.765 → 29.2945613 dentro del canvas de 39.
  assert.equal(manzana.min, 9.765);
  assert.equal(manzana.max, 29.2945613);
  assert.ok(Math.abs(manzana.ancho - 19.53) < 0.01, `manzana ${manzana.ancho}, se esperaba ~19.53`);
  // La G, dentro del recuadro 10,10 → 30,30 de su canvas de 40.
  assert.equal(g.min, 10);
  assert.ok(g.max <= 30, `la G se sale de su recuadro: ${g.max}`);

  // Emparejadas: menos de medio punto de diferencia entre las dos.
  assert.ok(
    Math.abs(manzana.ancho - g.ancho) < 0.5,
    `manzana ${manzana.ancho} vs G ${g.ancho}: quedaron desparejas`
  );
  // Y la Medium, que era el problema, está más de 3 pt por debajo de la G.
  assert.ok(g.ancho - 15.46 > 3, "la Medium era la variante desbalanceada");

  // Las dos entran enteras en el slot común de 40x44 sin recortarse.
  assert.ok(manzana.max <= 39 && g.max <= 40);
});

test("Google conserva exactamente el viewBox, los cuatro paths y sus colores", () => {
  const google = sinComentarios(seccion("export const GOOGLE_MARK", "export function AppleMark"));
  const officialPaths = [...googleSvg.matchAll(/<path\s+[^>]*d="([^"]+)"\s+fill="([^"]+)"/g)].map(
    ([, d, fill]) => ({ d, fill })
  );
  const implementedPaths = [...google.matchAll(/\{\s*d:\s*"([^"]+)",\s*fill:\s*"([^"]+)"\s*\}/g)].map(
    ([, d, fill]) => ({ d, fill })
  );

  assert.equal(officialPaths.length, 4);
  assert.match(google, new RegExp(`viewBox: "${atributo(googleSvg, "viewBox")}"`));
  assert.match(google, /size: 40/);
  assert.deepEqual(implementedPaths, officialPaths);
});

test("el tile cuadrado de Google existe en el archivo y NO se porta al componente", () => {
  // El archivo oficial trae fondo + borde con la misma geometría: es el botón
  // que publica Google, no la marca. El shell del botón de Órbita ya aporta esas
  // dos cosas, así que GOOGLE_MARK no lo copia y GoogleMark no lo dibuja.
  const officialRects = [...googleSvg.matchAll(/<rect\s+([^>]+)\/>/g)]
    .map(([, attrs]) => attrs)
    .filter((attrs) => attrs.includes('x="0.5"'))
    .map((attrs) => ({
      x: atributo(attrs, "x"),
      y: atributo(attrs, "y"),
      width: atributo(attrs, "width"),
      height: atributo(attrs, "height"),
      rx: atributo(attrs, "rx"),
      fill: attrs.includes("fill=") ? atributo(attrs, "fill") : atributo(googleSvg, "fill"),
      stroke: attrs.includes("stroke=") ? atributo(attrs, "stroke") : null
    }));
  assert.deepEqual(officialRects, [
    { x: "0.5", y: "0.5", width: "39", height: "39", rx: "3.5", fill: "#131314", stroke: null },
    { x: "0.5", y: "0.5", width: "39", height: "39", rx: "3.5", fill: "none", stroke: "#8E918F" }
  ]);

  const codigo = sinComentarios(componente);
  assert.match(codigo, /^import Svg, \{ Path \} from "react-native-svg";$/m);
  for (const literal of ["Rect", "background", "border", "#131314", "#8E918F", "rx", "stroke"]) {
    assert.ok(!codigo.includes(literal), `el componente no debe portar el tile: ${literal}`);
  }
});

// ---------------------------------------------------------------------------
// Prohibición de tintes
// ---------------------------------------------------------------------------

test("AppleMark EXIGE tono: sin default y sin ninguna prop de color", () => {
  const codigo = sinComentarios(componente);
  // La unión es exactamente la que publica Apple. No hay un tercer tono.
  assert.match(codigo, /export type AppleTone = "black" \| "white";/);

  const firma = objeto(codigo, "export function AppleMark(");
  assert.match(firma, /^\s*tone,/, "`tone` va primero y sin default");
  assert.doesNotMatch(firma, /tone\s*=/, "`tone` no puede tener default: elegir tono es obligatorio");
  assert.match(codigo, /export function AppleMark\(\{[^}]*\}: \{ tone: AppleTone; height\?: number \}\)/);
  // Nada que permita pintar la manzana desde afuera.
  const cuerpo = codigo.slice(
    codigo.indexOf("export function AppleMark"),
    codigo.indexOf("export function GoogleMark")
  );
  for (const prohibida of ["color", "fill:", "tint", "opacity"]) {
    assert.ok(!cuerpo.includes(prohibida), `AppleMark no acepta ${prohibida}`);
  }
  // El fill sale del archivo, indexado por el tono; nunca de un literal suelto.
  assert.match(codigo, /fill=\{APPLE_MARK\.fill\[tone\]\}/);
});

test("los wrappers dibujan SVG/Path sin tintes ni currentColor", () => {
  const wrappers = sinComentarios(componente.slice(componente.indexOf("export function AppleMark")));
  assert.match(wrappers, /<Svg[\s\S]*?<Path/);
  // GoogleMark: los cuatro Path del archivo y NADA más adentro del Svg.
  const googleMark = wrappers.slice(wrappers.indexOf("export function GoogleMark"));
  const cuerpo = googleMark.slice(googleMark.indexOf("<Svg"), googleMark.indexOf("</Svg>"));
  assert.match(cuerpo, /viewBox=\{GOOGLE_MARK\.viewBox\}/);
  assert.match(
    cuerpo,
    /\{GOOGLE_MARK\.paths\.map\(\(trazo\) => \(\s*<Path key=\{trazo\.fill\} d=\{trazo\.d\} fill=\{trazo\.fill\} \/>/
  );
  assert.doesNotMatch(cuerpo, /<Rect|GOOGLE_MARK\.background|GOOGLE_MARK\.border/);
  // Dos "<" y se acabó: el `<Svg>` y el `<Path>` del map.
  assert.equal(cuerpo.match(/</g)?.length, 2);
  assert.doesNotMatch(wrappers, /tintColor|currentColor|color=/);
});

test("el componente de marcas no importa un token de Órbita ni nada fuera de svg", () => {
  // Un import del tema sería la puerta de entrada al tinte: `orbita.bone` en la
  // manzana o en la G viola las dos guías. Acá sólo entra `react-native-svg`.
  const imports = [...sinComentarios(componente).matchAll(/from "([^"]+)"/g)].map(([, spec]) => spec);
  assert.deepEqual(imports, ["react-native-svg"]);
});

// ---------------------------------------------------------------------------
// Las superficies que las usan
// ---------------------------------------------------------------------------

/**
 * La pastilla que dibuja Órbita vive en `components/ProviderButton`, no en la
 * pantalla: la variante NO-iOS del botón de Apple (`AppleAuthButton.tsx`) la
 * necesita, y `AuthScreen` no puede ser su dueña sin un ciclo de imports. En
 * iOS Apple ya no pasa por acá — lo dibuja el sistema— pero Google sí, en todas
 * las plataformas, y el camino web de Apple también.
 */
const auth = sinComentarios(leer("src/onboarding/screens/AuthScreen.tsx"));
const providerButton = sinComentarios(leer("src/onboarding/components/ProviderButton.tsx"));
const googleButton = sinComentarios(leer("src/onboarding/components/GoogleButton.tsx"));

test("las dos superficies usan las marcas oficiales y no FontAwesome", () => {
  assert.match(
    providerButton,
    /import \{ AppleMark, GoogleMark \} from "@\/components\/brand\/ProviderMarks";/
  );
  assert.match(providerButton, /apple \? <AppleMark tone="black" \/> : <GoogleMark \/>/);
  assert.match(
    googleButton,
    /import \{ GoogleMark \} from "@\/components\/brand\/ProviderMarks";/
  );
  assert.match(googleButton, /<GoogleMark \/>/);

  for (const [archivo, source] of [
    ["AuthScreen", auth],
    ["ProviderButton", providerButton],
    ["GoogleButton", googleButton]
  ] as const) {
    assert.doesNotMatch(source, /FontAwesome|@expo\/vector-icons/, `${archivo} no usa icon fonts`);
    assert.doesNotMatch(source, /name=\{?["'](?:apple|google)["']\}?/, `${archivo} no aproxima marcas`);
  }
});

test("ninguna pantalla del repo vuelve a dibujar una marca con FontAwesome", () => {
  // `Ionicons` sigue siendo legítimo para los íconos de la interfaz; el que
  // traía los logos de Apple y Google era FontAwesome, y ya no queda ninguno.
  const recorrer = (dir: string): string[] =>
    readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entrada) =>
      entrada.isDirectory()
        ? recorrer(join(dir, entrada.name))
        : /\.tsx?$/.test(entrada.name)
          ? [join(dir, entrada.name)]
          : []
    );
  const culpables = [...recorrer("src"), ...recorrer("app")].filter((rel) =>
    sinComentarios(leer(rel)).includes("FontAwesome")
  );
  assert.deepEqual(culpables, []);
});

test("los call sites pasan el tono y NADA más: ni un color, ni un tamaño", () => {
  const marcas = [
    ...providerButton.matchAll(/<AppleMark[^/]*\/>/g),
    ...auth.matchAll(/<AppleMark[^/]*\/>/g),
    ...googleButton.matchAll(/<AppleMark[^/]*\/>/g)
  ].map(([m]) => m);
  assert.deepEqual(marcas, ['<AppleMark tone="black" />']);

  const geses = [
    ...providerButton.matchAll(/<GoogleMark[^/]*\/>/g),
    ...auth.matchAll(/<GoogleMark[^/]*\/>/g),
    ...googleButton.matchAll(/<GoogleMark[^/]*\/>/g)
  ].map(([m]) => m);
  assert.deepEqual(geses, ["<GoogleMark />", "<GoogleMark />"]);

  for (const [archivo, source] of [
    ["AuthScreen", auth],
    ["ProviderButton", providerButton],
    ["GoogleButton", googleButton]
  ] as const) {
    assert.doesNotMatch(source, /tintColor/, `${archivo} no tinta la marca`);
  }
});

test("la geometría de la pastilla tiene UNA fuente, y el botón nativo la reusa", () => {
  // 54 y 27 dejaron de ser dos literales sueltos: el botón NATIVO de Apple toma
  // exactamente estos números (alto del marco y `cornerRadius`), así que la fila
  // de proveedores mide lo mismo en iOS que fuera de iOS. Si alguien mueve uno,
  // se mueven los dos.
  assert.match(providerButton, /export const PROVIDER_HEIGHT = 54;/);
  assert.match(providerButton, /export const PROVIDER_RADIUS = 27;/);
});

test("el botón de Apple es blanco con logo y texto negros, y conserva la pastilla", () => {
  // Sigue siendo la superficie de Apple FUERA de iOS (web con la conexión
  // encendida). En iOS la dibuja el sistema y este archivo no participa.
  const hoja = providerButton.slice(providerButton.indexOf("const styles = StyleSheet.create("));
  const provider = props(objeto(hoja, "provider: {"));
  const apple = props(objeto(hoja, "providerApple: {"));

  // La pastilla que ya existía: alto 54, radio 27, contorno de 1 pt.
  assert.equal(provider.height, "PROVIDER_HEIGHT");
  assert.equal(provider.borderRadius, "PROVIDER_RADIUS");
  assert.equal(provider.borderWidth, "1");
  assert.equal(provider.borderColor, "orbita.bone");
  // Apple sólo cambia el fondo: blanco, el botón que publica su guía.
  assert.deepEqual(apple, { backgroundColor: '"#FFFFFF"' });
  assert.match(
    providerButton,
    /style=\{\[styles\.provider, apple && styles\.providerApple, off && styles\.providerOff\]\}/
  );

  // Texto: Inter Medium 16/22, y negro sólo del lado de Apple.
  const txt = props(objeto(providerButton, "export const PROVIDER_TXT = {"));
  assert.deepEqual(txt, {
    color: "orbita.bone",
    fontFamily: "font.sansMed",
    fontSize: "16",
    lineHeight: "22"
  });
  assert.match(
    providerButton,
    /export const PROVIDER_TXT_APPLE = \{ \.\.\.PROVIDER_TXT, color: "#000000" \} as const;/
  );
  assert.match(providerButton, /<Text style=\{apple \? PROVIDER_TXT_APPLE : PROVIDER_TXT\}>/);
  // Literales, no `StyleSheet.create`: si la clase del `Text` compartido ganara,
  // el negro de Apple saldría claro sobre blanco.
  assert.doesNotMatch(hoja, /providerTxt/);
});

test("Google queda oscuro y con la G de cuatro colores", () => {
  const hoja = providerButton.slice(providerButton.indexOf("const styles = StyleSheet.create("));
  const provider = props(objeto(hoja, "provider: {"));
  assert.equal(provider.backgroundColor, "orbita.bgElev");
  // No hay override para Google: es la pastilla oscura de siempre.
  assert.doesNotMatch(hoja, /providerGoogle/);
  // Y la G no se tinta ni se aplana a un color.
  assert.equal(GOOGLE_FILLS.length, 4);
  assert.equal(new Set(GOOGLE_FILLS).size, 4);
});

test("la fila del acceso mide 220x54 con slot de 40x44 y sin offset óptico", () => {
  const hoja = providerButton.slice(providerButton.indexOf("const styles = StyleSheet.create("));
  const contenido = props(objeto(hoja, "providerContent: {"));
  const slot = props(objeto(hoja, "providerIcon: {"));

  assert.equal(contenido.width, "220");
  assert.equal(contenido.height, "PROVIDER_HEIGHT");
  assert.equal(contenido.flexDirection, '"row"');
  assert.equal(contenido.alignItems, '"center"');
  // El slot es el canvas del vector de Apple: 40 de ancho, 44 de alto.
  assert.equal(slot.width, "40");
  assert.equal(slot.height, "44");
  assert.equal(slot.alignItems, '"center"');
  assert.equal(slot.justifyContent, '"center"');

  sinOffsetOptico("providerContent", contenido);
  sinOffsetOptico("providerIcon", slot);
  sinOffsetOptico("PROVIDER_TXT", props(objeto(providerButton, "export const PROVIDER_TXT = {")));
});

test("GoogleButton alinea a 220 y no cambia nada más", () => {
  const content = props(objeto(googleButton, "const CONTENT = {"));
  const slot = props(objeto(googleButton, "const ICON_SLOT = {"));
  const row = props(objeto(googleButton, "const ROW = {"));

  // Lo único que se movió acá: la fila pasa a 220, la misma del acceso.
  assert.equal(content.width, "220");
  assert.equal(slot.width, "40");
  assert.equal(slot.height, "44");
  sinOffsetOptico("CONTENT", content);
  sinOffsetOptico("ICON_SLOT", slot);

  // La superficie del botón sigue siendo la de siempre: clara, 54, radio 27.
  assert.equal(row.backgroundColor, "orbita.bone");
  assert.equal(row.height, "54");
  assert.equal(row.borderRadius, "27");
  assert.equal(props(objeto(googleButton, "const LABEL = {")).color, "orbita.ink");

  // Comportamiento y accesibilidad intactos.
  assert.match(googleButton, /onPress=\{busy \? undefined : onPress\}/);
  assert.match(googleButton, /accessibilityRole="button"/);
  assert.match(googleButton, /accessibilityLabel=\{label\}/);
  assert.match(googleButton, /accessibilityState=\{\{ busy, disabled: busy \}\}/);
  assert.match(googleButton, /busy \? "Un momento…" : label/);
});

test("la pastilla conserva callbacks, estados y accesibilidad", () => {
  assert.match(providerButton, /accessibilityRole="button"/);
  assert.match(providerButton, /accessibilityLabel=\{label\}/);
  assert.match(providerButton, /accessibilityState=\{\{ busy, disabled: off \}\}/);
  assert.match(providerButton, /onPress=\{off \? undefined : onPress\}/);
  assert.match(providerButton, /const off = busy \|\| disabled;/);
  assert.match(providerButton, /busy \? "Un momento…" : label/);
});

test("el acceso sigue colgando cada vía de su flag y del mismo `oauth`", () => {
  // Google es la pastilla; Apple es `AppleAuthButton`, que el bundler resuelve
  // por plataforma (nativo en iOS, pastilla fuera). Los dos siguen llamando
  // exactamente al mismo `oauth` con su proveedor.
  assert.match(auth, /APPLE_AUTH_ENABLED \?[\s\S]{0,240}onPress=\{\(\) => onPress\("apple"\)\}/);
  assert.match(auth, /GOOGLE_AUTH_ENABLED \?[\s\S]{0,240}onPress=\{\(\) => onPress\("google"\)\}/);
  assert.match(auth, /<AppleAuthButton/);
  assert.match(auth, /<ProviderButton\s+icon="google"/);
  // La pantalla ya no dibuja la pastilla: no puede volver a divergir de ella.
  for (const clave of [
    "provider: {",
    "providerApple: {",
    "providerContent: {",
    "providerIcon: {",
    "providerOff: {"
  ]) {
    assert.ok(!auth.includes(clave), `la pantalla volvió a dibujar la pastilla: «${clave}»`);
  }
  assert.doesNotMatch(auth, /components\/brand\/ProviderMarks/, "las marcas las dibuja la pastilla");
});
