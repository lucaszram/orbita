import { Redirect } from "expo-router";

/**
 * Tu momento · Cuatro ritmos (CORE-211), variante NATIVA: en la app la lectura vive en la pestaña de
 * Tránsitos/Perfil V4.9.2; esta ruta sólo redirige (deep links y enlaces
 * heredados de la web).
 */
export default function Route() {
  return <Redirect href="/transitos/momento" />;
}
