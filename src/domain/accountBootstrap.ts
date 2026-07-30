import { isAccountSwitch, onboardingInputFromBirthData } from "@/domain/sessionStart";
import type { BirthDataDoc } from "@/services/appRefs";

/**
 * Transacción de bootstrap de cuenta, con las dependencias inyectadas.
 *
 * Está separada del hook a propósito: así los tests la EJECUTAN con dobles y
 * comprueban el orden real de las operaciones y qué pasa con dos llamadas
 * concurrentes. Antes había un test que sólo miraba que dos archivos
 * mencionaran `useAccountBootstrap` — no probaba nada de la conducta.
 *
 * Sólo LEE el estado remoto: nunca escribe `birthData` ni recalcula la carta.
 */

export type BootstrapDeps = {
  /** Lee el estado remoto autoritativo de la identidad Clerk activa. */
  hydrate: () => Promise<
    | { status: "ok"; clerkUserId: string | null; birthData: BirthDataDoc | null }
    | { status: "error" }
  >;
  /** Dueño del perfil local en disco, o null si no hay/es guest. */
  profileOwner: string | null;
  /** Hay un perfil local en disco. */
  hasLocalProfile: boolean;
  archiveAccountData: (userId: string | null) => Promise<void>;
  resetApp: () => Promise<void>;
  restoreAccountData: (userId: string) => Promise<{ profileRestored: boolean }>;
  createProfile: (
    input: ReturnType<typeof onboardingInputFromBirthData>,
    ownerUserId?: string | null
  ) => Promise<void>;
  adoptLocalProfile: (userId: string) => Promise<void>;
};

export type BootstrapOutcome =
  /** El perfil local quedó hidratado con los datos remotos: se puede entrar. */
  | { status: "ready" }
  /**
   * La cuenta no completó el alta. Lo ajeno (si había) quedó aislado y lo suyo
   * restaurado: corresponde seguir al onboarding, NO mostrar un error.
   */
  | { status: "incomplete" }
  | { status: "error" };

/**
 * Deja el estado local consistente con la cuenta activa.
 *
 * El aislamiento de datos ajenos ocurre ANTES de decidir cualquier destino, y
 * también cuando la cuenta activa no tiene `birthData` — si no, alguien que
 * entra con otra cuenta y arranca el onboarding se llevaba el diario y las
 * guardadas del dueño anterior.
 */
export async function runAccountBootstrap(deps: BootstrapDeps): Promise<BootstrapOutcome> {
  let result: Awaited<ReturnType<BootstrapDeps["hydrate"]>>;
  try {
    result = await deps.hydrate();
  } catch {
    return { status: "error" };
  }
  if (result.status === "error") return { status: "error" };

  // CAMBIO DE CUENTA: lo local es de OTRA persona (su sesión se perdió sin
  // logout, así que nada se archivó). Se archiva bajo SU dueño —no se destruye,
  // lo recupera al volver a entrar— y recién ahí se limpia.
  const switchingAccount = isAccountSwitch({
    localProfileOwner: deps.profileOwner,
    incomingUserId: result.clerkUserId
  });
  if (switchingAccount) {
    try {
      await deps.archiveAccountData(deps.profileOwner);
      await deps.resetApp();
    } catch {
      // Falla cerrado: antes que arriesgar mezclar dos cuentas, no se entra.
      return { status: "error" };
    }
  }
  const hasLocalProfile = switchingAccount ? false : deps.hasLocalProfile;

  // Si esta cuenta ya usó el dispositivo, volver su diario y sus guardadas
  // (se archivan al cerrar sesión; no viven en Convex).
  let profileRestored = false;
  if (result.clerkUserId) {
    try {
      ({ profileRestored } = await deps.restoreAccountData(result.clerkUserId));
    } catch {
      return { status: "error" };
    }
  }

  try {
    if (result.birthData) {
      // Lo remoto manda; el snapshot sólo aporta diario y guardadas. Queda
      // marcado con su dueño para que el arranque lo reconozca como propio.
      await deps.createProfile(onboardingInputFromBirthData(result.birthData), result.clerkUserId);
      return { status: "ready" };
    }
    if (hasLocalProfile && !profileRestored && result.clerkUserId) {
      // Guest-upgrade sin datos remotos: la cuenta ADOPTA el perfil local de
      // forma explícita (el arranque nunca confía en un perfil sin dueño).
      await deps.adoptLocalProfile(result.clerkUserId);
    }
  } catch {
    return { status: "error" };
  }

  // Sin `birthData` la cuenta no completó el alta. El aislamiento salió bien,
  // así que esto NO es un error: es el camino al onboarding.
  return { status: "incomplete" };
}
