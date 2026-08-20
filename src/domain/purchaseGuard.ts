/**
 * Marcador de compra en vuelo — la parte pura.
 *
 * ## El agujero que cierra
 *
 * El bloqueo anti-doble-cobro vivía en `useState` de `PlusPaywallScreen`. Si la
 * pantalla se desmonta —volver atrás y entrar de nuevo, o iOS descartándola
 * mientras la hoja de StoreKit está arriba— el estado se pierde y el botón
 * vuelve a decir "comprar" con un cargo posiblemente ya hecho. Un cargo no es
 * un detalle de pantalla: tiene que sobrevivir al desmontaje.
 *
 * ## Qué es y qué no es
 *
 * Es una nota de SEGURIDAD, no un permiso: dice "esta cuenta inició una compra
 * y todavía no sabemos cómo terminó". Nunca concede acceso —el acceso lo
 * resuelve Convex— y sólo puede empujar la pantalla hacia Restaurar.
 *
 * Va por cuenta a propósito: el marcador de A no puede frenar la compra de B en
 * el mismo teléfono.
 */

export type PurchaseGuardMarker = {
  userId: string;
  startedAt: number;
};

export function serializePurchaseGuardMarker(marker: PurchaseGuardMarker): string {
  return JSON.stringify({ userId: marker.userId, startedAt: marker.startedAt });
}

/**
 * Un marcador ilegible se lee como "no hay marcador".
 *
 * La alternativa —tratarlo como bloqueo— dejaría a alguien sin poder comprar
 * para siempre por un JSON roto. El costo de equivocarse en esta dirección lo
 * cubre el resto del circuito: la tienda no cobra dos veces una suscripción
 * activa del mismo grupo, y Convex sigue siendo la autoridad del acceso.
 */
export function parsePurchaseGuardMarker(raw: string | null | undefined): PurchaseGuardMarker | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const { userId, startedAt } = parsed as { userId?: unknown; startedAt?: unknown };
    if (typeof userId !== "string" || userId.length === 0) return null;
    return {
      userId,
      startedAt: typeof startedAt === "number" && Number.isFinite(startedAt) ? startedAt : 0
    };
  } catch {
    return null;
  }
}

/** ¿Esta cuenta tiene una compra sin resolver? */
export function purchaseGuardHolds(
  marker: PurchaseGuardMarker | null | undefined,
  userId: string | null | undefined
): boolean {
  return Boolean(marker && userId && marker.userId === userId);
}

/**
 * Resultado de leer el marcador.
 *
 * `unreadable` es su propio estado a propósito: un JSON roto o un fallo de
 * AsyncStorage pueden estar TAPANDO un cargo real, y ahí "no sé" no puede
 * degradar a "no hay nada". Se trata como bloqueo.
 */
export type PurchaseGuardRead =
  | { state: "empty" }
  | { state: "held"; marker: PurchaseGuardMarker }
  | { state: "unreadable" };

/**
 * ¿Este resultado impide ofrecer "comprar"?
 *
 * Falla CERRADO: `unreadable` bloquea. Eso no deja a nadie sin poder comprar
 * para siempre, porque un Restaurar vacío autoritativo —la tienda diciendo "no
 * hay compra"— limpia el marcador y devuelve el botón.
 */
export function purchaseGuardBlocks(read: PurchaseGuardRead): boolean {
  return read.state !== "empty";
}

/** Lee el crudo del almacenamiento distinguiendo vacío de ilegible. */
export function parsePurchaseGuardRead(
  raw: string | null | undefined,
  userId: string | null | undefined
): PurchaseGuardRead {
  if (raw === null || raw === undefined || raw === "") return { state: "empty" };
  const marker = parsePurchaseGuardMarker(raw);
  if (!marker) return { state: "unreadable" };
  // Un marcador de OTRA cuenta no bloquea a ésta.
  return purchaseGuardHolds(marker, userId) ? { state: "held", marker } : { state: "empty" };
}
