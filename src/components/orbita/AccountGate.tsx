import { useEffect, type ReactNode } from "react";
import { Redirect } from "expo-router";
import { destinationAllows } from "@/domain/accountDestination";
import { HOME_ROUTE, ONBOARDING_ROUTE, SIGN_IN_ROUTE } from "@/domain/appRoutes";
import { useAccountBootstrap } from "@/hooks/useAccountBootstrap";
import { useAccountDestination } from "@/hooks/useAccountDestination";
import { ErrorState, MinimalLoading } from "@/components/orbita/states";

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
  error
}: {
  surface: "landing" | "auth" | "onboarding" | "app";
  children: ReactNode;
  /** Carga propia de la superficie (la web usa su spinner sobre fondo oscuro). */
  loading?: ReactNode;
  error?: (retry: () => void) => ReactNode;
}) {
  const { destination, retry } = useAccountDestination();
  const bootstrap = useAccountBootstrap();

  // Cuenta completa sin perfil local propio: se hidrata ANTES de entrar. Sin
  // esto, Home rebotaba a onboarding y el onboarding devolvía a Home.
  useEffect(() => {
    if (destination !== "bootstrap") return;
    if (bootstrap.state !== "idle") return;
    // `incomplete` NO es un error: el aislamiento salió bien y la cuenta
    // simplemente no completó el alta. El resolver reevalúa con el estado local
    // ya limpio y manda al onboarding.
    void bootstrap.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, bootstrap.state]);

  const mostrarError = (onRetry: () => void) =>
    error ? <>{error(onRetry)}</> : <ErrorState onRetry={onRetry} />;

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
    return <>{loading ?? <MinimalLoading />}</>;
  }
  if (destination === "loading") return <>{loading ?? <MinimalLoading />}</>;
  if (destinationAllows(destination, surface)) return <>{children}</>;

  // El destino resuelto es otro: se navega ahí.
  switch (destination) {
    case "sign-in":
      return <Redirect href={SIGN_IN_ROUTE as never} />;
    case "onboarding":
      return <Redirect href={ONBOARDING_ROUTE as never} />;
    case "app-home":
      return <Redirect href={HOME_ROUTE as never} />;
  }
}
