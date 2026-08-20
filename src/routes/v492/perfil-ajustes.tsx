import { DetailLayerScreen } from "@/components/v492/Screen";
import { PerfilAjustesBody } from "@/screens/PerfilScreen";

/**
 * Ajustes de la cuenta, detrás del engranaje de "Tu carta".
 *
 * El chrome (scroll, lienzo y el ← de 44×44) lo pone `DetailLayerScreen`; el
 * contenido es el cuerpo administrativo canónico de `PerfilScreen`, sin hero ni
 * tarjeta. `fallbackHref` cae a la raíz de la pestaña cuando la pantalla se
 * abre por deep link y no hay historial.
 */
export default function PerfilAjustesRoute() {
  return (
    <DetailLayerScreen eyebrow="AJUSTES" fallbackHref="/perfil">
      <PerfilAjustesBody />
    </DetailLayerScreen>
  );
}
