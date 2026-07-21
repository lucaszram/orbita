import { useEffect, useRef } from "react";
import { useProductTelemetry } from "@/hooks/useProductTelemetry";
import type { ProductEventName } from "@/domain/productEvents";

/**
 * Marca "contenido real visible": montarlo SOLO en la rama de éxito de una
 * pantalla (nunca junto a loading/empty/error). Dispara una vez por montaje;
 * el dedupe por sesión de los eventos que lo requieren vive en el provider.
 * `entryPoint` es un slug técnico en minúscula, jamás copy ni texto de la persona.
 */
export function TrackScreenView({
  event,
  entryPoint
}: {
  event: ProductEventName;
  entryPoint?: string;
}) {
  const { track } = useProductTelemetry();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, entryPoint ? { entryPoint } : undefined);
  }, [track, event, entryPoint]);
  return null;
}
