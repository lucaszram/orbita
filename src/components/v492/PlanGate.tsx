import type { ReactNode } from "react";
import { Redirect } from "expo-router";
import { TRANSITOS_ROUTE } from "@/domain/detailOrigin";
import { usePlanAccess } from "@/hooks/usePlanAccess";

/**
 * Puerta de las superficies TEMPORALES (build 30).
 *
 * Todo lo que se calcula sobre el cielo del día —el ranking, el arco de un
 * tránsito, la Luna sobre la carta, el cumpleluna y los ciclos de `Tu
 * momento`— vive detrás de Órbita Plus. Con Free, cualquier enlace a una de
 * esas pantallas aterriza en Tránsitos, que es donde el bloqueo está escrito
 * con su oferta; el frame lo dice en su propia bajada ("Cualquier link a un
 * tránsito aterriza acá hasta que actives Plus").
 *
 * La redirección ocurre EN EL RENDER y antes de montar el detalle: un deep link
 * de un build anterior, una notificación vieja o la restauración de navegación
 * de iOS no llegan a pedir un cálculo que esta cuenta no recibe.
 *
 * Mientras el plan no resolvió se monta el hijo. No es una fuga: el ciclo de
 * capas tampoco pide su sobre sin plan resuelto (`useLayers`), así que lo que
 * la pantalla dibuja en esa ventana es su propio estado de carga. Redirigir
 * antes de saber el plan mandaría a Tránsitos a alguien que sí tiene Plus, sólo
 * porque su red estaba lenta.
 *
 * Las superficies NATALES no pasan por acá: la carta, su tipo lunar y su mapa
 * elemental son de la persona y Free las conserva enteras.
 */
export function TemporalPlusGate({ children }: { children: ReactNode }) {
  const acceso = usePlanAccess();
  if (acceso === "free") return <Redirect href={TRANSITOS_ROUTE as never} />;
  return <>{children}</>;
}
