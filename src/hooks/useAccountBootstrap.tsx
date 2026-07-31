import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { runAccountBootstrap, type BootstrapOutcome } from "@/domain/accountBootstrap";
import { useAppState } from "@/hooks/useAppState";
import { useSignInHydrate } from "@/onboarding/useAccount";

export type BootstrapState = "idle" | "running" | "error";

type BootstrapValue = {
  state: BootstrapState;
  /** Corre la transacción una sola vez a la vez. */
  run: () => Promise<BootstrapOutcome>;
  reset: () => void;
};

/**
 * Dueño ÚNICO de la transacción de bootstrap y de su lock.
 *
 * Es un provider y no un hook suelto porque cada instancia del hook tenía su
 * propio `useRef`: con `AccountGate` y la pantalla de login llamándolo por
 * separado, había dos locks independientes y el archivado podía correr dos
 * veces. Ahora hay un solo estado compartido montado sobre el gate.
 */
const BootstrapContext = createContext<BootstrapValue | null>(null);

const SIN_PROVIDER: BootstrapValue = {
  state: "idle",
  run: async () => ({ status: "error" }),
  reset: () => undefined
};

export function AccountBootstrapProvider({ children }: { children: ReactNode }) {
  const {
    profile,
    profileOwner,
    createProfile,
    adoptLocalProfile,
    restoreAccountData,
    archiveAccountData,
    resetApp
  } = useAppState();
  const hydrate = useSignInHydrate();
  const [state, setState] = useState<BootstrapState>("idle");
  // Lock SINCRÓNICO: el estado de React recién se refleja en el próximo render,
  // así que dos disparos del mismo render pasarían los dos y archivarían dos veces.
  const running = useRef<Promise<BootstrapOutcome> | null>(null);

  const run = useCallback(async (): Promise<BootstrapOutcome> => {
    // Una corrida en vuelo se comparte en vez de arrancar otra: dos llamadas
    // concurrentes hacen UN solo archive/reset/restore.
    if (running.current) return running.current;
    if (!hydrate) return { status: "error" };
    setState("running");
    const corrida = runAccountBootstrap({
      hydrate,
      profileOwner,
      hasLocalProfile: !!profile,
      archiveAccountData,
      resetApp,
      restoreAccountData,
      createProfile,
      adoptLocalProfile
    })
      .then((outcome) => {
        setState(outcome.status === "error" ? "error" : "idle");
        return outcome;
      })
      .finally(() => {
        running.current = null;
      });
    running.current = corrida;
    return corrida;
  }, [
    adoptLocalProfile,
    archiveAccountData,
    createProfile,
    hydrate,
    profile,
    profileOwner,
    resetApp,
    restoreAccountData
  ]);

  const reset = useCallback(() => setState("idle"), []);
  const value = useMemo(() => ({ state, run, reset }), [state, run, reset]);

  return <BootstrapContext.Provider value={value}>{children}</BootstrapContext.Provider>;
}

/** Lee el bootstrap compartido. NUNCA crea uno nuevo. */
export function useAccountBootstrap(): BootstrapValue {
  return useContext(BootstrapContext) ?? SIN_PROVIDER;
}
