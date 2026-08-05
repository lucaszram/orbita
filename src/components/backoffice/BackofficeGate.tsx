/**
 * Puerta del backoffice: config → Clerk → Convex → allowlist.
 *
 * Estaba dentro de `BackofficeLab.tsx` cuando el backoffice era una sola
 * pantalla. Se movió acá sin cambios de conducta: ahora protege las DOS
 * pestañas (`Cuentas` y `Lab`), no sólo el Lab.
 *
 * El gate del cliente no reemplaza al del servidor. La allowlist real la aplica
 * Convex (`requireBackofficeIdentity`) en cada función; lo de acá sólo evita
 * montar la herramienta sin sesión y explicar qué falta cuando el handshake no
 * llega.
 */
import { useConvexAuth } from "convex/react";
import { ComponentType, useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { backendConfig } from "@/services/backendProviders";

import { BackofficeScreen } from "./BackofficeScreen";
import { SetupPanel, backofficeColors as c, kit } from "./kit";

/** Acceso por código: superado por Clerk. Se limpia por si quedó de una sesión vieja. */
const staleCodeAccessStorageKey = "orbita:backoffice-lab-access";

function clearStoredLabAccess() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(staleCodeAccessStorageKey);
}

export function BackofficeRoute() {
  if (!backendConfig.isConfigured) {
    return (
      <SetupPanel title="Falta conectar Convex y Clerk">
        <Text selectable style={kit.body}>
          Configurá `EXPO_PUBLIC_CONVEX_URL` y `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` para montar el backoffice.
        </Text>
        <Text selectable style={kit.body}>
          En Convex también falta `ORBITA_BACKOFFICE_ALLOWED_EMAILS` con los emails habilitados.
        </Text>
      </SetupPanel>
    );
  }

  return <BackofficeAuthGate />;
}

function BackofficeAuthGate() {
  const { useAuth, useUser } = require("@clerk/expo") as typeof import("@clerk/expo");
  const auth = useAuth();
  const { user } = useUser();
  const convexAuth = useConvexAuth();
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress;

  useEffect(() => {
    clearStoredLabAccess();
  }, []);

  if (!auth.isLoaded) {
    return (
      <SetupPanel title="Cargando sesión">
        <ActivityIndicator color={c.copper} />
      </SetupPanel>
    );
  }

  if (!auth.isSignedIn) {
    return <ClerkWebSignInPanel />;
  }

  if (convexAuth.isLoading) {
    return (
      <SetupPanel title="Conectando Convex">
        <ActivityIndicator color={c.copper} />
        <Text selectable style={kit.body}>
          Ya estás en Clerk como `{userEmail ?? "tu cuenta"}`. Estoy esperando el token de Convex para habilitar el backoffice.
        </Text>
      </SetupPanel>
    );
  }

  if (!convexAuth.isAuthenticated) {
    return (
      <SetupPanel title="Falta conectar Clerk con Convex">
        <Text selectable style={kit.body}>
          Clerk inició sesión con `{userEmail ?? "tu cuenta"}`, pero Convex no recibió identidad. Configurá el JWT template
          `convex` en Clerk con application id `convex`.
        </Text>
        <View style={styles.setupActions}>
          <Pressable
            accessibilityLabel="Cambiar cuenta"
            accessibilityRole="button"
            onPress={() => void auth.signOut()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Cambiar cuenta</Text>
          </Pressable>
        </View>
      </SetupPanel>
    );
  }

  return <BackofficeScreen onSignOut={() => void auth.signOut()} userEmail={userEmail} />;
}

function ClerkWebSignInPanel() {
  if (process.env.EXPO_OS !== "web") {
    return (
      <SetupPanel title="Necesitás iniciar sesión">
        <Text selectable style={kit.body}>
          El backoffice exige una sesión Clerk allowlisted. Abrilo desde Expo Web e iniciá sesión con
          `lucaszramos11@gmail.com`.
        </Text>
      </SetupPanel>
    );
  }

  const { SignIn } = require("@clerk/expo/web") as {
    SignIn: ComponentType<Record<string, unknown>>;
  };

  return (
    <ScrollView style={kit.page} contentContainerStyle={kit.setupWrap}>
      <View style={kit.setupPanel}>
        <Text style={kit.kicker}>Órbita Backoffice</Text>
        <Text style={kit.title}>Iniciar sesión</Text>
        <Text selectable style={kit.body}>
          Entrá con `lucaszramos11@gmail.com`. El acceso se valida con Clerk y la allowlist de Convex.
        </Text>
        <View style={styles.clerkPanel}>
          <SignIn
            fallbackRedirectUrl="/backoffice"
            forceRedirectUrl="/backoffice"
            routing="hash"
            signUpFallbackRedirectUrl="/backoffice"
            signUpForceRedirectUrl="/backoffice"
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  setupActions: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: c.panelSoft,
    borderColor: c.faint,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14
  },
  secondaryButtonText: {
    color: c.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  clerkPanel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    overflow: "hidden",
    padding: 4
  }
});
