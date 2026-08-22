import { Redirect } from "expo-router";

import { SIGN_UP_ROUTE } from "@/domain/appRoutes";

/**
 * `/empezar` es la entrada al alta desde la LANDING web (ver `empezar.web.tsx`,
 * que Metro resuelve únicamente ahí).
 *
 * En nativo no hay landing: `/empezar` entra al flujo auth-first, así que
 * redirige a `SIGN_UP_ROUTE`. Una vez creada la cuenta, el resolver de destino
 * manda a onboarding. Esta ruta sólo redirige, así que no duplica el alta ni
 * arrastra el aviso de "sin backend" de la web.
 */
export default function Route() {
  return <Redirect href={SIGN_UP_ROUTE} />;
}
