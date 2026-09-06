import { Redirect } from "expo-router";
import { BackofficeRoute as BackofficeScreen } from "@/components/backoffice/BackofficeLab";
import { INTERNAL_TOOLS_ENABLED } from "@/services/internalTools";

export default function BackofficeRoute() {
  if (!INTERNAL_TOOLS_ENABLED) return <Redirect href="/" />;
  return <BackofficeScreen />;
}
