/**
 * Cómo se configura el SDK de la web, y qué se le borra después (CORE-183).
 *
 * Está separado de `webTelemetry.tsx` por una razón práctica: acá el SDK entra
 * SÓLO como tipo (`import type`, que Babel borra), así que este módulo se puede
 * importar en una prueba de Node y afirmar sobre el objeto de configuración real
 * —el mismo que recibe `posthog.init`— en vez de sobre el texto del archivo.
 *
 * Lo que el SDK guarda en el dispositivo es tan parte del contrato como lo que
 * manda por la red: `docs/analytics/event-contract.md`, sección 8, prohíbe la
 * query, el fragmento y el referrer crudo, y no dice "en el payload".
 */
import type { PostHogConfig } from "posthog-js/dist/module.slim";

import { isEventName, type ConsentState } from "@/analytics/eventContract";
import { retainedProperties } from "@/analytics/routeClassification";

/**
 * El instrumento de consentimiento que rige HOY en la web.
 *
 * Decisión registrada de Lucas, 2026-09-07: para una visita anónima y
 * sanitizada, el instrumento aplicable es la política de privacidad publicada
 * —que enumera a PostHog y dice qué se registra y qué no—, y no hay banner. La
 * misma aclaración está en el documento del contrato, sección 8, bajo
 * «Aclaración registrada 2026-09-07».
 *
 * Está nombrado, y no escondido detrás de un `"granted"` mudo, porque el
 * contrato (sección 8) exige "el consentimiento APLICABLE" sin decir quién lo
 * otorga: la respuesta es una decisión de producto con fecha, y cuando cambie
 * —un opt-in explícito, un opt-out por región— lo que cambia es `currentConsent`
 * y nada más. Ningún otro archivo pregunta por el consentimiento.
 */
export const CONSENT_INSTRUMENT = "privacy_policy";

/**
 * Qué consentimiento otorga un instrumento, en una plataforma.
 *
 * Devuelve `granted` en un solo caso —la política de privacidad, en la web— y
 * `unknown` en todos los demás, que el contrato trata como un no ("todavía no
 * contestó" es un no). Nativo mide por otro canal
 * (`docs/handoff-claude-product-events.md`) y esta política no lo cubre.
 */
export function consentUnder(
  instrument: string,
  platform: string | null | undefined
): ConsentState {
  if (instrument !== CONSENT_INSTRUMENT) return "unknown";
  if (platform !== "web") return "unknown";
  return "granted";
}

/** El consentimiento vigente para ESTE build. */
export function currentConsent(): ConsentState {
  return consentUnder(CONSENT_INSTRUMENT, process.env.EXPO_OS);
}

/**
 * Lo que el SDK persiste sin preguntar, y este módulo borra.
 *
 * `save_campaign_params: false` y `save_referrer: false` apagan casi todo, pero
 * en el build instalado quedan dos escrituras que ninguna opción cubre —se
 * comprobó leyendo `node_modules/posthog-js`, y la prueba
 * `test/webTelemetryStorage.test.ts` lo verifica corriendo el SDK de verdad—:
 *
 *   · `$client_session_props` (localStorage): el `SessionPropsManager` guarda
 *     `{ r: referrer crudo, u: URL completa }` cada vez que arranca una sesión,
 *     y se construye siempre salvo en modo cookieless —que regeneraría el
 *     distinct ID anónimo y rompería la sección 7 del contrato—;
 *   · `$search_engine` y `ph_keyword` (sessionStorage): `update_search_keyword`
 *     corre en TODA captura, sin ninguna opción que lo condicione, y `ph_keyword`
 *     es literalmente lo que la persona escribió en el buscador.
 *
 * El resto de la lista es cinturón sobre tirante: son las claves que el SDK
 * escribiría si un default cambiara de valor. Que la lista sea una enumeración
 * —y las enumeraciones envejecen— lo cubre la prueba, que no busca estas claves
 * sino que afirma que en el almacenamiento no queda NINGUNA URL ni referrer.
 */
export const PERSISTED_NAVIGATION_KEYS: readonly string[] = [
  "$client_session_props",
  "$initial_person_info",
  "$initial_campaign_params",
  "$initial_referrer_info",
  "$referrer",
  "$referring_domain"
];

/** Lo mismo, en el almacenamiento de sesión (`sessionStorage`). */
export const PERSISTED_SESSION_NAVIGATION_KEYS: readonly string[] = [
  "$search_engine",
  "ph_keyword",
  "$referrer",
  "$referring_domain"
];

/** Lo mínimo del cliente que hace falta para limpiar: dos métodos públicos. */
export type NavigationPersistence = {
  readonly unregister: (property: string) => void;
  readonly unregister_for_session: (property: string) => void;
};

/**
 * Borra del dispositivo lo que el SDK acaba de escribir sobre navegación.
 *
 * Corre dentro de `before_send`, que es el único punto por el que pasan TODAS
 * las capturas —también una que el SDK inicie por su cuenta— y que es síncrono
 * dentro de `capture()`: la escritura y este borrado ocurren en el mismo turno,
 * así que no queda nada guardado entre una captura y la siguiente.
 */
export function purgePersistedNavigation(client: NavigationPersistence | null): void {
  if (!client) return;
  for (const key of PERSISTED_NAVIGATION_KEYS) client.unregister(key);
  for (const key of PERSISTED_SESSION_NAVIGATION_KEYS) client.unregister_for_session(key);
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
 * El único evento que el SDK emite y que no está en el diccionario, pero sale.
 *
 * `identify()` no manda una orden aparte: captura un evento llamado `$identify`
 * con el identificador nuevo y el distinct ID anónimo anterior, y esa captura
 * pasa por `before_send` como cualquier otra. Con la comprobación contra el
 * diccionario a secas, `$identify` se descartaba y la identidad que CORE-188
 * necesita no llegaba nunca — `identify` habría sido una línea de código sin
 * efecto, que es peor que no tenerla.
 *
 * No es una grieta en el filtro: es el ÚNICO nombre permitido fuera del
 * diccionario, está escrito acá, y lo que lleva sigue reducido a la allowlist de
 * transporte y sin `$set` ni `$set_once`. `$create_alias` no está —el contrato
 * reserva `alias` para un caso que el flujo normal no tiene— ni `$groupidentify`,
 * ni `$set`, ni ninguno de los que el SDK emite por su cuenta.
 */
export const IDENTITY_EVENT = "$identify";

/**
 * Opciones del SDK: nada se captura solo, y nada de navegación se guarda.
 *
 * Hay dos familias de opciones acá y conviene no confundirlas. Las primeras
 * apagan CAPTURA: autocapture, replay, encuestas, web vitals. Las segundas
 * apagan PERSISTENCIA: el SDK, por defecto, escribe en el dispositivo el
 * referrer, la URL inicial y los parámetros de campaña de cada visita, aunque
 * `before_send` los descarte al enviar. Guardarlos ya es tratarlos, y el
 * contrato no lo permite.
 *
 * Lo que sigue sin poder apagarse es el CÁLCULO: el SDK arma `$current_url`,
 * `$host`, `$pathname`, `$referrer` y la huella de pantalla antes de mirar
 * cualquier opción. Eso no sale porque `before_send` reduce las propiedades a la
 * allowlist del contrato.
 */
export function clientOptions(input: {
  readonly apiHost: string;
  /** El propio cliente, para que `before_send` pueda limpiar lo persistido. */
  readonly persisted: () => NavigationPersistence | null;
}) {
  return {
    api_host: input.apiHost,
    // --- Nada de captura automática: el único emisor es esta tarjeta ---------
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
    // --- Nada de navegación guardada en el dispositivo ----------------------
    // Con estas dos en `true` —el default del SDK— cada captura escribe el
    // referrer crudo y la URL inicial en `localStorage` y los parámetros de
    // campaña en `sessionStorage`. El contrato prohíbe los tres.
    save_campaign_params: false,
    save_referrer: false,
    // `store_google` está deprecado en favor de `save_campaign_params`, pero
    // sigue leyéndose: se apaga por si una versión vuelve a darle prioridad.
    store_google: false,
    // El hash de la URL no se captura ni se guarda. `before_send` ya lo
    // descarta; esto evita que exista en el medio.
    disable_capture_url_hashes: true,
    // El distinct ID anónimo tiene que sobrevivir a la recarga (contrato,
    // sección 7), pero no hace falta una cookie para eso: en `localStorage` el
    // identificador no viaja en cada request al dominio.
    persistence: "localStorage" as const,
    // Un perfil de persona SÓLO para quien se identificó. Una visita anónima no
    // crea perfil, y desde CORE-188 la cuenta que inicia sesión sí: es el mismo
    // valor, y ahora es el que hace la diferencia. Con `always` habría un perfil
    // por visitante, que es exactamente lo que el contrato no quiere.
    person_profiles: "identified_only" as const,
    // Cinturón sobre el tirante: aunque `before_send` ya borra la URL, el SDK
    // tampoco arma los parámetros de campaña con su valor real.
    mask_personal_data_properties: true,
    before_send: beforeSendWith(input.persisted)
  };
}

/**
 * El último punto antes de la red.
 *
 * Hace tres cosas que la configuración sola no puede: descarta cualquier evento
 * que el contrato no declare —salvo `IDENTITY_EVENT`, la única excepción y está
 * nombrada—, reduce las propiedades a la allowlist de ESE evento y borra del
 * dispositivo lo que el SDK acaba de persistir sobre la navegación. `$set` y
 * `$set_once` se descartan enteros porque ahí es donde viajarían las propiedades
 * iniciales de persona (`$initial_referrer`, `$initial_current_url`) — y también
 * las que `identify()` aceptaría por parámetro, así que la promesa de "identify
 * sólo con el identificador" no depende de que nadie se acuerde en el llamado.
 *
 * La comprobación es contra el DICCIONARIO y no contra un nombre suelto. Hasta
 * CORE-188 acá decía `result.event !== PAGEVIEW_EVENT`, porque la web emitía un
 * solo evento; con esa línea, cada evento nuevo del contrato habría que
 * habilitarlo a mano y el que se olvidara se perdería en silencio. Ahora pasa lo
 * que el contrato declara —los ocho— y se descarta todo lo demás, que es lo
 * mismo que hacía antes para lo que importaba: `page_view` (legado, sección 4
 * del documento), `$web_vitals`, `$exception`, `survey shown` y cualquier
 * captura que el SDK inicie por su cuenta, sin depender de que la opción que la
 * apaga siga existiendo.
 */
export function beforeSendWith(persisted: () => NavigationPersistence | null): BeforeSend {
  return (result) => {
    purgePersistedNavigation(persisted());
    if (!result) return null;
    // La red que impide que se cuele lo que nadie declaró. Un nombre fuera del
    // diccionario —el legado `page_view` incluido— no sale. La única excepción,
    // enumerada arriba, es el evento con el que el SDK ata la identidad.
    if (!isEventName(result.event) && result.event !== IDENTITY_EVENT) return null;
    return {
      ...result,
      properties: retainedProperties(result.properties, result.event),
      $set: undefined,
      $set_once: undefined,
      $unset: undefined
    };
  };
}
