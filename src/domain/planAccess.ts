/**
 * Acceso Free/Plus de la app nativa (build 30).
 *
 * Es la ÚNICA función que convierte el plan de la cuenta en una autorización de
 * pantalla. Existe por separado de `@/domain/entitlement` —que nombra el plan
 * para mostrarlo— porque nombrar y autorizar son dos cosas distintas y sólo una
 * de las dos puede apoyarse en el snapshot local: el chip del encabezado puede
 * decir "PLUS" desde el disco mientras el remoto viaja, pero abrir Hoy con esa
 * misma memoria le mostraría a alguien datos que el servidor ya no le manda.
 *
 * Por eso acá entran EXACTAMENTE dos señales de `useEntitlement()`:
 *
 * - `remote` — lo que el backend confirmó para el dueño vigente (ya
 *   correlacionado por `safeEntitlement`);
 * - `resolved` — que esa confirmación es de ESTA cuenta y no de la anterior.
 *
 * Ni `effective` ni `source` ni `hydrated` participan: los tres pueden venir del
 * snapshot, y un snapshot no autoriza.
 *
 * Módulo puro: no importa React, ni Convex, ni React Native.
 */

/**
 * Qué puede abrir esta cuenta.
 *
 * `loading` no es "Free todavía": es "no sé", y se dibuja esperando. Afirmar
 * Free antes de tiempo le muestra el bloqueo a quien paga —cada arranque en
 * frío— y afirmar Plus le promete a un Free un contenido que el servidor le va
 * a negar en el mismo render.
 */
export type PlanAccess = "loading" | "free" | "plus";

export function planAccess(input: {
  /** `useEntitlement().remote`: la confirmación del backend, o `undefined`. */
  remote: { isPro: boolean } | null | undefined;
  /** `useEntitlement().resolved`: esa confirmación es del dueño vigente. */
  resolved: boolean;
}): PlanAccess {
  // Sin confirmación remota no hay nada que autorizar. `resolved` es lo único
  // que distingue "el backend contestó" de "todavía tengo el plan cacheado".
  if (!input.resolved) return "loading";
  // Defensa en profundidad: `resolved` implica un remoto presente, pero si
  // alguna vez dejara de implicarlo, la respuesta honesta sigue siendo esperar.
  if (input.remote === undefined) return "loading";
  // `null` es "el backend no reconoce plan": eso ES Free, no una espera.
  return input.remote?.isPro === true ? "plus" : "free";
}

/**
 * Dónde arranca la app cuando el shell de pestañas abre por la ruta raíz.
 *
 * Free no entra por Hoy: esa pestaña no se calcula para su plan, así que
 * aterrizar ahí sería abrir la app en una pantalla bloqueada. Su primera
 * superficie es su carta natal, que es lo que su plan SÍ incluye entero.
 *
 * Los otros dos casos no son destinos, son estados:
 *
 * - **Online sin resolver** (`esperar`): con sesión viva y el plan en vuelo no
 *   se elige pestaña. Mandar a Carta "por las dudas" le movería el arranque a
 *   quien paga en cada red lenta, y mandar a Hoy le mostraría el bloqueo a un
 *   Free por un instante.
 * - **Degradado**: la sesión no se pudo confirmar, así que el plan tampoco va a
 *   resolver y esperar sería un spinner eterno. Se abre Carta, que es la
 *   superficie que el shell degradado puede sostener con los últimos datos de
 *   esta misma cuenta.
 *
 * Sin backend configurado no hay cuenta ni plan que consultar: la app corre
 * local-first y conserva su arranque histórico en Hoy.
 */
export type StartTab = "esperar" | "hoy" | "carta";

export function startTab(input: {
  access: PlanAccess;
  /** `confidence === "degraded-local"`: sesión sin confirmar, identidad segura. */
  degraded: boolean;
  backendConfigured: boolean;
}): StartTab {
  if (!input.backendConfigured) return "hoy";
  if (input.degraded) return "carta";
  if (input.access === "loading") return "esperar";
  return input.access === "plus" ? "hoy" : "carta";
}

// ---------------------------------------------------------------------------
// La salida única del bloqueo
// ---------------------------------------------------------------------------

/**
 * La paywall nativa: la ÚNICA salida de cualquier superficie cerrada por plan.
 *
 * Es una constante y no un literal repetido porque el bloqueo aparece en cuatro
 * lugares —Hoy, Tránsitos, el cupo de personas y el patrón relacional— y todos
 * tienen que llegar a la misma pantalla: una ruta distinta en uno de ellos
 * sería una oferta que no cobra.
 */
export const PLUS_PAYWALL_ROUTE = "/paywall";

/** El rótulo del CTA, tal como lo escribe el frame. */
export const PLUS_CTA_LABEL = "VER ÓRBITA PLUS";

// ---------------------------------------------------------------------------
// Copy de los bloqueos (Figma `BEB5v6SbgJn2Nipm8Qa0wE`)
// ---------------------------------------------------------------------------

/**
 * Las frases del frame, una sola vez.
 *
 * Están acá y no adentro de cada pantalla porque son la MISMA promesa dicha en
 * cuatro lugares: si una se reescribe sola, la app termina ofreciendo dos cosas
 * distintas por el mismo precio. Las pruebas focales las comparan contra el
 * frame aprobado.
 */

/** `01 · Hoy · Free bloqueado` (`1248:1617`). */
export const HOY_FREE_INTRO =
  "Hoy lee los movimientos del día sobre tu carta. Con Órbita Free esta pestaña no se calcula.";
export const HOY_FREE_LOCK =
  "Con Órbita Plus, Hoy se calcula todos los días: el ranking de tránsitos, la Luna sobre tu carta y tu cumpleluna.";

/** `02 · Tránsitos · Free bloqueado` (`1249:1633`). */
export const TRANSITOS_FREE_INTRO =
  "Tránsitos reúne los movimientos activos sobre tu carta. Con Órbita Free esta pestaña no se calcula.";
export const TRANSITOS_FREE_LOCK =
  "Con Órbita Plus se abre la lista completa de hoy y el detalle de cada tránsito, con su ventana y sus fechas. Cualquier link a un tránsito aterriza acá hasta que actives Plus.";

/**
 * `03 · Vínculos · Free sin personas` (`1250:1651`): lo que Free SÍ incluye.
 *
 * Se dice sólo mientras el cupo está libre. Con la persona ya guardada, repetir
 * "incluye una persona" sería contarle a alguien un permiso que acaba de usar.
 */
export const VINCULOS_FREE_QUOTA_NOTE =
  "Órbita Free incluye una persona. Podés guardar sus datos, editarlos y ver la comparación completa.";

/** El patrón relacional cerrado, con el cupo de personas todavía libre. */
export const VINCULOS_PATTERN_LOCK = "Tu patrón relacional está disponible con Órbita Plus.";

/**
 * `04 · Vínculos · Free con una persona` (`1253:1665`): el cupo ya tomado.
 *
 * Nombra las DOS cosas que abre la compra porque en ese estado las dos están
 * cerradas, y ofrecer sólo el patrón dejaría sin explicación el botón de
 * agregar que ya no agrega.
 */
export const VINCULOS_PATTERN_AND_QUOTA_LOCK =
  "Con Órbita Plus podés guardar más personas y abrir tu patrón relacional.";

/** El CTA de alta con cupo libre y el mismo CTA ya cerrado, tal como los rotula el frame. */
export const VINCULOS_ADD_LABEL = "AGREGAR UNA PERSONA";
export const VINCULOS_ADD_BLOCKED_LABEL = "AGREGAR A UNA PERSONA";

// ---------------------------------------------------------------------------
// Vínculos: el cupo del plan
// ---------------------------------------------------------------------------

/**
 * La lista autorizada de personas, tal como la publica `relationships.listWithAccess`.
 *
 * El cupo lo decide el SERVIDOR (`canCreate`), no una cuenta hecha en el
 * cliente: una cuenta histórica puede tener varias personas guardadas con plan
 * Free y las conserva todas, así que "cuántas hay" y "puede crear otra" son dos
 * hechos distintos y sólo el segundo autoriza el formulario.
 */
export type RelationshipAccessList = {
  currentCount: number;
  canCreate: boolean;
};

/** Qué hace el CTA de agregar una persona. */
export type RelationshipAddIntent = "esperar" | "formulario" | "paywall";

/**
 * Adónde va "agregar una persona".
 *
 * Mientras la lista viaja el botón espera: ofrecer el formulario y rebotar
 * después —o mandar a la paywall a alguien que todavía tenía cupo— es peor que
 * un instante deshabilitado.
 */
export function relationshipAddIntent(
  list: RelationshipAccessList | undefined
): RelationshipAddIntent {
  if (list === undefined) return "esperar";
  return list.canCreate ? "formulario" : "paywall";
}

/**
 * El rechazo estable del backend cuando el cupo Free ya está tomado.
 *
 * Se compara contra el mensaje del error de Convex, que llega envuelto: el
 * código viaja adentro del texto, así que se busca por inclusión igual que en
 * `relationshipTypeRejectedByBackend`.
 */
export const RELATIONSHIP_PLUS_REQUIRED = "RELATIONSHIP_PLUS_REQUIRED";

export function relationshipPlusRequired(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  const mensaje =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof (error as { message?: unknown }).message === "string"
          ? ((error as { message: string }).message)
          : "";
  return mensaje.includes(RELATIONSHIP_PLUS_REQUIRED);
}
