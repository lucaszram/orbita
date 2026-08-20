/**
 * La revisión del payload natal: qué carta EXACTA se usó para generar algo.
 *
 * ## Por qué hace falta
 *
 * `natalCharts` guarda una fila por `cacheKey`, y el `cacheKey` se arma con los
 * DATOS natales. Cuando una corrida mejora la carta —el proveedor devuelve por
 * fin las casas y los ejes que faltaban— el payload cambia **sobre el mismo
 * `_id`**. Todo lo que se derivó del payload anterior sigue apuntando a esa
 * misma fila y no tiene forma de saber que ya no la describe.
 *
 * `natalInterpretations` se identificaba sólo por carta + feature +
 * `promptVersion`, así que una lectura `ready` escrita sobre la carta parcial
 * seguía leyéndose como cache hit después de instalar la geometría completa: el
 * texto hablaba de una carta sin Ascendente ni casas mientras la pantalla ya
 * mostraba las dos cosas. Y al revés: una generación que arrancó con el payload
 * parcial podía terminar DESPUÉS de la mejora y persistir ese texto viejo encima
 * del estado nuevo.
 *
 * La revisión cierra las dos puertas: es la identidad del payload, no de la
 * fila. Si el payload cambia, la revisión cambia, y lo derivado deja de
 * verificar.
 *
 * ## Qué es
 *
 * El hash estable del payload guardado, con `stableInputHash`: determinista,
 * independiente del orden de las claves y sin depender de relojes. Dos payloads
 * iguales dan la misma revisión aunque se hayan escrito en corridas distintas;
 * dos payloads distintos, no.
 *
 * Una fila legada sin revisión no puede demostrar sobre qué carta se generó:
 * `null` nunca es igual a la revisión vigente, así que se trata como no
 * verificada y se regenera en vez de publicarse.
 */
import { stableInputHash } from "./stableHash";

/** La identidad del payload natal vigente de una carta. */
export function natalPayloadRevision(payload: unknown): string {
  return stableInputHash(payload ?? null);
}

/**
 * ¿Esta marca guardada demuestra la vigente?
 *
 * Sirve para las DOS marcas con las que una fila derivada tiene que poder
 * identificarse: la revisión del payload natal y la versión de caché con la que
 * se generó. En los dos casos la regla es la misma: sin marca no se demuestra
 * nada —una fila legada no prueba sobre qué se escribió— y una marca distinta
 * describe otra cosa.
 */
export function natalStampMatches(
  stored: string | null | undefined,
  expected: string | null | undefined
): boolean {
  return typeof stored === "string" && stored.length > 0 && stored === expected;
}
