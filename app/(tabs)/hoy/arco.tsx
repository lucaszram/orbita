import { Redirect } from "expo-router";
import { DetailLayerScreen } from "@/components/v492/Screen";
import { LoadingBlock } from "@/components/v492/States";
import { TRANSIT_DETAIL_EYEBROW } from "@/domain/layerMeaning";
import { useLayers } from "@/hooks/useLayers";

/**
 * `/hoy/arco` — **sólo compatibilidad de deep links**.
 *
 * Era el detalle del arco principal del día, abierto desde Hoy. Hoy ya no lo
 * abre —el bloque del arco salió de esa pantalla— y el detalle de CUALQUIER
 * tránsito, incluido el principal, vive en un único lugar canónico:
 * `/transitos/arco/[arcId]`, dentro de la sección desde la que se llega.
 *
 * Por eso esta ruta no vuelve a montar `ArcoDetailScreen`. Dos rutas
 * renderizando la misma pantalla con dos "volver" distintos es la clase de
 * duplicado que se desincroniza sola: el día que el detalle cambie, una de las
 * dos se queda atrás. Acá sólo se traduce el enlace viejo al nuevo.
 *
 * El destino sale del sobre del día: el `arcId` del tránsito principal. Sin ese
 * dato no hay detalle que abrir y se manda a la lista (`/transitos`), que es
 * donde ese tránsito estaría si sigue activo.
 *
 * Mientras el sobre viaja NO se redirige: resolver a `/transitos` en ese
 * instante mandaría a la lista a alguien que pidió un detalle concreto, sólo
 * porque su enlace llegó antes que el cálculo.
 */
export default function ArcoPrincipalRoute() {
  const { phase, bundle } = useLayers();

  if (phase === "cargando") {
    return (
      <DetailLayerScreen eyebrow={TRANSIT_DETAIL_EYEBROW} fallbackHref="/hoy">
        <LoadingBlock />
      </DetailLayerScreen>
    );
  }

  const arcId = bundle?.today.transitArc.data?.arcId ?? null;
  const destino = arcId ? `/transitos/arco/${encodeURIComponent(arcId)}` : "/transitos";
  return <Redirect href={destino as never} />;
}
