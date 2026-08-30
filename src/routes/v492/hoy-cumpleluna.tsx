import { TemporalPlusGate } from "@/components/v492/PlanGate";
import { CumplelunaDetailScreen } from "@/screens/v492/CumplelunaDetailScreen";

/**
 * Detalle del Cumpleluna, dentro del stack de Hoy (`/hoy/cumpleluna`).
 *
 * Misma pantalla de siempre, con el gate de plan del build 30: el ciclo lunar
 * personal se calcula sobre el cielo del día, así que con Free el enlace
 * aterriza en el bloqueo de Tránsitos antes de montar el detalle.
 */
export default function HoyCumplelunaRoute() {
  return (
    <TemporalPlusGate>
      <CumplelunaDetailScreen />
    </TemporalPlusGate>
  );
}
