import { Redirect } from "expo-router";

/**
 * En web no existe la pantalla de ajustes: /perfil ES el perfil administrativo
 * de siempre. Cero regresiones web: esta ruta sólo devuelve ahí.
 */
export default function PerfilAjustesRoute() {
  return <Redirect href="/perfil" />;
}
