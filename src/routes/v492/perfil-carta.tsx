import { Redirect } from "expo-router";

/**
 * El hub de la carta vive ahora en la raíz de la pestaña (/perfil). Esta ruta
 * queda para los deep links y builds instalados que todavía apuntan acá: un
 * solo salto, sin cadena.
 */
export default function PerfilCartaRoute() {
  return <Redirect href="/perfil" />;
}
