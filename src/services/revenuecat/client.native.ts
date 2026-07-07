// Implementación nativa (iOS/Android) de RevenueCat. Metro carga este archivo en
// vez de `client.ts` en plataformas nativas. Requiere una build con dev-client /
// EAS (no funciona en Expo Go ni web).
import { Platform } from "react-native";
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  PurchasesError,
  PurchasesOffering,
  PurchasesPackage
} from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { ORBITA_PLAN_PRODUCT_IDS, ORBITA_PRO_ENTITLEMENT_ID, ORBITA_REVENUECAT_OFFERING_ID, OrbitaPlanId } from "./constants";

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

type NormalizedRevenueCatError = {
  code?: string;
  isCancelled: boolean;
  message: string;
};

let hasConfiguredRevenueCat = false;

export function isRevenueCatSupported(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

function getRevenueCatApiKey(): string | undefined {
  const testKey = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ?? "test_abWYVQjsvuJRVRjJDXjuIIiPPvR";

  if (__DEV__) {
    return testKey;
  }

  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? testKey;
  }

  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? testKey;
  }

  return undefined;
}

export async function configureRevenueCat(appUserID?: string): Promise<boolean> {
  if (!isRevenueCatSupported()) {
    return false;
  }

  if (hasConfiguredRevenueCat) {
    return true;
  }

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    throw new Error("Missing RevenueCat public SDK key for this platform.");
  }

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
  Purchases.configure({ apiKey, appUserID });
  hasConfiguredRevenueCat = true;

  return true;
}

export async function identifyRevenueCatUser(appUserID: string): Promise<CustomerInfo | null> {
  const configured = await configureRevenueCat();
  if (!configured) {
    return null;
  }

  const currentAppUserID = await Purchases.getAppUserID();
  if (currentAppUserID === appUserID) {
    return await Purchases.getCustomerInfo();
  }

  const { customerInfo } = await Purchases.logIn(appUserID);
  return customerInfo;
}

export async function logOutRevenueCatUser(): Promise<void> {
  if (!isRevenueCatSupported()) {
    return;
  }
  await configureRevenueCat();
  await Purchases.logOut();
}

export function isOrbitaPro(customerInfo: CustomerInfo | null | undefined): boolean {
  return Boolean(customerInfo?.entitlements.active[ORBITA_PRO_ENTITLEMENT_ID]);
}

export async function getRevenueCatCustomerInfo(): Promise<CustomerInfo | null> {
  const configured = await configureRevenueCat();
  if (!configured) {
    return null;
  }
  return await Purchases.getCustomerInfo();
}

async function getCurrentOffering(): Promise<PurchasesOffering> {
  await configureRevenueCat();

  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  const fallback = offerings.all[ORBITA_REVENUECAT_OFFERING_ID];

  if (!current && !fallback) {
    throw new Error("No RevenueCat offering is configured.");
  }

  return current ?? fallback;
}

function packageMatchesPlan(pkg: PurchasesPackage, planId: OrbitaPlanId): boolean {
  const productId = ORBITA_PLAN_PRODUCT_IDS[planId];
  const packageIdentifier = pkg.identifier.toLowerCase();
  const productIdentifier = pkg.product.identifier.toLowerCase();
  const packageType = String(pkg.packageType).toLowerCase();

  if (productIdentifier === productId) {
    return true;
  }

  if (packageIdentifier === planId || packageIdentifier === productId) {
    return true;
  }

  if (planId === "lifetime") {
    return packageIdentifier.includes("lifetime") || packageType.includes("lifetime");
  }

  if (planId === "yearly") {
    return packageIdentifier.includes("annual") || packageIdentifier.includes("year") || packageType.includes("annual");
  }

  return packageIdentifier.includes("weekly") || packageType.includes("weekly");
}

function findPackageForPlan(offering: PurchasesOffering, planId: OrbitaPlanId): PurchasesPackage {
  const pkg = offering.availablePackages.find((candidate) => packageMatchesPlan(candidate, planId));
  if (!pkg) {
    throw new Error(`Missing RevenueCat package for plan: ${planId}`);
  }
  return pkg;
}

function normalizeRevenueCatError(error: unknown): NormalizedRevenueCatError {
  const purchasesError = error as Partial<PurchasesError> & {
    code?: string;
    message?: string;
    userCancelled?: boolean;
  };

  const code = purchasesError.code;
  const isCancelled =
    purchasesError.userCancelled === true || code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;

  if (isCancelled) {
    return { code, isCancelled: true, message: "Compra cancelada." };
  }

  if (code?.toLowerCase().includes("network")) {
    return { code, isCancelled: false, message: "No pudimos contactar a RevenueCat. Revisá la conexión y probá de nuevo." };
  }

  if (code?.toLowerCase().includes("configuration")) {
    return { code, isCancelled: false, message: "RevenueCat no está configurado correctamente para este producto." };
  }

  return { code, isCancelled: false, message: purchasesError.message ?? "No se pudo completar la compra." };
}

export async function purchaseOrbitaPlan(planId: OrbitaPlanId): Promise<PurchaseResult> {
  try {
    const offering = await getCurrentOffering();
    const packageToBuy = findPackageForPlan(offering, planId);
    const { customerInfo, productIdentifier } = await Purchases.purchasePackage(packageToBuy);

    return {
      customerInfo,
      productIdentifier,
      isPro: isOrbitaPro(customerInfo),
      wasCancelled: false
    };
  } catch (error) {
    const normalized = normalizeRevenueCatError(error);
    if (normalized.isCancelled) {
      return { customerInfo: null, productIdentifier: undefined, isPro: false, wasCancelled: true };
    }
    throw new Error(normalized.message);
  }
}

export async function restoreOrbitaPurchases(): Promise<{ customerInfo: CustomerInfo | null; isPro: boolean }> {
  try {
    await configureRevenueCat();
    const customerInfo = await Purchases.restorePurchases();
    return { customerInfo, isPro: isOrbitaPro(customerInfo) };
  } catch (error) {
    const normalized = normalizeRevenueCatError(error);
    throw new Error(normalized.message);
  }
}

export async function presentOrbitaProPaywall(): Promise<PaywallResult> {
  await configureRevenueCat();

  const result = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: ORBITA_PRO_ENTITLEMENT_ID
  });

  if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
    const customerInfo = await Purchases.getCustomerInfo();
    return { customerInfo, isPro: isOrbitaPro(customerInfo), result: String(result) };
  }

  return { customerInfo: await Purchases.getCustomerInfo(), isPro: false, result: String(result) };
}

export async function openRevenueCatCustomerCenter(): Promise<void> {
  await configureRevenueCat();
  await RevenueCatUI.presentCustomerCenter();
}

export function subscribeToCustomerInfo(listener: (customerInfo: CustomerInfo) => void): () => void {
  if (!isRevenueCatSupported()) {
    return () => {};
  }
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}
