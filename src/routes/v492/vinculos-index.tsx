import { VinculosHubScreen } from "@/screens/v492/VinculosHubScreen";

/**
 * Raíz de la pestaña Vínculos (`/vinculos`).
 *
 * En nativo monta la experiencia V4.9.2: tu patrón relacional y tus personas
 * guardadas. La web conserva `/vinculo` y no llega hasta acá — su variante está
 * en `vinculos-index.web.tsx`.
 */
export default function VinculosRoute() {
  return <VinculosHubScreen />;
}
