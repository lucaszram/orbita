// Implementación web/default de RevenueCat: NO importa el módulo nativo, así el
// bundle web y Expo Go nunca lo resuelven. Metro carga `client.native.ts` en
// iOS/Android; tsc y el bundle web usan este archivo. Las firmas deben coincidir.
//
// En web el acceso Pro se resuelve solo por Convex (subscriptions.getCurrent),
// no por RevenueCat.
import type { CustomerInfo } from "react-native-purchases";
import { ORBITA_PRO_ENTITLEMENT_ID, OrbitaPlanId } from "./constants";

export type PurchaseResult = {
  customerInfo: CustomerInfo | null;
  productIdentifier?: string;
  isPro: boolean;
  wasCancelled: boolean;
};

export type PaywallResult = {
  customerInfo: CustomerInfo | null;
  isPro: boolean;
  result?: string;
};

export function isRevenueCatSupported(): boolean {
  return false;
}

export async function configureRevenueCat(_appUserID?: string): Promise<boolean> {
  return false;
}

export async function identifyRevenueCatUser(_appUserID: string): Promise<CustomerInfo | null> {
  return null;
}

export async function logOutRevenueCatUser(): Promise<void> {
  return;
}

export function isOrbitaPro(customerInfo: CustomerInfo | null | undefined): boolean {
  return Boolean(customerInfo?.entitlements?.active?.[ORBITA_PRO_ENTITLEMENT_ID]);
}

export async function getRevenueCatCustomerInfo(): Promise<CustomerInfo | null> {
  return null;
}

export async function purchaseOrbitaPlan(_planId: OrbitaPlanId): Promise<PurchaseResult> {
  throw new Error("RevenueCat no está disponible en esta plataforma. Usá el checkout web (Stripe).");
}

export async function restoreOrbitaPurchases(): Promise<{ customerInfo: CustomerInfo | null; isPro: boolean }> {
  return { customerInfo: null, isPro: false };
}

export async function presentOrbitaProPaywall(): Promise<PaywallResult> {
  return { customerInfo: null, isPro: false };
}

export async function openRevenueCatCustomerCenter(): Promise<void> {
  return;
}

// Devuelve una función de desuscripción. En web es no-op.
export function subscribeToCustomerInfo(_listener: (customerInfo: CustomerInfo) => void): () => void {
  return () => {};
}
