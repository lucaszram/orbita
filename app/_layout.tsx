import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";
import { AppStateProvider } from "@/hooks/useAppState";
import { BackendProviders } from "@/services/backendProviders";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <BackendProviders>
        <AppStateProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="backoffice" />
            <Stack.Screen name="studio" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </AppStateProvider>
      </BackendProviders>
    </SafeAreaProvider>
  );
}
