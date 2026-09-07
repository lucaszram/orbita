import { usePathname, useSegments } from "expo-router";
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

import {
  BRAND_ICON_PATH,
  BRAND_ICON_SIZE,
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  ROBOTS_PRIVATE,
  ROBOTS_PUBLIC,
  SITE_LANG,
  SITE_LOCALE,
  SITE_NAME,
  THEME_COLOR,
  absoluteUrl,
  isPublicPath,
  siteJsonLd
} from "@/web/seo.mjs";

/**
 * Documento raíz de la web (`expo.web.output: "static"`).
 *
 * Reemplaza a `public/index.html`, que ya no existe: con el render estático
 * Expo NO usa esa plantilla —lo hace sólo en el modo SPA (`exportApp.ts`)— sino
 * este componente, que `expo-router` levanta desde `app/+html.tsx`
 * (`expo-router/_ctx-html` + `getRootComponent`). Con la plantilla se fueron
 * también sus dos trampas: los marcadores `%…%` que Expo sustituía con un
 * `String.replace` y los cierres de `head`/`body` que había que escribir una
 * sola vez.
 *
 * Acá va SÓLO lo que es igual en todas las rutas. El título, la descripción, la
 * canónica, el `og:url` y el `robots` son por ruta y los pone `RouteHead`
 * (`@/web/route-head`), que Expo inyecta arriba de este `<head>`.
 *
 * Los valores no se escriben a mano: salen de `@/web/seo.mjs`, la misma fuente
 * que usan las canónicas y el sitemap.
 */
export default function Root({ children }: PropsWithChildren) {
  // El documento raíz vive DENTRO del `NavigationContainer` (Expo Router lo
  // monta como `wrapper` del árbol), así que sabe qué ruta se está emitiendo.
  //
  // Los segmentos deciden aparte de la ruta: el export emite una VARIACIÓN por
  // cada grupo (`dist/(tabs)/index.html` además de `dist/index.html`), y esas
  // copias comparten pathname con la ruta real. Se indexa sólo la de verdad.
  const segments = useSegments() as string[];
  const isGroupVariation = segments.some((segment) => segment.startsWith("("));
  const indexable = !isGroupVariation && isPublicPath(usePathname());

  return (
    <html lang={SITE_LANG}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/*
          Ícono de marca EXPLÍCITO. No reemplaza al `favicon.ico` que genera
          Expo desde `expo.web.favicon` (16/32/48, válido y ya publicado, y que
          Expo inyecta solo al final del head): lo refuerza. Esa inyección va
          sin `sizes` ni `type`, así que acá se declara el MISMO emblema a
          192×192 —cuadrado y múltiplo de 48, como pide la guía de favicons de
          Google— de forma explícita y autodescripta.
        */}
        <link
          rel="icon"
          type="image/png"
          sizes={`${BRAND_ICON_SIZE}x${BRAND_ICON_SIZE}`}
          href={BRAND_ICON_PATH}
        />
        <link rel="apple-touch-icon" sizes={`${BRAND_ICON_SIZE}x${BRAND_ICON_SIZE}`} href={BRAND_ICON_PATH} />
        <meta name="theme-color" content={THEME_COLOR} />

        {/*
          Qué se indexa y qué no, decidido acá y no ruta por ruta.

          Sólo las seis rutas de `PUBLIC_ROUTES` se dejan indexar; TODO lo demás
          —lo que cuelga de `(tabs)`, el pago, el checkout, las lecturas, el
          backoffice, el lab, el studio— sale con `noindex, nofollow`. Vive en el
          documento porque es el único punto por el que pasan las 91 páginas
          emitidas: las rutas generadas por Expo Router (`+not-found`,
          `_sitemap`) se dibujan FUERA del layout raíz, así que un `<Head>` en el
          layout no las alcanzaría y quedarían abiertas.
        */}
        <meta name="robots" content={indexable ? ROBOTS_PUBLIC : ROBOTS_PRIVATE} />

        {/*
          Open Graph / Twitter del SITIO. Lo que cambia por ruta —título,
          descripción y URL— lo pone `RouteHead`; acá queda lo invariante.
        */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:locale" content={SITE_LOCALE} />
        <meta property="og:image" content={absoluteUrl(OG_IMAGE_PATH)} />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:width" content={String(OG_IMAGE_WIDTH)} />
        <meta property="og:image:height" content={String(OG_IMAGE_HEIGHT)} />
        <meta property="og:image:alt" content={OG_IMAGE_ALT} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={absoluteUrl(OG_IMAGE_PATH)} />

        {/*
          Datos estructurados mínimos y verificables: quién publica el sitio y
          cómo se llama. Nada de reseñas, precios ni ratings inventados. Van en
          todas las rutas porque describen al SITIO, no a la página.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd()) }}
        />

        {/* Reset recomendado de react-native-web para una app a pantalla completa. */}
        <ScrollViewStyleReset />
      </head>
      <body>
        {children}
        {/*
          La app arranca con `createRoot`, NO con `hydrateRoot`.

          El export estático inyecta `__EXPO_ROUTER_HYDRATE__ = true` al final
          del `<head>` y `registerRootComponent` lo lee para hidratar. Acá se
          apaga: el HTML emitido es la cáscara PÚBLICA (ver
          `@/web/static-document`) y el primer render del navegador es el árbol
          REAL —con sus proveedores, su sesión y sus gates—, así que los dos
          árboles no coinciden y una hidratación terminaría descartando el
          documento igual, con un error de consola de regalo. Vaciar `#root` y
          montar de cero es exactamente lo que la web ya hacía cuando el
          documento traía el bloque plano `#orbita-pre-js`.

          El orden importa y es el que hace que esto funcione: los módulos
          diferidos corren en el orden del documento, así que este —último hijo
          del `<body>`— pisa al del `<head>` y el bundle, que va después, lee
          `false`. `scripts/check-web-export.mjs` verifica ese orden en el HTML
          emitido.
        */}
        <script
          type="module"
          dangerouslySetInnerHTML={{ __html: "globalThis.__EXPO_ROUTER_HYDRATE__=false;" }}
        />
      </body>
    </html>
  );
}
