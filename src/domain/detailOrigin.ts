/**
 * De dónde se abrió un detalle, y a dónde vuelve cuando ya no hay historial.
 *
 * ## El defecto que cierra (QA22-027)
 *
 * `Hoy → Tu momento → detalle → Atrás` devolvía a `Ahora`. No era el botón: los
 * detalles de las capas del día existían SÓLO dentro del stack de **Hoy**
 * (`/hoy/cumpleluna`, `/hoy/luna`), así que abrir uno desde `Tu momento` —que
 * vive en el stack de **Tránsitos**— cambiaba de sección, y el "volver" del
 * stack de Hoy no tiene forma de saber que la persona venía de otra parte. La
 * subvista se perdía porque nunca había estado en ese stack.
 *
 * Por eso la continuidad acá no se resuelve con memoria, sino con RUTA: un
 * detalle abierto desde `Tu momento` se abre DENTRO del stack de Tránsitos
 * (`/transitos/capa/[layer]`), así que `Atrás` es un `pop` del mismo stack. La
 * pantalla de abajo nunca se desmontó: conserva su instancia y su punto de
 * lectura sin que nadie los guarde ni los restaure.
 *
 * ## El caso que sí necesita declarar su origen
 *
 * El detalle del arco es distinto: `/transitos/arco/[arcId]` ya vive en el
 * stack de Tránsitos y lo abren TRES superficies —Hoy, `Ahora` y `Tu momento`—,
 * así que su origen no se puede leer de la ruta. Viaja explícito en la URL
 * (`?desde=momento`) y se usa SÓLO para el respaldo: mientras el stack siga
 * montado quien decide es el historial, que es lo que conserva la instancia.
 *
 * Sin origen declarado —un deep link, un enlace viejo— el respaldo es la raíz
 * canónica de la sección. Nunca `/hoy`: el detalle no vive ahí.
 *
 * Es un módulo puro —entra el parámetro crudo de la URL, sale un destino—, así
 * que se prueba entero sin montar el navegador.
 */

/** La vista que abre estos detalles y la raíz a la que vuelven. */
export const MOMENTO_ROUTE = "/transitos/momento";

/** La raíz de la sección: el respaldo cuando el detalle no declara origen. */
export const TRANSITOS_ROUTE = "/transitos";

/** El parámetro con el que un detalle compartido declara desde dónde se abrió. */
export const DETAIL_ORIGIN_PARAM = "desde";

/**
 * Los orígenes que un detalle compartido puede declarar.
 *
 * Es una tabla y no un `if` para que sumar una vista con el mismo problema sea
 * una línea, y para que la lista se lea de un vistazo. Hoy hay una sola: ni Hoy
 * ni `Ahora` la necesitan, porque para ellas el respaldo YA es la raíz canónica
 * del detalle.
 */
const DETAIL_ORIGINS = ["momento"] as const;

export type DetailOrigin = (typeof DETAIL_ORIGINS)[number];

const DETAIL_ORIGIN_ROUTE: Record<DetailOrigin, string> = {
  momento: MOMENTO_ROUTE
};

/**
 * Las capas cuyo detalle abre la sección Tránsitos, en su propio stack.
 *
 * Dos de ellas —`cumpleluna` y `luna`— son las MISMAS pantallas que Hoy abre en
 * el suyo: no se duplica el detalle, se duplica el lugar del que cuelga. Un
 * detalle sólo puede volver al stack en el que se apiló, así que cada sección
 * tiene que poder apilar el suyo.
 *
 * Las otras tres —`estacion`, `ano` y `mandala`— nacen acá y sólo acá: son los
 * módulos de `Tu momento` que no tenían a dónde profundizar. Los dos primeros se
 * quedaban en una frase en la portada (QA22-024); el tercero es el detalle
 * integral del dibujo, que en el build 23 seguía sin lectura propia mientras
 * repartía cuatro enlaces hacia los ritmos que ya se leen arriba (QA23-002). No
 * se agregan al stack de Hoy porque Hoy no los muestra.
 *
 * El slug es el de la URL, así que va sin acentos ni eñes: `ano` es el año
 * personal. Nombrarlo `año` obligaría a escapar el segmento en cada enlace y a
 * decodificarlo para compararlo, que es exactamente donde se cuelan los
 * destinos que no resuelven.
 */
export const SECTION_LAYER_DETAILS = ["estacion", "ano", "cumpleluna", "luna", "mandala"] as const;

export type SectionLayerDetail = (typeof SECTION_LAYER_DETAILS)[number];

/** El origen declarado en la URL, o `null` si no vino o no es uno de los válidos. */
export function detailOrigin(raw: unknown): DetailOrigin | null {
  // Un parámetro de URL puede llegar repetido (`?desde=a&desde=b`) y entonces
  // el router entrega un arreglo. Un origen ambiguo no es un origen: cae al
  // respaldo canónico, que es seguro por definición.
  if (typeof raw !== "string") return null;
  return (DETAIL_ORIGINS as readonly string[]).includes(raw) ? (raw as DetailOrigin) : null;
}

/**
 * A dónde vuelve un detalle sin historial: el origen que declaró, o la raíz
 * canónica de su sección.
 */
export function detailFallbackHref(raw: unknown, canonical: string): string {
  const origin = detailOrigin(raw);
  return origin ? DETAIL_ORIGIN_ROUTE[origin] : canonical;
}

/** El mismo destino, declarando desde qué vista se lo abre. */
export function withDetailOrigin(href: string, origin: DetailOrigin): string {
  return `${href}?${DETAIL_ORIGIN_PARAM}=${origin}`;
}

/** La capa pedida por la URL, o `null` si la sección no abre ese detalle. */
export function sectionLayerDetail(raw: unknown): SectionLayerDetail | null {
  if (typeof raw !== "string") return null;
  return (SECTION_LAYER_DETAILS as readonly string[]).includes(raw)
    ? (raw as SectionLayerDetail)
    : null;
}

/** El detalle de una capa dentro del stack de Tránsitos. */
export function layerDetailHref(layer: SectionLayerDetail): string {
  return `/transitos/capa/${layer}`;
}
