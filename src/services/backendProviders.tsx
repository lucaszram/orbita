import Constants from "expo-constants";
import { ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL ?? extra?.convexUrl;
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? extra?.clerkPublishableKey;

export const backendConfig = {
  convexUrl,
  clerkPublishableKey,
  isConfigured: Boolean(convexUrl && clerkPublishableKey)
};

export function BackendProviders({ children }: { children: ReactNode }) {
  const convex = useMemo(() => (convexUrl ? new ConvexReactClient(convexUrl) : null), []);

  if (!convex || !clerkPublishableKey) {
    return <>{children}</>;
  }

  const { ClerkProvider, useAuth } = require("@clerk/expo");
  const { tokenCache } = require("@clerk/expo/token-cache");
  const { ConvexProviderWithClerk } = require("convex/react-clerk");

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
