/**
 * Tracker de `page_view` — variante NATIVA: no monta nada.
 *
 * No alcanza con que el servicio sea un no-op: acá también evitamos suscribir
 * la app nativa a los cambios de ruta por una métrica que sólo existe en web.
 * Metro resuelve `PageViewTracker.web.tsx` para web y este archivo para el
 * resto.
 */
export function PageViewTracker() {
  return null;
}
