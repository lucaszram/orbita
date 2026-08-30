import { Redirect } from "expo-router";

import { ONBOARDING_ROUTE } from "@/domain/appRoutes";
import { AccountGate } from "@/components/orbita/AccountGate";

/**
 * `/iniciar-sesion` — ALIAS del acceso canónico, sin UI propia.
 *
 * El acceso de Órbita es UNO: la primera superficie del onboarding
 * (`AuthScreen`, paso `STEP_AUTH`), con "Crear cuenta" e "Ingresar" como dos
 * modos de la MISMA pantalla. Esta ruta montaba además el shell legado
 * (`SignInScreen` dentro de su propio `WebLayoutProvider`, con su archivado, su
 * hidratación y su salida a "Crear una cuenta"): un segundo login, con su
 * propia máquina de estados, sus propios errores y su propia idea de qué hacer
 * con el borrador. Dos puertas para la misma cuenta divergen siempre — y ya
 * divergieron: la de acá no tenía ni el selector de modo ni la vía de Apple, y
 * su salida a "Crear una cuenta" reenviaba igual al alta.
 *
 * Lo que queda es lo mínimo que la ruta tiene que seguir haciendo:
 *
 * 1. El gate. `surface="auth"` sólo se permite cuando NO hay sesión; con una
 *    sesión activa el resolver único manda al destino autoritativo (Home si la
 *    cuenta está completa, `/editar-datos` si quedó incompleta, `bootstrap` si
 *    falta hidratar). Sin esto, entrar por el enlace viejo con la sesión puesta
 *    volvía a abrir una pantalla de login.
 * 2. El reenvío. `mode=signin` abre la puerta única directamente en "Ingresar",
 *    que es exactamente lo que pidió quien tocó "Ya tengo cuenta". No se
 *    inventa un destino nuevo: `ONBOARDING_ROUTE` es `/empezar` en web y
 *    `/onboarding` en nativo, las dos entradas que ya montan `OnboardingGate`.
 *
 * El comportamiento que vivía acá se unificó en `OnboardingFlow`, que es el
 * dueño de la puerta única. Son dos garantías distintas y cada una tiene su
 * enganche:
 *
 * - Abandonar el borrador anónimo al entrar por el camino de ingreso
 *   (QA23-008) lo hace `discardSignupMarker`, el `onSignInPath` de
 *   `AuthScreen`, y cubre las tres vías (código, contraseña y proveedor).
 * - Liberar un teléfono COMPARTIDO antes de crear una cuenta —lo que hacía
 *   `leaveWithoutSignIn` en el camino "Crear una cuenta" de esta ruta— lo hace
 *   `releaseSharedDevice` desde `onBeforeSignup`, o sea la `seedMarker` de
 *   `startSignupGate`: archiva lo del dueño anterior bajo su cuenta y limpia
 *   antes del alta, y si falla no deja avanzar ni el marcador ni a Clerk.
 *
 * Esa segunda garantía quedó un tiempo sin dueño cuando la ruta perdió su UI:
 * el archivado no se había trasladado y una cuenta nueva podía heredar el
 * diario y las guardadas del anterior.
 *
 * La ruta sigue existiendo —y sigue declarada en el Stack raíz y en la
 * allowlist pública— porque es un deep link publicado: enlaces viejos, el pie
 * de las tarjetas de Clerk y `/login` caen acá.
 *
 * `SignInScreen` NO desaparece: la sigue montando `PendingDeletionBoundary`,
 * que es otra superficie (reingreso para cancelar una eliminación pendiente) y
 * no comparte esta decisión.
 */
export default function IniciarSesionRoute() {
  return (
    <AccountGate surface="auth">
      <Redirect href={{ pathname: ONBOARDING_ROUTE, params: { mode: "signin" } } as never} />
    </AccountGate>
  );
}
