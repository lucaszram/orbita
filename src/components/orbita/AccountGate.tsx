import type { ReactNode } from "react";
import { Redirect } from "expo-router";
import { destinationAllows } from "@/domain/accountDestination";
import { HOME_ROUTE, ONBOARDING_ROUTE, SIGN_IN_ROUTE } from "@/domain/appRoutes";
import { useAccountDestination } from "@/hooks/useAccountDestination";
import { MinimalLoading } from "@/components/orbita/states";
import { ErrorState } from "@/components/orbita/states";

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

  if (destination === "loading") return <>{loading ?? <MinimalLoading />}</>;
  if (destination === "retry") {
    return <>{error ? error(retry) : <ErrorState onRetry={retry} />}</>;
  }
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
