import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { OrbitaLanding } from "@/components/web/orbita-landing";
import {
  onboardingInputFromBirthData,
  resolveStart,
  type RecoveryState
} from "@/domain/sessionStart";
import { useAppState } from "@/hooks/useAppState";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useSignInHydrate } from "@/onboarding/useAccount";
import { backendConfig } from "@/services/backendProviders";
import { theme } from "@/theme/theme";

const IS_WEB = process.env.EXPO_OS === "web";
const BACKEND_CONFIGURED = backendConfig.hasConvex && backendConfig.hasClerk;
// Si Clerk no terminó de cargar en este plazo (p. ej. primera instalación sin
// red), seguimos como signed-out: entrada estable, nunca spinner infinito.
const CLERK_LOAD_TIMEOUT_MS = 8000;

/**
 * Arranque nativo (hotfix build 11): la decisión vive en `resolveStart`
 * (src/domain/sessionStart.ts, con tests). Antes se decidía SOLO por el perfil
 * local, sin esperar Clerk: una cuenta existente sin perfil local caía al
 * onboarding como si fuera nueva y el Perfil la mostraba como invitado.
 */
export default function IndexRoute() {
  const { isReady, profile, createProfile } = useAppState();
  const { auth } = useLiveApp();
  const hydrate = useSignInHydrate();
  const [recovery, setRecovery] = useState<RecoveryState>("idle");
  const [hasRemoteBirthData, setHasRemoteBirthData] = useState(false);
  const [recoveryTick, setRecoveryTick] = useState(0);
  const [clerkTimedOut, setClerkTimedOut] = useState(false);

  useEffect(() => {
    if (IS_WEB || !BACKEND_CONFIGURED) return;
    const t = setTimeout(() => setClerkTimedOut(true), CLERK_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  const decision = resolveStart({
    backendConfigured: BACKEND_CONFIGURED,
    localReady: isReady,
    hasLocalProfile: !!profile,
    clerkLoaded: auth ? auth.isLoaded || clerkTimedOut : true,
    isSignedIn: !!auth?.isSignedIn,
    recovery,
    hasRemoteBirthData
  });

  // Sesión activa sin perfil local (upgrade/reinstalación): recuperar la
  // cuenta desde Convex ANTES de decidir Home vs continuar el alta.
  useEffect(() => {
    if (IS_WEB || decision !== "recover" || recovery !== "idle" || !hydrate) return;
    let cancelled = false;
    setRecovery("loading");
    hydrate().then(async (result) => {
      if (cancelled) return;
      if (result.status === "error") {
        setRecovery("error");
        return;
      }
      if (result.birthData) {
        // Hidratar el perfil local con los datos reales de la cuenta.
        await createProfile(onboardingInputFromBirthData(result.birthData));
      }
      if (cancelled) return;
      setHasRemoteBirthData(!!result.birthData);
      setRecovery("done");
    });
    return () => {
      cancelled = true;
    };
  }, [decision, recovery, hydrate, createProfile, recoveryTick]);

  if (IS_WEB) {
    return <OrbitaLanding />;
  }

  switch (decision) {
    case "home":
      return <Redirect href="/(tabs)" />;
    case "resume-onboarding":
      // Cuenta activa sin datos de nacimiento: continuar el alta desde los
      // datos (el paso de cuenta se saltea solo; no se crea una segunda).
      return <Redirect href={{ pathname: "/onboarding", params: { resume: "datos" } }} />;
    case "entry":
      // Entrada estable: Empezar / Ya tengo cuenta (paso 0 del onboarding).
      return <Redirect href="/onboarding" />;
    case "recover-error":
      return (
        <RecoveryError
          onRetry={() => {
            setRecovery("idle");
            setRecoveryTick((t) => t + 1);
          }}
        />
      );
    case "loading":
    case "recover":
    default:
      return (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.plum} />
        </View>
      );
  }
}

function RecoveryError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.loading}>
      <Text style={styles.errorTitle}>No pudimos recuperar tu cuenta.</Text>
      <Text style={styles.errorBody}>Revisá tu conexión y probá de nuevo.</Text>
      <Pressable onPress={onRetry} accessibilityRole="button" style={styles.retryBtn} hitSlop={8}>
        <Text style={styles.retryText}>REINTENTAR</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  errorBody: {
    color: theme.colors.muted,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center"
  },
  errorTitle: {
    color: theme.colors.ink,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center"
  },
  loading: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32
  },
  retryBtn: {
    borderColor: theme.colors.plum,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 10
  },
  retryText: {
    color: theme.colors.plum,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1
  }
});
