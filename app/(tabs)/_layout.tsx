import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect, Slot, Tabs, usePathname } from "expo-router";
import { WebAppShell } from "@/components/web/web-app-shell";
import type { NavKey } from "@/components/web/web-nav";
import { OrbitaTabBar } from "@/components/orbita/TabBar";
import { resolveTabsGuard, type LocalProfileOwner } from "@/domain/sessionStart";
import { useAppState } from "@/hooks/useAppState";
import { useLiveApp } from "@/hooks/useLiveApp";
import { backendConfig } from "@/services/backendProviders";
import { theme } from "@/theme/theme";

const IS_WEB = process.env.EXPO_OS === "web";
const BACKEND_CONFIGURED = backendConfig.hasConvex && backendConfig.hasClerk;
const CLERK_LOAD_TIMEOUT_MS = 8000;

/**
 * Gate de sesión de las tabs — ARRIBA de `(tabs)` a propósito: iOS restaura la
 * navegación y puede montar una pestaña DIRECTO tras una actualización, sin
 * pasar nunca por `app/index.tsx`. Ese era el agujero por el que un usuario
 * con cuenta y sin sesión veía la Home invitada.
 *
 * Órbita no tiene modo invitado: sin sesión confirmada no se renderiza Home,
 * Tránsitos, Umbral ni Perfil. La regla vive en `resolveTabsGuard` (con tests).
 */
/** Qué sección de la navegación web corresponde a la ruta actual. */
function navKeyForPath(pathname: string): NavKey {
  if (pathname.startsWith("/transitos")) return "transitos";
  if (pathname.startsWith("/vacio") || pathname.startsWith("/umbral")) return "umbral";
  if (pathname.startsWith("/carta")) return "carta";
  if (pathname.startsWith("/perfil")) return "perfil";
  return "inicio";
}

export default function TabsLayout() {
  const pathname = usePathname();
  const { isReady, profile, profileOwner, profileAdoptionPending } = useAppState();
  const { auth } = useLiveApp();
  const [clerkTimedOut, setClerkTimedOut] = useState(false);

  useEffect(() => {
    if (IS_WEB || !BACKEND_CONFIGURED || auth?.isLoaded) return;
    const t = setTimeout(() => setClerkTimedOut(true), CLERK_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [auth?.isLoaded]);

  const localProfileOwner: LocalProfileOwner = !profile || !profileOwner
    ? "none"
    : auth?.isSignedIn && profileOwner === auth.userId
      ? "current"
      : "other";

  const guard = IS_WEB
    ? "allow"
    : resolveTabsGuard({
        backendConfigured: BACKEND_CONFIGURED,
        localReady: isReady,
        hasLocalProfile: !!profile,
        localProfileOwner,
        clerkLoaded: auth ? auth.isLoaded : true,
        clerkTimedOut,
        isSignedIn: !!auth?.isSignedIn,
        profileAdoptionPending,
        // La recuperación remota es del arranque, no de las tabs.
        recovery: "idle",
        hasRemoteBirthData: false
      });

  switch (guard) {
    case "sign-in":
      return <Redirect href="/iniciar-sesion" />;
    case "entry":
      return <Redirect href="/onboarding" />;
    case "start":
      // Clerk no resolvió a tiempo: la pantalla de reintento (no destructiva)
      // vive en "/" y no se duplica acá.
      return <Redirect href="/" />;
    case "loading":
      return (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.plum} />
        </View>
      );
    case "allow":
    default:
      break;
  }

  // En web la barra de pestañas de React Navigation no es el chrome de la app:
  // el resto de las rutas autenticadas usa `WebAppShell`, y tener dos chromes
  // distintos según la ruta era justamente la deriva que este trabajo elimina.
  // El shell se monta UNA vez acá, en el layout, no por pantalla.
  // En nativo no cambia absolutamente nada.
  if (IS_WEB) {
    return (
      <WebAppShell active={navKeyForPath(pathname)}>
        <Slot />
      </WebAppShell>
    );
  }

  return (
    <Tabs
      tabBar={(props) => <OrbitaTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="transitos" options={{ title: "Tránsitos" }} />
      <Tabs.Screen name="vacio" options={{ title: "Umbral" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
      {/* Fuera de la barra pero siguen como rutas: Carta vive en el Perfil ("algo de
          una vez"); Vínculo queda parkeado (Próximamente). */}
      <Tabs.Screen name="carta" options={{ href: null }} />
      <Tabs.Screen name="vinculo" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    flex: 1,
    justifyContent: "center"
  }
});
