import { TemporalPlusGate } from "@/components/v492/PlanGate";
import { LunaDetailScreen } from "@/screens/v492/LunaDetailScreen";

/**
 * Detalle de la Luna sobre tu carta, dentro del stack de Hoy (`/hoy/luna`).
 *
 * La pantalla no cambia: sigue siendo la MISMA que abre `Tu momento` desde su
 * propia ruta. Lo que agrega esta capa es el gate de plan (build 30): la Luna
 * sobre la carta es una capa temporal y con Free el enlace aterriza en el
 * bloqueo de Tránsitos antes de montar el detalle.
 */
export default function HoyLunaRoute() {
  return (
    <TemporalPlusGate>
      <LunaDetailScreen />
    </TemporalPlusGate>
  );
}
