import { useEffect } from "react";
import { router } from "expo-router";
import { useAppState } from "./useAppState";

export function useRequireProfile() {
  const { isReady, profile } = useAppState();

  useEffect(() => {
    if (isReady && !profile) {
      router.replace("/onboarding");
    }
  }, [isReady, profile]);

  return { isReady, profile };
}
