import { Redirect } from "expo-router";

/**
 * Carta completa (CORE-215), variante NATIVA: en la app la lectura vive en la pestaña de
 * Tránsitos/Perfil V4.9.2; esta ruta sólo redirige (deep links y enlaces
 * heredados de la web).
 */
export default function Route() {
  return <Redirect href="/perfil/carta/completa" />;
}
