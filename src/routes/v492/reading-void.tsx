import { Redirect } from "expo-router";

/**
 * En nativo el Vacío ya no tiene una ruta paralela: la sección canónica es la
 * pestaña `Umbral` (`/umbral`), con su stack y la barra inferior. `/reading/void`
 * era la misma experiencia montada fuera del grupo de pestañas —otro chrome para
 * la misma pantalla—, así que acá solo redirige y los enlaces viejos siguen
 * funcionando.
 *
 * No importa `VoidExperience`: el destino ya la monta, y así el bundle nativo no
 * la arrastra dos veces.
 */
export default function Route() {
  return <Redirect href="/umbral" />;
}
