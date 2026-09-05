import type { DailyGuidePayload } from "@/services/appRefs";

/**
 * La estructura de la sección **Hoy**: qué es «lo principal», qué filas tiene el
 * ranking de tránsitos, en qué orden se numeran los cuatro módulos y cuántos
 * tienen dato de verdad.
 *
 * Todo sale de `daily.getGuide` (`DailyGuidePayload`), que es lo único que el
 * backend calcula hoy sobre los tránsitos del día. El contrato V4.9.2 —con
 * `orb`, `activeCount`, `exactness` y una barra por fila— **no existe en este
 * deployment**, así que acá no se deriva ninguno de esos números: una barra de
 * cercanía sin orbe sería un puntaje inventado, y un contador de activos sin
 * lista completa sería un número que nadie calculó.
 *
 * Lo que sí hay es real y basta: el aspecto destacado con su lectura, y los
 * secundarios con la suya. El módulo es puro (sin React, sin reloj, sin red)
 * para poder probarlo entero — ver `test/hoyPrincipal.test.ts`.
 */

/** Texto presentable: string no vacío después de recortar. `null` si no lo es. */
function texto(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const limpio = value.trim();
  return limpio.length > 0 ? limpio : null;
}

/**
 * Clave de deduplicación de una fila del ranking.
 *
 * El destacado casi siempre vuelve a aparecer dentro de `secundarios` (el
 * backend arma las dos listas por separado y el primero es el mismo contacto),
 * así que sin esto la lista empieza con la misma fila dos veces. Se compara el
 * aspecto normalizado —minúsculas, espacios colapsados y sin puntuación final—
 * porque es lo que identifica al contacto; la lectura puede estar redactada
 * distinto en cada lista y seguir siendo el mismo tránsito.
 */
function claveDeAspecto(aspecto: string): string {
  return aspecto
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;,·]+$/u, "");
}

/** La síntesis editorial que encabeza Hoy. */
export type HoyPrincipal = {
  /** La frase grande. Es texto calculado por el backend, nunca una plantilla. */
  titular: string;
  /** El contacto que la sostiene (`Luna en cuadratura a tu Sol`), si vino. */
  aspecto: string | null;
};

/** Una fila del ranking, ya deduplicada y numerada. */
export type HoyRankingFila = {
  /** Clave estable para React: el aspecto normalizado. */
  clave: string;
  /** Posición en la lista, 1-based. Es el orden del backend, no uno propio. */
  rango: number;
  aspecto: string;
  /**
   * La lectura del contacto, o `null` si el backend no escribió una. El
   * contrato real manda los secundarios SIN lectura (`lectura: ""`): son
   * contactos reales del día igual, y la fila los muestra sin inventarles una.
   */
  lectura: string | null;
};

/** Los cuatro módulos numerados de Hoy, identificados por su capa. */
export type HoyBloqueKey = "principal" | "ranking" | "luna" | "cumpleluna";

/**
 * ¿La guía del día todavía está en su primera respuesta, sin tránsitos?
 *
 * `daily.getGuide` contesta rápido con un payload genérico —sin tránsitos,
 * con el titular de relleno del propio backend— y marca
 * `enrichment.status: "pending"` mientras calcula la lectura real. Mostrar ese
 * payload como si fuera el del día sería un mock con otro nombre; la sección lo
 * trata como carga y vuelve a consultar hasta que el backend deje de declararlo
 * pendiente. Un payload sin `enrichment` es un v3 generado completo: listo.
 */
export function guiaPendiente(payload: DailyGuidePayload | null | undefined): boolean {
  const enrichment = (payload as { enrichment?: unknown } | null | undefined)?.enrichment;
  if (!enrichment || typeof enrichment !== "object") return false;
  return (enrichment as { status?: unknown }).status === "pending";
}

/**
 * `LO PRINCIPAL HOY`.
 *
 * El titular es la lectura del aspecto destacado; si esa lectura no vino, cae al
 * `headline` del día, que es la misma generación. Si no hay ninguno de los dos
 * no hay bloque: la síntesis no se rellena con el clima ni con una plantilla.
 */
export function hoyPrincipal(payload: DailyGuidePayload | null | undefined): HoyPrincipal | null {
  if (guiaPendiente(payload)) return null;
  const destacado = payload?.destacado;
  const titular = texto(destacado?.lectura) ?? texto(payload?.headline);
  if (!titular) return null;
  return { titular, aspecto: texto(destacado?.aspecto) };
}

/**
 * Las filas del ranking: el destacado primero y después los secundarios, en el
 * orden en que los mandó el backend.
 *
 * Una fila necesita el contacto: sin aspecto no hay fila. La lectura es
 * opcional porque el contrato real la manda vacía en los secundarios; no se
 * ordena, no se recorta y no se completa con nada. Mientras la guía está
 * pendiente de enriquecimiento no hay ranking: sus «tránsitos» son el relleno
 * del primer render, no el cielo de hoy.
 */
export function hoyRanking(payload: DailyGuidePayload | null | undefined): HoyRankingFila[] {
  if (guiaPendiente(payload)) return [];
  const secundarios = payload && Array.isArray(payload.secundarios) ? payload.secundarios : [];
  const crudas: ReadonlyArray<unknown> = [payload?.destacado, ...secundarios];

  const filas: HoyRankingFila[] = [];
  const vistas = new Set<string>();
  for (const cruda of crudas) {
    const fila = cruda as { aspecto?: unknown; lectura?: unknown } | null | undefined;
    const aspecto = texto(fila?.aspecto);
    const lectura = texto(fila?.lectura);
    if (!aspecto) continue;

    const clave = claveDeAspecto(aspecto);
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    filas.push({ clave, rango: filas.length + 1, aspecto, lectura });
  }
  return filas;
}

/**
 * El orden canónico de los cuatro módulos (CORE-191).
 *
 * Por defecto: lo principal, ranking, Luna y Cumpleluna. Cuando el Cumpleluna
 * cae hoy —o puede caer hoy— sube a la posición 01 y los otros tres corren un
 * lugar: el frame numera **lo que se ve, en el orden en que se ve**, no un
 * catálogo fijo de capas.
 */
export function hoyBloques(cumplelunaHoy: boolean): readonly HoyBloqueKey[] {
  return cumplelunaHoy
    ? ["cumpleluna", "principal", "ranking", "luna"]
    : ["principal", "ranking", "luna", "cumpleluna"];
}

/** `0` → `"01"`. El índice que imprime el encabezado de cada bloque. */
export function numeroDeBloque(indice: number): string {
  const numero = Number.isFinite(indice) ? Math.max(0, Math.trunc(indice)) + 1 : 1;
  return String(numero).padStart(2, "0");
}

/**
 * Cuántos módulos de Hoy tienen dato REAL en esta carga.
 *
 * Cuenta lo que se puede dibujar, no lo que existe en el contrato: un bloque que
 * está mostrando por qué le falta el dato no es una capa lista. Si no hay
 * ninguno, el encabezado se queda sin contador en vez de anunciar «0 MÓDULOS».
 */
export function contarModulos(input: {
  principal: boolean;
  ranking: boolean;
  luna: boolean;
  cumpleluna: boolean;
}): number {
  return [input.principal, input.ranking, input.luna, input.cumpleluna].filter(Boolean).length;
}

/** `"3 MÓDULOS"` · `"1 MÓDULO"` · `null` cuando no hay ninguno que contar. */
export function etiquetaDeModulos(cantidad: number): string | null {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return null;
  const entero = Math.trunc(cantidad);
  return `${entero} ${entero === 1 ? "MÓDULO" : "MÓDULOS"}`;
}
