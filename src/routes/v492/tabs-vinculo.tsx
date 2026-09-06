import { Redirect } from "expo-router";

/**
 * Ruta histórica de Vínculo (singular).
 *
 * En nativo la sección ahora es la pestaña `Vínculos`, así que esta ruta
 * redirige a `/vinculos`. La redirección ocurre en el render, sin pintar nada
 * antes: no hay parpadeo. No importa `VinculoScreen` para no arrastrar ese árbol
 * al bundle nativo.
 *
 * En web sigue siendo exactamente lo de siempre: ver `tabs-vinculo.web.tsx`.
 */
export default function VinculoRoute() {
  return <Redirect href="/vinculos" />;
}
