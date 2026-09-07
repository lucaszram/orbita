/**
 * El cliente de telemetría de la web (CORE-183).
 *
 * Hoy la web productiva no registra ninguna visita: el bundle salía sin SDK y
 * PostHog no recibe un solo evento del dominio desde el 2026-08-09. Sin visitas
 * no hay retención, no hay adquisición y no hay forma de leer si un cambio del
 * producto sirvió. Este módulo es la única cosa que captura en la web, y captura
 * un solo evento: `$pageview`, con las siete propiedades del contrato v1.0.0.
 *
 * ## Qué NO hace, a propósito
 *
 * Sin autocapture, sin session replay, sin heatmaps, sin encuestas, sin
 * `$pageleave`, sin web vitals y sin captura de excepciones: todo eso se apaga
 * en la configuración y, si algo se colara igual, `before_send` lo descarta
 * porque sólo deja pasar `$pageview`. Sin `identify`, sin `alias` y sin `reset`:
 * la identidad de persona es de otra tarjeta y acá queda el distinct ID anónimo
 * que el SDK sortea solo (contrato, sección 7).
 *
 * ## Por qué el SDK entra por `dist/module.slim`
 *
 * El paquete trae dos builds. El completo pesa 92 KB comprimidos y la mitad es
 * lo que esta tarjeta apaga: grabador de sesión, encuestas, autocapture,
 * captura de excepciones. El `slim` trae el núcleo —`init`, `capture`,
 * `before_send`, la misma configuración y los mismos tipos— y pesa 49 KB. El
 * JavaScript de la web ya venía en 1,20 MB comprimidos contra un techo de 1,25
 * (`scripts/check-web-export.mjs`): con el build completo el export no entra, y
 * con el `slim` entra. Que las extensiones no estén en el bundle además hace
 * estructural lo que la configuración sólo pide.
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
 * Qué se emite, con qué propiedades y qué se descarta lo decide
 * `routeClassification.ts`, que es puro y está testeado sin navegador. Este
 * archivo hace tres cosas: resolver la configuración, montar el cliente y
 * preguntar en cada cambio de ruta.
 */
import Constants from "expo-constants";
import { usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import posthog, { type PostHog, type PostHogConfig } from "posthog-js/dist/module.slim";

import {
  canCapture,
  normalizeEnvironment,
  type ConsentState,
  type Environment
} from "@/analytics/eventContract";
import {
  PAGEVIEW_EVENT,
  decidePageview,
  pageviewWarning,
  retainedProperties
} from "@/analytics/routeClassification";

/**
 * Cuánto se espera a que la ruta se asiente antes de contar la visita.
 *
 * El contrato dice que una redirección intermedia NO es un `$pageview`, y la web
 * de Órbita redirige seguido: `/login` a `/iniciar-sesion`, `/profile` a
 * `/perfil`, los gates de sesión a la landing o a Home. Un `<Redirect>` de Expo
 * Router pasa por la ruta intermedia durante un instante, así que emitir apenas
 * cambia el pathname contaría dos visitas por cada redirección.
 *
 * Con esta ventana, la visita se cuenta recién cuando la ruta dejó de moverse:
 * si el pathname cambia antes, el efecto se limpia y la intermedia no se emite
 * nunca. No se pierde ninguna navegación real —nadie navega dos veces en 200 ms—
 * y no hace falta enumerar las redirecciones, que es lo que envejece mal.
 */
export const ROUTE_SETTLE_MS = 200;

/**
 * El consentimiento que rige HOY en la web, y por qué.
 *
 * `canCapture` es la puerta: sin `granted` no se inicializa el cliente, no se
 * guarda nada y no sale un solo evento. Lo que este archivo declara es qué
 * estado corresponde hoy, y esa es una lectura, no una invención.
 *
 * El contrato (`docs/analytics/event-contract.md`, sección 8) exige "el
 * consentimiento APLICABLE" y no un banner: no define quién lo otorga ni cuándo,
 * porque eso depende del régimen y del instrumento que rige. En Órbita ese
 * instrumento es hoy la política de privacidad —que esta misma tarjeta actualiza
 * para enumerar a PostHog y decir qué se registra—, y lo que se mide es una
 * visita anónima a una ruta del catálogo, sin URL completa, sin query, sin
 * referrer, sin datos personales y sin publicidad.
 *
 * Ese es el alcance de esta lectura, y su límite: si Órbita decide pedir
 * consentimiento explícito antes de medir (un banner), la decisión cambia acá y
 * en ningún otro lado. No se inventa un banner en esta tarjeta, y queda
 * reportado como decisión pendiente.
 */
function currentConsent(): ConsentState {
  return "granted";
}

/**
 * El entorno sale de la configuración de despliegue y de ningún otro lado.
 *
 * `app.config.js` lee `VERCEL_ENV` en el build y lo deja en `extra.environment`;
 * acá se lo vuelve a normalizar contra el contrato porque lo que llega del
 * bundle es un valor cualquiera hasta que el contrato lo acepta. Sin build de
 * Vercel —local, CI— el valor es `development`. Nunca se mira el hostname ni la
 * clave del proyecto: el proyecto se elige por el entorno, no al revés.
 */
function resolveEnvironment(): Environment {
  const extra = Constants.expoConfig?.extra as { environment?: unknown } | undefined;
  return normalizeEnvironment(extra?.environment) ?? "development";
}

/**
 * El tipo del hook de salida del SDK, derivado de su propia configuración.
 *
 * `CaptureResult` no se exporta desde `posthog-js` sino desde un paquete que
 * Órbita no declara como dependencia, y agregar una dependencia para nombrar un
 * tipo sería peor que derivarlo: acá sale del mismo lugar donde se usa, así que
 * no puede quedar viejo.
 */
type BeforeSend = Extract<NonNullable<PostHogConfig["before_send"]>, (...args: never[]) => unknown>;

/**
 * El último punto antes de la red.
 *
 * Hace dos cosas que la configuración sola no puede: descarta cualquier evento
 * que no sea `$pageview` y reduce las propiedades a la allowlist del contrato.
 * `$set` y `$set_once` se descartan enteros porque ahí es donde viajarían las
 * propiedades iniciales de persona (`$initial_referrer`, `$initial_current_url`).
 */
const beforeSend: BeforeSend = (result) => {
  if (!result) return null;
  // El contrato tiene cinco eventos y esta tarjeta emite uno. Cualquier otra
  // cosa que el SDK quiera mandar —web vitals, excepciones, encuestas— se queda
  // acá, sin depender de que la opción que la apaga siga existiendo.
  if (result.event !== PAGEVIEW_EVENT) return null;
  return {
    ...result,
    properties: retainedProperties(result.properties),
    $set: undefined,
    $set_once: undefined,
    $unset: undefined
  };
};

/**
 * Opciones del SDK: todo lo que captura solo, apagado.
 *
 * El SDK calcula `$current_url`, `$host`, `$pathname`, `$referrer`,
 * `$referring_domain`, los parámetros de campaña y la huella de pantalla ANTES
 * de mirar cualquier opción: no hay forma de pedirle que no los arme, sólo de no
 * dejarlos salir. Eso lo resuelve `beforeSend`, que es el último punto antes de
 * la red.
 */
function clientOptions(apiHost: string) {
  return {
    api_host: apiHost,
    // Nada de captura automática: el único emisor es esta tarjeta.
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    capture_performance: false,
    rageclick: false,
    enable_heatmaps: false,
    disable_session_recording: true,
    disable_surveys: true,
    // Sin cargar scripts externos ni pedir configuración remota: nada de lo que
    // traerían está habilitado, y una respuesta remota no puede volver a
    // encender lo que esta configuración apaga.
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    // El distinct ID anónimo tiene que sobrevivir a la recarga (contrato,
    // sección 7), pero no hace falta una cookie para eso: en `localStorage` el
    // identificador no viaja en cada request al dominio.
    persistence: "localStorage" as const,
    // Sin `identify` no hay persona: los eventos quedan anónimos y el proyecto
    // no crea un perfil por visitante.
    person_profiles: "identified_only" as const,
    // Cinturón sobre el tirante: aunque `before_send` ya borra la URL, el SDK
    // tampoco arma los parámetros de campaña con su valor real.
    mask_personal_data_properties: true,
    before_send: beforeSend
  };
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

function ensureClient(): PostHog | null {
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

  return posthog.init(key, clientOptions(apiHost));
}

/**
 * Un `$pageview` por navegación real, y ninguno por render.
 *
 * El efecto depende de `pathname` y de nada más: React lo vuelve a correr cuando
 * la ruta cambia y no cuando el árbol se vuelve a dibujar. Recargar una ruta es
 * un montaje nuevo y cuenta una vez. Una redirección intermedia limpia el efecto
 * antes de que la ventana de asentamiento termine y no cuenta ninguna.
 *
 * Se monta en el layout raíz y no en cada pantalla: si cada pantalla emitiera lo
 * suyo, la definición de "visita" se partiría en tantas versiones como pantallas.
 */
export function WebPageviewTelemetry() {
  const pathname = usePathname();
  // ¿Es el primer `$pageview` de esta carga? Sólo ése lee el referrer: el
  // documento conserva el suyo aunque la SPA cambie de ruta diez veces.
  const firstOfSession = useRef(true);

  useEffect(() => {
    const posthogClient = ensureClient();
    if (!posthogClient) return;

    const timer = setTimeout(() => {
      const decision = decidePageview({
        pathname,
        referrer: typeof document === "undefined" ? null : document.referrer,
        currentHost: typeof window === "undefined" ? null : window.location.host,
        firstOfSession: firstOfSession.current,
        environment: resolveEnvironment()
      });
      firstOfSession.current = false;

      if (!decision.emit) {
        console.warn(pageviewWarning(decision));
        return;
      }

      posthogClient.capture(PAGEVIEW_EVENT, decision.properties);
    }, ROUTE_SETTLE_MS);

    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}
