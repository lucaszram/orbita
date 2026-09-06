/**
 * Candado sincrónico para acciones que no pueden entrar dos veces.
 *
 * **Por qué no alcanza el estado de React.** Un `useState` de "guardando" se
 * aplica en el render SIGUIENTE. Dos toques dentro del mismo render —el rebote
 * de un dedo, un doble toque rápido, VoiceOver activando dos veces— leen los dos
 * el valor viejo (`false`), los dos pasan la guarda y los dos llegan al backend.
 * El bloqueo tiene que ser el MISMO objeto que los dos toques ven, y tiene que
 * cambiar en el instante en que el primero lo toma: por eso es un `ref` con una
 * bandera común y no un estado.
 *
 * **Dónde se toma.** Antes del primer `await` del handler. Cualquier cosa que se
 * espere —una confirmación del sistema, una mutation, una acción— abre un hueco
 * en el que el segundo toque puede entrar; tomar el candado después de ese hueco
 * no evita nada. Se libera SIEMPRE en `finally`: si se soltara sólo en el camino
 * feliz, un error dejaría la acción muerta hasta remontar la pantalla.
 *
 * Es puro y sin React a propósito: el comportamiento —dos entradas en el mismo
 * tick, una sola corrida— se prueba de verdad, no buscando una palabra en el
 * archivo.
 */

export type ExclusiveGate = {
  /**
   * Toma el candado si estaba libre. Devuelve `true` sólo a quien lo tomó, y
   * lo hace SINCRÓNICAMENTE: el segundo llamador del mismo tick recibe `false`.
   */
  acquire: () => boolean;
  /** Libera el candado. Llamarlo sin tenerlo tomado no rompe nada. */
  release: () => void;
  /** ¿Hay una corrida en curso? Sólo para leer; no toma ni libera. */
  held: () => boolean;
};

export function createExclusiveGate(): ExclusiveGate {
  let tomado = false;
  return {
    acquire: () => {
      if (tomado) return false;
      tomado = true;
      return true;
    },
    release: () => {
      tomado = false;
    },
    held: () => tomado
  };
}

/**
 * Un candado POR DUEÑO.
 *
 * El candado corta dos toques del mismo tick, pero es uno solo para el
 * componente: si A pedía algo lento y Clerk pasaba a B, B quedaba esperando
 * detrás de una operación que ya no es de nadie —y cuyo resultado se descarta
 * igual—. Cambiar de dueño entrega un candado NUEVO: B puede pedir lo suyo
 * enseguida, y el `finally` de A libera el candado viejo sin tocar el de B.
 *
 * `for` se llama durante el render y es idempotente para el mismo dueño.
 */
export type OwnerGates = { for: (owner: string | null) => ExclusiveGate };

export function createOwnerGates(): OwnerGates {
  /**
   * Un candado por dueño, CONSERVADO mientras el componente viva.
   *
   * La primera versión guardaba uno solo y lo reemplazaba al cambiar de dueño.
   * Eso rompía A → B → A: al volver a A se fabricaba un candado nuevo, así que
   * la operación de A que seguía en vuelo ya no frenaba a la segunda —y su
   * `finally` liberaba un candado que ya no era el suyo—. Con el mapa, A
   * recupera SU candado y sigue bloqueado hasta que su operación termine.
   *
   * La clave `null` (sin sesión) también tiene el suyo.
   */
  const gates = new Map<string | null, ExclusiveGate>();
  return {
    for: (owner) => {
      const existente = gates.get(owner);
      if (existente) return existente;
      const nuevo = createExclusiveGate();
      gates.set(owner, nuevo);
      return nuevo;
    }
  };
}

/** Lo que devuelve `runExclusive`: o corrió y trae su valor, o no corrió. */
export type ExclusiveOutcome<T> = { ran: true; value: T } | { ran: false; value: null };

/**
 * Corre `task` sólo si el candado estaba libre, y lo libera pase lo que pase.
 *
 * El candado se toma antes de tocar `task`, así que la función es segura aunque
 * `task` sea `async` y empiece a esperar en su primera línea. Un error de la
 * tarea se propaga —quien llama decide qué mostrar—, pero el candado ya quedó
 * libre para el reintento.
 */
export async function runExclusive<T>(
  gate: ExclusiveGate,
  task: () => Promise<T>
): Promise<ExclusiveOutcome<T>> {
  if (!gate.acquire()) return { ran: false, value: null };
  try {
    return { ran: true, value: await task() };
  } finally {
    gate.release();
  }
}
