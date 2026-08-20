import { Redirect } from "expo-router";

/**
 * Ruta histórica del Umbral.
 *
 * `vacio` era el nombre de archivo de la pestaña y todavía hay enlaces viejos
 * apuntando ahí. La sección ya vive en `/umbral` —su nombre de producto y su
 * única URL canónica—, así que acá sólo queda la redirección: ningún link se
 * rompe y no hay dos archivos disputándose la misma pantalla.
 */
export default function VacioRoute() {
  return <Redirect href="/umbral" />;
}
