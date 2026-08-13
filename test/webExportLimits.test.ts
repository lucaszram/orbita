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
  MB,
  REQUIRED_PUBLIC_FILES,
  classifyEntry,
  evaluateExport,
  evaluatePublicSeo,
  formatBytes
} from "../scripts/check-web-export.mjs";

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

const HTML_OK = [
  '<link rel="canonical" href="https://orbitaastrologia.xyz/" />',
  '<link rel="icon" type="image/png" sizes="192x192" href="/orbita-icon-192.png" />',
  '<script type="application/ld+json">{}</script>',
  '<meta name="description" content="Órbita calcula tu carta natal…">',
  '<div id="root"><div id="orbita-pre-js">Una carta para hoy.</div></div>'
].join("\n");

const seoOk = { paths: [...REQUIRED_PUBLIC_FILES, "_expo/static/js/web/entry-abc.js"], indexHtml: HTML_OK };

test("la ficha de búsqueda exige los estáticos que se sirven por URL propia", () => {
  // Los cinco de `public/` más el `.ico` que genera Expo. Ninguno lleva hash:
  // el buscador cachea esas URLs.
  assert.deepEqual(REQUIRED_PUBLIC_FILES, [
    "favicon.ico",
    "index.html",
    "orbita-icon-192.png",
    "orbita-og.jpg",
    "robots.txt",
    "sitemap.xml"
  ]);
  assert.equal(evaluatePublicSeo(seoOk).ok, true);
});

test("un export sin robots ni sitemap falla y los nombra", () => {
  // El defecto real: `public/` no se copió y esas dos URLs caían en el rewrite
  // de la SPA, que devolvía el `index.html`.
  const verdict = evaluatePublicSeo({
    ...seoOk,
    paths: seoOk.paths.filter((p) => p !== "robots.txt" && p !== "sitemap.xml")
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.failures[0].check, "publicFiles");
  assert.deepEqual(verdict.failures[0].offenders, ["robots.txt", "sitemap.xml"]);
});

test("un `index.html` sin ícono de marca o sin contenido inicial falla", () => {
  const sinIcono = evaluatePublicSeo({ ...seoOk, indexHtml: HTML_OK.replace(/<link rel="icon"[^>]+>/, "") });
  assert.equal(sinIcono.ok, false);
  assert.deepEqual(sinIcono.failures[0].offenders, ["el ícono de marca de 192 px"]);

  // El documento de antes de este arreglo: `#root` vacío y ningún metadato.
  const sinContenido = evaluatePublicSeo({ ...seoOk, indexHtml: '<div id="root"></div>' });
  assert.equal(sinContenido.ok, false);
  assert.ok(
    sinContenido.failures[0].offenders.includes("el contenido inicial de la landing"),
    "el bloque que le da extracto al buscador es de los que se revisan"
  );
  assert.equal(sinContenido.failures[0].offenders.length, 5);
});

test("un `index.html` con marcadores sin sustituir falla", () => {
  // Escribir un marcador dos veces en la plantilla deja el literal publicado y
  // el build no se queja.
  const verdict = evaluatePublicSeo({ ...seoOk, indexHtml: `${HTML_OK}\n<title>%WEB_TITLE%</title>` });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.failures[0].check, "indexHtml");
  assert.deepEqual(verdict.failures[0].offenders, ["%WEB_TITLE%"]);
});

test("sin `index.html` se reporta el archivo faltante una sola vez", () => {
  const verdict = evaluatePublicSeo({ paths: seoOk.paths.filter((p) => p !== "index.html"), indexHtml: null });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.failures.length, 1);
  assert.deepEqual(verdict.failures[0].offenders, ["index.html"]);
});
