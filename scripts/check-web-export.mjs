#!/usr/bin/env node
// Órbita — límites del export web.
//
// Corre sobre un `dist/` YA construido (`pnpm build:web`); no compila nada. Sin
// dependencias: sólo `node:fs`, `node:path` y `node:zlib`.
//
//   pnpm check:web-export [ruta-a-dist]
//
// Falla (exit 1) si:
//   · el export completo pasa de 50 MB;
//   · alguna imagen emitida pasa de 500 KB;
//   · el JavaScript de aplicación comprimido pasa de 1,25 MB;
//   · falta alguno de los estáticos públicos (favicon, ícono de marca, imagen
//     de compartido, robots, sitemap);
//   · alguna de las seis rutas públicas no emitió su documento, o lo emitió sin
//     su ficha propia (título, descripción, canónica, `og:url`, datos
//     estructurados) o con la canónica de otra;
//   · alguna ruta privada salió sin `noindex`;
//   · el sitemap no enumera exactamente las mismas URLs que las canónicas;
//   · quedó un marcador de plantilla sin sustituir;
//   · la portada emitida no trae el texto REAL de la landing.
//
// Las decisiones son puras (`evaluateExport`, `evaluatePublicSeo`) y están
// testeadas en `test/webExportLimits.test.ts`. Este archivo sólo agrega I/O y
// reporte.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

import {
  PUBLIC_ROUTES,
  ROBOTS_PRIVATE,
  ROBOTS_PUBLIC,
  canonicalUrl,
  htmlFileForPath
} from "../src/web/seo.mjs";

export const KB = 1024;
export const MB = 1024 * 1024;

export const DEFAULT_LIMITS = {
  totalBytes: 50 * MB,
  imageBytes: 500 * KB,
  appJsGzipBytes: Math.round(1.25 * MB)
};

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".bmp", ".ico", ".svg"];
const FONT_EXTENSIONS = [".ttf", ".otf", ".woff", ".woff2", ".eot"];

/** Bytes → texto legible. Se usa en el reporte y en los mensajes de fallo. */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return String(bytes);
  if (Math.abs(bytes) >= MB) return `${(bytes / MB).toFixed(2)} MB`;
  if (Math.abs(bytes) >= KB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${bytes} B`;
}

/**
 * Clasifica una ruta RELATIVA a `dist/`.
 *
 * `appJs` es únicamente el JavaScript de aplicación que emite Metro bajo
 * `_expo/static/js/web/`. Los source maps salen ANTES que el `.js` (un
 * `entry-x.js.map` termina en `.map`, no en `.js`) y las fuentes van aparte:
 * el límite de JS comprimido no puede contarlos, y el de imagen tampoco.
 */
export function classifyEntry(relativePath) {
  const posix = relativePath.split(sep).join("/");
  const lower = posix.toLowerCase();

  if (lower.endsWith(".map")) return "sourceMap";
  if (FONT_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "font";
  if (IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "image";
  if (lower.endsWith(".js") && lower.startsWith("_expo/static/js/web/")) return "appJs";
  return "other";
}

/**
 * Decisión pura. No toca el disco: recibe lo ya medido y devuelve el veredicto.
 *
 * `appJs` viene con el tamaño COMPRIMIDO ya calculado, porque el límite de
 * 1,25 MB es sobre lo que viaja por la red, no sobre el archivo en disco.
 */
export function evaluateExport(measured, limits = DEFAULT_LIMITS) {
  const { totalBytes, images = [], appJs = [] } = measured;
  const failures = [];

  if (totalBytes > limits.totalBytes) {
    failures.push({
      check: "total",
      message: `el export completo mide ${formatBytes(totalBytes)} y el límite es ${formatBytes(limits.totalBytes)}`,
      offenders: []
    });
  }

  const oversizedImages = images
    .filter((image) => image.bytes > limits.imageBytes)
    .sort((a, b) => b.bytes - a.bytes);
  if (oversizedImages.length > 0) {
    failures.push({
      check: "image",
      message: `${oversizedImages.length} imagen(es) pasan el límite de ${formatBytes(limits.imageBytes)}`,
      offenders: oversizedImages.map((image) => `${image.path} — ${formatBytes(image.bytes)}`)
    });
  }

  // Si no hay JS de aplicación es que cambió la ruta del bundle: sin esto el
  // gate pasaría en verde midiendo cero y dejaría de proteger nada.
  if (appJs.length === 0) {
    failures.push({
      check: "appJs",
      message: "no se encontró JavaScript de aplicación en `_expo/static/js/web/` — revisá la ruta del bundle antes de confiar en este gate",
      offenders: []
    });
  } else {
    const gzipBytes = appJs.reduce((sum, file) => sum + file.gzipBytes, 0);
    if (gzipBytes > limits.appJsGzipBytes) {
      failures.push({
        check: "appJs",
        message: `el JavaScript de aplicación comprimido mide ${formatBytes(gzipBytes)} y el límite es ${formatBytes(limits.appJsGzipBytes)}`,
        offenders: appJs
          .slice()
          .sort((a, b) => b.gzipBytes - a.gzipBytes)
          .map((file) => `${file.path} — ${formatBytes(file.gzipBytes)} gzip`)
      });
    }
  }

  return { ok: failures.length === 0, failures };
}

/**
 * Estáticos que la web pública necesita servir desde su propia URL, sin hash.
 * `favicon.ico` lo genera Expo desde `expo.web.favicon`; el ícono, la imagen de
 * compartido y `robots.txt` salen de `public/`; `index.html` y `sitemap.xml` los
 * produce el export (el documento lo renderiza `app/+html.tsx`, el mapa lo
 * escribe `scripts/generate-sitemap.mjs`). Si alguno faltara, el sitio publicado
 * se quedaría sin robots, sin mapa o sin el ícono declarado y nada avisaría.
 */
export const REQUIRED_PUBLIC_FILES = [
  "favicon.ico",
  "index.html",
  "orbita-icon-192.png",
  "orbita-og.jpg",
  "robots.txt",
  "sitemap.xml"
];

/**
 * Marcas del SITIO que todo documento emitido conserva, venga de la ruta que
 * venga. Cada entrada es `[qué es, cómo se reconoce]`.
 */
const REQUIRED_SITE_MARKS = [
  ["el ícono de marca de 192 px", /<link rel="icon" type="image\/png" sizes="192x192"/],
  ["los datos estructurados", /<script type="application\/ld\+json">/],
  ["el arranque sin hidratación", /__EXPO_ROUTER_HYDRATE__=false/]
];

/**
 * Marcadores que no pueden llegar publicados. Los dos primeros son los de la
 * plantilla SPA que esta web ya no usa (volverían si alguien recreara
 * `public/index.html`); los otros dos son el resultado de renderizar un valor
 * que no existe.
 */
const HTML_PLACEHOLDERS = ["%LANG_ISO_CODE%", "%WEB_TITLE%", "content=\"undefined\"", "[object Object]"];

/** Contenido del primer `<title>` del documento (el que gana en el navegador). */
export function readTitle(html) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? null;
}

/** `content` de un `<meta>` identificado por `name` o `property`. */
export function readMeta(html, key, name) {
  return html.match(new RegExp(`<meta[^>]*\\b${key}="${name}"[^>]*\\bcontent="([^"]*)"`, "i"))?.[1] ?? null;
}

/** `href` del `<link rel="canonical">`. */
export function readCanonical(html) {
  return html.match(/<link[^>]*\brel="canonical"[^>]*\bhref="([^"]*)"/i)?.[1] ?? null;
}

/** URLs `<loc>` del sitemap, en orden. */
export function readSitemapLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

/**
 * Decisión pura sobre la ficha de búsqueda del export. No toca el disco.
 *
 * @param {{
 *   paths?: string[],
 *   documents?: Record<string, string>,
 *   sitemap?: string | null
 * }} [input] `documents` va indexado por la ruta del HTML dentro de `dist/`.
 */
export function evaluatePublicSeo({ paths = [], documents = {}, sitemap = null } = {}) {
  const failures = [];
  const emitted = new Set(paths);

  const missing = REQUIRED_PUBLIC_FILES.filter((file) => !emitted.has(file));
  if (missing.length > 0) {
    failures.push({
      check: "publicFiles",
      message: `faltan ${missing.length} estático(s) público(s) en la raíz del export`,
      offenders: missing
    });
  }

  // --- una ficha propia por ruta pública ------------------------------------
  const sinDocumento = [];
  const sinFicha = [];
  const canonicalsVistas = new Map();

  for (const route of PUBLIC_ROUTES) {
    const file = htmlFileForPath(route.path);
    const html = documents[file];
    if (typeof html !== "string") {
      sinDocumento.push(`${route.path} — falta ${file}`);
      continue;
    }

    const canonical = canonicalUrl(route.path);
    const declarada = readCanonical(html);
    const problemas = [];
    if (readTitle(html) !== route.title) problemas.push("título propio");
    if (readMeta(html, "name", "description") !== route.description) problemas.push("meta description");
    if (declarada !== canonical) problemas.push(`canónica ${canonical}`);
    if (readMeta(html, "property", "og:url") !== canonical) problemas.push("og:url coherente");
    if (readMeta(html, "property", "og:title") !== route.title) problemas.push("og:title");
    if (readMeta(html, "property", "og:description") !== route.description) problemas.push("og:description");
    if (readMeta(html, "name", "robots") !== ROBOTS_PUBLIC) problemas.push("robots indexable");
    for (const [label, pattern] of REQUIRED_SITE_MARKS) {
      if (!pattern.test(html)) problemas.push(label);
    }
    if (problemas.length > 0) sinFicha.push(`${file} — falta ${problemas.join(", ")}`);

    // Contra la canónica DECLARADA, no contra la esperada: el defecto que abrió
    // la tarjeta era justamente que todas declaraban la misma (la del raíz).
    if (declarada) {
      const dueño = canonicalsVistas.get(declarada);
      if (dueño) sinFicha.push(`${file} — comparte la canónica ${declarada} con ${dueño}`);
      else canonicalsVistas.set(declarada, file);
    }
  }

  if (sinDocumento.length > 0) {
    failures.push({
      check: "publicRoutes",
      message: `${sinDocumento.length} ruta(s) pública(s) no emitieron su documento`,
      offenders: sinDocumento
    });
  }
  if (sinFicha.length > 0) {
    failures.push({
      check: "publicRoutes",
      message: `${sinFicha.length} documento(s) público(s) salieron sin su ficha propia`,
      offenders: sinFicha
    });
  }

  // --- todo lo demás va cerrado ---------------------------------------------
  const publicFiles = new Set(PUBLIC_ROUTES.map((route) => htmlFileForPath(route.path)));
  const abiertas = Object.entries(documents)
    .filter(([file]) => !publicFiles.has(file))
    .filter(([, html]) => readMeta(html, "name", "robots") !== ROBOTS_PRIVATE)
    .map(([file]) => file);
  if (abiertas.length > 0) {
    failures.push({
      check: "privateRoutes",
      message: `${abiertas.length} documento(s) privado(s) salieron sin \`${ROBOTS_PRIVATE}\``,
      offenders: abiertas.slice(0, 10)
    });
  }

  // --- marcadores sin sustituir ---------------------------------------------
  const leftovers = [];
  for (const [file, html] of Object.entries(documents)) {
    for (const placeholder of HTML_PLACEHOLDERS) {
      if (html.includes(placeholder)) leftovers.push(`${file} — ${placeholder}`);
    }
  }
  if (leftovers.length > 0) {
    failures.push({
      check: "placeholders",
      message: "hay documentos emitidos con marcadores sin sustituir",
      offenders: leftovers.slice(0, 10)
    });
  }

  // --- el sitemap dice lo mismo que las canónicas ---------------------------
  if (sitemap !== null) {
    const locs = readSitemapLocs(sitemap);
    const esperadas = PUBLIC_ROUTES.map((route) => canonicalUrl(route.path));
    const iguales = locs.length === esperadas.length && locs.every((loc, i) => loc === esperadas[i]);
    if (!iguales) {
      failures.push({
        check: "sitemap",
        message: `el sitemap enumera ${locs.length} URL(s) y las canónicas públicas son ${esperadas.length}`,
        offenders: [`sitemap: ${locs.join(", ") || "(vacío)"}`, `canónicas: ${esperadas.join(", ")}`]
      });
    }
  }

  return { ok: failures.length === 0, failures };
}

/**
 * Piso de texto visible de la portada emitida. La landing real ronda los 4.000
 * caracteres; con menos de esto lo que salió no es la portada sino un spinner,
 * un gate o un documento vacío — que es exactamente el modo de falla del render
 * estático y el que ningún build reportaba.
 */
export const LANDING_MIN_TEXT = 1500;

/** Texto visible de un fragmento de HTML, con el espacio colapsado. */
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Encabezados del documento, como `[nivel, texto]`. */
export function readHeadings(html) {
  return [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => [
    Number(m[1]),
    visibleText(m[2])
  ]);
}

/**
 * La portada emitida dice lo MISMO que la landing que ve una persona.
 *
 * Antes de CORE-272 el documento traía un bloque de HTML plano escrito a mano
 * (`#orbita-pre-js`) porque la SPA llegaba con `#root` vacío, y había una
 * regresión que comparaba frase por frase ese bloque contra el componente real
 * para que no pudiera decir otra cosa. Con el render estático ese bloque ya no
 * existe: `dist/index.html` ES `OrbitaLanding` renderizado. El guard se mudó
 * acá, al HTML EMITIDO, y sigue preguntando lo mismo —¿el texto que lee un
 * buscador está en el componente que ve una persona?— más lo que antes no podía
 * fallar y ahora sí: que la portada haya renderizado algo.
 *
 * @param {{ indexHtml?: string | null, landingSource?: string | null }} [input]
 */
export function evaluateLandingHtml({ indexHtml = null, landingSource = null } = {}) {
  const failures = [];

  if (landingSource === null) {
    failures.push({
      check: "landing",
      message: "no pude leer `src/components/web/orbita-landing.tsx`: sin el componente real no hay con qué comparar la portada emitida",
      offenders: []
    });
    return { ok: false, failures };
  }

  // Sin documento no hay nada que revisar, y la falta ya la reporta
  // `evaluatePublicSeo`: no se duplica el fallo.
  if (indexHtml === null) return { ok: failures.length === 0, failures };

  const body = indexHtml.slice(indexHtml.indexOf("<body"), indexHtml.indexOf("</body>"));
  const texto = visibleText(body);
  if (texto.length < LANDING_MIN_TEXT) {
    failures.push({
      check: "landing",
      message: `la portada emitida tiene ${texto.length} caracteres de texto visible y el piso es ${LANDING_MIN_TEXT}: no renderizó la landing`,
      offenders: [texto.slice(0, 160) || "(documento sin texto)"]
    });
  }

  const headings = readHeadings(body);
  const h1 = headings.filter(([level]) => level === 1);
  if (h1.length !== 1) {
    failures.push({
      check: "landing",
      message: `la portada emitida tiene ${h1.length} encabezado(s) de nivel 1 y tiene que tener exactamente uno`,
      offenders: h1.map(([, text]) => text)
    });
  }

  const fuente = landingSource.replace(/\s+/g, " ");
  const inventados = headings.filter(([, text]) => text && !fuente.includes(text));
  if (inventados.length > 0) {
    failures.push({
      check: "landing",
      message: `${inventados.length} encabezado(s) de la portada emitida no están en \`orbita-landing.tsx\`: el HTML no puede decir algo distinto de lo que se ve`,
      offenders: inventados.map(([level, text]) => `h${level} — ${text}`)
    });
  }

  return { ok: failures.length === 0, failures };
}

/** Recorre `dist/` y devuelve cada archivo con su ruta relativa y su tamaño. */
export function collectFiles(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push({ path: relative(root, full).split(sep).join("/"), bytes: statSync(full).size });
    }
  };
  walk(root);
  return files;
}

/** Mide un `dist/` real y arma el input de `evaluateExport`. */
export function measureExport(root) {
  const files = collectFiles(root);
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const images = [];
  const appJs = [];

  for (const file of files) {
    const kind = classifyEntry(file.path);
    if (kind === "image") images.push(file);
    // `level: 9` para que la medición no dependa del default del runtime.
    else if (kind === "appJs") appJs.push({ ...file, gzipBytes: gzipSync(readFileSync(join(root, file.path)), { level: 9 }).length });
  }

  return { totalBytes, fileCount: files.length, images, appJs, paths: files.map((file) => file.path) };
}

/** Lee un archivo del export, o `null` si no está. */
function readOptional(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** Todos los HTML emitidos, indexados por su ruta dentro de `dist/`. */
function readDocuments(root, paths) {
  const documents = {};
  for (const path of paths) {
    if (!path.endsWith(".html")) continue;
    const html = readOptional(join(root, path));
    if (html !== null) documents[path] = html;
  }
  return documents;
}

function main(argv) {
  const root = argv[2] ?? "dist";

  try {
    if (!statSync(root).isDirectory()) throw new Error("no es un directorio");
  } catch {
    console.error(`✗ no encontré el export en \`${root}\`. Construilo primero con \`pnpm build:web\`.`);
    return 1;
  }

  const measured = measureExport(root);
  const limits = evaluateExport(measured);
  const documents = readDocuments(root, measured.paths);
  const documentCount = Object.keys(documents).length;
  const seo = evaluatePublicSeo({
    paths: measured.paths,
    documents,
    sitemap: readOptional(join(root, "sitemap.xml"))
  });
  const landing = evaluateLandingHtml({
    indexHtml: documents["index.html"] ?? null,
    landingSource: readOptional(join(import.meta.dirname, "..", "src", "components", "web", "orbita-landing.tsx"))
  });
  const failures = [...limits.failures, ...seo.failures, ...landing.failures];
  const appJsGzip = measured.appJs.reduce((sum, file) => sum + file.gzipBytes, 0);
  const biggestImage = measured.images.slice().sort((a, b) => b.bytes - a.bytes)[0];

  console.log(`Órbita · límites del export web (\`${root}\`, ${measured.fileCount} archivos)`);
  console.log(`  export completo      ${formatBytes(measured.totalBytes)}  / ${formatBytes(DEFAULT_LIMITS.totalBytes)}`);
  console.log(
    `  imagen más pesada    ${biggestImage ? `${formatBytes(biggestImage.bytes)}  / ${formatBytes(DEFAULT_LIMITS.imageBytes)}   ${biggestImage.path}` : "sin imágenes emitidas"}`
  );
  console.log(
    `  JS de app (gzip)     ${formatBytes(appJsGzip)}  / ${formatBytes(DEFAULT_LIMITS.appJsGzipBytes)}   ${measured.appJs.length} archivo(s)`
  );
  console.log(
    `  ficha de búsqueda    ${seo.ok ? "completa" : "INCOMPLETA"}   ${REQUIRED_PUBLIC_FILES.length} estáticos + ${documentCount} documento(s), ${PUBLIC_ROUTES.length} de ellos públicos`
  );
  console.log(`  portada emitida      ${landing.ok ? "con el texto real de la landing" : "SIN el texto real de la landing"}`);

  if (failures.length === 0) {
    console.log("✓ el export entra en todos los límites y publica la ficha completa.");
    return 0;
  }

  console.error("");
  for (const failure of failures) {
    console.error(`✗ ${failure.message}`);
    for (const offender of failure.offenders) console.error(`    ${offender}`);
  }
  return 1;
}

// Sólo corre como CLI; importado desde los tests no ejecuta nada. `pathToFileURL`
// y no `file://${argv[1]}`: una ruta con espacios o acentos no compara igual.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv));
}
