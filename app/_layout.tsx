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
import { PendingDeletionBoundary } from "@/components/PendingDeletionBoundary";
import { AccountBootstrapProvider } from "@/hooks/useAccountBootstrap";
import { AppStateProvider } from "@/hooks/useAppState";
import { DailyContextProvider } from "@/hooks/useDailyContext";
import { OrbitaSessionProvider } from "@/hooks/useLiveApp";
import { BackendProviders, backendConfig } from "@/services/backendProviders";
import { InstallPing } from "@/components/InstallPing";
import { RevenueCatProvider } from "@/services/revenuecat/RevenueCatProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <BackendProviders>
        {backendConfig.hasConvex ? <InstallPing /> : null}
        {/* Eliminación de cuenta pendiente: se resuelve ANTES que nada.
            Mientras haya un marcador —o el disco no conteste— no se monta la
            sesión (que recrearía la fila Convex de la cuenta borrada), ni el
            bootstrap, ni el AppState, ni el Stack. El gate vivía dentro de `/`
            y lo esquivaba cualquier deep link o pestaña restaurada. */}
        <PendingDeletionBoundary>
        {/* Sesión central (hotfix build 11): un solo estado Clerk/Convex
            compartido; antes cada pantalla resolvía la sesión por su cuenta. */}
        <OrbitaSessionProvider>
          {/* Nativo: identifica RevenueCat recién cuando Clerk + fila Convex
              están listos. Web resuelve un provider vacío y conserva Stripe. */}
          <RevenueCatProvider>
          {/* Fecha canónica compartida: una sola llamada a getTodayContext por
              sesión, dentro de la sesión central. */}
          <DailyContextProvider>
          <AppStateProvider>
          <ConfirmHost>
          <AccountBootstrapProvider>
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
              {/* El Umbral no tiene ruta raíz: `/umbral` es la pestaña
                  (`app/(tabs)/umbral`), su único dueño. */}
              <Stack.Screen name="paywall" />
              <Stack.Screen name="checkout/success" />
              <Stack.Screen name="profile" />
              <Stack.Screen name="carta-full" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </AccountBootstrapProvider>
          </ConfirmHost>
          </AppStateProvider>
          </DailyContextProvider>
          </RevenueCatProvider>
        </OrbitaSessionProvider>
        </PendingDeletionBoundary>
      </BackendProviders>
    </SafeAreaProvider>
  );
}
