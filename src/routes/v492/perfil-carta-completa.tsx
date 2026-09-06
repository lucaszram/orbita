import { CartaCompletaV492Screen } from "@/screens/v492/CartaCompletaV492Screen";

/**
 * Carta completa dentro de la carta del Perfil (`/perfil/carta/completa`),
 * arquitectura nativa V4.9.2.
 *
 * Cuelga del hub porque es el detalle de la MISMA carta: todas las posiciones,
 * los contactos y las casas. "Volver" tiene que dejar en la carta.
 *
 * En web esta ruta redirige a `/carta` (ver `perfil-carta-completa.web.tsx`),
 * igual que el hub y los otros detalles.
 */
export default function PerfilCartaCompletaRoute() {
  return <CartaCompletaV492Screen />;
}
