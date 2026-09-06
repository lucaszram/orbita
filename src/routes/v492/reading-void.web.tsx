import { VoidExperience } from "@/components/void/VoidExperience";

/**
 * `/reading/void` en web: la lectura de El Vacío con botón "volver", tal cual
 * venía sirviéndose. La web no cambia.
 *
 * Va sin `WebAppShell` a propósito: es una lectura del stack `reading/`, que se
 * abre desde otra pantalla y vuelve a ella; el chrome de navegación lo pone la
 * sección `Umbral`, no esta ruta.
 */
export default function VoidScreen() {
  return <VoidExperience showBack />;
}
