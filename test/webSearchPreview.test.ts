/**
 * La ficha de Órbita en un buscador: una por ruta pública.
 *
 * Existe por tres defectos reales de producción, más un refuerzo:
 *
 *   1. `robots.txt` y `sitemap.xml` no existían, y el rewrite de la SPA se
 *      quedaba con esos pedidos: las dos URLs devolvían el `index.html`;
 *   2. el documento llegaba con `#root` vacío, así que el buscador no tenía
 *      contenido del cual sacar el extracto y se quedó con el aviso en inglés
 *      de la plantilla por defecto de Expo;
 *   3. (CORE-272) TODAS las rutas —`/`, `/empezar`, `/privacy`, `/terminos`,
 *      `/support`— se servían desde el mismo documento, con el mismo título, la
 *      misma descripción y una canónica fija al raíz: para Google el sitio
 *      entero era una sola página, y el sitemap tenía que declarar una sola URL
 *      para no contradecirla;
 *   4. el ícono. OJO con la historia: el `favicon.ico` publicado es VÁLIDO
 *      (200, enlazado, con frame de 48×48 además de 16 y 32; auditado en
 *      producción el 2026-08-11). El globo genérico que se vio en Google se
 *      explica por un crawl viejo, no por un favicon roto. Lo que se agrega es
 *      una declaración explícita, estable y más grande del mismo emblema — un
 *      refuerzo, no un arreglo.
 *
 * Se afirma sobre las FUENTES (`src/web/seo.mjs`, `app/+html.tsx`, `public/`):
 * el export no está disponible en la suite y el error se comete acá. El `dist/`
 * real lo revisa `scripts/check-web-export.mjs`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ROOT } from "./moduleGraph";
import {
  BRAND_ICON_PATH,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  PUBLIC_PATHS,
  PUBLIC_ROUTES,
  SITE_DESCRIPTION,
  SITE_ORIGIN,
  buildSitemapXml,
  canonicalUrl,
  htmlFileForPath,
  isPublicPath,
  normalizePath,
  siteJsonLd
} from "../src/web/seo.mjs";

const PUBLIC = join(ROOT, "public");
const documento = readFileSync(join(ROOT, "app", "+html.tsx"), "utf8");
const routeHead = readFileSync(join(ROOT, "src", "web", "route-head.tsx"), "utf8");
const staticDocument = readFileSync(join(ROOT, "src", "web", "static-document.tsx"), "utf8");
const robots = readFileSync(join(PUBLIC, "robots.txt"), "utf8");

/** Sin comentarios: los dos archivos cuentan su historia en prosa, y esas
 *  menciones no son marcado ni código. */
const sinComentarios = (x: string) =>
  x.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SITIO = `${SITE_ORIGIN}/`;

// --- medidas reales de los assets (no lo que dice el `<meta>`) ---------------

/** Ancho y alto de un PNG: firma de 8 bytes + IHDR con las dos medidas. */
function pngSize(path: string) {
  const buf = readFileSync(path);
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${path} no es un PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Ancho y alto de un JPEG: el primer marcador SOF trae las medidas del cuadro. */
function jpegSize(path: string) {
  const buf = readFileSync(path);
  assert.equal(buf.readUInt16BE(0), 0xffd8, `${path} no es un JPEG`);
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    // SOF0..SOF15 salvo DHT (C4), JPG (C8) y DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      i += 2;
      continue;
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error(`${path}: no encontré el marcador SOF`);
}

// --- 1. Ícono de marca -------------------------------------------------------

test("el documento declara un ícono de marca propio, PNG y cuadrado", () => {
  assert.match(
    documento,
    /rel="icon"[\s\S]{0,120}type="image\/png"[\s\S]{0,120}href=\{BRAND_ICON_PATH\}/,
    "el `.ico` que inyecta Expo va sin `sizes` ni `type`: esta es la declaración que se describe a sí misma"
  );
  assert.match(documento, /rel="apple-touch-icon"[\s\S]{0,120}href=\{BRAND_ICON_PATH\}/);
});

test("el ícono existe, es cuadrado y su lado es múltiplo de 48", () => {
  const path = join(PUBLIC, BRAND_ICON_PATH.slice(1));
  assert.ok(existsSync(path), `falta ${BRAND_ICON_PATH}: la declaración del documento apuntaría a un 404`);
  const { width, height } = pngSize(path);
  // La guía de favicons de Google pide cuadrado y de lado múltiplo de 48 px.
  assert.equal(width, height, "un favicon que no es cuadrado queda fuera de la guía");
  assert.equal(width % 48, 0, "un lado que no es múltiplo de 48 px queda fuera de la guía");
  assert.equal(width, 192);
});

test("el ícono se sirve desde `public/`, con URL estable y sin hash", () => {
  // Un asset del bundle sale con hash y cambia en cada build: el buscador
  // cachea la URL del favicon durante semanas.
  assert.doesNotMatch(BRAND_ICON_PATH, /[0-9a-f]{16,}/, "la URL del ícono no puede llevar hash de build");
  assert.ok(existsSync(join(PUBLIC, BRAND_ICON_PATH.slice(1))));
});

// --- 2. Metadatos de compartido y datos estructurados ------------------------

test("Open Graph y Twitter repiten EXACTAMENTE el título y la descripción de CADA ruta", () => {
  // Antes se comparaba contra `app.json`, que era la única fuente para todo el
  // sitio. Ahora la fuente es la tabla de rutas y hay que repetirla por ruta.
  assert.match(routeHead, /<meta property="og:title" content=\{route\.title\} \/>/);
  assert.match(routeHead, /<meta property="og:description" content=\{route\.description\} \/>/);
  assert.match(routeHead, /<meta name="twitter:title" content=\{route\.title\} \/>/);
  assert.match(routeHead, /<meta name="twitter:description" content=\{route\.description\} \/>/);
  assert.match(routeHead, /<title>\{route\.title\}<\/title>/);
  assert.match(routeHead, /<meta name="description" content=\{route\.description\} \/>/);
});

test("las URLs de compartido son absolutas y del dominio productivo", () => {
  assert.match(routeHead, /<meta property="og:url" content=\{canonical\} \/>/);
  assert.match(documento, /property="og:image" content=\{absoluteUrl\(OG_IMAGE_PATH\)\}/);
  assert.match(documento, /name="twitter:image" content=\{absoluteUrl\(OG_IMAGE_PATH\)\}/);
  assert.match(documento, /property="og:type" content="website"/);
  assert.match(documento, /property="og:site_name" content=\{SITE_NAME\}/);
  assert.match(documento, /name="twitter:card" content="summary_large_image"/);
  for (const path of PUBLIC_PATHS) {
    assert.ok(canonicalUrl(path).startsWith(`${SITE_ORIGIN}/`), `${path} no canoniza al dominio productivo`);
  }
});

test("la imagen de compartido existe y mide lo que declara", () => {
  const path = join(PUBLIC, OG_IMAGE_PATH.slice(1));
  assert.ok(existsSync(path), `falta ${OG_IMAGE_PATH}`);
  const { width, height } = jpegSize(path);
  assert.equal(width, OG_IMAGE_WIDTH);
  assert.equal(height, OG_IMAGE_HEIGHT);
  assert.equal(OG_IMAGE_WIDTH, 1200);
  assert.equal(OG_IMAGE_HEIGHT, 630);
});

test("los datos estructurados son JSON válido, del sitio real y sin claims inventados", () => {
  const data = siteJsonLd();
  assert.equal(data["@context"], "https://schema.org");

  const tipos = data["@graph"].map((n: Record<string, unknown>) => n["@type"]);
  assert.deepEqual(tipos, ["WebSite", "Organization"]);

  const [site, org] = data["@graph"] as Array<Record<string, any>>;
  assert.equal(site.url, SITIO);
  assert.equal(site.name, "Órbita");
  assert.equal(site.description, SITE_DESCRIPTION);
  assert.equal(site.publisher["@id"], org["@id"]);
  assert.equal(org.logo.url, `${SITE_ORIGIN}${BRAND_ICON_PATH}`);
  assert.equal(org.logo.width, 192);

  // Guardrail de producto: nada de reseñas, ratings ni precios fabricados.
  const serializado = JSON.stringify(data);
  for (const prohibido of ["aggregateRating", "review", "offers", "price"]) {
    assert.doesNotMatch(serializado, new RegExp(`"${prohibido}"`, "i"), `${prohibido} sería inventado`);
  }
  // Y viaja en TODAS las rutas, porque describe al sitio y no a la página.
  assert.match(documento, /type="application\/ld\+json"[\s\S]{0,200}siteJsonLd\(\)/);
});

// --- 3. Una ficha propia por ruta pública ------------------------------------

test("las seis rutas públicas son las acordadas y cada una tiene ruta real", () => {
  assert.deepEqual(PUBLIC_PATHS, ["/", "/empezar", "/iniciar-sesion", "/privacy", "/terminos", "/support"]);
  for (const path of PUBLIC_PATHS) {
    if (path === "/") {
      assert.ok(existsSync(join(ROOT, "app", "index.tsx")));
      continue;
    }
    assert.ok(existsSync(join(ROOT, "app", `${path.slice(1)}.tsx`)), `${path} no tiene ruta real en \`app/\``);
  }
});

test("ninguna ruta pública comparte título, descripción ni canónica con otra", () => {
  // El defecto que abrió esta tarjeta: las cinco rutas heredaban la ficha de la
  // portada y para Google el sitio era una sola página.
  for (const campo of ["title", "description"] as const) {
    const valores = PUBLIC_ROUTES.map((route) => route[campo]);
    assert.equal(new Set(valores).size, valores.length, `hay ${campo} repetidos entre rutas públicas`);
  }
  const canonicas = PUBLIC_PATHS.map(canonicalUrl);
  assert.equal(new Set(canonicas).size, canonicas.length);
});

test("la portada canoniza al raíz con barra final y el resto sin ella", () => {
  assert.equal(canonicalUrl("/"), SITIO);
  assert.equal(canonicalUrl("/terminos"), `${SITE_ORIGIN}/terminos`);
  // Un enlace externo con barra final es la MISMA ruta: no puede salir con otra
  // canónica ni caer como si fuera privada.
  assert.equal(canonicalUrl("/terminos/"), `${SITE_ORIGIN}/terminos`);
  assert.equal(normalizePath("/terminos?x=1#y"), "/terminos");
  assert.equal(normalizePath(""), "/");
});

test("cada ruta pública declara su `RouteHead` con su propio path", () => {
  const declaraciones: Array<[string, string]> = [
    ["/", "src/routes/v492/index.web.tsx"],
    ["/empezar", "src/routes/v492/empezar.web.tsx"],
    ["/iniciar-sesion", "app/iniciar-sesion.tsx"],
    ["/privacy", "src/routes/v492/privacy.web.tsx"],
    ["/terminos", "src/routes/v492/terminos.web.tsx"],
    ["/support", "src/routes/v492/support.web.tsx"]
  ];
  assert.equal(declaraciones.length, PUBLIC_ROUTES.length);
  for (const [path, file] of declaraciones) {
    const codigo = readFileSync(join(ROOT, file), "utf8");
    assert.match(codigo, new RegExp(`<RouteHead path="${path}" />`), `${file} no declara su ficha`);
  }
});

test("el layout raíz cierra el resto sin que las públicas lo hereden", () => {
  const layout = readFileSync(join(ROOT, "app", "_layout.tsx"), "utf8");
  assert.match(layout, /<RouteHead privateOnly \/>/);
  assert.match(routeHead, /if \(privateOnly && route\) return null;/);
  // Y en nativo la ficha no existe: no hay documento ni buscador.
  assert.ok(existsSync(join(ROOT, "src", "web", "route-head.native.tsx")));
});

test("los textos de cada ruta siguen la voz y los guardrails de Órbita", () => {
  for (const route of PUBLIC_ROUTES) {
    assert.match(route.title, /Órbita/, `${route.path}: el título no nombra a Órbita`);
    assert.ok(route.title.length <= 70, `${route.path}: el título se corta en los buscadores`);
    assert.ok(route.description.length >= 80, `${route.path}: la descripción es demasiado corta`);
    assert.ok(route.description.length <= 320, `${route.path}: la descripción se corta en los buscadores`);
    // Sin destino, salud, dinero ni decisiones legales prometidas.
    for (const prohibido of [/predice/i, /predicción/i, /destino/i, /garantiz/i, /\bsalud\b/i, /\bdinero\b/i]) {
      assert.doesNotMatch(`${route.title} ${route.description}`, prohibido, `${route.path}: claim prohibido`);
    }
  }
});

test("las descripciones legales salen de lo que esas páginas ya dicen", () => {
  const legal = readFileSync(join(ROOT, "src", "components", "web", "orbita-legal.tsx"), "utf8");
  const claves: Array<[string, string[]]> = [
    ["/privacy", ["Qué datos", "proveedores", "eliminar tu cuenta"]],
    ["/terminos", ["Órbita Plus", "cancel", "cuenta"]],
    ["/support", ["datos de nacimiento", "eliminar tu cuenta", "cancel"]]
  ];
  for (const [path, temas] of claves) {
    const route = PUBLIC_ROUTES.find((r) => r.path === path)!;
    for (const tema of temas) {
      assert.ok(
        legal.toLowerCase().includes(tema.toLowerCase()),
        `${path}: la descripción promete "${tema}" y la página no lo trata`
      );
      assert.ok(
        route.description.toLowerCase().includes(tema.toLowerCase()),
        `${path}: la descripción no menciona "${tema}"`
      );
    }
  }
});

// --- 4. El HTML público es el componente real (nada de cloaking) -------------

test("la cáscara estática monta los componentes REALES, no una copia del texto", () => {
  // El documento traía un bloque de HTML plano escrito a mano (`#orbita-pre-js`)
  // porque la SPA llegaba con `#root` vacío. Con el render estático la portada y
  // las legales se emiten renderizando los MISMOS componentes que ve una
  // persona: no hay una segunda copia del copy que pueda desincronizarse.
  assert.match(staticDocument, /"\/": OrbitaLanding/);
  assert.match(staticDocument, /"\/privacy": OrbitaPrivacy/);
  assert.match(staticDocument, /"\/support": OrbitaSupport/);
  assert.match(staticDocument, /"\/terminos": OrbitaTerms/);
  assert.match(staticDocument, /from "@\/components\/web\/orbita-landing"/);
  assert.match(staticDocument, /from "@\/components\/web\/orbita-legal"/);
  // Y no queda ningún resto del bloque plano.
  assert.doesNotMatch(sinComentarios(documento), /orbita-pre-js/);
  assert.doesNotMatch(sinComentarios(staticDocument), /orbita-pre-js/);
});

test("el render estático no toca `window`, `document` ni `localStorage`", () => {
  assert.match(staticDocument, /typeof window === "undefined"/);
  const layout = readFileSync(join(ROOT, "app", "_layout.tsx"), "utf8");
  assert.match(layout, /if \(isStaticRender\(\)\) return <WebStaticDocument \/>;/);
  // Y en nativo la cáscara web ni se importa: el bundle nativo no empaqueta la
  // landing ni las legales (mismo motivo que `src/routes/v492`).
  const nativa = readFileSync(join(ROOT, "src", "web", "static-document.native.tsx"), "utf8");
  assert.match(nativa, /return false;/);
  assert.doesNotMatch(nativa, /orbita-landing|orbita-legal/);
});

// --- 5. robots.txt y sitemap.xml --------------------------------------------

test("robots.txt es un archivo real, abre el sitio y publica el sitemap", () => {
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, new RegExp(`^Sitemap: ${SITIO}sitemap\\.xml$`, "m"));
  // Bloquear el bundle impediría que Google renderice la landing completa.
  assert.doesNotMatch(robots, /Disallow:\s*\/(_expo|assets|$)/m);
});

test("robots.txt sólo cierra rutas que existen y no son públicas", () => {
  const cerradas = [...robots.matchAll(/^Disallow: (\S+)$/gm)].map((m) => m[1]);
  assert.deepEqual(cerradas, ["/backoffice", "/lab", "/studio", "/checkout/"]);
  for (const ruta of cerradas) {
    const base = join(ROOT, "app", ruta.replace(/^\/|\/$/g, ""));
    assert.ok(existsSync(`${base}.tsx`) || existsSync(base), `robots cierra ${ruta}, que no existe`);
    assert.equal(isPublicPath(ruta), false, `${ruta} está cerrada en robots y abierta en la tabla pública`);
  }
});

test("el sitemap se GENERA y ya no vive como archivo estático", () => {
  // Escrito a mano quedaba desactualizado y contradecía a las canónicas: por eso
  // sólo podía declarar una URL. Ahora lo escribe `scripts/generate-sitemap.mjs`
  // durante el export, desde la misma tabla que las canónicas.
  assert.equal(existsSync(join(PUBLIC, "sitemap.xml")), false);
  assert.ok(existsSync(join(ROOT, "scripts", "generate-sitemap.mjs")));
  const metro = readFileSync(join(ROOT, "metro.config.js"), "utf8");
  assert.match(metro, /scripts\/generate-sitemap\.mjs/, "el export tiene que dispararlo solo");
  assert.match(metro, /--only-on-export/, "y sólo cuando la corrida es un `expo export`");
});

test("el sitemap enumera las seis rutas públicas con la MISMA URL que su canónica", () => {
  const xml = buildSitemapXml("2026-09-07T12:00:00.000Z");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, PUBLIC_PATHS.map(canonicalUrl));
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  // `lastmod` ISO en cada entrada; `changefreq` y `priority` los ignora Google.
  assert.equal((xml.match(/<lastmod>2026-09-07T12:00:00\.000Z<\/lastmod>/g) ?? []).length, locs.length);
  assert.doesNotMatch(xml, /changefreq|priority/);
});

test("cada ruta pública emite su propio archivo HTML en el export", () => {
  assert.deepEqual(PUBLIC_PATHS.map(htmlFileForPath), [
    "index.html",
    "empezar.html",
    "iniciar-sesion.html",
    "privacy.html",
    "terminos.html",
    "support.html"
  ]);
});

test("`cleanUrls` sirve esos archivos y el catch-all cae en un destino SIN extensión", () => {
  const vercel = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as {
    cleanUrls?: boolean;
    rewrites?: Array<{ source: string; destination: string }>;
    routes?: unknown;
  };
  // Sin `cleanUrls`, `/terminos` no matchea ningún archivo y cae en el rewrite
  // catch-all: volvería a servirse el documento de la portada.
  assert.equal(vercel.cleanUrls, true);

  // El catch-all es lo único que sostiene a las rutas dinámicas, que no tienen
  // HTML propio: sin él, `/vinculos/abc123` no llega nunca al router del cliente.
  const rewrites = vercel.rewrites ?? [];
  const catchAll = rewrites.find((rewrite) => rewrite.source === "/(.*)");
  assert.ok(catchAll, "falta el rewrite catch-all: toda ruta sin documento propio sería un 404 del servidor");

  // Y con `cleanUrls` ningún destino puede llevar extensión: Vercel deja de
  // servir los `.html` por su nombre de archivo, así que el rewrite no resuelve.
  // Medido con curl el 2026-09-07 sobre el preview del PR 117 (commit fa061ee),
  // que tenía `"destination": "/index.html"`: /transitos/arco/ejemplo-123,
  // /vinculos/abc123, /vinculos/abc123/comparacion y /reading/xyz devolvieron
  // http=404, mientras /terminos, /transitos y /checkout/success —que sí emiten
  // su documento— devolvían 200. La combinación es la que rompe, no el catch-all.
  for (const { source, destination } of rewrites) {
    const archivo = destination.split(/[?#]/)[0].split("/").pop() ?? "";
    assert.doesNotMatch(
      archivo,
      /\.[A-Za-z0-9]+$/,
      `el rewrite de \`${source}\` apunta a \`${destination}\`: con \`cleanUrls\` un destino con extensión es 404`
    );
  }

  // El destino es la URL limpia del documento de la portada, que es adonde caían
  // estas rutas antes de la tarjeta.
  assert.equal(catchAll.destination, "/index");
  assert.equal(`${catchAll.destination.slice(1)}.html`, htmlFileForPath("/"));

  // `routes` desactiva `cleanUrls` y los rewrites: no se migra.
  assert.equal(vercel.routes, undefined);
});
