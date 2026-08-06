/**
 * `page_view` — la única métrica de la web pública.
 *
 * Este archivo es la parte que se puede probar sin navegador: normalizar la
 * ruta, decidir si un cambio de ruta merece un evento y limpiar las propiedades
 * que el SDK agrega por su cuenta. No importa React, React Native ni PostHog a
 * propósito — la suite corre en Node.
 *
 * La regla de privacidad es una sola y vive acá: **sólo viaja el path**. Ni
 * query string, ni fragmento, ni segmentos que puedan ser un identificador.
 * Órbita maneja datos de nacimiento y correos; medir cuántas visitas tuvo
 * `/empezar` no necesita saber quién las hizo.
 */

/** Nombre exacto del evento. No hay otros: el capture automático está apagado. */
export const PAGE_VIEW_EVENT = "page_view";

/** Reemplazo de cualquier segmento que pueda no ser una ruta fija del producto. */
export const REDACTED_SEGMENT = "redactado";

/** Host por defecto del proyecto PostHog cuando el deploy no define uno propio. */
export const DEFAULT_ANALYTICS_HOST = "https://us.i.posthog.com";

/**
 * Corta una URL o ruta en el primer `?` o `#`.
 *
 * Ahí es exactamente donde viajan los datos personales en Órbita: el
 * `__clerk_ticket` del alta, el `session_id` que Stripe devuelve al volver del
 * checkout, el email tipeado que el login pasa por params y el `#/create` con
 * el que Clerk rutea el registro dentro de `/empezar`.
 */
export function stripQueryAndHash(value: string): string {
  return value.split("?")[0].split("#")[0];
}

/**
 * ¿Este segmento puede ser un identificador y no un tramo fijo de la ruta?
 *
 * Hoy ninguna ruta de `app/**` tiene segmento dinámico, así que en la práctica
 * esto no debería dispararse nunca. Está igual porque el día que alguien agregue
 * `reading/[id]` el default correcto es no medir el id, no enterarse después.
 */
function isOpaqueSegment(segment: string): boolean {
  const value = segment.toLowerCase();
  // Un email entero o codificado (`%40`) en la ruta.
  if (value.includes("@") || value.includes("%40")) return true;
  // Ids numéricos.
  if (/^\d+$/.test(value)) return true;
  // UUID.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) return true;
  // Tokens opacos tipo `user_2abc…`: largos, con dígitos y sin forma de palabra.
  if (value.length >= 16 && /\d/.test(value) && /^[a-z0-9_-]+$/.test(value)) return true;
  return false;
}

/**
 * Ruta canónica que se manda como propiedad `path` del evento.
 *
 * Acepta tanto lo que devuelve `usePathname` como una URL completa, siempre
 * devuelve algo que empieza con `/` y nunca devuelve query ni fragmento.
 */
export function normalizePagePath(raw: string): string {
  if (typeof raw !== "string") return "/";

  let path = raw.trim();
  // URL absoluta: sacamos protocolo y host antes de mirar nada más.
  const origin = path.match(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i);
  if (origin) path = path.slice(origin[0].length);

  const segments = stripQueryAndHash(path)
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => (isOpaqueSegment(segment) ? REDACTED_SEGMENT : segment));

  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

/** Lo último que se midió. El tracker lo guarda en un ref, no en estado de React. */
export type PageViewState = { readonly lastPath: string | null };

export const INITIAL_PAGE_VIEW_STATE: PageViewState = { lastPath: null };

/**
 * Decide si un render merece un `page_view` y devuelve el estado siguiente.
 *
 * Dedup por ruta normalizada, no por el string crudo: `/empezar?resume=datos`
 * y `/empezar` son la misma pantalla, y el efecto que escucha la ruta se
 * vuelve a disparar por causas que no son navegación (StrictMode monta dos
 * veces en dev, un cambio de params re-renderiza). Sin esto la misma pantalla
 * se contaría varias veces y el número dejaría de significar algo.
 */
export function nextPageView(
  state: PageViewState,
  raw: string
): { state: PageViewState; capture: string | null } {
  const path = normalizePagePath(raw);
  if (state.lastPath === path) return { state, capture: null };
  return { state: { lastPath: path }, capture: path };
}

/** Configuración resuelta del SDK. `null` significa: no medir nada. */
export type AnalyticsConfig = { readonly key: string; readonly host: string };

/**
 * Resuelve la config desde las variables públicas del build.
 *
 * Sin clave devuelve `null` y la web no inicializa el SDK: un deploy que se
 * olvida de setearla no manda nada a ningún lado. Es el mismo default cerrado
 * que usan las herramientas internas.
 */
export function resolveAnalyticsConfig(env: {
  key?: string | null;
  host?: string | null;
}): AnalyticsConfig | null {
  const key = (env.key ?? "").trim();
  if (key === "") return null;
  const host = (env.host ?? "").trim();
  return { key, host: host === "" ? DEFAULT_ANALYTICS_HOST : host };
}

/**
 * Última línea de defensa sobre lo que el SDK agrega solo.
 *
 * Aunque el evento lo mandemos nosotros con un único `path` limpio, PostHog
 * adjunta `$current_url`, `$referrer`, `$pathname` y sus variantes `$initial_*`
 * leídas del navegador — con query y fragmento incluidos. Se enchufa como
 * `sanitize_properties` en el `init`, así que corre para todo lo que salga.
 */
export function sanitizeAnalyticsProperties<T extends Record<string, unknown>>(properties: T): T {
  const clean: Record<string, unknown> = { ...properties };
  for (const [name, value] of Object.entries(clean)) {
    if (typeof value !== "string") continue;
    if (!/(url|referrer|pathname)$/i.test(name)) continue;
    clean[name] = stripQueryAndHash(value);
  }
  return clean as T;
}
