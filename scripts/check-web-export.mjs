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
//     de compartido, robots, sitemap) o el `index.html` emitido perdió los
//     metadatos de la ficha de búsqueda.
//
// Las decisiones son puras (`evaluateExport`, `evaluatePublicSeo`) y están
// testeadas en `test/webExportLimits.test.ts`. Este archivo sólo agrega I/O y
// reporte.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

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
 * Los cinco últimos salen de `public/`; `favicon.ico` lo genera Expo desde
 * `expo.web.favicon`. Si Expo dejara de copiar `public/` —o si alguien borrara
 * uno de esos archivos— hoy nada avisaría: el export saldría en verde y el
 * sitio publicado se quedaría sin robots, sin sitemap o sin el ícono declarado.
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
 * Marcas que el `index.html` EMITIDO tiene que conservar. La suite ya revisa la
 * plantilla de `public/`; acá se revisa lo que realmente se publica, que es lo
 * único que ve Google. Cada entrada es `[qué es, cómo se reconoce]`.
 */
const REQUIRED_HTML_MARKS = [
  ["la canónica productiva", /<link rel="canonical" href="https:\/\/orbitaastrologia\.xyz\/"/],
  ["el ícono de marca de 192 px", /<link rel="icon" type="image\/png" sizes="192x192"/],
  ["el contenido inicial de la landing", /<div id="orbita-pre-js">/],
  ["los datos estructurados", /<script type="application\/ld\+json">/],
  ["la meta description que inyecta Expo", /<meta name="description" content="[^"]+"/]
];

/** Marcadores sin sustituir: el documento saldría con el literal a la vista. */
const HTML_PLACEHOLDERS = ["%LANG_ISO_CODE%", "%WEB_TITLE%"];

/**
 * Decisión pura sobre la ficha de búsqueda del export. No toca el disco:
 * recibe las rutas emitidas y el `index.html` ya leído (`null` si no existe).
 *
 * @param {{ paths?: string[], indexHtml?: string | null }} [input]
 */
export function evaluatePublicSeo({ paths = [], indexHtml = null } = {}) {
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

  if (indexHtml === null) {
    // Sin documento no hay nada que revisar, y la falta ya la reporta el bloque
    // de arriba: no se duplica el fallo.
    return { ok: failures.length === 0, failures };
  }

  const missingMarks = REQUIRED_HTML_MARKS.filter(([, pattern]) => !pattern.test(indexHtml));
  if (missingMarks.length > 0) {
    failures.push({
      check: "indexHtml",
      message: `el \`index.html\` emitido perdió ${missingMarks.length} metadato(s) de la ficha de búsqueda`,
      offenders: missingMarks.map(([label]) => label)
    });
  }

  const leftovers = HTML_PLACEHOLDERS.filter((placeholder) => indexHtml.includes(placeholder));
  if (leftovers.length > 0) {
    failures.push({
      check: "indexHtml",
      message: "el `index.html` emitido conserva marcadores de la plantilla sin sustituir",
      offenders: leftovers
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
  let indexHtml = null;
  try {
    indexHtml = readFileSync(join(root, "index.html"), "utf8");
  } catch {
    // Sin `index.html` no hay documento: lo reporta `evaluatePublicSeo`.
  }
  const seo = evaluatePublicSeo({ paths: measured.paths, indexHtml });
  const failures = [...limits.failures, ...seo.failures];
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
    `  ficha de búsqueda    ${seo.ok ? "completa" : "INCOMPLETA"}   ${REQUIRED_PUBLIC_FILES.length} estáticos + metadatos del \`index.html\``
  );

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
