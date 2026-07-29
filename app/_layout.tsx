import { LogBox } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";

// Warning benigno del módulo nativo de expo-notifications en dev/simulador
// (lectura de notificaciones persistidas). No afecta al usuario; en release no
// hay LogBox. Lo silenciamos para no ensuciar la pantalla en el testeo interno.
LogBox.ignoreLogs(["[expo-notifications]"]);
import { ConfirmHost } from "@/components/orbita/ConfirmHost";
import { AppStateProvider } from "@/hooks/useAppState";
import { DailyContextProvider } from "@/hooks/useDailyContext";
import { OrbitaSessionProvider } from "@/hooks/useLiveApp";
import { BackendProviders, backendConfig } from "@/services/backendProviders";
import { InstallPing } from "@/components/InstallPing";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <BackendProviders>
        {backendConfig.hasConvex ? <InstallPing /> : null}
        {/* Sesión central (hotfix build 11): un solo estado Clerk/Convex
            compartido; antes cada pantalla resolvía la sesión por su cuenta. */}
        <OrbitaSessionProvider>
          {/* Fecha canónica compartida: una sola llamada a getTodayContext por
              sesión, dentro de la sesión central. */}
          <DailyContextProvider>
          <AppStateProvider>
          <ConfirmHost>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="recepcion" />
              <Stack.Screen name="iniciar-sesion" />
              <Stack.Screen name="editar-datos" />
              <Stack.Screen name="lab" />
              <Stack.Screen name="backoffice" />
              <Stack.Screen name="studio" />
              <Stack.Screen name="reading" />
              <Stack.Screen name="umbral" />
              <Stack.Screen name="paywall" />
              <Stack.Screen name="checkout/success" />
              <Stack.Screen name="profile" />
              <Stack.Screen name="carta-full" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </ConfirmHost>
          </AppStateProvider>
          </DailyContextProvider>
        </OrbitaSessionProvider>
      </BackendProviders>
    </SafeAreaProvider>
  );
}
