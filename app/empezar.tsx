import { Redirect } from "expo-router";
import { OnboardingWithBackend, OrbitaOnboarding } from "@/components/web/orbita-onboarding";
import { backendConfig } from "@/services/backendProviders";

export default function EmpezarRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/onboarding" />;
  }

  // Con Convex+Clerk: escribe carta real (login en el paso de cuenta). Sin config: demo mock.
  if (backendConfig.isConfigured) {
    return <OnboardingWithBackend />;
  }
  return <OrbitaOnboarding />;
}
