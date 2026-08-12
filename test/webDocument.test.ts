/**
 * Documento de la web pública (`public/index.html` + `expo.web` de `app.json`).
 *
 * Existe por un defecto real y silencioso: Expo completa la plantilla con un
 * `String.replace` por marcador, que reemplaza SÓLO la primera aparición.
 * Nombrar un marcador en un comentario se come la sustitución y el sitio sale
 * publicado con `lang` y `<title>` literales, sin que nada falle en el build.
 *
 * Se afirma sobre las fuentes, no sobre `dist/`: el export no está disponible
 * en la suite y el error se comete acá.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ROOT } from "./moduleGraph";

const html = readFileSync(join(ROOT, "public", "index.html"), "utf8");
const appJson = JSON.parse(readFileSync(join(ROOT, "app.json"), "utf8")) as {
  expo: { name: string; web?: { lang?: string; name?: string; description?: string; themeColor?: string } };
};
const web = appJson.expo.web ?? {};

const apariciones = (marcador: string) => html.split(marcador).length - 1;

test("cada marcador de la plantilla aparece UNA sola vez", () => {
  // Dos apariciones = la primera se sustituye y la del documento queda literal.
  assert.equal(apariciones("%LANG_ISO_CODE%"), 1);
  assert.equal(apariciones("%WEB_TITLE%"), 1);
});

test("los cierres de `head` y `body` aparecen UNA sola vez", () => {
  // Mismo defecto que los marcadores, con otra víctima: Expo inyecta la meta
  // description, el <link> del favicon y el CSS pisando la PRIMERA aparición
  // del cierre del head, y los <script> del bundle la del body. Un cierre
  // escrito antes (en un comentario, en un ejemplo) se los come y el sitio sale
  // publicado sin descripción, sin estilos o sin JavaScript.
  assert.equal(apariciones("</head>"), 1);
  assert.equal(apariciones("</body>"), 1);
});

test("los marcadores están donde tienen que estar: el idioma en `<html>` y el título en `<title>`", () => {
  assert.match(html, /<html lang="%LANG_ISO_CODE%">/);
  assert.match(html, /<title>%WEB_TITLE%<\/title>/);
});

test("la plantilla declara la canónica productiva", () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/orbitaastrologia\.xyz\/" \/>/);
});

test("la plantilla conserva el punto de montaje y el reset de react-native-web", () => {
  // El contenedor ya no está vacío (ver `webSearchPreview.test.ts`), pero sigue
  // siendo el `#root` que busca `registerRootComponent` — sin él la app ni
  // arranca.
  assert.match(html, /<div id="root">/);
  assert.match(html, /id="expo-reset"/);
});

test("la descripción y el theme-color no se declaran dos veces", () => {
  // Expo agrega `<meta name="description">` desde `expo.web.description` y
  // `<meta name="theme-color">` desde `expo.web.themeColor`. La descripción se
  // deja en `app.json` (la plantilla no la escribe) y el theme-color se declara
  // en la plantilla (`app.json` no lo trae): cualquiera de los dos en los dos
  // lugares publica metadatos duplicados.
  // Sin comentarios: el documento explica esta regla en prosa y esa mención no
  // es una etiqueta.
  const marcado = html.replace(/<!--[\s\S]*?-->/g, "");
  assert.doesNotMatch(marcado, /<meta\s+name="description"/);
  assert.ok(web.description, "la meta description sale de `expo.web.description`");
  assert.equal(web.themeColor, undefined, "el theme-color ya lo declara `public/index.html`");
  assert.match(html, /<meta name="theme-color" content="#07080A" \/>/);
});

test("el documento se sirve en español", () => {
  assert.equal(web.lang, "es");
});

test("el título y la descripción son de Órbita, en español y sin claims prohibidos", () => {
  const titulo = web.name ?? appJson.expo.name;
  const descripcion = web.description ?? "";

  assert.match(titulo, /Órbita/);
  assert.ok(descripcion.length >= 80, "la descripción es demasiado corta para servir de meta description");
  assert.ok(descripcion.length <= 320, "una meta description muy larga se corta en los buscadores");
  assert.match(descripcion, /entretenimiento|autoconocimiento/i);

  // Guardrails de producto: nada de destino, predicción garantizada, salud,
  // dinero ni consejo legal en la carta de presentación del sitio.
  for (const prohibido of [/predice/i, /predicción/i, /destino/i, /garantiz/i, /salud/i, /dinero/i]) {
    assert.doesNotMatch(`${titulo} ${descripcion}`, prohibido);
  }
});
