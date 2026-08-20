/**
 * En web el cobro es Stripe y su checkout alojado resuelve el estado por sí
 * mismo: no hay compra de tienda en vuelo que recordar. Este stub existe para
 * que el bundle web no arrastre `AsyncStorage` ni la lógica nativa.
 */
import type { PurchaseGuardRead } from "@/domain/purchaseGuard";

export async function readPurchaseGuard(): Promise<PurchaseGuardRead> {
  return { state: "empty" };
}

export async function storePurchaseGuard(): Promise<void> {
  return undefined;
}

/** En web no hay marcador que borrar: la operación siempre "tiene éxito". */
export async function clearPurchaseGuard(): Promise<void> {
  return undefined;
}

export async function clearPurchaseGuardBestEffort(): Promise<void> {
  return undefined;
}
