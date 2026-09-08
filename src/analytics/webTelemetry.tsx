/**
 * El cliente de telemetría de la web (CORE-183).
 *
 * Hoy la web productiva no registra ninguna visita: el bundle salía sin SDK y
 * PostHog no recibe un solo evento del dominio desde el 2026-08-09. Sin visitas
 * no hay retención, no hay adquisición y no hay forma de leer si un cambio del
 * producto sirvió. Este módulo emite un solo evento —`$pageview`, con las siete
 * propiedades del contrato— y además monta el cliente que comparte el resto de
 * la web: los siete eventos de producto de CORE-188 capturan por el mismo
 * `ensureClient()`, desde `productTelemetry.ts`, y no inicializan nada propio.
 *
 * ## Qué NO hace, a propósito
 *
 * Sin autocapture, sin session replay, sin heatmaps, sin encuestas, sin
 * `$pageleave`, sin web vitals y sin captura de excepciones: todo eso se apaga
 * en la configuración y, si algo se colara igual, `before_send` lo descarta
 * porque sólo deja pasar lo que el diccionario del contrato declara. Tampoco
 * guarda navegación en el dispositivo: el referrer, la URL inicial y los
 * parámetros de campaña que el SDK persiste por defecto quedan apagados y, lo
 * que ninguna opción cubre, se borra en la misma captura
 * (`webClientOptions.ts`).
 *
 * La identidad de persona SÍ está, desde CORE-188, y vive en
 * `productEvents.ts`/`productTelemetry.ts`: `identify` con el identificador
 * interno que el contrato declara y `reset` en los hechos que el contrato nombra
 * (logout, cambio de cuenta, eliminación, retiro de consentimiento). Sin `alias`
 * —el contrato lo reserva para unir dos emisores distintos, y el flujo normal no
 * tiene ese caso— y sin propiedades de persona. Hasta que alguien inicia sesión,
 * lo que viaja sigue siendo el distinct ID anónimo que el SDK sortea solo
 * (contrato, sección 7), y `identify` lo ata a la cuenta cuando aparece.
 *
 * ## Por qué el SDK entra por `dist/module.slim`
 *
 * El paquete trae dos builds. El completo pesa 92 KB comprimidos y la mitad es
 * lo que esta tarjeta apaga: grabador de sesión, encuestas, autocapture,
 * captura de excepciones. El `slim` trae el núcleo —`init`, `capture`,
 * `before_send`, la misma configuración y los mismos tipos— y pesa 49 KB. El
 * JavaScript de la web venía en 1,20 MB comprimidos y el techo del export subió
 * a 1,35 para pagar esta tarjeta (`scripts/check-web-export.mjs`): con el `slim`
 * queda en 1,25 MB y entra con margen; con el build completo no entraría. Que
 * las extensiones no estén en el bundle además hace estructural lo que la
 * configuración sólo pide.
 *
 * Es una ruta profunda del paquete, así que `test/webPageviewTelemetry.test.ts`
 * comprueba que exista: si una versión nueva la mueve, falla la suite y no el
 * deploy.
 *
 * ## Dónde vive
 *
 * Sólo en el navegador. El módulo se importa desde el layout raíz, que es
 * COMPARTIDO, así que la variante nativa (`webTelemetry.native.tsx`) no
 * renderiza nada y no arrastra `posthog-js` al bundle de la app — el mismo
 * patrón de `src/web/route-head.tsx`. Y dentro de la web, el cliente se crea
 * dentro de un efecto: el render estático del export (CORE-272) corre en Node,
 * sin `window`, y ahí no hay nada que medir.
 *
 * ## Las decisiones no están acá
 *
 * Qué se emite y con qué propiedades lo decide `routeClassification.ts`; CUÁNDO
 * se emite lo deciden `bootState.ts` y `pageviewStream.ts`; cómo se configura el
 * SDK, `webClientOptions.ts`. Los cuatro son puros y están testeados sin
 * navegador. Este archivo hace tres cosas: resolver la configuración, montar el
 * cliente y avisar en cada cambio de ruta.
 */
import Constants from "expo-constants";
import { usePathname } from "expo-router";
import { useEffect } from "react";
import posthog, { type PostHog } from "posthog-js/dist/module.slim";

import { canCapture, normalizeEnvironment, type Environment } from "@/analytics/eventContract";
import { trackRoute, type PageviewPort } from "@/analytics/pageviewStream";
import { clientOptions, currentConsent } from "@/analytics/webClientOptions";

/**
 * El entorno sale de la configuración de despliegue y de ningún otro lado.
 *
 * `app.config.js` lee `VERCEL_ENV` en el build y lo deja en `extra.environment`;
 * acá se lo vuelve a normalizar contra el contrato porque lo que llega del
 * bundle es un valor cualquiera hasta que el contrato lo acepta. Sin build de
 * Vercel —local, CI— el valor es `development`. Nunca se mira el hostname ni la
 * clave del proyecto: el proyecto se elige por el entorno, no al revés.
 *
 * Se exporta para que los eventos de producto (CORE-188) resuelvan el entorno
 * por ESTE camino y no por uno propio: dos lecturas distintas serían dos
 * respuestas posibles para la misma pregunta.
 */
export function resolveEnvironment(): Environment {
  const extra = Constants.expoConfig?.extra as { environment?: unknown } | undefined;
  return normalizeEnvironment(extra?.environment) ?? "development";
}

/**
 * El cliente, creado una sola vez.
 *
 * `undefined` es "todavía no se intentó"; `null` es "no corresponde y no se va a
 * intentar de nuevo" —sin `window`, sin consentimiento o sin clave—. Esa
 * distinción es lo que hace que el caso normal de CI (build sin variables) no
 * escriba un aviso por cada cambio de ruta.
 */
let client: PostHog | null | undefined;

/**
 * El cliente compartido por TODO lo que la web captura.
 *
 * Los eventos de producto (CORE-188) entran por acá y no por un `init` propio:
 * dos clientes serían dos distinct IDs anónimos, dos configuraciones y dos
 * `before_send` — y la persona que recorre el alta quedaría partida en dos.
 */
export function ensureClient(): PostHog | null {
  if (client !== undefined) return client;
  client = createClient();
  return client;
}

function createClient(): PostHog | null {
  // Render estático del export (CORE-272): corre en Node y no hay visita que
  // medir. En nativo este archivo ni siquiera se resuelve.
  if (typeof window === "undefined") return null;

  // Sin consentimiento no se inicializa: no se guarda un identificador, no se
  // abre una conexión y no se emite. "Dejar de capturar" no alcanza si el SDK ya
  // escribió el distinct ID en el dispositivo.
  if (!canCapture(currentConsent())) return null;

  // CORE-182: Vercel da una clave distinta por scope. Sin clave no hay cliente,
  // que es exactamente lo que pasa en CI y en un build local sin variables. El
  // valor NO se lee ni se escribe en ningún otro lado: entra por el entorno del
  // build y muere adentro de `init`.
  const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  const apiHost = process.env.EXPO_PUBLIC_POSTHOG_HOST;
  if (!apiHost) {
    // Con clave y sin host, el SDK mandaría al host por defecto del proveedor:
    // un destino que nadie eligió. Se avisa y no se captura.
    console.warn("[orbita] $pageview no emitido: falta EXPO_PUBLIC_POSTHOG_HOST");
    return null;
  }

  // `posthog` es el singleton del SDK y es lo mismo que devuelve `init`: se le
  // pasa como `persisted` para que `before_send` pueda borrar lo que el propio
  // SDK escriba durante la captura, sin esperar a que `init` haya retornado.
  return posthog.init(key, clientOptions({ apiHost, persisted: () => posthog }));
}

/** Todo lo que el contador necesita del navegador, en un solo lugar. */
const browserPort: PageviewPort = {
  capture: (event, properties) => ensureClient()?.capture(event, properties),
  referrer: () => (typeof document === "undefined" ? null : document.referrer),
  currentHost: () => (typeof window === "undefined" ? null : window.location.host),
  environment: resolveEnvironment,
  warn: (message) => console.warn(message)
};

/**
 * Un `$pageview` por navegación real, y ninguno por render.
 *
 * El efecto depende de `pathname` y de nada más: React lo vuelve a correr cuando
 * la ruta cambia y no cuando el árbol se vuelve a dibujar. Lo que hace no es
 * emitir sino AVISAR qué ruta está mostrando el router; si eso se convierte en
 * una visita lo decide `pageviewStream.ts` cuando el arranque queda resuelto, y
 * el contador de rutas ya emitidas vive a nivel de módulo — por eso un remount o
 * el doble efecto de StrictMode no cuentan dos veces.
 *
 * Se monta en el layout raíz y no en cada pantalla: si cada pantalla emitiera lo
 * suyo, la definición de "visita" se partiría en tantas versiones como pantallas.
 */
export function WebPageviewTelemetry() {
  const pathname = usePathname();

  useEffect(() => {
    // Sin cliente no hay nada que contar, y tampoco un aviso por cada ruta: es
    // el caso normal de CI y de un build local sin variables.
    if (!ensureClient()) return;
    trackRoute(pathname, browserPort);
  }, [pathname]);

  return null;
}
