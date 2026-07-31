import { Redirect } from "expo-router";

/**
 * Alias legado. El login canónico es `/iniciar-sesion`: la misma pantalla que
 * usa el nativo, con recuperación por código al email. Antes acá vivía una
 * segunda pantalla de login sólo para web (`orbita-login.tsx`), que era
 * exactamente la deriva que este trabajo elimina.
 */
export default function LoginRoute() {
  return <Redirect href="/iniciar-sesion" />;
}
