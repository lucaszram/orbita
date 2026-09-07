/**
 * Límites del export web (`scripts/check-web-export.mjs`).
 *
 * Lo que se prueba acá es la DECISIÓN, no el recorrido del disco: `classifyEntry`
 * (qué cuenta como imagen y qué como JavaScript de aplicación) y `evaluateExport`
 * (qué hace fallar el gate y con qué mensaje). El gate existió porque el export
 * llegó a 84 MB con PNGs de 5,7 MB adentro; si esta lógica se afloja, eso vuelve
 * sin que nadie se entere.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_LIMITS,
  KB,
  LANDING_MIN_TEXT,
  MB,
  REQUIRED_PUBLIC_FILES,
  classifyEntry,
  evaluateExport,
  evaluateLandingHtml,
  evaluatePublicSeo,
  formatBytes,
  readHeadings
} from "../scripts/check-web-export.mjs";
import {
  PARENT_ARGV_ENV,
  parentArgv,
  readCommand,
  shouldWriteSitemap
} from "../scripts/generate-sitemap.mjs";
import {
  PUBLIC_ROUTES,
  ROBOTS_PRIVATE,
  ROBOTS_PUBLIC,
  buildSitemapXml,
  canonicalUrl,
  htmlFileForPath
} from "../src/web/seo.mjs";

const ok = { totalBytes: 10 * MB, images: [{ path: "assets/a.jpg", bytes: 200 * KB }], appJs: [{ path: "_expo/static/js/web/entry-abc.js", gzipBytes: MB }] };

test("los límites son los del brief: 50 MB de export, 500 KB por imagen, 1,25 MB de JS comprimido", () => {
  assert.equal(DEFAULT_LIMITS.totalBytes, 50 * MB);
  assert.equal(DEFAULT_LIMITS.imageBytes, 500 * KB);
  assert.equal(DEFAULT_LIMITS.appJsGzipBytes, Math.round(1.25 * MB));
});

test("un export dentro de los tres límites pasa", () => {
  const verdict = evaluateExport(ok);
  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.failures, []);
});

test("el límite es estricto pero no excluyente: exactamente el límite pasa, un byte más falla", () => {
  const justo = evaluateExport({ ...ok, totalBytes: DEFAULT_LIMITS.totalBytes });
  assert.equal(justo.ok, true);

  const uno = evaluateExport({ ...ok, totalBytes: DEFAULT_LIMITS.totalBytes + 1 });
  assert.equal(uno.ok, false);
  assert.equal(uno.failures[0].check, "total");
});

test("el export completo pasado de 50 MB falla e informa la medida real", () => {
  const verdict = evaluateExport({ ...ok, totalBytes: 84 * MB });
  assert.equal(verdict.ok, false);
  const fallo = verdict.failures.find((f) => f.check === "total");
  assert.ok(fallo, "tiene que reportar el check de total");
  assert.match(fallo!.message, /84\.00 MB/, "el mensaje trae el valor medido");
  assert.match(fallo!.message, /50\.00 MB/, "y contra qué límite");
});

test("cada imagen pasada de 500 KB se lista, de la más pesada a la más liviana", () => {
  const verdict = evaluateExport({
    ...ok,
    images: [
      { path: "assets/chico.jpg", bytes: 200 * KB },
      { path: "assets/mediano.png", bytes: 2 * MB },
      { path: "assets/scorpio.png", bytes: 5785 * KB }
    ]
  });
  assert.equal(verdict.ok, false);
  const fallo = verdict.failures.find((f) => f.check === "image");
  assert.ok(fallo);
  assert.equal(fallo!.offenders.length, 2, "el que entra en el límite no se reporta");
  assert.match(fallo!.offenders[0], /scorpio\.png — 5\.65 MB/, "primero el peor, con su tamaño");
  assert.match(fallo!.offenders[1], /mediano\.png — 2\.00 MB/);
});

test("el JS de aplicación se mide comprimido y sumando todos los chunks", () => {
  // 700 KB + 700 KB gzip = 1,37 MB: cada archivo entra solo, el conjunto no.
  const verdict = evaluateExport({
    ...ok,
    appJs: [
      { path: "_expo/static/js/web/entry-abc.js", gzipBytes: 700 * KB },
      { path: "_expo/static/js/web/chunk-def.js", gzipBytes: 700 * KB }
    ]
  });
  assert.equal(verdict.ok, false);
  const fallo = verdict.failures.find((f) => f.check === "appJs");
  assert.ok(fallo);
  assert.match(fallo!.message, /1\.37 MB/);
  assert.equal(fallo!.offenders.length, 2, "lista los chunks que suman");
});

test("si no hay JS de aplicación el gate falla en vez de pasar midiendo cero", () => {
  // El modo de falla peligroso: cambia la ruta del bundle, el check no encuentra
  // nada, suma 0 y da verde para siempre.
  const verdict = evaluateExport({ ...ok, appJs: [] });
  assert.equal(verdict.ok, false);
  const fallo = verdict.failures.find((f) => f.check === "appJs");
  assert.ok(fallo);
  assert.match(fallo!.message, /no se encontró JavaScript de aplicación/);
});

test("los tres fallos se reportan juntos: una corrida dice todo lo que hay que arreglar", () => {
  const verdict = evaluateExport({
    totalBytes: 84 * MB,
    images: [{ path: "assets/icon.png", bytes: 1722 * KB }],
    appJs: []
  });
  assert.deepEqual(
    verdict.failures.map((f) => f.check).sort(),
    ["appJs", "image", "total"]
  );
});

test("classifyEntry separa imagen, JS de app, source map y fuente", () => {
  assert.equal(classifyEntry("assets/assets/orbita/core/x.png"), "image");
  assert.equal(classifyEntry("assets/assets/orbita/optimized/core/x.jpg"), "image");
  assert.equal(classifyEntry("assets/x.webp"), "image");
  assert.equal(classifyEntry("_expo/static/js/web/entry-abc.js"), "appJs");
  assert.equal(classifyEntry("index.html"), "other");
  assert.equal(classifyEntry("metadata.json"), "other");
});

test("el límite de JS comprimido NO cuenta fuentes ni source maps", () => {
  // `MaterialCommunityIcons.ttf` pesa 1,27 MB y `entry-*.js.map` puede pesar
  // decenas: si cualquiera de los dos entrara al check de JS, el gate mediría
  // otra cosa y fallaría por algo que no es el bundle de la app.
  assert.equal(classifyEntry("assets/node_modules/.../MaterialCommunityIcons.6e43.ttf"), "font");
  assert.equal(classifyEntry("_expo/static/js/web/entry-abc.js.map"), "sourceMap");
  assert.notEqual(classifyEntry("_expo/static/js/web/entry-abc.js.map"), "appJs");
  // Y una fuente tampoco puede colarse como imagen.
  assert.notEqual(classifyEntry("assets/x.woff2"), "image");
});

test("un `.js` fuera de `_expo/static/js/web/` no es JS de aplicación", () => {
  // Un service worker o un script suelto no es el bundle que queremos acotar.
  assert.equal(classifyEntry("sw.js"), "other");
  assert.equal(classifyEntry("assets/vendor/whatever.js"), "other");
});

test("formatBytes rinde legible en las tres escalas", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(500 * KB), "500.0 KB");
  assert.equal(formatBytes(50 * MB), "50.00 MB");
});

// --- ficha de búsqueda del export -------------------------------------------
//
// Lo que se prueba es el CONTRATO nuevo (CORE-272): cada ruta pública emite su
// propio documento, con su título, su descripción, su canónica y su `og:url`;
// todo lo demás sale con `noindex`; y el sitemap dice exactamente las mismas
// URLs que las canónicas. Antes el contrato era el contrario —una sola URL en
// el sitemap y una canónica compartida— y eso es justo lo que ya no vale.

/** Marcas del sitio que todo documento emitido conserva. */
const MARCAS_DEL_SITIO = [
  '<link rel="icon" type="image/png" sizes="192x192" href="/orbita-icon-192.png"/>',
  '<script type="application/ld+json">{}</script>',
  '<script type="module">globalThis.__EXPO_ROUTER_HYDRATE__=false;</script>'
].join("");

/** Un documento público bien formado, como lo emite el export. */
function docPublico(route: { path: string; title: string; description: string }, patch = "") {
  const canonical = canonicalUrl(route.path);
  return [
    `<title data-rh="true">${route.title}</title>`,
    `<meta data-rh="true" name="description" content="${route.description}"/>`,
    `<link data-rh="true" rel="canonical" href="${canonical}"/>`,
    `<meta data-rh="true" property="og:url" content="${canonical}"/>`,
    `<meta data-rh="true" property="og:title" content="${route.title}"/>`,
    `<meta data-rh="true" property="og:description" content="${route.description}"/>`,
    `<meta name="robots" content="${ROBOTS_PUBLIC}"/>`,
    MARCAS_DEL_SITIO,
    patch
  ].join("");
}

const docPrivado = `<title data-rh="true">Órbita</title><meta name="robots" content="${ROBOTS_PRIVATE}"/>${MARCAS_DEL_SITIO}`;

function documentosOk(patch: Record<string, string> = {}) {
  const documents: Record<string, string> = { "home.html": docPrivado, "paywall.html": docPrivado };
  for (const route of PUBLIC_ROUTES) documents[htmlFileForPath(route.path)] = docPublico(route);
  return { ...documents, ...patch };
}

const seoOk = () => ({
  paths: [...REQUIRED_PUBLIC_FILES, "_expo/static/js/web/entry-abc.js"],
  documents: documentosOk(),
  sitemap: buildSitemapXml("2026-09-07T00:00:00.000Z")
});

test("la ficha de búsqueda exige los estáticos que se sirven por URL propia", () => {
  // Los cuatro de `public/` más el `.ico` que genera Expo y los dos que produce
  // el export (`index.html`, `sitemap.xml`). Ninguno lleva hash: el buscador
  // cachea esas URLs.
  assert.deepEqual(REQUIRED_PUBLIC_FILES, [
    "favicon.ico",
    "index.html",
    "orbita-icon-192.png",
    "orbita-og.jpg",
    "robots.txt",
    "sitemap.xml"
  ]);
  assert.equal(evaluatePublicSeo(seoOk()).ok, true);
});

test("un export sin robots ni sitemap falla y los nombra", () => {
  // El defecto real: `public/` no se copió y esas dos URLs caían en el rewrite
  // de la SPA, que devolvía el `index.html`.
  const base = seoOk();
  const verdict = evaluatePublicSeo({
    ...base,
    paths: base.paths.filter((p) => p !== "robots.txt" && p !== "sitemap.xml")
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.failures[0].check, "publicFiles");
  assert.deepEqual(verdict.failures[0].offenders, ["robots.txt", "sitemap.xml"]);
});

test("una ruta pública que no emitió su documento falla y dice cuál", () => {
  const documents = documentosOk();
  delete documents["terminos.html"];
  const verdict = evaluatePublicSeo({ ...seoOk(), documents });
  assert.equal(verdict.ok, false);
  const fallo = verdict.failures.find((f) => f.check === "publicRoutes");
  assert.ok(fallo);
  assert.deepEqual(fallo!.offenders, ["/terminos — falta terminos.html"]);
});

test("un documento público sin su ficha propia falla y enumera qué le falta", () => {
  const terminos = PUBLIC_ROUTES.find((r) => r.path === "/terminos")!;
  const verdict = evaluatePublicSeo({
    ...seoOk(),
    documents: documentosOk({
      "terminos.html": docPublico(terminos)
        .replace(/<title[^>]*>[^<]*<\/title>/, "<title data-rh=\"true\"></title>")
        .replace(/<meta data-rh="true" name="description"[^>]*>/, "")
    })
  });
  assert.equal(verdict.ok, false);
  const fallo = verdict.failures.find((f) => f.check === "publicRoutes");
  assert.ok(fallo);
  assert.match(fallo!.offenders[0], /^terminos\.html — falta título propio, meta description$/);
});

test("dos rutas públicas con la MISMA canónica fallan: es el defecto que abrió la tarjeta", () => {
  // Antes de CORE-272 las cinco rutas declaraban la canónica de la portada.
  const terminos = PUBLIC_ROUTES.find((r) => r.path === "/terminos")!;
  const verdict = evaluatePublicSeo({
    ...seoOk(),
    documents: documentosOk({
      "terminos.html": docPublico(terminos).replaceAll(canonicalUrl("/terminos"), canonicalUrl("/"))
    })
  });
  assert.equal(verdict.ok, false);
  const fallo = verdict.failures.find((f) => f.check === "publicRoutes");
  assert.ok(fallo);
  assert.ok(fallo!.offenders.some((o: string) => /comparte la canónica/.test(o)));
});

test("una ruta privada sin `noindex` falla", () => {
  const verdict = evaluatePublicSeo({
    ...seoOk(),
    documents: documentosOk({ "paywall.html": docPrivado.replace(ROBOTS_PRIVATE, ROBOTS_PUBLIC) })
  });
  assert.equal(verdict.ok, false);
  const fallo = verdict.failures.find((f) => f.check === "privateRoutes");
  assert.ok(fallo);
  assert.deepEqual(fallo!.offenders, ["paywall.html"]);
});

test("un documento con marcadores sin sustituir falla", () => {
  // Escribir un marcador dos veces en la plantilla SPA dejaba el literal
  // publicado y el build no se quejaba; un valor que no existe rinde
  // `content="undefined"` y tampoco se quejaba nadie.
  const verdict = evaluatePublicSeo({
    ...seoOk(),
    documents: documentosOk({ "home.html": `${docPrivado}<title>%WEB_TITLE%</title>` })
  });
  assert.equal(verdict.ok, false);
  const fallo = verdict.failures.find((f) => f.check === "placeholders");
  assert.ok(fallo);
  assert.deepEqual(fallo!.offenders, ["home.html — %WEB_TITLE%"]);
});

test("un sitemap que no coincide con las canónicas falla", () => {
  // El sitemap viejo declaraba UNA sola URL porque el documento tenía una sola
  // canónica. Ahora tiene que enumerar exactamente las seis.
  const verdict = evaluatePublicSeo({
    ...seoOk(),
    sitemap: '<?xml version="1.0"?><urlset><url><loc>https://orbitaastrologia.xyz/</loc></url></urlset>'
  });
  assert.equal(verdict.ok, false);
  const fallo = verdict.failures.find((f) => f.check === "sitemap");
  assert.ok(fallo);
  assert.match(fallo!.message, /enumera 1 URL\(s\) y las canónicas públicas son 6/);
});

test("sin `index.html` se reporta el archivo faltante", () => {
  const base = seoOk();
  const documents = documentosOk();
  delete documents["index.html"];
  const verdict = evaluatePublicSeo({
    paths: base.paths.filter((p) => p !== "index.html"),
    documents,
    sitemap: base.sitemap
  });
  assert.equal(verdict.ok, false);
  assert.deepEqual(verdict.failures[0].offenders, ["index.html"]);
});

// --- la portada emitida dice lo mismo que la landing -------------------------

const LANDING_FUENTE = `
  <Text role="heading" aria-level={1}>Una carta para hoy. Contexto para todos los días.</Text>
  <Text role="heading" aria-level={2}>Todo se lee sobre tu carta.</Text>
`;
const relleno = "texto real de la landing ".repeat(80);
const portadaOk = `<body><h1 aria-level="1">Una carta para hoy. Contexto para todos los días.</h1><h2>Todo se lee sobre tu carta.</h2><p>${relleno}</p></body>`;

test("la portada emitida pasa cuando trae el texto REAL del componente", () => {
  const verdict = evaluateLandingHtml({ indexHtml: portadaOk, landingSource: LANDING_FUENTE });
  assert.equal(verdict.ok, true);
});

test("una portada que renderizó un spinner falla: es el modo de falla del render estático", () => {
  // Sin este control, `dist/index.html` podía salir con el gate de cuenta o el
  // boundary de eliminación tapando todo y el build quedaba en verde.
  const verdict = evaluateLandingHtml({
    indexHtml: '<body><div role="progressbar"></div></body>',
    landingSource: LANDING_FUENTE
  });
  assert.equal(verdict.ok, false);
  assert.match(verdict.failures[0].message, new RegExp(`el piso es ${LANDING_MIN_TEXT}`));
});

test("un encabezado que no está en el componente real es cloaking y falla", () => {
  const verdict = evaluateLandingHtml({
    indexHtml: portadaOk.replace("Todo se lee sobre tu carta.", "Predecimos tu futuro"),
    landingSource: LANDING_FUENTE
  });
  assert.equal(verdict.ok, false);
  const fallo = verdict.failures.find((f) => /no están en/.test(f.message));
  assert.ok(fallo);
  assert.deepEqual(fallo!.offenders, ["h2 — Predecimos tu futuro"]);
});

test("la portada tiene UN solo encabezado de nivel 1", () => {
  const verdict = evaluateLandingHtml({
    indexHtml: portadaOk.replace("<h2>", '<h1 aria-level="1">Una carta para hoy. Contexto para todos los días.</h1><h2>'),
    landingSource: LANDING_FUENTE
  });
  assert.equal(verdict.ok, false);
  assert.match(verdict.failures[0].message, /2 encabezado\(s\) de nivel 1/);
});

test("readHeadings devuelve nivel y texto, sin el marcado de adentro", () => {
  assert.deepEqual(readHeadings('<h1><span>Una</span> carta</h1><h3 class="x">Tus datos</h3>'), [
    [1, "Una carta"],
    [3, "Tus datos"]
  ]);
});

// --- el sitemap se genera en el export ---------------------------------------

test("el sitemap se escribe SÓLO durante un `expo export`", () => {
  // `metro.config.js` se evalúa en TODA invocación de Metro. Un `expo start` no
  // tiene por qué tocar el `dist/` de un build anterior, y `export:embed` es el
  // bundle nativo, que no emite web.
  assert.equal(shouldWriteSitemap({ command: "export", outputDirExists: true }), true);
  assert.equal(shouldWriteSitemap({ command: "start", outputDirExists: true }), false);
  assert.equal(shouldWriteSitemap({ command: "export:embed", outputDirExists: true }), false);
  // El directorio de salida lo crea la CLI justo antes de levantar Metro: si no
  // existe, no estamos dentro del export y no se inventa uno.
  assert.equal(shouldWriteSitemap({ command: "export", outputDirExists: false }), false);
  assert.equal(shouldWriteSitemap(), false);
});

test("el subcomando de la CLI se lee salteando las banderas", () => {
  assert.equal(readCommand(["node", "cli", "export", "--platform", "web"]), "export");
  assert.equal(readCommand(["node", "cli", "--no-telemetry", "start"]), "start");
  assert.equal(readCommand(["node", "cli"]), null);
});

test("el argv de la CLI viaja al generador por variable de entorno", () => {
  // El generador corre como proceso hijo: su `process.argv` habla de él mismo.
  const argv = ["node", "cli", "export", "--platform", "web"];
  assert.deepEqual(parentArgv({ [PARENT_ARGV_ENV]: JSON.stringify(argv) }), argv);
  // Sin la variable, o con basura adentro, no se adivina un export.
  assert.deepEqual(parentArgv({}), []);
  assert.deepEqual(parentArgv({ [PARENT_ARGV_ENV]: "{no es json" }), []);
  assert.deepEqual(parentArgv({ [PARENT_ARGV_ENV]: '"export"' }), []);
  assert.equal(shouldWriteSitemap({ command: readCommand(parentArgv({})), outputDirExists: true }), false);
});
