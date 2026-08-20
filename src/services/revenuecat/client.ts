import { Platform } from "react-native";
import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  type CustomerInfo,
  type CustomerInfoUpdateListener,
  type PurchasesOffering,
  type PurchasesPackage
} from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";

import {
  nativeStorePlan,
  ORBITA_PRO_ENTITLEMENT,
  revenueCatIdentitySteps,
  type NativeStorePlan,
  type StoreTrialEligibility
} from "@/domain/nativeCommerce";
import type { RevenueCatActionResult } from "@/services/revenuecat/types";

export type NativeOffering = {
  offering: PurchasesOffering;
  plans: NativeStorePlan[];
  packages: Map<string, PurchasesPackage>;
};

/** Sólo claves públicas. Un release sin su clave de plataforma falla cerrado. */
export function revenueCatPublicApiKey(): string | null {
  const platformKey =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
      : Platform.OS === "android"
        ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
        : undefined;
  const cleanPlatformKey = platformKey?.trim();
  if (cleanPlatformKey) return cleanPlatformKey;

  const testKey = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY?.trim();
  return __DEV__ && testKey ? testKey : null;
}

export function customerHasOrbitaPro(customerInfo: CustomerInfo): boolean {
  return Boolean(customerInfo.entitlements.active[ORBITA_PRO_ENTITLEMENT]);
}

/**
 * RevenueCat se configura recién cuando Clerk y la fila Convex están listos.
 * Si Fast Refresh ya lo configuró, se verifica/cambia la identidad sin crear un
 * usuario anónimo intermedio.
 */
export async function identifyRevenueCatUser(apiKey: string, userId: string): Promise<CustomerInfo> {
  const cleanUserId = userId.trim();
  if (!cleanUserId || cleanUserId.startsWith("$RCAnonymousID:")) {
    throw new Error("REVENUECAT_IDENTIFIED_USER_REQUIRED");
  }

  if (!(await Purchases.isConfigured())) {
    Purchases.configure({
      apiKey,
      appUserID: cleanUserId,
      automaticDeviceIdentifierCollectionEnabled: false,
      shouldShowInAppMessagesAutomatically: true
    });
  } else {
    const currentUserId = await Purchases.getAppUserID();
    // Un solo paso: `logIn(B)` sobre A. Nunca un `logOut` intermedio, que
    // fabricaría un anónimo del SDK capaz de recibir una compra huérfana.
    for (const step of revenueCatIdentitySteps(currentUserId, cleanUserId)) {
      if (step === "login") await Purchases.logIn(cleanUserId);
    }
  }

  if ((await Purchases.getAppUserID()) !== cleanUserId) {
    throw new Error("REVENUECAT_IDENTITY_MISMATCH");
  }
  return await Purchases.getCustomerInfo();
}

/**
 * El logout de la app NO toca el SDK.
 *
 * `Purchases.logOut()` no cierra nada: crea un usuario anónimo. Dejar el último
 * id identificado es preferible —la próxima sesión entra con `logIn` sobre él,
 * en un paso— y ninguna compra puede quedar atada a un anónimo. Lo que sí se
 * limpia es el estado local de la app, que hace el provider.
 *
 * Se conserva la función para que el corte por plataforma tenga la misma
 * superficie en las dos caras.
 */
export async function logoutRevenueCatUser(): Promise<void> {
  return undefined;
}

/**
 * Elegibilidad de la oferta introductoria, preguntada a la tienda.
 *
 * Nunca tira: una consulta caída degrada a `unknown`, que la capa de dominio
 * traduce en "no prometas ninguna prueba". El precio mensual se sigue
 * publicando, así que un problema de red no deja el paywall sin oferta.
 */
export async function nativeTrialEligibility(product: {
  identifier: string;
  introPrice: { price: number } | null;
}): Promise<StoreTrialEligibility> {
  if (!product.introPrice) return "no_offer";
  try {
    const map = await Purchases.checkTrialOrIntroductoryPriceEligibility([product.identifier]);
    switch (map[product.identifier]?.status) {
      case INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE:
        return "eligible";
      case INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE:
        return "ineligible";
      case INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_NO_INTRO_OFFER_EXISTS:
        return "no_offer";
      default:
        return "unknown";
    }
  } catch {
    return "unknown";
  }
}

export async function currentNativeOffering(): Promise<NativeOffering | null> {
  const offering = (await Purchases.getOfferings()).current;
  // El contrato comercial/legal vigente es exactamente un plan mensual. Una
  // configuración histórica (semanal/anual/lifetime) falla cerrada en vez de
  // publicar una oferta que los Términos todavía no describen.
  if (offering?.availablePackages.length !== 1) return null;
  const onlyPackage = offering.availablePackages[0];
  if (onlyPackage.packageType !== "MONTHLY" || onlyPackage.product.subscriptionPeriod !== "P1M") return null;

  // La prueba y su duración salen de la tienda, igual que el precio. Si la
  // tienda no confirma elegibilidad, el plan viaja sin promesa de prueba.
  const trialEligibility = await nativeTrialEligibility(onlyPackage.product);

  const packages = new Map<string, PurchasesPackage>();
  const plans = [onlyPackage].map((item) => {
    packages.set(item.identifier, item);
    return nativeStorePlan({
      id: item.identifier,
      packageType: item.packageType,
      title: item.product.title,
      priceString: item.product.priceString,
      subscriptionPeriod: item.product.subscriptionPeriod,
      pricePerMonthString: item.product.pricePerMonthString,
      introOffer: item.product.introPrice
        ? {
            price: item.product.introPrice.price,
            priceString: item.product.introPrice.priceString,
            cycles: item.product.introPrice.cycles,
            period: item.product.introPrice.period
          }
        : null,
      trialEligibility
    });
  });
  return { offering, plans, packages };
}

async function requireMatchingUser(userId: string): Promise<void> {
  if (!(await Purchases.isConfigured()) || (await Purchases.getAppUserID()) !== userId) {
    throw new Error("REVENUECAT_IDENTITY_MISMATCH");
  }
}

export async function purchaseNativePackage(
  item: PurchasesPackage,
  userId: string
): Promise<{ result: RevenueCatActionResult; customerInfo: CustomerInfo | null }> {
  await requireMatchingUser(userId);
  try {
    const { customerInfo } = await Purchases.purchasePackage(item);
    return { result: customerHasOrbitaPro(customerInfo) ? "active" : "inactive", customerInfo };
  } catch (error) {
    const purchaseError = error as { code?: unknown; userCancelled?: unknown };
    if (
      purchaseError.userCancelled === true ||
      purchaseError.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
    ) {
      return { result: "cancelled", customerInfo: null };
    }
    throw error;
  }
}

export async function restoreNativePurchases(
  userId: string
): Promise<{ result: "active" | "inactive"; customerInfo: CustomerInfo }> {
  await requireMatchingUser(userId);
  const customerInfo = await Purchases.restorePurchases();
  return { result: customerHasOrbitaPro(customerInfo) ? "active" : "inactive", customerInfo };
}

export async function refreshNativeCustomerInfo(userId: string): Promise<CustomerInfo> {
  await requireMatchingUser(userId);
  return await Purchases.getCustomerInfo();
}

export async function presentNativeCustomerCenter(userId: string): Promise<void> {
  await requireMatchingUser(userId);
  await RevenueCatUI.presentCustomerCenter();
}

export async function trackNativePaywall(offering: PurchasesOffering): Promise<void> {
  await Purchases.trackCustomPaywallImpression({ offering });
}

export function listenForCustomerInfo(listener: CustomerInfoUpdateListener): () => void {
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}
