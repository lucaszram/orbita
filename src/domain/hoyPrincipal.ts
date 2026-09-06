import type { DailyGuidePayload, TransitPanorama } from "@/services/appRefs";
import { filaVista, FILAS_VISIBLES, type FilaVista } from "@/domain/transitosPanorama";

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
  /** La línea completa tal como la escribió el backend. */
  aspecto: string;
  /** `"Marte cuadratura tu Venus"`: el contacto sin el signo ni la casa, que van aparte. */
  titulo: string;
  /** `"MARTE"`, el planeta en tránsito. `null` si la línea no se pudo leer. */
  planeta: string | null;
  /** `"VENUS"`, el punto natal tocado. `null` si la línea no se pudo leer. */
  punto: string | null;
  /** La casa natal del contacto, si el backend la escribió. */
  casa: number | null;
  /**
   * Identidad del contacto para abrir su detalle (`/reading/transito?id=…`).
   * `null` en documentos anteriores al contrato: la fila se muestra igual, pero
   * no promete un detalle que no puede abrir.
   */
  transitId: string | null;
  /**
   * La lectura del contacto, o `null` si el backend no escribió una de verdad.
   * El contrato real manda los secundarios SIN lectura (`lectura: ""`), y en
   * modo fallback escribe la plantilla `Hoy <contacto>.`, que repite el
   * título: ninguna de las dos es una lectura y la fila no las muestra.
   */
  lectura: string | null;
};

/**
 * Los tres bloques numerados de Hoy, identificados por su capa. `LO PRINCIPAL
 * HOY` va arriba sin número: así lo componen los frames vigentes (Build 30
 * `1688:109` y WEB V1 `1718:2136`), que numeran ranking, Luna y Cumpleluna.
 */
export type HoyBloqueKey = "ranking" | "luna" | "cumpleluna";

/**
 * Las partes de una línea de contacto del backend, que tiene la forma
 * `Planeta [en Signo] aspecto tu Punto [(casa N)]` (`aspectLine` en
 * `convex/daily.ts`). No se inventa nada: lo que no se pudo leer queda `null`
 * y la fila muestra la línea entera tal cual vino.
 */
export function partesDeContacto(aspecto: string): {
  titulo: string;
  planeta: string | null;
  punto: string | null;
  signo: string | null;
  casa: number | null;
} {
  const limpio = aspecto.replace(/\s+/g, " ").trim();
  const m = /^(\S+)(?: en (\S+))? (\S+) tu (.+?)(?: \(casa (\d{1,2})\))?$/u.exec(limpio);
  if (!m) return { titulo: limpio, planeta: null, punto: null, signo: null, casa: null };
  const [, planeta, signo, tipo, punto, casa] = m;
  return {
    titulo: `${planeta} ${tipo} tu ${punto}`,
    planeta,
    punto,
    signo: signo ?? null,
    casa: casa ? Number(casa) : null
  };
}

/** La identidad tal como la publica el backend (`planeta-aspecto-punto`), o `null`. */
export function transitIdValido(value: unknown): string | null {
  const limpio = texto(value);
  return limpio && /^[a-z0-9_-]{1,120}$/.test(limpio) ? limpio : null;
}

/**
 * Qué pide una ruta `/reading/transito[?id=…]`: `destacado` cuando no viene
 * `id`, `{ transitId }` cuando viene uno válido, y `invalido` cuando viene
 * algo que no es una identidad (mayúsculas, acentos, `../`, vacío). Un id
 * presente pero inválido NUNCA cae al destacado: abriría otro tránsito.
 */
export function pedidoDeRutaTransito(
  value: string | string[] | undefined | null
): { kind: "destacado" } | { kind: "contacto"; transitId: string } | { kind: "invalido" } {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null) return { kind: "destacado" };
  const transitId = transitIdValido(raw);
  return transitId ? { kind: "contacto", transitId } : { kind: "invalido" };
}

/** ¿La «lectura» es la plantilla de fallback del backend, `Hoy <contacto>.`? */
export function esLecturaPlantilla(lectura: string, aspecto: string): boolean {
  const norm = (v: string) => v.toLocaleLowerCase("es").replace(/\s+/g, " ").trim().replace(/[.;,·]+$/u, "");
  return norm(lectura) === norm(`hoy ${aspecto}`);
}

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
  const aspecto = texto(destacado?.aspecto);
  const lectura = texto(destacado?.lectura);
  // La plantilla de fallback (`Hoy <contacto>.`) no es una síntesis: repite el
  // contacto. En ese caso vale el `headline` del día, que al menos dice algo
  // distinto de la línea de abajo.
  const lecturaReal = lectura && aspecto && esLecturaPlantilla(lectura, aspecto) ? null : lectura;
  const titular = lecturaReal ?? texto(payload?.headline);
  if (!titular) return null;
  return { titular, aspecto };
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
    const fila = cruda as { aspecto?: unknown; lectura?: unknown; transitId?: unknown } | null | undefined;
    const aspecto = texto(fila?.aspecto);
    const lectura = texto(fila?.lectura);
    if (!aspecto) continue;
    const transitId = transitIdValido(fila?.transitId);

    const clave = claveDeAspecto(aspecto);
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    const partes = partesDeContacto(aspecto);
    filas.push({
      clave,
      rango: filas.length + 1,
      aspecto,
      titulo: partes.titulo,
      planeta: partes.planeta,
      punto: partes.punto,
      casa: partes.casa,
      transitId,
      lectura: lectura && esLecturaPlantilla(lectura, aspecto) ? null : lectura
    });
  }
  return filas;
}

/**
 * El orden de los bloques numerados (frames Build 30 y WEB V1).
 *
 * Por defecto: ranking, Luna y Cumpleluna, con `LO PRINCIPAL HOY` arriba y sin
 * número. Cuando el Cumpleluna cae hoy —o puede caer hoy— sube a la posición 01
 * y los otros dos corren un lugar: el frame numera **lo que se ve, en el orden
 * en que se ve**, no un catálogo fijo de capas.
 */
export function hoyBloques(cumplelunaHoy: boolean): readonly HoyBloqueKey[] {
  return cumplelunaHoy ? ["cumpleluna", "ranking", "luna"] : ["ranking", "luna", "cumpleluna"];
}

/**
 * A dónde lleva «Ver tu momento» (frames `1718:2136` / `1718:1997`): la
 * sección Tránsitos, pidiendo el segmento de Tu momento. Tránsitos decide
 * qué hacer con el parámetro; Hoy sólo declara el destino.
 */
export const RUTA_TU_MOMENTO = { pathname: "/transito", params: { segmento: "momento" } } as const;

/**
 * La línea `CONTEXTO · TU AÑO DE …` de lo principal: el tema del año de la
 * profección (`momento.getTemaDelAno`, CORE-210) escrito como en el frame
 * (`TU AÑO DE RUTINAS, TAREAS Y ORGANIZACIÓN COTIDIANA`). `null` cuando el
 * sobre no trae un tema listo: entonces lo principal muestra el contacto.
 */
export function contextoDelAno(tema: { status: string; houseTheme?: string } | null | undefined, titularDeCasa: string | null): string | null {
  if (!tema || tema.status !== "ready") return null;
  const tituloTema = titularDeCasa ?? (typeof tema.houseTheme === "string" ? tema.houseTheme.trim() : "");
  if (!tituloTema) return null;
  return `Tu año de ${tituloTema}`;
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

/** `"4 CAPAS"` · `"1 CAPA"` · `null` cuando no hay ninguna que contar. El frame las llama capas. */
export function etiquetaDeModulos(cantidad: number): string | null {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return null;
  const entero = Math.trunc(cantidad);
  return `${entero} ${entero === 1 ? "CAPA" : "CAPAS"}`;
}

// --- CORE-238: el ranking de Hoy se lee como el de Tránsitos -----------------

/**
 * Las filas que Hoy muestra del panorama (Plus): las primeras `FILAS_VISIBLES`
 * del mismo orden que Tránsitos, con su barra, chip y cuerpo. Es el MISMO dato
 * que el panorama; Hoy no vuelve a ordenar ni a recortar por su cuenta.
 */
export function filasDelPanoramaParaHoy(panorama: TransitPanorama | null | undefined): FilaVista[] {
  if (!panorama || panorama.status !== "ready") return [];
  return panorama.rows.slice(0, FILAS_VISIBLES).map(filaVista);
}

/**
 * La fila de Hoy en Free, con la forma de una fila del panorama: sin barra
 * (`null`: no se dibuja una vacía), sin chip y con la casa como meta. Sólo las
 * filas con identidad pueden abrir su detalle; las demás quedan sin enlace.
 */
export function filaDeHoyComoVista(fila: HoyRankingFila): FilaVista | null {
  if (!fila.transitId) return null;
  return {
    transitId: fila.transitId,
    rango: fila.rango,
    titulo: fila.titulo,
    linea: [fila.planeta, fila.punto].filter((p): p is string => Boolean(p)).join(" · "),
    chip: null,
    meta: fila.casa !== null ? `CASA ${fila.casa}` : "",
    barra: null,
    cuerpo: fila.lectura ?? "",
    cadencia: null
  };
}

/** `"VER LOS 16 CONTACTOS ACTIVOS"` cuando el panorama publicó el total; `null` si no. */
export function etiquetaDeContactosActivos(panorama: TransitPanorama | null | undefined): string | null {
  if (!panorama || panorama.status !== "ready") return null;
  const total = panorama.activeTotal ?? panorama.rows.length;
  if (total <= 0) return null;
  return total === 1 ? "VER EL CONTACTO ACTIVO" : `VER LOS ${total} CONTACTOS ACTIVOS`;
}

/**
 * Con el panorama listo, lo principal es la lectura del contacto que el
 * panorama pone primero (frame `1718:2136`: la frase completa del contacto).
 * Sin panorama, queda la síntesis de la guía.
 */
export function principalDesdePanorama(panorama: TransitPanorama | null | undefined, fallback: HoyPrincipal | null): HoyPrincipal | null {
  if (!panorama || panorama.status !== "ready" || panorama.rows.length === 0) return fallback;
  const fila = panorama.rows[0];
  const titular = fila.body.trim();
  if (!titular) return fallback;
  return { titular, aspecto: fila.title };
}
