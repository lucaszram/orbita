import { Redirect } from "expo-router";

/**
 * `/empezar` es la entrada al alta desde la LANDING web (ver `empezar.web.tsx`,
 * que Metro resuelve únicamente ahí).
 *
 * En nativo no hay landing: el alta se abre en `/onboarding`, que monta el mismo
 * flujo canónico a través del mismo gate compartido. Esta ruta sólo redirige,
 * así que no duplica el alta ni arrastra el aviso de "sin backend" de la web.
 */
export default function Route() {
  return <Redirect href="/onboarding" />;
}
