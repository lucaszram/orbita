import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { OrbitaLanding } from "@/components/web/orbita-landing";
import {
  onboardingInputFromBirthData,
  resolveStart,
  type LocalProfileOwner,
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
  // Sin `resetApp`: el arranque ya no borra nada. La única limpieza local es
  // el logout explícito del Perfil.
  const { isReady, profile, profileOwner, profileAdoptionPending, createProfile } = useAppState();
  const { auth } = useLiveApp();
  const hydrate = useSignInHydrate();
  const [recovery, setRecovery] = useState<RecoveryState>("idle");
  const [hasRemoteBirthData, setHasRemoteBirthData] = useState(false);
  const [recoveryTick, setRecoveryTick] = useState(0);
  const [clerkTimedOut, setClerkTimedOut] = useState(false);
  const [authTick, setAuthTick] = useState(0);


  useEffect(() => {
    if (IS_WEB || !BACKEND_CONFIGURED || auth?.isLoaded) return;
    const t = setTimeout(() => setClerkTimedOut(true), CLERK_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [auth?.isLoaded, authTick]);

  // Dueño del perfil local: "current" solo si coincide con la sesión activa.
  // Sin dueño = guest/legado; con dueño distinto (o sin sesión) = "other".
  const localProfileOwner: LocalProfileOwner = !profile || !profileOwner
    ? "none"
    : auth?.isSignedIn && profileOwner === auth.userId
      ? "current"
      : "other";

  const decision = resolveStart({
    backendConfigured: BACKEND_CONFIGURED,
    localReady: isReady,
    hasLocalProfile: !!profile,
    localProfileOwner,
    // isLoaded REAL: el timeout NO se disfraza de "cargado" (≠ signed-out).
    clerkLoaded: auth ? auth.isLoaded : true,
    clerkTimedOut,
    isSignedIn: !!auth?.isSignedIn,
    profileAdoptionPending,
    recovery,
    hasRemoteBirthData
  });

  // Sesión activa sin perfil local PROPIO (upgrade/reinstalación/perfil guest
  // o ajeno): recuperar la cuenta desde Convex ANTES de decidir Home vs
  // continuar el alta. Cualquier fallo (incluido createProfile) termina en la
  // pantalla de reintento: recovery nunca queda colgado en loading.
  useEffect(() => {
    if (IS_WEB || decision !== "recover" || recovery !== "idle" || !hydrate) return;
    let cancelled = false;
    setRecovery("loading");
    hydrate()
      .then(async (result) => {
        if (cancelled) return;
        if (result.status === "error") {
          setRecovery("error");
          return;
        }
        try {
          if (result.birthData) {
            // Hidratar el perfil local con los datos reales de la cuenta,
            // marcado con su dueño (clerkUserId confirmado por el backend).
            await createProfile(onboardingInputFromBirthData(result.birthData), result.clerkUserId);
          }
        } catch {
          if (!cancelled) setRecovery("error");
          return;
        }
        if (cancelled) return;
        setHasRemoteBirthData(!!result.birthData);
        setRecovery("done");
      })
      .catch(() => {
        if (!cancelled) setRecovery("error");
      });
    return () => {
      cancelled = true;
    };
    // OJO: `recovery` NO va en las deps. El propio setRecovery("loading")
    // re-ejecutaba el efecto, el cleanup marcaba cancelled=true y los
    // callbacks del hydrate en vuelo quedaban todos cancelados: nadie seteaba
    // done/error y el arranque quedaba en spinner para siempre (reproducido
    // en la reinstalación con sesión activa). El guard usa el valor fresco de
    // cada re-render disparado por las otras deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision, hydrate, createProfile, recoveryTick]);

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
    case "sign-in":
      // Esta instalación es de una cuenta y Clerk confirmó que no hay sesión
      // (logout a medio terminar o sesión perdida en un upgrade): volver a
      // entrar. Nada local se toca — el perfil, las guardadas y el diario
      // siguen en disco esperando a su dueño.
      return <Redirect href="/iniciar-sesion" />;
    case "recover-error":
      return (
        <RecoveryError
          onRetry={() => {
            setRecovery("idle");
            setRecoveryTick((t) => t + 1);
          }}
        />
      );
    case "auth-timeout":
      // No destructivo: sin confirmación de Clerk no se toca NADA local.
      return (
        <AuthTimeout
          onRetry={() => {
            setClerkTimedOut(false);
            setAuthTick((t) => t + 1);
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

function AuthTimeout({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.loading}>
      <Text style={styles.errorTitle}>No pudimos confirmar tu sesión.</Text>
      <Text style={styles.errorBody}>
        Parece que no hay conexión. No tocamos nada de este teléfono; probá de nuevo.
      </Text>
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
