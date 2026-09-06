import { useEffect } from "react";
import { Redirect } from "expo-router";
import { markFirstRun } from "@/services/firstRun";

/**
 * `/recepcion` en NATIVO: la ceremonia del día 1 con su oferta de compra vive
 * sólo en la web (ver `recepcion.web.tsx`, que Metro resuelve únicamente ahí).
 *
 * Acá no hay una pantalla nueva que inventar: el activo que la recepción
 * presentaba —la carta natal— ya tiene su lugar propio en el stack del Perfil,
 * así que el cierre del alta entra directo ahí. Se conserva el ÚNICO efecto que
 * la ceremonia dejaba en el dispositivo (`recepcionVista`), para que el resto de
 * la app siga sabiendo que el día 1 ya pasó. No se importa la rueda, el
 * entitlement ni el árbol de la ceremonia web: nada de eso llega al bundle
 * nativo.
 */
export default function Route() {
  useEffect(() => {
    void markFirstRun({ recepcionVista: true });
  }, []);

  return <Redirect href="/perfil/carta" />;
}
