import type { RelationshipComparisonResult } from "@/services/relationshipsApi";

/**
 * El estado del CÁLCULO de una comparación, separado del guardado (QA22-016).
 *
 * Guardar una persona y calcular su comparación son dos cosas distintas y hasta
 * el build 22 se veían como una sola: el alta terminaba abriendo el resultado y
 * la espera del proveedor quedaba en el medio, sin decir si lo que tardaba era
 * escribir la persona o generar la lectura. Ahora la persona aparece apenas se
 * guarda y el cálculo se anuncia donde pasa: en SU fila y en SU lectura.
 *
 * Este módulo es puro —entra el sobre, sale una fase— para que la fila de la
 * raíz y la pantalla de resultado no puedan discrepar sobre qué está pasando.
 */

/** La forma mínima del sobre que estas reglas miran. */
export type RelationshipCalcEnvelope = {
  status: RelationshipComparisonResult["status"];
  data: RelationshipComparisonResult["data"];
};

/**
 * Los estados del sobre en los que volver a pedir el cálculo puede cambiar algo.
 *
 * `needs_birth_time` queda deliberadamente afuera: ahí no falta una corrida,
 * falta un dato, y reintentar contra el proveedor devolvería exactamente lo
 * mismo. Para eso está el botón que lleva a completar los datos.
 */
export const RELATIONSHIP_RECALC_STATES: readonly RelationshipComparisonResult["status"][] = [
  "partial",
  "stale",
  "unavailable",
  "error"
];

/**
 * ¿Hay que volver a pedirle el cálculo al backend?
 *
 * Es puro a propósito: la condición que dispara el recálculo automático, la que
 * muestra el botón de reintento y la que lo esconde cuando el cálculo está listo
 * tienen que ser el MISMO hecho. Cuando el sobre está `ready` y con datos no hay
 * nada que recalcular, y ofrecerlo igual haría creer que lo visible es viejo.
 */
export function relationshipNeedsCalculation(comparison: RelationshipCalcEnvelope): boolean {
  if (!comparison.data) return true;
  return RELATIONSHIP_RECALC_STATES.includes(comparison.status);
}

/**
 * La huella del estado que ya pidió un cálculo automático: persona, nivel que
 * permiten sus datos, TIPO DE VÍNCULO declarado y entradas del cálculo.
 *
 * Mientras esos cuatro no cambien, un resultado que sigue corto —el proveedor
 * caído— no reabre el ciclo: es lo que acota el reintento automático a UNO por
 * estado en vez de dejarlo girando.
 *
 * **Por qué el tipo entra (QA23-004).** El backend ya lo mete en su propio
 * `inputHash`, así que en el camino normal el cambio de tipo llega solo por ese
 * lado. Entra igual acá porque esta clave es la identidad que el CLIENTE tiene
 * del estado, y tiene que cambiar cuando cambia lo declarado aunque el sobre
 * todavía sea el viejo —o aunque venga de un backend que no lo hashea—: si no,
 * la pantalla se quedaría sentada sobre un intento ya gastado, con una lectura
 * escrita para otro vínculo. Es sólo una identidad: no dispara nada por sí sola,
 * porque `relationshipNeedsCalculation` sigue decidiendo si hay algo que pedir.
 *
 * `undefined` y `null` son la misma cosa —sin definir— y dan la misma clave, tal
 * como el hash del backend.
 */
export function relationshipCalcKey(args: {
  profileId: string;
  level: string;
  inputHash: string;
  /** El tipo declarado, o `null`/ausente cuando no se definió. */
  relationshipType?: string | null;
}): string {
  return `${args.profileId}|${args.level}|${args.relationshipType ?? "sin_definir"}|${args.inputHash}`;
}

/**
 * En qué está la comparación de esta persona, para anunciarlo EN SU LUGAR:
 *
 * - `buscando` — la consulta todavía no contestó. No se sabe nada.
 * - `calculando` — hay una corrida en vuelo, o está por salir la automática.
 * - `error` — la corrida falló. Se puede reintentar.
 * - `pendiente` — la corrida terminó y el resultado sigue sin alcanzar: el
 *   proveedor no trajo posiciones o el sobre volvió parcial. No es un fallo de
 *   red y por eso no se dice "no pudimos": se dice que todavía no está.
 * - `lista` — hay una comparación usable.
 */
export type RelationshipCalcPhase = "buscando" | "calculando" | "error" | "pendiente" | "lista";

export function relationshipCalcPhase(args: {
  /** El sobre, o `undefined` mientras la consulta viaja. */
  comparison: RelationshipCalcEnvelope | undefined;
  /** Hay una corrida en vuelo. */
  running: boolean;
  /** La última corrida de ESTE estado falló. */
  failed: boolean;
  /** El intento automático de ESTE estado ya se gastó. */
  attempted: boolean;
}): RelationshipCalcPhase {
  if (args.comparison === undefined) return "buscando";
  if (args.running) return "calculando";
  if (!relationshipNeedsCalculation(args.comparison)) return "lista";
  if (args.failed) return "error";
  return args.attempted ? "pendiente" : "calculando";
}

/**
 * Cuántos reintentos MANUALES admite la fila de la raíz antes de mandar a la
 * lectura.
 *
 * La fila es un aviso, no una pantalla de recuperación: si dos intentos seguidos
 * no alcanzaron, lo que corresponde es abrir su lectura, donde el reintento vive
 * con todo el contexto —el estado del sobre, sus límites y de quién es el dato
 * que falta—. Sin este tope la raíz se convertiría en un botón que se puede
 * tocar para siempre sin que nada explique por qué no avanza.
 */
export const RELATIONSHIP_ROW_RETRY_LIMIT = 2;

/** ¿Le queda a la fila algún reintento propio? */
export function relationshipRowCanRetry(manualRetries: number): boolean {
  return manualRetries < RELATIONSHIP_ROW_RETRY_LIMIT;
}

/** Lo que la fila dice en cada fase. `null` cuando no hay nada que anunciar. */
export function relationshipCalcNote(phase: RelationshipCalcPhase): string | null {
  switch (phase) {
    case "buscando":
      return "Buscando su lectura…";
    case "calculando":
      return "Preparando su lectura. Podés seguir usando la app: cuando esté, se abre desde acá.";
    case "error":
      return "No pudimos preparar su lectura ahora. Sus datos están guardados.";
    case "pendiente":
      return "Su lectura todavía no está lista. Sus datos están guardados.";
    case "lista":
      return null;
  }
}
