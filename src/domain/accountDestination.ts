import {
  resolveReadinessDestination,
  type OnboardingCompletion
} from "@/domain/onboardingReadiness";

/**
 * Único resolver de destino de cuenta. El estado REMOTO de la cuenta decide
 * adónde va cada superficie.
 *
 * La cuenta se crea DENTRO del alta, en su paso original (V4.4
 * `14 / Create Account`), con la UI oficial de Clerk: la experiencia inmersiva
 * va primero y recién se pide cuenta cuando ya hay una carta que guardar. Hasta
 * entonces todo vive en el borrador. Ver `destinationAllows`.
 *
 * Existe uno solo a propósito. Antes la decisión estaba repartida entre
 * `app/index.tsx`, `app/iniciar-sesion.tsx`, `RequireSession`, `app/empezar.tsx`
 * y el layout de tabs, cada uno con su propia idea: la web mostraba la landing
 * aunque hubiera sesión, el login decidía por perfil local (`home-local`) y el
 * onboarding se montaba para cuentas ya completas.
 *
 * La autoridad de "esta cuenta completó el alta" es `onboarding.getCompletionStatus`,
 * y sólo su `chart_ready` abre Órbita. Antes alcanzaba con que existiera
 * `birthData` remoto: una cuenta con datos y SIN carta calculada entraba a una
 * Home que no podía dibujar nada. Un perfil local tampoco autoriza: puede
 * restaurar diario y guardadas después de identificar al dueño, pero no
 * reemplaza la prueba remota.
 */

export type AccountDestination =
  | "loading"
  | "sign-in"
  /**
   * Hay cuenta completa en el backend pero el perfil local todavía no es de
   * ella (navegador nuevo, storage vacío, o el perfil es de OTRA cuenta). Hay
   * que hidratar antes de entrar.
   *
   * Sin este estado se producía un loop: el gate mandaba a Home, el guard de
   * perfil de Home mandaba a onboarding, y el gate del onboarding devolvía a
   * Home porque el remoto estaba completo. La sesión que teníamos en el
   * navegador no lo mostraba porque ya tenía un perfil local.
   */
  | "bootstrap"
  | "onboarding"
  /**
   * Una cuenta que YA existía quedó incompleta (sin datos natales válidos o sin
   * carta calculada). No vuelve al alta: `completeBirthData` es create-only y
   * rechazaría el cambio. Se la manda al editor de datos, que sí puede
   * completar y recalcular sin borrar ni recrear la cuenta.
   */
  | "edit-birth-data"
  | "app-home"
  | "retry";

export type AccountState = {
  /** Convex + Clerk configurados. Sin backend no hay cuenta que resolver. */
  backendConfigured: boolean;
  /** Clerk terminó de cargar la sesión. */
  clerkLoaded: boolean;
  /** Hay sesión activa (y confirmada contra Convex). */
  signedIn: boolean;
  /** La query `onboarding.getCompletionStatus` ya resolvió. */
  completionResolved: boolean;
  /** Estado autoritativo persistido. `undefined` mientras no resolvió. */
  completion?: OnboardingCompletion;
  /**
   * Existe perfil local Y pertenece a la cuenta activa. `undefined` mientras el
   * storage local todavía no se leyó.
   */
  localProfileReady?: boolean;
  /**
   * Hay datos locales de OTRA cuenta (o sin dueño) en este dispositivo. Hay que
   * aislarlos ANTES de elegir cualquier destino — también cuando la cuenta
   * activa no tiene `birthData`: si no, quien entra con otra cuenta arranca el
   * onboarding llevándose el diario y las guardadas del dueño anterior.
   */
  localProfileForeign?: boolean;
  /** La recuperación de la cuenta falló y hay que ofrecer reintento. */
  recoveryFailed?: boolean;
};

/**
 * Sin backend configurado no hay estado remoto: la app funciona local-first y
 * el destino lo decide cada superficie (es el modo invitado del build sin
 * envs, no un modo invitado de producto).
 */
export function resolveAccountDestination(s: AccountState): AccountDestination {
  // El error gana sobre todo: sin resolver la cuenta no se adivina un destino.
  if (s.recoveryFailed) return "retry";
  if (!s.backendConfigured) return "onboarding";
  if (!s.clerkLoaded) return "loading";
  if (!s.signedIn) return "sign-in";
  // Con sesión pero sin el estado autoritativo, se espera. Nunca se cae a la
  // landing, a un perfil local ni al onboarding "por si acaso": montar el
  // onboarding para una cuenta completa es lo que permitía sobrescribir.
  if (!s.completionResolved || !s.completion) return "loading";
  if (s.localProfileReady === undefined) return "loading";
  // El aislamiento va PRIMERO, esté completa o no: mezclar los datos de dos
  // cuentas es peor que hacer esperar un instante.
  if (s.localProfileForeign) return "bootstrap";

  const readiness = resolveReadinessDestination(s.completion);
  // La consulta dice que no hay identidad: se cree a la consulta, no a Clerk.
  if (readiness === "sign-in") return "sign-in";
  if (readiness === "onboarding") return "onboarding";
  if (readiness === "edit-birth-data") return "edit-birth-data";
  // `chart_ready`: recién se entra cuando el perfil local es de ESTA cuenta.
  return s.localProfileReady ? "app-home" : "bootstrap";
}

/**
 * ¿Puede esta superficie renderizarse con el destino resuelto?
 *
 * Cada ruta declara qué destino le corresponde; si el resuelto es otro, hay que
 * navegar. Se expresa así para que ninguna ruta invente su propia comparación.
 */
export type AccountSurface = "landing" | "auth" | "onboarding" | "edit-birth-data" | "app";

export function destinationAllows(
  destination: AccountDestination,
  surface: AccountSurface
): boolean {
  switch (surface) {
    case "landing":
      // La landing es SÓLO para quien no tiene sesión.
      return destination === "sign-in";
    case "auth":
      // Login y alta: se permiten justo cuando todavía no hay sesión.
      return destination === "sign-in";
    case "onboarding":
      // El alta empieza SIN sesión: los pasos inmersivos y los datos de
      // nacimiento se juntan en el borrador local, y la cuenta se crea en su
      // paso original de la secuencia V4.4. Por eso `sign-in` —que acá
      // significa "todavía no hay sesión"— también puede montar el onboarding.
      //
      // Lo que NO cambia es la protección que motivó todo esto: una cuenta ya
      // COMPLETA resuelve `app-home`, no entra acá, y por lo tanto no puede
      // sobrescribir sus datos natales desde el alta. Una cuenta preexistente
      // incompleta resuelve `edit-birth-data` y tampoco entra.
      return destination === "onboarding" || destination === "sign-in";
    case "edit-birth-data":
      // El editor sirve para dos casos: completar una cuenta que quedó a medias
      // y editar los datos de una cuenta ya completa desde Perfil.
      return destination === "edit-birth-data" || destination === "app-home";
    case "app":
      return destination === "app-home";
  }
}
