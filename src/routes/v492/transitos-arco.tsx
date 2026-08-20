import { Redirect, useLocalSearchParams } from "expo-router";
import { ArcoDetailScreen } from "@/screens/v492/ArcoDetailScreen";

/**
 * Detalle de un tránsito de la lista (`/transitos/arco/[arcId]`).
 *
 * Cuelga de `arco/` y no de la raíz de la sección: un segmento dinámico suelto
 * en `transitos/` se queda con CUALQUIER URL de un nivel —`/transitos/momento`
 * incluido— y el desempate lo decidiría el router, no el producto. Con el
 * prefijo, `momento` es una vista de la sección y `arco/…` es un detalle.
 *
 * El `arcId` es el identificador estable del arco que arma el backend
 * (`arc_v1_…`), así que el enlace sobrevive a recálculos del día mientras ese
 * contacto siga activo.
 *
 * Sin `arcId` no hay detalle que abrir: se vuelve a la lista en lugar de montar
 * la pantalla del arco principal del día, que es otra cosa y vive en
 * `/hoy/arco`.
 *
 * Se entra a este detalle desde la lista, así que "volver" sin historial
 * —un deep link— tiene que dejar en Tránsitos y no en Hoy.
 */
export default function TransitoDetalleRoute() {
  const { arcId } = useLocalSearchParams<{ arcId?: string }>();
  if (typeof arcId !== "string" || arcId.length === 0) return <Redirect href="/transitos" />;
  return <ArcoDetailScreen arcId={arcId} fallbackHref="/transitos" />;
}
