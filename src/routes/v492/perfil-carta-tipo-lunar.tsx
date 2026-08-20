import { TipoLunarDetailScreen } from "@/screens/v492/TipoLunarDetailScreen";

/**
 * Tipo lunar dentro de la carta del Perfil (`/perfil/carta/tipo-lunar`),
 * arquitectura nativa V4.9.2.
 *
 * Cuelga del hub de la carta porque es una capa NATAL: no cambia con el día, se
 * lee junto a la rueda y "volver" tiene que dejar en la carta.
 *
 * En web esta ruta redirige a `/carta` (ver `perfil-carta-tipo-lunar.web.tsx`),
 * igual que el hub.
 */
export default function PerfilCartaTipoLunarRoute() {
  return <TipoLunarDetailScreen />;
}
