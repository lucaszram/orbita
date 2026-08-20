import { VoidExperience } from "@/components/void/VoidExperience";

/**
 * El Umbral. Raíz de pestaña → sin botón "volver".
 *
 * Es la misma experiencia canónica en las dos plataformas: en nativo la monta la
 * pestaña `Umbral`; en web, la sección `Umbral` de la navegación, dentro del
 * shell que ya aporta el layout del grupo (acá no se vuelve a montar).
 */
export default function UmbralTab() {
  return <VoidExperience showBack={false} />;
}
