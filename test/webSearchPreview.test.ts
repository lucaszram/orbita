/**
 * La ficha de Órbita en un buscador: ícono, extracto, robots y sitemap.
 *
 * Existe por dos defectos reales de producción, más un refuerzo. Los tres viven
 * en archivos estáticos que ningún build validaba:
 *
 *   1. `robots.txt` y `sitemap.xml` no existían, y el rewrite de la SPA se
 *      quedaba con esos pedidos: las dos URLs devolvían el `index.html`;
 *   2. el documento llegaba con `#root` vacío, así que el buscador no tenía
 *      contenido del cual sacar el extracto y se quedó con el aviso en inglés
 *      de la plantilla por defecto de Expo;
 *   3. el ícono. OJO con la historia: el `favicon.ico` publicado es VÁLIDO
 *      (200, enlazado, con frame de 48×48 además de 16 y 32; auditado en
 *      producción el 2026-08-11). El globo genérico que se vio en Google se
 *      explica por un crawl viejo, no por un favicon roto. Lo que se agrega acá
 *      es una declaración explícita, estable y más grande del mismo emblema,
 *      que cumple la guía de favicons de Google — un refuerzo, no un arreglo.
 *
 * Se afirma sobre las FUENTES (`public/`): el export no está disponible en la
 * suite y el error se comete acá. El `dist/` real lo revisa
 * `scripts/check-web-export.mjs`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ROOT } from "./moduleGraph";

const PUBLIC = join(ROOT, "public");
const html = readFileSync(join(PUBLIC, "index.html"), "utf8");
const robots = readFileSync(join(PUBLIC, "robots.txt"), "utf8");
const sitemap = readFileSync(join(PUBLIC, "sitemap.xml"), "utf8");
const landing = readFileSync(join(ROOT, "src", "components", "web", "orbita-landing.tsx"), "utf8");
const appJson = JSON.parse(readFileSync(join(ROOT, "app.json"), "utf8")) as {
  expo: { web?: { name?: string; description?: string } };
};

const SITIO = "https://orbitaastrologia.xyz/";
const ICONO = "/orbita-icon-192.png";
const OG = "/orbita-og.jpg";

/** Colapsa todo espacio en blanco: el mismo texto parte líneas distinto en JSX y en HTML. */
const norm = (texto: string) => texto.replace(/\s+/g, " ").trim();

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
    html,
    new RegExp(`<link rel="icon" type="image/png" sizes="192x192" href="${ICONO}" />`),
    "el `.ico` que inyecta Expo va sin `sizes` ni `type`: esta es la declaración que se describe a sí misma"
  );
  assert.match(html, new RegExp(`<link rel="apple-touch-icon" sizes="192x192" href="${ICONO}" />`));
});

test("el ícono existe, es cuadrado y su lado es múltiplo de 48", () => {
  const path = join(PUBLIC, ICONO.slice(1));
  assert.ok(existsSync(path), `falta ${ICONO}: la declaración del documento apuntaría a un 404`);
  const { width, height } = pngSize(path);
  // La guía de favicons de Google pide cuadrado y de lado múltiplo de 48 px.
  assert.equal(width, height, "un favicon que no es cuadrado queda fuera de la guía");
  assert.equal(width % 48, 0, "un lado que no es múltiplo de 48 px queda fuera de la guía");
  assert.equal(width, 192);
});

test("el ícono se sirve desde `public/`, con URL estable y sin hash", () => {
  // Un asset del bundle sale con hash y cambia en cada build: el buscador
  // cachea la URL del favicon durante semanas.
  assert.doesNotMatch(ICONO, /[0-9a-f]{16,}/, "la URL del ícono no puede llevar hash de build");
  assert.ok(existsSync(join(PUBLIC, ICONO.slice(1))));
});

// --- 2. Metadatos de compartido y datos estructurados ------------------------

test("Open Graph y Twitter repiten EXACTAMENTE el título y la descripción de `app.json`", () => {
  const titulo = appJson.expo.web?.name ?? "";
  const descripcion = appJson.expo.web?.description ?? "";
  assert.ok(titulo && descripcion);

  for (const tag of [
    `<meta property="og:title" content="${titulo}" />`,
    `<meta name="twitter:title" content="${titulo}" />`
  ]) {
    assert.ok(html.includes(tag), `falta o difiere: ${tag}`);
  }
  // La descripción va partida en varias líneas en el documento.
  const metas = norm(html);
  assert.ok(metas.includes(`property="og:description" content="${descripcion}"`));
  assert.ok(metas.includes(`name="twitter:description" content="${descripcion}"`));
});

test("las URLs de compartido son absolutas y del dominio productivo", () => {
  assert.match(html, new RegExp(`<meta property="og:url" content="${SITIO}" />`));
  assert.match(html, new RegExp(`<meta property="og:image" content="https://orbitaastrologia\\.xyz${OG}" />`));
  assert.match(html, new RegExp(`<meta name="twitter:image" content="https://orbitaastrologia\\.xyz${OG}" />`));
  assert.match(html, /<meta property="og:type" content="website" \/>/);
  assert.match(html, /<meta property="og:site_name" content="Órbita" \/>/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/);
});

test("la imagen de compartido existe y mide lo que declara", () => {
  const path = join(PUBLIC, OG.slice(1));
  assert.ok(existsSync(path), `falta ${OG}`);
  const { width, height } = jpegSize(path);
  assert.equal(width, 1200);
  assert.equal(height, 630);
  assert.match(html, new RegExp(`<meta property="og:image:width" content="${width}" />`));
  assert.match(html, new RegExp(`<meta property="og:image:height" content="${height}" />`));
});

test("el documento se deja indexar", () => {
  assert.match(html, /<meta name="robots" content="index, follow[^"]*" \/>/);
  assert.doesNotMatch(html, /content="[^"]*noindex/);
});

test("los datos estructurados son JSON válido, del sitio real y sin claims inventados", () => {
  const bloque = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(bloque, "falta el bloque JSON-LD");
  const data = JSON.parse(bloque[1]) as { "@context": string; "@graph": Array<Record<string, any>> };
  assert.equal(data["@context"], "https://schema.org");

  const tipos = data["@graph"].map((n) => n["@type"]);
  assert.deepEqual(tipos, ["WebSite", "Organization"]);

  const [site, org] = data["@graph"];
  assert.equal(site.url, SITIO);
  assert.equal(site.name, "Órbita");
  assert.equal(site.description, appJson.expo.web?.description);
  assert.equal(site.publisher["@id"], org["@id"]);
  assert.equal(org.logo.url, `https://orbitaastrologia.xyz${ICONO}`);
  assert.equal(org.logo.width, 192);

  // Guardrail de producto: nada de reseñas, ratings ni precios fabricados.
  for (const prohibido of ["aggregateRating", "review", "offers", "price"]) {
    assert.doesNotMatch(bloque[1], new RegExp(`"${prohibido}"`, "i"), `${prohibido} sería inventado`);
  }
});

// --- 3. El contenido inicial (lo que lee el buscador sin ejecutar JS) --------

const PRE_JS = (() => {
  const desde = html.indexOf('<div id="orbita-pre-js">');
  assert.ok(desde > 0, "falta el contenido inicial de la landing");
  return html.slice(desde, html.indexOf("</body>"));
})();

/** Texto visible del bloque inicial, frase por frase (sin el aviso de no-JS). */
const FRASES = PRE_JS.replace(/<noscript>[\s\S]*?<\/noscript>/g, "")
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<[^>]+>/g, "\n")
  .split("\n")
  .map(norm)
  .filter((linea) => /\p{L}/u.test(linea));

test("el contenido inicial vive DENTRO de `#root`, que es lo que React vacía al montar", () => {
  // `createRoot` (no `hydrateRoot`: `__EXPO_ROUTER_HYDRATE__` sólo lo define el
  // renderizado estático) limpia el contenedor en su primer commit. Fuera de
  // `#root` este bloque quedaría para siempre debajo de la app.
  const root = html.indexOf('<div id="root">');
  assert.ok(root > 0 && root < html.indexOf('<div id="orbita-pre-js">'));
  assert.doesNotMatch(html, /__EXPO_ROUTER_HYDRATE__/);
});

test("el contenido inicial trae la portada real: encabezado, promesa y acciones", () => {
  assert.match(PRE_JS, /<h1>Una carta para hoy\. Contexto para todos los días\.<\/h1>/);
  assert.equal((PRE_JS.match(/<h1>/g) ?? []).length, 1, "un solo H1");
  assert.match(PRE_JS, /<h2>Todo se lee sobre tu carta\.<\/h2>/);
  assert.match(PRE_JS, /<h2>Tu cielo, todos los días\.<\/h2>/);
  // Enlaces reales: el buscador (y una persona sin JS todavía cargado) llega a
  // las rutas públicas antes de que monte la SPA.
  for (const [href, ruta] of [
    ["/empezar", "app/empezar.tsx"],
    ["/iniciar-sesion", "app/iniciar-sesion.tsx"],
    ["/privacy", "app/privacy.tsx"],
    ["/terminos", "app/terminos.tsx"],
    ["/support", "app/support.tsx"]
  ]) {
    assert.match(PRE_JS, new RegExp(`href="${href}"`), `el contenido inicial no enlaza ${href}`);
    assert.ok(existsSync(join(ROOT, ruta)), `${href} no tiene ruta real (${ruta})`);
  }
});

test("cada frase del contenido inicial es copy REAL de la landing (nada de cloaking)", () => {
  const landingNorm = norm(landing);
  assert.ok(FRASES.length >= 20, "el bloque quedó demasiado pobre para servir de extracto");
  for (const frase of FRASES) {
    assert.ok(
      landingNorm.includes(frase),
      `“${frase}” no está en la landing: el HTML inicial no puede decir algo distinto de lo que se ve`
    );
  }
});

test("el contenido inicial no está oculto por ningún truco", () => {
  const estilos = html.match(/<style id="orbita-prejs-style">([\s\S]*?)<\/style>/);
  assert.ok(estilos, "falta la hoja de estilos del bloque inicial");
  for (const truco of [
    /display\s*:\s*none/i,
    /visibility\s*:\s*hidden/i,
    /opacity\s*:\s*0(?![.\d])/i,
    /font-size\s*:\s*0/i,
    /text-indent\s*:\s*-/i,
    /position\s*:\s*absolute/i,
    /clip(-path)?\s*:/i,
    /(?:left|top)\s*:\s*-/i,
    /height\s*:\s*0/i
  ]) {
    assert.doesNotMatch(estilos[1], truco, "un bloque escondido es cloaking, no SEO");
  }
  assert.doesNotMatch(PRE_JS, /aria-hidden|\shidden(?:=|\s|>)/);
  // Y todo el estilo cuelga del bloque: cuando React lo borra no queda ninguna
  // regla suelta que pueda pisar a la app.
  for (const regla of estilos[1].split("}")) {
    const selector = regla.split("{")[0].trim();
    if (!selector) continue;
    for (const parte of selector.split(",")) {
      assert.match(parte.trim(), /^#orbita-pre-js\b/, `regla fuera de alcance: ${parte.trim()}`);
    }
  }
});

// --- 4. robots.txt y sitemap.xml --------------------------------------------

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
  }
});

test("el sitemap no contradice la canónica de la SPA", () => {
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length > 0, "un sitemap vacío no sirve de nada");
  // Todas las rutas se sirven desde el mismo documento y ese documento declara
  // una sola canónica: listar otra URL sería pedirle a Google que crawlee algo
  // que él mismo va a descartar.
  const canonica = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  assert.equal(canonica, SITIO);
  for (const loc of locs) assert.equal(loc, canonica);
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
});
