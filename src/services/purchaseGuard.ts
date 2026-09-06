/**
 * Persistencia del marcador de compra en vuelo (nativo).
 *
 * Una clave por cuenta: el marcador de A no puede frenar la compra de B en el
 * mismo teléfono. La variante `.web.ts` no guarda nada, porque en web el cobro
 * es Stripe y su propio checkout resuelve el estado.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  parsePurchaseGuardRead,
  serializePurchaseGuardMarker,
  type PurchaseGuardRead
} from "@/domain/purchaseGuard";

const purchaseGuardKey = (userId: string) => `orbita:purchase-guard:${userId}`;

/**
 * Lee el marcador distinguiendo vacío de ilegible.
 *
 * Un fallo de AsyncStorage devuelve `unreadable`, NO `empty`: el disco puede
 * estar tapando un cargo real, y ahí "no sé" no puede degradar a "no hay nada".
 * `purchaseGuardBlocks` lo trata como bloqueo, y un Restaurar vacío
 * autoritativo lo levanta.
 */
export async function readPurchaseGuard(userId: string): Promise<PurchaseGuardRead> {
  try {
    return parsePurchaseGuardRead(await AsyncStorage.getItem(purchaseGuardKey(userId)), userId);
  } catch {
    return { state: "unreadable" };
  }
}

export async function storePurchaseGuard(userId: string, startedAt: number): Promise<void> {
  await AsyncStorage.setItem(
    purchaseGuardKey(userId),
    serializePurchaseGuardMarker({ userId, startedAt })
  );
}

/**
 * Borra el marcador de esta cuenta. **Propaga el fallo.**
 *
 * Antes se tragaba el error, y eso convertía "no pude borrarlo" en "listo": la
 * pantalla habilitaba comprar de nuevo con un marcador todavía en disco, y la
 * purga de una eliminación retiraba su propio marcador dejando el guard vivo.
 *
 * Todo camino que PROMETE limpieza —cancelación, restore vacío, confirmación
 * de RevenueCat en el backend, borrado de cuenta— tiene que enterarse del
 * fallo y quedarse bloqueado. Nunca simular el borrado.
 */
export async function clearPurchaseGuard(userId: string): Promise<void> {
  await AsyncStorage.removeItem(purchaseGuardKey(userId));
}

/**
 * Variante que NO propaga, para el único caso en que da igual: limpiar un
 * marcador de una cuenta cuya sesión ya se cerró y que no promete nada.
 *
 * No la use ningún camino comercial ni la eliminación de cuenta.
 */
export async function clearPurchaseGuardBestEffort(userId: string): Promise<void> {
  try {
    await clearPurchaseGuard(userId);
  } catch {
    // Deliberado: este camino no afirma que el marcador haya quedado limpio.
  }
}
