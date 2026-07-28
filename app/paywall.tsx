import { Redirect } from "expo-router";
import { OrbitaPaywall } from "@/components/web/orbita-paywall";

export default function PaywallRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return <OrbitaPaywall />;
}
