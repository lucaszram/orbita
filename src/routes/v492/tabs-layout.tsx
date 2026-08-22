import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AccountGate } from "@/components/orbita/AccountGate";
import { OrbitaTabBar } from "@/components/orbita/TabBar";
import { resolveTabsGuard, type LocalProfileOwner } from "@/domain/sessionStart";
import { useAppState } from "@/hooks/useAppState";
import { LayersProvider } from "@/hooks/useLayers";
import { useLiveApp } from "@/hooks/useLiveApp";
import { backendConfig } from "@/services/backendProviders";
import { BOOT_ACCENT, BOOT_BACKGROUND, BOOT_STATUS_BAR_STYLE } from "@/theme/boot";

const BACKEND_CONFIGURED = backendConfig.hasConvex && backendConfig.hasClerk;
const CLERK_LOAD_TIMEOUT_MS = 8000;

/**
 * Gate de sesión de las tabs — ARRIBA de `(tabs)` a propósito: iOS restaura la
 * navegación y puede montar una pestaña DIRECTO tras una actualización, sin
 * pasar nunca por `app/index.tsx`. Ese era el agujero por el que un usuario
 * con cuenta y sin sesión veía la Home invitada.
 *
 * Órbita no tiene modo invitado: sin sesión confirmada no se renderiza Hoy,
 * Tránsitos, Vínculos, Umbral ni Perfil. La regla vive en `resolveTabsGuard`
 * (con tests).
 *
 * `LayersProvider` envuelve el chrome en las dos ramas autorizadas: es el único
 * ciclo de datos de las capas V4.9.2, así que todas las pestañas y sus detalles
 * comparten el mismo reloj, el mismo sobre y el mismo aviso de "no pudimos
 * actualizar". Va DENTRO del gate: sin sesión no hay nada que recalcular.
 */
export default function TabsLayout() {
  const { isReady, profile, profileOwner, profileAdoptionPending } = useAppState();
  const { auth } = useLiveApp();
  const [clerkTimedOut, setClerkTimedOut] = useState(false);

  useEffect(() => {
    if (!BACKEND_CONFIGURED || auth?.isLoaded) return;
    const t = setTimeout(() => setClerkTimedOut(true), CLERK_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [auth?.isLoaded]);

  const localProfileOwner: LocalProfileOwner = !profile || !profileOwner
    ? "none"
    : auth?.isSignedIn && profileOwner === auth.userId
      ? "current"
      : "other";

  // Con backend configurado la autoridad es la misma para las dos plataformas:
  // `onboarding.getCompletionStatus` vía el gate compartido, que bloquea hasta
  // `chart_ready`. Sin datos natales y sin carta no hay Home que dibujar.
  if (BACKEND_CONFIGURED) {
    return (
      <AccountGate surface="app" loading={<TabsLoading />}>
        <LayersProvider>
          <TabsChrome />
        </LayersProvider>
      </AccountGate>
    );
  }

  // Sin envs no hay cuenta que resolver: la app corre 100% local y la regla
  // sigue siendo la del perfil de este dispositivo.
  const guard = resolveTabsGuard({
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
      return <TabsLoading />;
    case "allow":
    default:
      break;
  }

  return (
    <LayersProvider>
      <TabsChrome />
    </LayersProvider>
  );
}

/**
 * El chrome de la app, ya autorizado.
 *
 * La arquitectura V4.9.2: cinco pestañas —Hoy · Tránsitos · Vínculos · Umbral ·
 * Perfil— y cada una con su propio stack, así que un detalle se abre DENTRO de
 * su sección y vuelve a ella. Las rutas históricas (`/`, `/vacio`, `/vinculo`,
 * `/carta`) siguen existiendo fuera de la barra: son las que redirigen al
 * destino nuevo, así que ningún link viejo se rompe.
 *
 * El shell nativo es oscuro (`#0A0B0E`) y la barra de estado va en `light`. El
 * estilo se declaraba SÓLO acá porque el default del layout raíz era `dark`, y
 * en los huecos sin pantalla montada —carga de la pestaña, transición entre
 * secciones— la hora y la señal quedaban en negro sobre negro. Desde QA23-006
 * el arranque también es oscuro y el raíz declara `light`, así que esta línea
 * dejó de ser una corrección y pasó a ser lo que parece: el shell repitiendo el
 * estilo que le corresponde, con el mismo token, sin poder divergir.
 *
 * El chrome de web vive en `tabs-layout.web.tsx` (`WebAppShell`), no acá.
 */
function TabsChrome(): ReactNode {
  return (
    <>
      <StatusBar style={BOOT_STATUS_BAR_STYLE} />
      <Tabs
        tabBar={(props) => <OrbitaTabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: BOOT_BACKGROUND } }}
      >
        <Tabs.Screen name="hoy" options={{ title: "Hoy" }} />
        <Tabs.Screen name="transitos" options={{ title: "Tránsitos" }} />
        <Tabs.Screen name="vinculos" options={{ title: "Vínculos" }} />
        <Tabs.Screen name="umbral" options={{ title: "Umbral" }} />
        <Tabs.Screen name="perfil" options={{ title: "Carta" }} />
        {/* Rutas históricas: fuera de la barra, sólo redirigen (ver cada archivo). */}
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="vacio" options={{ href: null }} />
        <Tabs.Screen name="vinculo" options={{ href: null }} />
        <Tabs.Screen name="carta" options={{ href: null }} />
      </Tabs>
    </>
  );
}

/**
 * La espera del gate de las tabs, con el color del shell que está por montar.
 *
 * Es la pantalla que más se ve al abrir la app con sesión: mientras
 * `onboarding.getCompletionStatus` resuelve, esto ocupa el viewport entero.
 * Pintaba el crema del MVP legado, así que el arranque de alguien que ya entró
 * mil veces empezaba con un frame claro y terminaba en negro (QA23-006).
 */
function TabsLoading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={BOOT_ACCENT} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: BOOT_BACKGROUND,
    flex: 1,
    justifyContent: "center"
  }
});
