import { TemporalPlusGate } from "@/components/v492/PlanGate";
import { TransitosLayersScreen } from "@/screens/v492/TransitosLayersScreen";

/**
 * Tránsitos · Tu momento: los ciclos lentos, que se miden en años y no en días.
 *
 * Es una VISTA de la sección, no un detalle: comparte pantalla con `Ahora` y el
 * selector cambia de ruta. Tiene URL propia para que "estoy mirando mis ciclos
 * largos" sobreviva a un deep link y a la restauración de navegación de iOS, que
 * antes devolvía siempre a `Ahora` porque la vista era estado local.
 */
export default function TransitosMomentoRoute() {
  return (
    // Con Free los ciclos largos tampoco se calculan: el enlace cae en la raíz
    // de la sección, que es donde vive el bloqueo con su oferta (build 30).
    <TemporalPlusGate>
      <TransitosLayersScreen mode="momento" />
    </TemporalPlusGate>
  );
}
