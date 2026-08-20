/**
 * Coordinador de pedidos "gana el último", sin React.
 *
 * El detalle de un tránsito pide el cálculo de UN arco. Esa acción tarda —verifica
 * pasadas contra efemérides reales— y mientras tanto la persona puede volver a la
 * lista y abrir otro tránsito. Si la respuesta del primero llega después, escribir
 * la pantalla con ella mostraría el arco equivocado bajo el titular del nuevo.
 *
 * Dos reglas, las dos verificables sin simulador:
 *
 * 1. **Un pedido por clave.** Pedir dos veces lo mismo —dos renders, dos efectos,
 *    dos toques— no larga dos acciones. La clave incluye arco, día civil, zona y
 *    hora civil, así que un cambio real de contexto sí es un pedido nuevo.
 * 2. **Sólo el último manda.** Cada pedido admitido se lleva un token creciente;
 *    al volver, sólo el token vigente puede escribir estado. Los anteriores se
 *    descartan en silencio: su trabajo ya no describe lo que hay en pantalla.
 *
 * El estado vive en el coordinador y no en `useState` a propósito: un candado que
 * se aplica en el render siguiente no impide las dos entradas del mismo render.
 */

export type LatestRequestGate = {
  /**
   * Pide turno para `key`. Devuelve el token del pedido, o `null` si esa clave ya
   * fue pedida y no se liberó.
   */
  start: (key: string) => number | null;
  /** ¿Este token sigue siendo el pedido vigente? */
  isCurrent: (token: number) => boolean;
  /**
   * Vuelve a habilitar `key`. Es lo que hace un reintento explícito: la clave se
   * puede volver a pedir sin esperar que cambie el contexto.
   */
  release: (key: string) => void;
  /** Olvida todo: sirve al desmontar o al cambiar de cuenta. */
  reset: () => void;
};

export function createLatestRequestGate(): LatestRequestGate {
  const started = new Set<string>();
  let issued = 0;
  let current = 0;

  return {
    start(key) {
      if (started.has(key)) return null;
      started.add(key);
      issued += 1;
      current = issued;
      return issued;
    },
    isCurrent(token) {
      return token === current;
    },
    release(key) {
      started.delete(key);
    },
    reset() {
      started.clear();
      issued = 0;
      current = 0;
    }
  };
}

/**
 * La clave de un pedido de arco. Se declara acá —y no dentro del hook— para que la
 * regla de "cuándo es el mismo pedido" se pueda leer y probar en un solo lugar.
 *
 * `attempt` es el contador de reintentos explícitos: sube cuando la persona toca
 * el botón, y por eso una clave que ya se pidió vuelve a ser pedible.
 */
export function transitArcRequestKey(args: {
  arcId: string;
  localDate: string;
  timezone: string;
  civilHour: string;
  attempt: number;
}): string {
  return [args.arcId, args.localDate, args.timezone, args.civilHour, String(args.attempt)].join("|");
}
