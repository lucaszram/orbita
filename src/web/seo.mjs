/**
 * Órbita — la ficha de buscador de la web pública. FUENTE ÚNICA.
 *
 * Acá viven el dominio, el título y la descripción del sitio, y la tabla de las
 * seis rutas públicas indexables con su propio título y su propia descripción.
 * Lo consumen tres mundos distintos, y por eso el archivo es JavaScript plano
 * (ESM, sin dependencias) en vez de TypeScript:
 *
 *   1. el bundle web —`app/+html.tsx` y `RouteHead`— vía Metro;
 *   2. `scripts/generate-sitemap.mjs`, que corre en Node puro durante el export
 *      (lo dispara `metro.config.js`) y no puede leer TypeScript;
 *   3. la suite (`test/webSearchPreview.test.ts`), que compara lo que se emite
 *      contra lo que se declara acá.
 *
 * Duplicar el dominio o la descripción en `app.json`, en el sitemap o en un
 * `<Head>` es exactamente el defecto que esta tarjeta vino a cerrar: hasta
 * ahora TODAS las rutas compartían título, descripción y canónica.
 */

export const SITE_ORIGIN = "https://orbitaastrologia.xyz";
export const SITE_NAME = "Órbita";
export const SITE_LANG = "es";
export const SITE_LOCALE = "es_AR";
export const THEME_COLOR = "#07080A";

export const SITE_TITLE = "Órbita — tu carta natal, leída todos los días";
export const SITE_DESCRIPTION =
  "Órbita calcula tu carta natal con tu fecha, hora y lugar de nacimiento, y la lee cada día junto a tus tránsitos y tu carta de Tarot. Entretenimiento, autoconocimiento y contexto diario.";

/**
 * Estáticos de marca. Viven en `public/`, así que se sirven SIEMPRE desde la
 * misma URL (Metro no les pone hash) — que es lo que un buscador cachea.
 */
export const BRAND_ICON_PATH = "/orbita-icon-192.png";
export const BRAND_ICON_SIZE = 192;
export const OG_IMAGE_PATH = "/orbita-og.jpg";
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_ALT =
  "Fondo orbital de Órbita: un planeta anillado y órbitas de cobre sobre negro.";

/** Lo que se le pide al buscador en una ruta pública y en una privada. */
export const ROBOTS_PUBLIC = "index, follow, max-image-preview:large, max-snippet:-1";
export const ROBOTS_PRIVATE = "noindex, nofollow";

/**
 * Las SEIS rutas públicas indexables, con su ficha propia.
 *
 * El orden es el del sitemap: primero la portada, después las dos puertas de
 * cuenta y al final las legales. Cualquier otra ruta de la web —todo lo que
 * cuelga de `(tabs)`, el pago, las lecturas, las herramientas internas— es
 * privada por defecto y sale con `noindex, nofollow`.
 *
 * Las descripciones respetan `docs/voz-copy-orbita.md`: vos, tildes, y ninguna
 * promesa de destino, salud, dinero ni decisiones legales.
 */
export const PUBLIC_ROUTES = [
  {
    path: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION
  },
  {
    path: "/empezar",
    title: "Empezar en Órbita — armá tu carta natal",
    description:
      "Cargá tu fecha, hora y lugar de nacimiento y Órbita dibuja tu carta natal: Sol, Luna, ascendente y casas. Es el mapa sobre el que después se lee tu día."
  },
  {
    path: "/iniciar-sesion",
    title: "Entrar a Órbita",
    description:
      "Volvé a tu cuenta de Órbita con tu email. Tu carta natal, tus lecturas guardadas y tu diario te esperan donde los dejaste; si todavía no tenés cuenta, podés crearla acá."
  },
  {
    path: "/privacy",
    title: "Política de privacidad — Órbita",
    description:
      "Qué datos te pide Órbita, para qué los usa, qué proveedores intervienen y cómo podés revisarlos, corregirlos o eliminar tu cuenta desde tu perfil."
  },
  {
    path: "/terminos",
    title: "Términos y condiciones — Órbita",
    description:
      "Las condiciones de uso de Órbita: qué es el servicio, cómo funciona tu cuenta, cómo se contrata y se cancela Órbita Plus, y qué alcance tiene lo que leés en la app."
  },
  {
    path: "/support",
    title: "Soporte — Órbita",
    description:
      "Ayuda de Órbita: cómo cambiar tus datos de nacimiento, cómo eliminar tu cuenta, cómo cancelar Órbita Plus y a qué correo escribirnos si algo no funciona."
  }
];

/** Sólo las rutas, en el orden del sitemap. */
export const PUBLIC_PATHS = PUBLIC_ROUTES.map((route) => route.path);

/**
 * Normaliza lo que devuelve `usePathname()` a una clave de la tabla.
 *
 * Expo Router entrega `/terminos` sin barra final y `/` para la portada, pero
 * un enlace externo puede traer `/terminos/`: las dos formas son la MISMA ruta
 * y no pueden salir con canónicas distintas.
 */
export function normalizePath(pathname) {
  if (typeof pathname !== "string" || pathname === "") return "/";
  const [withoutHash] = pathname.split("#");
  const [clean] = withoutHash.split("?");
  if (clean === "" || clean === "/") return "/";
  const trimmed = clean.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** La ficha de una ruta pública, o `null` si esa ruta no se indexa. */
export function publicRoute(pathname) {
  const path = normalizePath(pathname);
  return PUBLIC_ROUTES.find((route) => route.path === path) ?? null;
}

export function isPublicPath(pathname) {
  return publicRoute(pathname) !== null;
}

/**
 * URL absoluta de una ruta. La portada canoniza al raíz CON barra final (es la
 * canónica que el sitio ya publicaba y la que Google tiene indexada); el resto
 * canoniza sin barra final, que es como Vercel las sirve con `cleanUrls`.
 */
export function canonicalUrl(pathname) {
  const path = normalizePath(pathname);
  return path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;
}

/**
 * Nombre del HTML que el export estático emite para una ruta. Expo Router
 * escribe `index.html` para la portada y `<ruta>.html` para el resto.
 */
export function htmlFileForPath(pathname) {
  const path = normalizePath(pathname);
  return path === "/" ? "index.html" : `${path.slice(1)}.html`;
}

/** URL absoluta de un estático de `public/` (imagen de compartido, ícono). */
export function absoluteUrl(path) {
  return `${SITE_ORIGIN}${path}`;
}

/**
 * Datos estructurados del SITIO, iguales en todas las rutas: quién publica y
 * cómo se llama. Nada de reseñas, precios ni ratings inventados.
 */
export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_ORIGIN}/#website`,
        url: `${SITE_ORIGIN}/`,
        name: SITE_NAME,
        inLanguage: SITE_LANG,
        description: SITE_DESCRIPTION,
        publisher: { "@id": `${SITE_ORIGIN}/#organization` }
      },
      {
        "@type": "Organization",
        "@id": `${SITE_ORIGIN}/#organization`,
        name: SITE_NAME,
        url: `${SITE_ORIGIN}/`,
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl(BRAND_ICON_PATH),
          width: BRAND_ICON_SIZE,
          height: BRAND_ICON_SIZE
        }
      }
    ]
  };
}

/**
 * El sitemap, armado con las MISMAS URLs que las canónicas de cada ruta. Es una
 * función pura: recibe el `lastmod` en vez de mirar el reloj, así el generador
 * y la suite pueden compararla contra un valor fijo.
 *
 * `<changefreq>` y `<priority>` no se declaran: Google los ignora.
 */
export function buildSitemapXml(lastmod) {
  const urls = PUBLIC_ROUTES.map(
    (route) =>
      `  <url>\n    <loc>${canonicalUrl(route.path)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
  ).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<!--",
    "  Órbita — mapa del sitio público. GENERADO: no se edita a mano.",
    "",
    "  Lo escribe `scripts/generate-sitemap.mjs` durante `expo export` (lo",
    "  dispara `metro.config.js`) a partir de `src/web/seo.mjs`, que es la misma",
    "  fuente que usan las canónicas de cada ruta. Editarlo acá se pierde en el",
    "  próximo build.",
    "-->",
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    ""
  ].join("\n");
}
