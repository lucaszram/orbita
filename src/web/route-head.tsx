import Head from "expo-router/head";
import { usePathname } from "expo-router";

import { SITE_TITLE, canonicalUrl, publicRoute } from "@/web/seo.mjs";

/**
 * La ficha de buscador de ESTA ruta (CORE-272).
 *
 * Hasta esta tarjeta la web era una SPA: todas las rutas se servían desde el
 * mismo `public/index.html`, con el mismo título y una canónica fija al raíz.
 * Para un buscador el sitio entero era una sola página. Ahora cada ruta emite
 * su propio HTML y cada uno declara acá su título, su descripción, su canónica
 * absoluta y su `og:url`.
 *
 * Se monta en dos lugares y nunca en los dos a la vez:
 *   · en cada una de las seis rutas públicas, con su `path` explícito;
 *   · en el layout raíz, en modo `privateOnly`, que le da a todo lo demás el
 *     título de siempre y ninguna canónica.
 *
 * El `robots` NO se declara acá: lo pone `app/+html.tsx`, que es el único punto
 * por el que pasan las 91 páginas del export —incluidas `+not-found` y
 * `_sitemap`, que se dibujan fuera de este layout—.
 *
 * En nativo no renderiza nada (`route-head.native.tsx`).
 */
export function RouteHead({
  path,
  privateOnly = false
}: {
  /** Ruta declarada por la pantalla. Si falta, se lee la ruta activa. */
  path?: string;
  /** Sólo emitir la ficha cuando la ruta NO es pública. */
  privateOnly?: boolean;
}) {
  const active = usePathname();
  const pathname = path ?? active;
  const route = publicRoute(pathname);

  // El layout raíz declara `privateOnly`: en una ruta pública se aparta y deja
  // que la pantalla ponga su propia ficha, sin competir por el mismo `<title>`.
  if (privateOnly && route) return null;

  if (!route) {
    // Rutas con sesión e internas: sin descripción y sin canónica —no hay nada
    // público que canonizar—. Conservan el título del sitio, que es el que la
    // pestaña ya mostraba en todas las rutas antes de esta tarjeta.
    return (
      <Head>
        <title>{SITE_TITLE}</title>
      </Head>
    );
  }

  const canonical = canonicalUrl(route.path);

  return (
    <Head>
      <title>{route.title}</title>
      <meta name="description" content={route.description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={route.title} />
      <meta property="og:description" content={route.description} />
      <meta property="og:url" content={canonical} />
      <meta name="twitter:title" content={route.title} />
      <meta name="twitter:description" content={route.description} />
    </Head>
  );
}
