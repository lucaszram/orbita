# RevenueCat React Native Integration Handoff

Date: 2026-07-06

Scope: frontend implementation for the Expo/React Native app. Codex should not edit
`app/` or `src/` in the shared workflow, so this is a handoff for the frontend
worktree. Current app facts: Expo SDK 54, React Native 0.81.5, Expo Router,
NativeWind/RN Reusables, bundle/package `com.horoscopo.orbita`, and a Convex
subscription stub that is not yet wired to real purchases.

Sources checked:

- RevenueCat React Native installation: https://www.revenuecat.com/docs/getting-started/installation/reactnative
- RevenueCat Expo installation: https://www.revenuecat.com/docs/getting-started/installation/expo
- RevenueCat SDK configuration: https://www.revenuecat.com/docs/getting-started/configuring-sdk
- RevenueCat product configuration: https://www.revenuecat.com/docs/projects/configuring-products
- RevenueCat entitlements: https://www.revenuecat.com/docs/getting-started/entitlements
- RevenueCat offerings: https://www.revenuecat.com/docs/offerings/overview
- RevenueCat paywalls: https://www.revenuecat.com/docs/tools/paywalls
- RevenueCat React Native paywall display: https://www.revenuecat.com/docs/tools/paywalls/displaying-paywalls
- RevenueCat CustomerInfo/subscription status: https://www.revenuecat.com/docs/customers/customer-info
- RevenueCat Customer Center: https://www.revenuecat.com/docs/tools/customer-center
- RevenueCat React Native Customer Center: https://www.revenuecat.com/docs/tools/customer-center/customer-center-react-native

## Recommended Decisions

- Use RevenueCat as the immediate client source of truth for premium access.
- Mirror subscription state into Convex later through RevenueCat webhooks, not by
  trusting client writes for server-side gating.
- Use entitlement identifier `orbita_pro` with display name `Orbita Pro`.
  If the RevenueCat dashboard entitlement identifier is literally `Orbita Pro`,
  update the constant below to that exact string. The SDK checks identifiers,
  not display names.
- Configure products requested by Lucas:
  - `lifetime`: lifetime access, non-consumable, unlocks `orbita_pro`
  - `yearly`: yearly subscription, unlocks `orbita_pro`
  - `weekly`: weekly subscription, unlocks `orbita_pro`
- Use RevenueCat Offering identifier `default`, with packages for lifetime,
  annual/yearly, and weekly.
- Prefer RevenueCat Paywalls for the first real checkout because the paywall can
  be edited remotely. Keep the manual purchase helper below if the current
  Figma-authored onboarding payment screen must stay fully custom.
- Add Customer Center in Profile/Settings once subscriptions are live and the
  RevenueCat plan supports it. It makes sense for restore, cancellation, refund
  request on iOS, plan changes on iOS, and reducing support work.

## Install With npm

The user requested npm:

```bash
npm install --save react-native-purchases react-native-purchases-ui
```

Because this is an Expo app and these are native modules, add a development
client if the frontend worktree does not already have one:

```bash
npx expo install expo-dev-client
```

After installing, rebuild the native app. An EAS Update alone will not add the
new native modules to an already-installed binary.

Suggested `eas.json` addition for this repo:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "preview",
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

Then build and run:

```bash
npx eas build --platform ios --profile development
npx eas build --platform android --profile development
npx expo start --dev-client
```

Expo Go can preview some RevenueCat logic through preview mode, but real in-app
purchases, native paywalls, and end-to-end store behavior must be tested in a
development, preview, TestFlight, or Play internal build.

## Environment

The key provided by Lucas is a public SDK key for testing:

```bash
EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=test_abWYVQjsvuJRVRjJDXjuIIiPPvR
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=test_abWYVQjsvuJRVRjJDXjuIIiPPvR
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=test_abWYVQjsvuJRVRjJDXjuIIiPPvR
```

For production, replace platform keys with RevenueCat app-specific public SDK
keys from the dashboard, usually Apple and Google keys. Do not put RevenueCat
secret API keys in the app.

## RevenueCat Dashboard Setup

1. Create or open the RevenueCat project for Orbita.
2. Add apps/stores:
   - iOS bundle id: `com.horoscopo.orbita`
   - Android package: `com.horoscopo.orbita`
   - Use Test Store while developing if App Store Connect/Google Play products
     are not ready.
3. Create products:
   - `lifetime`: non-consumable or lifetime package, price decided in stores
   - `yearly`: annual subscription
   - `weekly`: weekly subscription
4. Create entitlement:
   - Identifier: `orbita_pro`
   - Display name: `Orbita Pro`
5. Attach all three products to `orbita_pro`.
6. Create Offering:
   - Identifier: `default`
   - Add packages:
     - Lifetime package -> product `lifetime`
     - Annual package -> product `yearly`
     - Weekly package -> product `weekly`
   - Set this Offering as the default Offering.
7. Create a RevenueCat Paywall for `default`.
8. Configure Customer Center under Monetization Tools when ready. Add support
   email and localized Spanish strings before shipping.

## Code Example: Constants

Suggested file: `src/services/revenuecat/constants.ts`

```ts
export const ORBITA_PRO_ENTITLEMENT_ID = "orbita_pro";
export const ORBITA_REVENUECAT_OFFERING_ID = "default";

export type OrbitaPlanId = "lifetime" | "yearly" | "weekly";

export const ORBITA_PLAN_PRODUCT_IDS: Record<OrbitaPlanId, string> = {
  lifetime: "lifetime",
  yearly: "yearly",
  weekly: "weekly"
};
```

## Code Example: RevenueCat Client

Suggested file: `src/services/revenuecat/client.ts`

```ts
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
import {
  ORBITA_PLAN_PRODUCT_IDS,
  ORBITA_PRO_ENTITLEMENT_ID,
  ORBITA_REVENUECAT_OFFERING_ID,
  OrbitaPlanId
} from "./constants";

type NormalizedRevenueCatError = {
  code?: string;
  isCancelled: boolean;
  message: string;
};

let hasConfiguredRevenueCat = false;

export function isRevenueCatSupported() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

function getRevenueCatApiKey() {
  const testKey =
    process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ??
    "test_abWYVQjsvuJRVRjJDXjuIIiPPvR";

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

export async function configureRevenueCat(appUserID?: string) {
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

export async function identifyRevenueCatUser(appUserID: string) {
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

export async function logOutRevenueCatUser() {
  if (!isRevenueCatSupported()) {
    return null;
  }

  await configureRevenueCat();
  return await Purchases.logOut();
}

export function isOrbitaPro(customerInfo: CustomerInfo | null | undefined) {
  return Boolean(customerInfo?.entitlements.active[ORBITA_PRO_ENTITLEMENT_ID]);
}

export async function getRevenueCatCustomerInfo() {
  const configured = await configureRevenueCat();

  if (!configured) {
    return null;
  }

  return await Purchases.getCustomerInfo();
}

export async function getCurrentOffering() {
  await configureRevenueCat();

  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  const fallback = offerings.all[ORBITA_REVENUECAT_OFFERING_ID];

  if (!current && !fallback) {
    throw new Error("No RevenueCat offering is configured.");
  }

  return current ?? fallback;
}

function packageMatchesPlan(pkg: PurchasesPackage, planId: OrbitaPlanId) {
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
    return (
      packageIdentifier.includes("annual") ||
      packageIdentifier.includes("year") ||
      packageType.includes("annual")
    );
  }

  return packageIdentifier.includes("weekly") || packageType.includes("weekly");
}

export function findPackageForPlan(offering: PurchasesOffering, planId: OrbitaPlanId) {
  const pkg = offering.availablePackages.find((candidate) =>
    packageMatchesPlan(candidate, planId)
  );

  if (!pkg) {
    throw new Error(`Missing RevenueCat package for plan: ${planId}`);
  }

  return pkg;
}

export function normalizeRevenueCatError(error: unknown): NormalizedRevenueCatError {
  const purchasesError = error as Partial<PurchasesError> & {
    code?: string;
    message?: string;
    userCancelled?: boolean;
  };

  const code = purchasesError.code;
  const isCancelled =
    purchasesError.userCancelled === true ||
    code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;

  if (isCancelled) {
    return {
      code,
      isCancelled: true,
      message: "Purchase cancelled."
    };
  }

  if (code?.toLowerCase().includes("network")) {
    return {
      code,
      isCancelled: false,
      message: "We could not reach RevenueCat. Check the connection and try again."
    };
  }

  if (code?.toLowerCase().includes("configuration")) {
    return {
      code,
      isCancelled: false,
      message: "RevenueCat is not configured correctly for this product."
    };
  }

  return {
    code,
    isCancelled: false,
    message: purchasesError.message ?? "The purchase could not be completed."
  };
}

export async function purchaseOrbitaPlan(planId: OrbitaPlanId) {
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
      return {
        customerInfo: null,
        productIdentifier: undefined,
        isPro: false,
        wasCancelled: true
      };
    }

    throw new Error(normalized.message);
  }
}

export async function restoreOrbitaPurchases() {
  try {
    await configureRevenueCat();
    const customerInfo = await Purchases.restorePurchases();

    return {
      customerInfo,
      isPro: isOrbitaPro(customerInfo)
    };
  } catch (error) {
    const normalized = normalizeRevenueCatError(error);
    throw new Error(normalized.message);
  }
}

export async function presentOrbitaProPaywall() {
  await configureRevenueCat();

  const result = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: ORBITA_PRO_ENTITLEMENT_ID
  });

  if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
    const customerInfo = await Purchases.getCustomerInfo();

    return {
      customerInfo,
      isPro: isOrbitaPro(customerInfo),
      result
    };
  }

  return {
    customerInfo: await Purchases.getCustomerInfo(),
    isPro: false,
    result
  };
}

export async function openRevenueCatCustomerCenter() {
  await configureRevenueCat();

  await RevenueCatUI.presentCustomerCenter({
    callbacks: {
      onRestoreCompleted: ({ customerInfo }) => {
        const active = isOrbitaPro(customerInfo);
        console.info("RevenueCat restore completed", { active });
      },
      onRestoreFailed: ({ error }) => {
        console.warn("RevenueCat restore failed", error);
      },
      onManagementOptionSelected: ({ option }) => {
        console.info("RevenueCat Customer Center option selected", option);
      }
    }
  });
}
```

## Code Example: React Provider

Suggested file: `src/services/revenuecat/RevenueCatProvider.tsx`

```tsx
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Purchases, { CustomerInfo } from "react-native-purchases";
import {
  configureRevenueCat,
  getRevenueCatCustomerInfo,
  isOrbitaPro,
  isRevenueCatSupported,
  normalizeRevenueCatError,
  openRevenueCatCustomerCenter,
  presentOrbitaProPaywall,
  purchaseOrbitaPlan,
  restoreOrbitaPurchases
} from "./client";
import { OrbitaPlanId } from "./constants";

type RevenueCatState = {
  customerInfo: CustomerInfo | null;
  error: string | null;
  isLoading: boolean;
  isPro: boolean;
  isSupported: boolean;
  openCustomerCenter: () => Promise<void>;
  presentPaywall: () => Promise<boolean>;
  purchasePlan: (planId: OrbitaPlanId) => Promise<boolean>;
  refreshCustomerInfo: () => Promise<CustomerInfo | null>;
  restorePurchases: () => Promise<boolean>;
};

const RevenueCatContext = createContext<RevenueCatState | null>(null);

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCustomerInfo = useCallback(async () => {
    if (!isRevenueCatSupported()) {
      return null;
    }

    const nextCustomerInfo = await getRevenueCatCustomerInfo();
    setCustomerInfo(nextCustomerInfo);
    return nextCustomerInfo;
  }, []);

  useEffect(() => {
    let mounted = true;
    const listener = (nextCustomerInfo: CustomerInfo) => {
      if (mounted) {
        setCustomerInfo(nextCustomerInfo);
      }
    };

    async function bootRevenueCat() {
      if (!isRevenueCatSupported()) {
        setIsLoading(false);
        return;
      }

      try {
        await configureRevenueCat();
        Purchases.addCustomerInfoUpdateListener(listener);
        const initialCustomerInfo = await Purchases.getCustomerInfo();

        if (mounted) {
          setCustomerInfo(initialCustomerInfo);
        }
      } catch (bootError) {
        const normalized = normalizeRevenueCatError(bootError);

        if (mounted) {
          setError(normalized.message);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    bootRevenueCat();

    return () => {
      mounted = false;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  const purchasePlan = useCallback(async (planId: OrbitaPlanId) => {
    const result = await purchaseOrbitaPlan(planId);

    if (result.customerInfo) {
      setCustomerInfo(result.customerInfo);
    }

    return result.isPro;
  }, []);

  const restorePurchases = useCallback(async () => {
    const result = await restoreOrbitaPurchases();
    setCustomerInfo(result.customerInfo);
    return result.isPro;
  }, []);

  const presentPaywall = useCallback(async () => {
    const result = await presentOrbitaProPaywall();
    setCustomerInfo(result.customerInfo);
    return result.isPro;
  }, []);

  const openCustomerCenter = useCallback(async () => {
    await openRevenueCatCustomerCenter();
    await refreshCustomerInfo();
  }, [refreshCustomerInfo]);

  const value = useMemo<RevenueCatState>(
    () => ({
      customerInfo,
      error,
      isLoading,
      isPro: isOrbitaPro(customerInfo),
      isSupported: isRevenueCatSupported(),
      openCustomerCenter,
      presentPaywall,
      purchasePlan,
      refreshCustomerInfo,
      restorePurchases
    }),
    [
      customerInfo,
      error,
      isLoading,
      openCustomerCenter,
      presentPaywall,
      purchasePlan,
      refreshCustomerInfo,
      restorePurchases
    ]
  );

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
}

export function useRevenueCat() {
  const value = useContext(RevenueCatContext);

  if (!value) {
    throw new Error("useRevenueCat must be used within RevenueCatProvider");
  }

  return value;
}
```

## Code Example: Mount Provider

Suggested change in `app/_layout.tsx`:

```tsx
import { RevenueCatProvider } from "@/services/revenuecat/RevenueCatProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <BackendProviders>
        <RevenueCatProvider>
          <AppStateProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="paywall" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </AppStateProvider>
        </RevenueCatProvider>
      </BackendProviders>
    </SafeAreaProvider>
  );
}
```

## Code Example: Identify Clerk Users

RevenueCat can start anonymous during onboarding. After Clerk sign-in, identify
the user with the stable Clerk user id:

```tsx
import { useUser } from "@clerk/clerk-expo";
import { useEffect } from "react";
import { identifyRevenueCatUser } from "@/services/revenuecat/client";

export function RevenueCatIdentityBridge() {
  const { user } = useUser();

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    identifyRevenueCatUser(user.id).catch((error) => {
      console.warn("RevenueCat identify failed", error);
    });
  }, [user?.id]);

  return null;
}
```

Mount this only inside a Clerk provider. If the app is running without Clerk
envs, skip this bridge and let RevenueCat use an anonymous id until auth is
fully implemented.

## Code Example: RevenueCat Paywall Route

Suggested file: `app/paywall.tsx`

```tsx
import { router } from "expo-router";
import { View } from "react-native";
import RevenueCatUI from "react-native-purchases-ui";
import { CustomerInfo } from "react-native-purchases";
import { isOrbitaPro } from "@/services/revenuecat/client";

export default function PaywallScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#090A0D" }}>
      <RevenueCatUI.Paywall
        onPurchaseCompleted={({ customerInfo }: { customerInfo: CustomerInfo }) => {
          if (isOrbitaPro(customerInfo)) {
            router.replace("/(tabs)");
          }
        }}
        onRestoreCompleted={({ customerInfo }: { customerInfo: CustomerInfo }) => {
          if (isOrbitaPro(customerInfo)) {
            router.replace("/(tabs)");
          }
        }}
        onPurchaseError={({ error }) => {
          console.warn("RevenueCat paywall purchase failed", error);
        }}
        onRestoreError={({ error }) => {
          console.warn("RevenueCat paywall restore failed", error);
        }}
        onDismiss={() => {
          router.back();
        }}
      />
    </View>
  );
}
```

For most gated actions, prefer the imperative helper:

```ts
const unlocked = await presentPaywall();

if (unlocked) {
  // Continue to Pro content.
}
```

## Code Example: Use Current Onboarding Payment Screen

If the frontend keeps the current Figma custom payment screen in
`app/onboarding.tsx`, wire the existing plan selector to manual package
purchases:

```tsx
import { Alert } from "react-native";
import { useRevenueCat } from "@/services/revenuecat/RevenueCatProvider";
import { OrbitaPlanId } from "@/services/revenuecat/constants";

function OnboardingPaymentActions({
  selectedPlan,
  completeOnboarding
}: {
  selectedPlan: OrbitaPlanId;
  completeOnboarding: () => Promise<void>;
}) {
  const { purchasePlan, restorePurchases, isPro } = useRevenueCat();

  async function handleContinue() {
    if (isPro) {
      await completeOnboarding();
      return;
    }

    try {
      const unlocked = await purchasePlan(selectedPlan);

      if (unlocked) {
        await completeOnboarding();
        return;
      }

      Alert.alert(
        "No pudimos activar Pro",
        "La compra termino, pero el entitlement todavia no figura activo. Proba restaurar o intenta de nuevo."
      );
    } catch (error) {
      Alert.alert(
        "No se pudo completar la compra",
        error instanceof Error ? error.message : "Volvelo a intentar en unos minutos."
      );
    }
  }

  async function handleRestore() {
    try {
      const restored = await restorePurchases();

      Alert.alert(
        restored ? "Compra restaurada" : "Sin compras activas",
        restored
          ? "Orbita Pro ya esta activo en este dispositivo."
          : "No encontramos una compra activa para esta cuenta."
      );
    } catch (error) {
      Alert.alert(
        "No se pudo restaurar",
        error instanceof Error ? error.message : "Volvelo a intentar en unos minutos."
      );
    }
  }

  return {
    handleContinue,
    handleRestore
  };
}
```

The current `Restaurar` text in screen 15 should become a real press target that
calls `handleRestore`.

## Code Example: Customer Info Retrieval

Use this any time a Pro-gated screen opens:

```ts
import { getRevenueCatCustomerInfo, isOrbitaPro } from "@/services/revenuecat/client";

export async function canOpenOrbitaProContent() {
  const customerInfo = await getRevenueCatCustomerInfo();
  return isOrbitaPro(customerInfo);
}
```

RevenueCat caches CustomerInfo, so calling this when opening Pro content is fine.
It also refreshes if the cache is stale.

## Code Example: Customer Center

Add this to Profile/Settings once subscriptions are live:

```tsx
import { Alert, Pressable, Text } from "react-native";
import { useRevenueCat } from "@/services/revenuecat/RevenueCatProvider";

export function ManageSubscriptionButton() {
  const { openCustomerCenter, isSupported } = useRevenueCat();

  if (!isSupported) {
    return null;
  }

  async function handlePress() {
    try {
      await openCustomerCenter();
    } catch (error) {
      Alert.alert(
        "No pudimos abrir la gestion",
        error instanceof Error ? error.message : "Proba de nuevo en unos minutos."
      );
    }
  }

  return (
    <Pressable onPress={handlePress} accessibilityRole="button">
      <Text>Gestionar suscripcion</Text>
    </Pressable>
  );
}
```

When Customer Center makes sense:

- Yes: Profile/Settings, "Gestionar suscripcion", after purchase is live.
- Yes: support flow for "Restaurar compra" or "No veo mi compra".
- Yes: before shipping, once support email, refunds, cancellation, and plan
  changes are configured in RevenueCat.
- Not necessary: first onboarding implementation if the only need is checkout.

## Server and Convex Best Practices

The existing `convex/subscriptions.ts` is a dev stub. For production:

1. Keep app gating immediate with RevenueCat SDK CustomerInfo.
2. Add RevenueCat webhooks to Convex for a server-side mirror.
3. Store:
   - `provider: "revenuecat"`
   - `providerCustomerId`: RevenueCat App User ID, ideally Clerk user id
   - `productId`
   - `entitlement: "plus"` or migrate contract to `pro`
   - `status`
   - `currentPeriodEnd`
   - `originalTransactionId`
4. Do not let the client mark itself paid in Convex for server-authoritative
   access. A client-side mutation is fine only for analytics/draft state.
5. Consider a contract cleanup later: product uses "Orbita Pro", while Convex
   currently says entitlement `"plus"`. Either map RevenueCat `orbita_pro` to
   Convex `"plus"` for now, or make a separate contract PR to rename the server
   entitlement.

## Testing Checklist

- RevenueCat dashboard has products, entitlement, offering, and paywall.
- Test Store key works with `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`.
- Native app has been rebuilt after installing SDKs.
- `Purchases.configure` runs once on app launch.
- CustomerInfo logs show active entitlement after Test Store purchase.
- Restore button is reachable on paywall and Profile.
- User cancellation does not show an error alert.
- Network/configuration errors show a clear retry message.
- On web, do not show native purchase UI unless RevenueCat Billing is configured.
- Before production, replace test key with platform public SDK keys, configure
  App Store Connect and Google Play products, and test sandbox purchases.

## Product Guardrails for Paywall Copy

Keep current Orbita framing:

- Entertainment, self-knowledge, and daily context.
- No claims about destiny, guaranteed outcomes, health, money, legal decisions,
  or psychological advice.
- Current safe subscription promise:
  - "Carta natal completa"
  - "Guia diaria personalizada"
  - "Transitos en tu carta"
  - "Lecturas mas profundas"
  - "Cancelas cuando quieras"

