import { MapaElementalDetailScreen } from "@/screens/v492/MapaElementalDetailScreen";

/**
 * Mapa elemental dentro de la carta del Perfil (`/perfil/carta/mapa-elemental`),
 * arquitectura nativa V4.9.2.
 *
 * Cuelga del hub de la carta porque es una capa NATAL: no cambia con el día, se
 * lee junto a la rueda y "volver" tiene que dejar en la carta.
 *
 * En web esta ruta redirige a `/carta` (ver
 * `perfil-carta-mapa-elemental.web.tsx`), igual que el hub.
 */
export default function PerfilCartaMapaElementalRoute() {
  return <MapaElementalDetailScreen />;
}
