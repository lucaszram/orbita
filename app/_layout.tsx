import { LogBox, StyleSheet } from "react-native";
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
import { EntitlementProvider, OrbitaSessionProvider } from "@/hooks/useLiveApp";
import { SessionResilienceProvider } from "@/hooks/useSessionResilience";
import { BackendProviders, backendConfig } from "@/services/backendProviders";
import { InstallPing } from "@/components/InstallPing";
import { RevenueCatProvider } from "@/services/revenuecat/RevenueCatProvider";
import {
  BOOT_BACKGROUND,
  BOOT_SCREEN_OPTIONS,
  BOOT_STATUS_BAR_STYLE
} from "@/theme/boot";

export default function RootLayout() {
  return (
    // El fondo del arranque se declara en el nodo MÁS ALTO del árbol de React,
    // no sólo en el `Stack`: entre que el splash se retira y el primer gate
    // monta hay renders del boundary de eliminación, de la sesión y del plan,
    // y todos ellos se dibujan sobre esto. Un solo color, desde el primer
    // frame (QA23-006).
    <SafeAreaProvider style={styles.root}>
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
          {/* Plan de la cuenta: UNA sola `subscriptions.getCurrent` para toda la
              UI nativa, correlacionada con el dueño de Clerk y con el snapshot
              local que evita el "Órbita Free" del arranque en frío. No depende
              de RevenueCat: la tienda dice qué cobró, no qué acceso concede. */}
          <EntitlementProvider>
          {/* Nativo: identifica RevenueCat recién cuando Clerk + fila Convex
              están listos. Web resuelve un provider vacío y conserva Stripe. */}
          <RevenueCatProvider>
          {/* Fecha canónica compartida: una sola llamada a getTodayContext por
              sesión, dentro de la sesión central. */}
          <DailyContextProvider>
          <AppStateProvider>
          <ConfirmHost>
          <AccountBootstrapProvider>
          {/* Confianza de sesión: UN solo plazo de confirmación y UNA sola
              `onboarding.getCompletionStatus` para todos los gates. Un timeout
              de Clerk/Convex deja de leerse como signed-out y, con identidad
              local segura, el shell abre con los últimos datos de ESA cuenta y
              sin autoridad de escritura (QA23-007). */}
          <SessionResilienceProvider>
            <StatusBar style={BOOT_STATUS_BAR_STYLE} />
            {/* `contentStyle` para TODAS las tarjetas del stack: sin él, el
                fondo lo pone el tema por defecto de React Navigation, que es
                claro, y ese era el frame que se colaba en cada hueco entre
                gates. Las cuatro rutas del arranque suman además
                `animation: "none"` (ver `@/theme/boot`): un `<Redirect>` es un
                `replace`, y el stack nativo anima un replace como un `pop` —el
                deslizamiento lateral del arranque—. El resto de las pantallas
                NO lleva opciones propias: se abren desde el producto y
                conservan su animación. */}
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: BOOT_BACKGROUND }
              }}
            >
              <Stack.Screen name="index" options={BOOT_SCREEN_OPTIONS} />
              <Stack.Screen name="onboarding" options={BOOT_SCREEN_OPTIONS} />
              <Stack.Screen name="recepcion" />
              <Stack.Screen name="iniciar-sesion" options={BOOT_SCREEN_OPTIONS} />
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
              <Stack.Screen name="(tabs)" options={BOOT_SCREEN_OPTIONS} />
            </Stack>
          </SessionResilienceProvider>
          </AccountBootstrapProvider>
          </ConfirmHost>
          </AppStateProvider>
          </DailyContextProvider>
          </RevenueCatProvider>
          </EntitlementProvider>
        </OrbitaSessionProvider>
        </PendingDeletionBoundary>
      </BackendProviders>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: BOOT_BACKGROUND, flex: 1 }
});
