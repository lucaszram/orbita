import { Redirect } from "expo-router";

/**
 * El Customer Portal de Stripe vuelve a `{WEB_APP_URL}/profile` (lo fija
 * `buildStripePortalForm` en el backend), pero el perfil de Órbita vive en
 * `/perfil`. Sin esta ruta, volver del portal daba 404.
 */
export default function ProfileRoute() {
  return <Redirect href="/perfil" />;
}
