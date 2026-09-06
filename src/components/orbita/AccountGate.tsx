import { useEffect, useRef, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import {
  destinationAllows,
  mountedOnboardingRetainsCompletion,
  type AccountSurface
} from "@/domain/accountDestination";
import { EDIT_BIRTH_DATA_ROUTE, HOME_ROUTE, ONBOARDING_ROUTE, SIGN_IN_ROUTE } from "@/domain/appRoutes";
import { surfaceOpensUnderConfidence, type SurfaceRequirement } from "@/domain/sessionResilience";
import { useAccountBootstrap } from "@/hooks/useAccountBootstrap";
import { useAccountDestination } from "@/hooks/useAccountDestination";
import { ErrorState, MinimalLoading } from "@/components/orbita/states";
import {
  DegradedSessionBanner,
  UnconfirmedSessionScreen
} from "@/components/orbita/SessionNotice";
import { BOOT_BACKGROUND } from "@/theme/boot";

/**
 * Superficie propia de los estados por defecto del gate (QA23-006).
 *
 * `MinimalLoading` y `ErrorState` son bloques de CONTENIDO —están escritos para
 * caer dentro de un shell que ya puso el fondo—, y este gate los monta sin
 * ninguno: `/onboarding` y `/iniciar-sesion` no le pasan un `loading` propio.
 * Sin superficie, el color lo ponía lo que hubiera detrás, que en el arranque
 * era el fondo claro del tema por defecto del navegador de rutas. Las
 * superficies que SÍ traen el suyo —`WebLoading`, la espera de las tabs— no
 * pasan por acá y no cambian.
 */
function BootSurface({ children }: { children: ReactNode }) {
  return <View style={styles.bootSurface}>{children}</View>;
}

/**
 * Puerta compartida por landing, login, alta, onboarding y rutas de app.
 *
 * Cada ruta declara SU superficie; el resolver decide el destino y esto navega
 * si no coinciden. Ninguna ruta compara estados por su cuenta, que es lo que
 * hacía que la web mostrara la landing con sesión activa o que el onboarding se
 * montara para una cuenta ya completa.
 */
export function AccountGate({
  surface,
  children,
  loading,
  error,
  sticky = false,
  requires = "read"
}: {
  surface: AccountSurface;
  children: ReactNode;
  /** Carga propia de la superficie (la web usa su spinner sobre fondo oscuro). */
  loading?: ReactNode;
  error?: (retry: () => void) => ReactNode;
  /**
   * Qué le exige ESTA ruta a la sesión (QA23-007).
   *
   * `read` —el default— abre con la sesión degradada: son los últimos datos de
   * la propia cuenta. `confirmed-session` no abre nunca sin confirmación, y lo
   * declara toda ruta cuya razón de ser es una operación sensible: el pago.
   * Bloquear la ruta entera es más fuerte que bloquear su botón, porque también
   * apaga el Offering, el restore y el Customer Center que viven adentro.
   */
  requires?: SurfaceRequirement;
  /**
   * La superficie tiene ESTADO PROPIO que no se puede perder: una vez montada,
   * un `loading` transitorio no la desmonta. Lo usa el onboarding.
   *
   * También sostiene el cierre después de persistir los datos natales: en ese
   * momento el resolver ya dice `bootstrap` —y luego `app-home`—, pero el flujo
   * todavía debe mostrar Antes/Después y la paywall y salir explícitamente a
   * Carta. El perfil local se crea recién en esa salida final.
   *
   * No debilita la protección: el destino resuelto sólo se retiene para un
   * onboarding que YA se montó de forma legítima. Una cuenta completa que abre
   * esta ruta inicialmente conserva `mounted=false` y es redirigida.
   */
  sticky?: boolean;
}) {
  const { destination, retry, confidence } = useAccountDestination();
  const bootstrap = useAccountBootstrap();
  // ¿Esta superficie llegó a renderizarse alguna vez? Escritura idempotente en
  // render: no dispara re-render y sobrevive al parpadeo de `loading`.
  const montado = useRef(false);
  const permitido = destinationAllows(destination, surface);
  if (permitido) montado.current = true;
  const retieneCierreOnboarding = mountedOnboardingRetainsCompletion({
    sticky,
    mounted: montado.current,
    surface,
    destination
  });

  // Cuenta completa sin perfil local propio: se hidrata ANTES de entrar. Sin
  // esto, Home rebotaba a onboarding y el onboarding devolvía a Home.
  useEffect(() => {
    // Durante el cierre de un alta real, la falta de perfil local es esperada:
    // se crea al salir de la paywall. Hidratar acá desmontaría el onboarding y
    // saltaría exactamente las superficies que todavía faltan.
    if (retieneCierreOnboarding) return;
    if (destination !== "bootstrap") return;
    if (bootstrap.state !== "idle") return;
    // `incomplete` NO es un error: el aislamiento salió bien y la cuenta
    // simplemente no completó el alta. El resolver reevalúa con el estado local
    // ya limpio y manda al onboarding.
    void bootstrap.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, bootstrap.state, retieneCierreOnboarding]);

  const mostrarError = (onRetry: () => void) =>
    error ? (
      <>{error(onRetry)}</>
    ) : (
      <BootSurface>
        <ErrorState onRetry={onRetry} />
      </BootSurface>
    );

  const mostrarCarga = () => (
    <>
      {loading ?? (
        <BootSurface>
          <MinimalLoading />
        </BootSurface>
      )}
    </>
  );

  /**
   * La sesión no se pudo CONFIRMAR (QA23-007).
   *
   * Se decide antes que el resto porque es un estado de SESIÓN, no de dato: los
   * reintentos de abajo asumen un backend que contesta, y acá justamente no lo
   * hay. Nunca se redirige: mandar al login a alguien cuya sesión sigue viva en
   * el llavero es exactamente el defecto que este bloque cierra.
   *
   * `sticky` manda igual que en `loading`, y por el mismo motivo: no poder
   * confirmar es "todavía no se sabe", no un destino resuelto distinto. Sin
   * esto, un corte de red durante el paso 13 del alta desmontaba el flujo entero
   * —identidad, fecha, lugar y hora— con la cuenta recién creada.
   */
  const sesionSinConfirmar = destination === "degraded" || confidence === "transient-unavailable";
  if (sesionSinConfirmar && sticky && montado.current) return <>{children}</>;

  if (destination === "degraded") {
    // Identidad local segura: se abre con los últimos datos de ESTA cuenta y el
    // aviso arriba. Salvo que la ruta exista para cobrar (`requires`).
    if (permitido && surfaceOpensUnderConfidence(requires, confidence)) {
      return (
        <>
          <DegradedSessionBanner onRetry={retry} />
          {children}
        </>
      );
    }
    return <UnconfirmedSessionScreen onRetry={retry} variant="confirmed-session" />;
  }

  /**
   * Se agotó el plazo y NO hay identidad local segura: instalación nueva,
   * perfil de invitado, perfil de otra cuenta o Clerk que ni siquiera cargó. El
   * gate se conserva —no se publica un solo dato— y lo único que cambia es que
   * deja de ser un spinner que no termina nunca.
   *
   * El motivo se dice distinto según qué esperaba la superficie: donde hace
   * falta una cuenta (`app`, `edit-birth-data`) se explica que no se muestran
   * datos que no se pueden verificar; en la landing, el login y el alta —donde
   * todavía no hay cuenta— eso sería una acusación sin sujeto, así que se dice
   * lo que de verdad pasó: no se pudo conectar.
   */
  if (
    confidence === "transient-unavailable" &&
    (destination === "loading" || destination === "retry")
  ) {
    const esperaCuenta = surface === "app" || surface === "edit-birth-data";
    return (
      <UnconfirmedSessionScreen
        onRetry={retry}
        variant={esperaCuenta ? "unattributable" : "confirmed-session"}
      />
    );
  }

  // Debe evaluarse ANTES de `bootstrap`: ése es el destino real inmediatamente
  // posterior a guardar los datos de un alta nueva.
  if (retieneCierreOnboarding) return <>{children}</>;

  if (destination === "retry") return mostrarError(retry);
  if (destination === "bootstrap") {
    // La hidratación falló: reintento visible. NO se redirige a ningún lado —
    // redirigir sería justo el loop que este estado existe para cortar.
    if (bootstrap.state === "error") {
      return mostrarError(() => {
        bootstrap.reset();
        void bootstrap.run();
      });
    }
    return mostrarCarga();
  }
  if (destination === "loading") {
    // Ver `sticky`: el alta ya montada se sostiene, no se desmonta y se remonta.
    if (sticky && montado.current) return <>{children}</>;
    return mostrarCarga();
  }
  if (permitido) return <>{children}</>;

  // El destino resuelto es otro: se navega ahí.
  switch (destination) {
    case "sign-in":
      return <Redirect href={SIGN_IN_ROUTE as never} />;
    case "onboarding":
      return <Redirect href={ONBOARDING_ROUTE as never} />;
    case "edit-birth-data":
      // Cuenta preexistente incompleta: se completa donde SÍ se puede editar y
      // recalcular. Nunca se la manda al alta, que es create-only.
      return <Redirect href={EDIT_BIRTH_DATA_ROUTE as never} />;
    case "app-home":
      return <Redirect href={HOME_ROUTE as never} />;
  }
}

const styles = StyleSheet.create({
  bootSurface: { backgroundColor: BOOT_BACKGROUND, flex: 1 }
});
