import { useCallback, useRef, useState } from "react";
import { isAccountSwitch, onboardingInputFromBirthData } from "@/domain/sessionStart";
import { useAppState } from "@/hooks/useAppState";
import { useSignInHydrate } from "@/onboarding/useAccount";

export type BootstrapState = "idle" | "running" | "error";

/**
 * Bootstrap de cuenta: traer el estado remoto y dejar el perfil LOCAL listo para
 * la cuenta activa.
 *
 * Lo usan los dos caminos de entrada — abrir la app con sesión ya activa y
 * terminar de iniciar sesión — porque son el mismo problema. Antes esta lógica
 * vivía sólo dentro de `enter()` del login, así que un navegador nuevo con
 * sesión activa y `birthData` completo entraba a Home sin perfil local: el guard
 * de Home mandaba a onboarding, el gate del onboarding devolvía a Home, y
 * quedaba dando vueltas.
 *
 * Nunca escribe en `birthData`: sólo lee lo remoto y arma lo local.
 */
export function useAccountBootstrap(): {
  state: BootstrapState;
  /** Corre el bootstrap. `true` si el perfil local quedó listo. */
  run: () => Promise<boolean>;
  reset: () => void;
} {
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
  // Lock sincrónico: el gate puede re-renderizar antes de que `state` se
  // refleje, y dos bootstraps en paralelo archivarían dos veces.
  const running = useRef(false);

  const run = useCallback(async (): Promise<boolean> => {
    if (running.current || !hydrate) return false;
    running.current = true;
    setState("running");
    try {
      const result = await hydrate();
      if (result.status === "error") {
        setState("error");
        return false;
      }

      // CAMBIO DE CUENTA en el mismo dispositivo: lo local es de OTRA persona
      // (su sesión se perdió sin logout, así que nada se archivó). Se archiva
      // bajo SU dueño —no se destruye— y recién ahí se limpia. Sin esto, su
      // diario y sus guardadas se mezclarían con los de quien entra.
      const switchingAccount = isAccountSwitch({
        localProfileOwner: profileOwner,
        incomingUserId: result.clerkUserId
      });
      if (switchingAccount) {
        // Falla cerrado: antes que arriesgar mezclar dos cuentas, se reintenta.
        await archiveAccountData(profileOwner);
        await resetApp();
      }
      // Tras el reset, el `profile` de este closure es del usuario anterior.
      const localProfile = switchingAccount ? null : profile;

      // Si esta cuenta ya usó el dispositivo, volver su diario y sus guardadas
      // (se archivan al cerrar sesión; no viven en Convex). El id sale del
      // backend, no de `useAuth`: React puede no haber re-renderizado todavía.
      const { profileRestored } = result.clerkUserId
        ? await restoreAccountData(result.clerkUserId)
        : { profileRestored: false };

      if (result.birthData) {
        // Lo remoto manda; el snapshot sólo aporta diario y guardadas. Queda
        // marcado con su dueño para que el arranque lo reconozca como propio.
        await createProfile(onboardingInputFromBirthData(result.birthData), result.clerkUserId);
      } else if (localProfile && !profileRestored && result.clerkUserId) {
        // Guest-upgrade sin datos remotos: la cuenta ADOPTA el perfil local
        // explícitamente (el arranque nunca confía en un perfil sin dueño).
        await adoptLocalProfile(result.clerkUserId);
      }

      setState("idle");
      return !!result.birthData || !!localProfile || profileRestored;
    } catch {
      setState("error");
      return false;
    } finally {
      running.current = false;
    }
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

  return { state, run, reset };
}
