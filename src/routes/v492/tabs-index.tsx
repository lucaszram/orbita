import { Redirect } from "expo-router";

/**
 * Ruta histórica de la Home.
 *
 * En nativo la arquitectura V4.9.2 empieza en `Hoy`, así que esta ruta —a la que
 * todavía apuntan `router.replace("/(tabs)")` y la restauración de navegación de
 * iOS— redirige ahí. La redirección ocurre en el render, sin pintar nada antes:
 * no hay parpadeo de la pantalla vieja. No importa `HomeScreen` ni el tarot para
 * no arrastrar ese árbol al bundle nativo.
 *
 * En web sigue siendo exactamente lo de siempre: ver `tabs-index.web.tsx`.
 */
export default function Route() {
  return <Redirect href="/hoy" />;
}
