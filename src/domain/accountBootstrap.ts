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
  /**
   * Corta el vínculo de la analítica con la persona anterior.
   *
   * Está inyectada como el resto: así el orden —resetear ANTES de identificar a
   * nadie— se prueba ejecutando esta transacción y no leyendo un componente. El
   * motivo es uno de los cuatro que declara el contrato de eventos
   * (`RESET_TRIGGERS`); acá el que aplica es el cambio de cuenta.
   */
  resetAnalyticsIdentity: (trigger: "account_switch") => void;
  /**
   * Ata la analítica a la cuenta confirmada por el backend.
   *
   * Se llama con el `clerkUserId` y no con un dato de pantalla: es el mismo
   * valor que este bootstrap usa para decidir de quién son los datos locales, así
   * que la identidad medida y la identidad de los datos no pueden divergir.
   */
  identifyAccount: (clerkUserId: string) => void;
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
 *
 * Es también el único lugar del producto que sabe, en la misma vuelta, que hubo
 * un cambio de cuenta y quién es la cuenta que entra. Por eso la identidad de la
 * analítica se resuelve acá y en ningún otro lado: resetear y identificar en dos
 * lugares distintos sería dos órdenes posibles, y el orden es justamente lo que
 * decide si los eventos de una persona terminan en el perfil de otra.
 */
export async function runAccountBootstrap(deps: BootstrapDeps): Promise<BootstrapOutcome> {
  let result: Awaited<ReturnType<BootstrapDeps["hydrate"]>>;
  try {
    result = await deps.hydrate();
  } catch {
    return { status: "error" };
  }
  if (result.status === "error") return { status: "error" };

  // Sin identidad confirmada no se toca NADA local. Con `clerkUserId` nulo,
  // `isAccountSwitch` no detecta cambio de cuenta, `restoreAccountData` se
  // saltea y `createProfile` escribiría los datos remotos en un perfil SIN
  // dueño: el arranque no lo reconocería como propio y quedaría a la vista de
  // quien use el dispositivo después.
  const clerkUserId = result.clerkUserId?.trim();
  if (!clerkUserId) return { status: "error" };

  // CAMBIO DE CUENTA: lo local es de OTRA persona (su sesión se perdió sin
  // logout, así que nada se archivó). Se archiva bajo SU dueño —no se destruye,
  // lo recupera al volver a entrar— y recién ahí se limpia.
  const switchingAccount = isAccountSwitch({
    localProfileOwner: deps.profileOwner,
    incomingUserId: clerkUserId
  });
  if (switchingAccount) {
    // ANTES de tocar nada, y antes de cualquier captura de la cuenta que entra:
    // sin esto, los eventos de quien entra viajan con el identificador de quien
    // salió y los dos perfiles quedan fusionados sin forma limpia de deshacerlo.
    // Va primero por la misma razón que el archivado va antes del borrado: es lo
    // que no se puede reparar después.
    deps.resetAnalyticsIdentity("account_switch");
    try {
      await deps.archiveAccountData(deps.profileOwner);
      await deps.resetApp();
    } catch {
      // Falla cerrado: antes que arriesgar mezclar dos cuentas, no se entra.
      return { status: "error" };
    }
  }

  // Recién ahora, con lo ajeno aislado: la captura queda atada a ESTA cuenta.
  // Lo anterior de esta pestaña —la visita anónima, el alta— se le atribuye a
  // ella, que es justamente lo que hace legible el embudo de punta a punta.
  deps.identifyAccount(clerkUserId);
  const hasLocalProfile = switchingAccount ? false : deps.hasLocalProfile;

  // Si esta cuenta ya usó el dispositivo, volver su diario y sus guardadas
  // (se archivan al cerrar sesión; no viven en Convex).
  let profileRestored = false;
  try {
    ({ profileRestored } = await deps.restoreAccountData(clerkUserId));
  } catch {
    return { status: "error" };
  }

  try {
    if (result.birthData) {
      // Lo remoto manda; el snapshot sólo aporta diario y guardadas. Queda
      // marcado con su dueño para que el arranque lo reconozca como propio.
      await deps.createProfile(onboardingInputFromBirthData(result.birthData), clerkUserId);
      return { status: "ready" };
    }
    if (hasLocalProfile && !profileRestored) {
      // Guest-upgrade sin datos remotos: la cuenta ADOPTA el perfil local de
      // forma explícita (el arranque nunca confía en un perfil sin dueño).
      await deps.adoptLocalProfile(clerkUserId);
    }
  } catch {
    return { status: "error" };
  }

  // Sin `birthData` la cuenta no completó el alta. El aislamiento salió bien,
  // así que esto NO es un error: es el camino al onboarding.
  return { status: "incomplete" };
}
