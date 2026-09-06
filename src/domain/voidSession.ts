/**
 * El Umbral — las decisiones puras de UNA interacción (QA22-001 / 002 / 031).
 *
 * ## Los defectos que cierra
 *
 * 1. **La pantalla entera esperaba al LLM** (QA22-001). `VoidExperience` montaba
 *    “Cargando tu cielo…” a pantalla completa hasta que la action de sugeridas
 *    contestaba. Esa action genera texto con un modelo: puede tardar segundos.
 *    Mientras tanto no había campo para escribir, no había cuota, no había nada
 *    — y lo único que la persona vino a hacer no depende de las sugeridas. El
 *    registro pide además no invalidar la “carga caliente”: cuando el día ya
 *    tiene su set, la entrada tiene que dibujarlo sin volver a generarlo.
 * 2. **Las categorías genéricas se pisaban** (QA22-001). Cuando la action volvía
 *    vacía, la vista caía al catálogo estático; si después llegaba el set
 *    personalizado, las pestañas cambiaban delante del usuario.
 * 3. **No había salida** (QA22-002). Desde la respuesta, el error, la espera o
 *    el cupo agotado no se podía volver al selector sin salir de la sección.
 *
 * Las tres son decisiones, no pintura: viven acá para poder probarse sin montar
 * React. La cuota NO se decide en este módulo — sale de `void.today`, que es
 * reactiva y es la única autoridad.
 */

/** Las tres fases de una interacción con el Umbral. */
export type VoidPhase = "entrada" | "escuchando" | "respuesta";

/**
 * El estado de la interacción actual. `TPayload` es la respuesta del backend
 * (`VoidAnswerPayload`); el módulo no la lee, sólo la limpia.
 */
export type VoidInteraction<TPayload> = {
  phase: VoidPhase;
  /** Lo que la persona escribió en el campo. */
  typed: string;
  /** La respuesta que se está mostrando. */
  payload: TPayload | null;
  /** El backend contestó que no queda cupo. */
  locked: boolean;
  /** La action falló de verdad (no es un límite: es un error). */
  askFailed: boolean;
};

/** La etiqueta del control que vuelve al selector, en las cuatro superficies. */
export const VOID_NEW_QUESTION_LABEL = "HACER OTRA PREGUNTA";

/**
 * Volver a la entrada, sin efectos.
 *
 * Devuelve la interacción vacía y **nada más**: no hay campo de cuota en el
 * tipo, así que este camino no puede consumir ni devolver una pregunta aunque
 * alguien lo quisiera. Lo que la persona ya gastó lo sigue publicando
 * `void.today`, que es reactiva.
 */
export function resetVoidInteraction<TPayload>(): VoidInteraction<TPayload> {
  return { phase: "entrada", typed: "", payload: null, locked: false, askFailed: false };
}

/**
 * Copy exacto del cupo agotado (QA22-031): primero el estado concreto, con el
 * límite real del día (3 free / 5 pro). La frase editorial acompaña como texto
 * secundario, no reemplaza esta explicación.
 */
export function voidDailyLimitCopy(limit: number): string {
  return `Usaste tus ${limit} preguntas de hoy. Volvé mañana para hacer más.`;
}

/** El set de sugeridas del día tal como lo publica `void.suggestedToday`. */
export type VoidCachedPrompts = { categories: readonly unknown[] } | null | undefined;

/**
 * ¿Hay que disparar la action que genera las sugeridas (y con ella el LLM)?
 *
 * El orden importa:
 *
 * 1. **Mientras la query viaja, no.** `undefined` no es “no hay set”: es “no
 *    sabemos”. Disparar acá volvería a generar un set que ya existía, que es
 *    justo la carga fría que QA22-001 pide no repetir en cada entrada.
 * 2. **Con el set del día, tampoco.** Ese es el punto de la query nueva: el día
 *    ya tiene sugeridas cacheadas y la pantalla las lee sin pagar un LLM.
 * 3. **Ya generado en esta sesión, tampoco.** Si no, la respuesta de la action
 *    —que además persiste el set— volvería a entrar por el efecto.
 */
export function shouldGenerateVoidPrompts(input: {
  cached: VoidCachedPrompts;
  /** Ya hay un set generado en esta sesión. */
  generated: boolean;
}): boolean {
  if (input.cached === undefined) return false;
  if (input.cached && input.cached.categories.length > 0) return false;
  return !input.generated;
}

/** En qué estado está la SECCIÓN de sugeridas (no la pantalla). */
export type VoidSuggestionsState = "listas" | "error" | "cargando";

/**
 * La sección de sugeridas se resuelve sola, sin bloquear la entrada.
 *
 * Con categorías, están listas —aunque un intento posterior haya fallado, lo
 * que se puede leer sigue siendo válido—. Sin categorías y con un fallo, es
 * error. Sin ninguna de las dos, sigue cargando: nunca se dibuja el catálogo
 * genérico para tapar el hueco, porque después cambiaría delante del usuario.
 */
export function voidSuggestionsState(input: {
  categories: readonly unknown[] | null;
  failed: boolean;
}): VoidSuggestionsState {
  if (input.categories && input.categories.length > 0) return "listas";
  if (input.failed) return "error";
  return "cargando";
}
