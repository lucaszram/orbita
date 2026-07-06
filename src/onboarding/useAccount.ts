import { useCallback, useRef, useState } from "react";
import { useMutation } from "convex/react";

import { deviceTimezone } from "@/hooks/useLiveApp";
import { useOrbitaAuth } from "@/hooks/useOrbitaAuth";
import { appApi } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";

/**
 * Cuenta Clerk (email + código) y persistencia Convex para el onboarding
 * inmersivo. `HAS_BACKEND` es constante de módulo: sin envs, los hooks
 * devuelven null y el flujo queda igual que siempre (invitado local).
 */
const HAS_BACKEND = backendConfig.hasConvex && backendConfig.hasClerk;

export type AccountFlow = {
  phase: "email" | "code";
  busy: boolean;
  error: string | null;
  isSignedIn: boolean;
  start: (email: string) => Promise<void>;
  verify: (code: string) => Promise<boolean>;
  resetToEmail: () => void;
};

function clerkErrorMessage(e: unknown): string {
  const err = e as { errors?: Array<{ longMessage?: string; message?: string }>; message?: string };
  return (
    err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? err?.message ?? "No pudimos conectar. Probá de nuevo."
  );
}

export function useAccountFlow(): AccountFlow | null {
  if (!HAS_BACKEND) return null;
  return useAccountFlowInner();
}

function useAccountFlowInner(): AccountFlow {
  const { useAuth } = require("@clerk/expo") as typeof import("@clerk/expo");
  // La API clásica (create/prepare/attempt) vive en el subpath legacy en @clerk/expo v3.
  const { useSignIn, useSignUp } = require("@clerk/expo/legacy") as typeof import("@clerk/expo/legacy");
  const { signUp, setActive: setActiveSignUp } = useSignUp();
  const { signIn, setActive: setActiveSignIn } = useSignIn();
  const { isSignedIn } = useAuth();
  const [phase, setPhase] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flowRef = useRef<"signUp" | "signIn">("signUp");

  const start = useCallback(
    async (emailAddress: string) => {
      if (!signUp || !signIn) return;
      setBusy(true);
      setError(null);
      try {
        await signUp.create({ emailAddress });
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        flowRef.current = "signUp";
        setPhase("code");
      } catch (e) {
        const code = (e as { errors?: Array<{ code?: string }> })?.errors?.[0]?.code;
        if (code === "form_identifier_exists") {
          // El email ya tiene cuenta: entrar por sign-in con código.
          try {
            const attempt = await signIn.create({ identifier: emailAddress });
            const factor = attempt.supportedFirstFactors?.find((f) => f.strategy === "email_code") as
              | { emailAddressId?: string }
              | undefined;
            await signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId: factor?.emailAddressId ?? "" });
            flowRef.current = "signIn";
            setPhase("code");
          } catch (e2) {
            setError(clerkErrorMessage(e2));
          }
        } else {
          setError(clerkErrorMessage(e));
        }
      } finally {
        setBusy(false);
      }
    },
    [signIn, signUp]
  );

  const verify = useCallback(
    async (code: string): Promise<boolean> => {
      if (!signUp || !signIn) return false;
      setBusy(true);
      setError(null);
      try {
        if (flowRef.current === "signUp") {
          const result = await signUp.attemptEmailAddressVerification({ code });
          if (result.status === "complete" && setActiveSignUp) {
            await setActiveSignUp({ session: result.createdSessionId });
            return true;
          }
        } else {
          const result = await signIn.attemptFirstFactor({ strategy: "email_code", code });
          if (result.status === "complete" && setActiveSignIn) {
            await setActiveSignIn({ session: result.createdSessionId });
            return true;
          }
        }
        setError("El código no coincide. Fijate en tu mail.");
        return false;
      } catch (e) {
        setError(clerkErrorMessage(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [setActiveSignIn, setActiveSignUp, signIn, signUp]
  );

  return {
    phase,
    busy,
    error,
    isSignedIn: !!isSignedIn,
    start,
    verify,
    resetToEmail: () => {
      setError(null);
      setPhase("email");
    }
  };
}

export type PersistBirthData = (input: {
  birthDate: string;
  birthTime?: string;
  birthPlaceLabel?: string;
}) => Promise<void>;

export function useBackendPersist(): PersistBirthData | null {
  if (!HAS_BACKEND) return null;
  return useBackendPersistInner();
}

function useBackendPersistInner(): PersistBirthData {
  const auth = useOrbitaAuth();
  const ensureUser = useMutation(appApi.users.getOrCreateCurrentUser);
  const completeBirthData = useMutation(appApi.onboarding.completeBirthData);
  // convex/charts.ts la define como mutation (appRefs la tipa action para la web).
  const calculateChart = useMutation(
    appApi.charts.calculateOrCreateNatalChart as unknown as Parameters<typeof useMutation>[0]
  );
  const generateToday = useMutation(appApi.readings.generateToday);
  const isSignedIn = auth.isSignedIn;

  return useCallback(
    async (input) => {
      if (!isSignedIn) return;
      try {
        const timezone = deviceTimezone();
        await ensureUser({});
        await completeBirthData({
          birthDate: input.birthDate,
          birthTime: input.birthTime,
          birthTimePrecision: input.birthTime ? "known" : "unknown",
          birthPlaceLabel: input.birthPlaceLabel ?? "Sin especificar",
          timezone
        });
        await calculateChart({});
        await generateToday({ localDate: new Date().toISOString().slice(0, 10), timezone });
      } catch (e) {
        // La copia local ya existe: el backend puede fallar sin romper el flujo.
        console.warn("Órbita: persistencia backend falló (la app sigue local)", e);
      }
    },
    [calculateChart, completeBirthData, ensureUser, generateToday, isSignedIn]
  );
}
