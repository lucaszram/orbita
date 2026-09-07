/**
 * Documento raíz de la web (`app/+html.tsx` + `expo.web` de `app.json`).
 *
 * Antes de CORE-272 la web era una SPA y el documento era una PLANTILLA
 * (`public/index.html`) que Expo completaba con un `String.replace` por
 * marcador. Ese archivo ya no existe: con `expo.web.output: "static"` Expo no
 * lo mira —sólo lo usa en el modo SPA— y el documento lo renderiza React desde
 * `app/+html.tsx`. Con la plantilla se fueron sus dos trampas (los marcadores
 * que se comía un comentario y los cierres de `head`/`body` irrepetibles), y
 * este archivo fija lo que ocupó su lugar.
 *
 * Se afirma sobre las fuentes, no sobre `dist/`: el export no está disponible
 * en la suite y el error se comete acá. El `dist/` real lo revisa
 * `scripts/check-web-export.mjs`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ROOT } from "./moduleGraph";
import {
  PUBLIC_ROUTES,
  ROBOTS_PRIVATE,
  ROBOTS_PUBLIC,
  SITE_DESCRIPTION,
  SITE_LANG,
  SITE_TITLE
} from "../src/web/seo.mjs";

const html = readFileSync(join(ROOT, "app", "+html.tsx"), "utf8");
const appJson = JSON.parse(readFileSync(join(ROOT, "app.json"), "utf8")) as {
  expo: {
    name: string;
    web?: { lang?: string; name?: string; description?: string; themeColor?: string; output?: string };
  };
};
const web = appJson.expo.web ?? {};

/** Sin comentarios: el documento explica sus reglas en prosa y eso no es marcado. */
const marcado = html.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

// --- 1. El render estático manda -------------------------------------------

test("la web se exporta con un HTML por ruta, no como SPA", () => {
  // Es la decisión de la que cuelga todo lo demás: con `output` en `single` (o
  // ausente) Expo vuelve a emitir un solo documento para todas las rutas y las
  // canónicas por ruta dejan de existir.
  assert.equal(web.output, "static");
});

test("la plantilla SPA ya no existe", () => {
  // Mientras `public/index.html` exista, el export lo copia a `dist/` ANTES de
  // escribir el HTML renderizado: si alguna vez volviera a ganar la carrera,
  // la portada saldría con el documento viejo y su canónica fija al raíz.
  assert.equal(existsSync(join(ROOT, "public", "index.html")), false);
});

test("`app/+html.tsx` es el documento raíz y monta el árbol", () => {
  // Expo Router lo levanta por nombre (`expo-router/_ctx-html`): sin el default
  // export, o sin `{children}` en el `<body>`, no hay app.
  assert.match(html, /export default function Root\(\{ children \}/);
  assert.match(marcado, /<body>[\s\S]*\{children\}/);
  assert.match(marcado, /<ScrollViewStyleReset \/>/);
});

// --- 2. Nada se declara dos veces ------------------------------------------

test("el idioma y el dominio salen de la fuente única, no escritos a mano", () => {
  assert.match(html, /<html lang=\{SITE_LANG\}>/);
  assert.equal(SITE_LANG, "es");
  // Ni el dominio ni el título ni la descripción se tipean en el documento:
  // duplicarlos es exactamente lo que esta tarjeta vino a cerrar.
  assert.doesNotMatch(marcado, /orbitaastrologia\.xyz/);
});

test("`app.json` ya no declara título ni descripción de la web", () => {
  // Con el render estático `expo.web.name` y `expo.web.description` no llegan a
  // ningún documento: sólo alimentaban la plantilla SPA. Dejarlos ahí sería una
  // segunda fuente de verdad que nadie lee y que se desincroniza en silencio.
  assert.equal(web.name, undefined);
  assert.equal(web.description, undefined);
  assert.equal(web.themeColor, undefined, "el theme-color lo declara `app/+html.tsx`");
  assert.equal(web.lang, SITE_LANG, "el idioma del dev server sigue el de la fuente única");
});

test("el documento NO declara título, descripción ni canónica: son por ruta", () => {
  // Si el documento raíz las declarara, las seis rutas públicas volverían a
  // compartir ficha — con el agravante de que `RouteHead` inyecta las suyas
  // ARRIBA y quedarían dos títulos y dos canónicas en el mismo `<head>`.
  assert.doesNotMatch(marcado, /<title/);
  assert.doesNotMatch(marcado, /name="description"/);
  assert.doesNotMatch(marcado, /rel="canonical"/);
  assert.doesNotMatch(marcado, /property="og:url"/);
});

// --- 3. Lo que sí es del sitio ---------------------------------------------

test("el documento conserva el ícono de marca, el theme-color y el compartido del sitio", () => {
  assert.match(marcado, /rel="icon"[\s\S]*?type="image\/png"/);
  assert.match(marcado, /rel="apple-touch-icon"/);
  assert.match(marcado, /name="theme-color" content=\{THEME_COLOR\}/);
  assert.match(marcado, /property="og:type" content="website"/);
  assert.match(marcado, /property="og:site_name" content=\{SITE_NAME\}/);
  assert.match(marcado, /name="twitter:card" content="summary_large_image"/);
  assert.match(marcado, /type="application\/ld\+json"/);
});

test("el `robots` se decide en el documento, que es por donde pasan TODAS las rutas", () => {
  // `+not-found` y `_sitemap` los dibuja Expo Router FUERA del layout raíz: un
  // `<Head>` en el layout no los alcanza y saldrían abiertos a indexación.
  assert.match(marcado, /name="robots" content=\{indexable \? ROBOTS_PUBLIC : ROBOTS_PRIVATE\}/);
  assert.match(html, /const indexable = !isGroupVariation && isPublicPath\(usePathname\(\)\)/);
  // Las variaciones de grupo (`dist/(tabs)/index.html`) comparten pathname con
  // la ruta real: son copias y no pueden indexarse como si fueran la original.
  assert.match(html, /segments\.some\(\(segment\) => segment\.startsWith\("\("\)\)/);
  assert.equal(ROBOTS_PRIVATE, "noindex, nofollow");
  assert.match(ROBOTS_PUBLIC, /^index, follow/);
});

test("el documento apaga la hidratación de Expo Router, y lo hace al final del body", () => {
  // El HTML emitido es la cáscara pública y el primer render del navegador es
  // el árbol real: hidratar terminaría descartando el documento igual, con un
  // error de consola de regalo. Los módulos diferidos corren en el orden del
  // documento, así que este tiene que ir DESPUÉS del `<head>` para pisar el
  // `= true` que inyecta la CLI.
  assert.match(marcado, /__EXPO_ROUTER_HYDRATE__=false/);
  assert.ok(
    marcado.indexOf("__EXPO_ROUTER_HYDRATE__=false") > marcado.indexOf("</head>"),
    "el apagado tiene que vivir en el `<body>`, después del `<head>`"
  );
});

// --- 4. Guardrails del copy del sitio --------------------------------------

test("el título y la descripción del sitio son de Órbita, en español y sin claims prohibidos", () => {
  assert.match(SITE_TITLE, /Órbita/);
  assert.ok(SITE_DESCRIPTION.length >= 80, "la descripción es demasiado corta para servir de meta description");
  assert.ok(SITE_DESCRIPTION.length <= 320, "una meta description muy larga se corta en los buscadores");
  assert.match(SITE_DESCRIPTION, /entretenimiento|autoconocimiento/i);

  for (const prohibido of [/predice/i, /predicción/i, /destino/i, /garantiz/i, /salud/i, /dinero/i]) {
    assert.doesNotMatch(`${SITE_TITLE} ${SITE_DESCRIPTION}`, prohibido);
  }
});

test("la portada conserva el título y la descripción que el sitio ya publicaba", () => {
  // No es una ficha nueva: es la de siempre, ahora atada sólo a `/`.
  const portada = PUBLIC_ROUTES.find((route) => route.path === "/");
  assert.ok(portada);
  assert.equal(portada!.title, SITE_TITLE);
  assert.equal(portada!.description, SITE_DESCRIPTION);
});
