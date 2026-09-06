/**
 * En web no hay snapshot local del plan.
 *
 * El arranque en frío del navegador no tiene el hueco que esto tapa —la sesión y
 * la query resuelven juntas, y la superficie web tiene su propio circuito de
 * Stripe—, así que acá el servicio es un no-op: siempre "no hay snapshot", y el
 * plan se muestra recién cuando el remoto contesta. Este stub existe para que el
 * bundle web no arrastre `AsyncStorage` ni la lógica nativa.
 */
import type { ConfirmedPlan } from "@/domain/entitlement";

export async function readEntitlementSnapshot(): Promise<ConfirmedPlan | null> {
  return null;
}

export async function writeEntitlementSnapshot(): Promise<void> {
  return undefined;
}

export async function clearEntitlementSnapshot(): Promise<void> {
  return undefined;
}
