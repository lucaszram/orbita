/**
 * Corte explícito del SDK nativo. Metro resuelve este archivo en web, por lo que
 * el bundle de Stripe nunca importa `react-native-purchases` ni su UI nativa.
 */
const NATIVE_ONLY = "Las compras de la tienda sólo están disponibles en la app nativa.";

export function revenueCatPublicApiKey(): null {
  return null;
}

/** En web el acceso lo resuelve Convex con Stripe; la tienda no opina. */
export function customerHasOrbitaPro(): boolean {
  return false;
}

export async function identifyRevenueCatUser(): Promise<never> {
  throw new Error(NATIVE_ONLY);
}

export async function logoutRevenueCatUser(): Promise<void> {
  return undefined;
}

export async function currentNativeOffering(): Promise<null> {
  return null;
}

export async function purchaseNativePackage(): Promise<never> {
  throw new Error(NATIVE_ONLY);
}

export async function restoreNativePurchases(): Promise<never> {
  throw new Error(NATIVE_ONLY);
}

export async function refreshNativeCustomerInfo(): Promise<never> {
  throw new Error(NATIVE_ONLY);
}

export async function presentNativeCustomerCenter(): Promise<never> {
  throw new Error(NATIVE_ONLY);
}

export async function nativeTrialEligibility(): Promise<"no_offer"> {
  return "no_offer";
}

export async function trackNativePaywall(): Promise<void> {
  return undefined;
}

export function listenForCustomerInfo(): () => void {
  return () => undefined;
}
