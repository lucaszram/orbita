/**
 * En nativo no hay telemetría web ni señal de arranque.
 *
 * `AccountGate` es COMPARTIDO y monta el puente sin condicionales —enumerar
 * plataformas dentro de su lógica de destino sería exactamente lo que esta
 * tarjeta no quiere—. Esta variante existe para que ese montaje no mute
 * `bootState`: en el bundle nativo no hay nadie que lea esa señal, porque quien
 * la consume es `pageviewStream.ts` y ése es exclusivamente del navegador. Es
 * el mismo motivo por el que `webTelemetry.native.tsx` no renderiza nada.
 *
 * La firma exportada es la MISMA que la de `bootSurface.tsx`: quien la usa no
 * sabe en qué plataforma está. Lo único que cambia es que acá no hay hecho que
 * declarar.
 */
import { useRef } from "react";

import type { ReactNode } from "react";
import type { BootSurfaceId } from "@/analytics/bootState";

/**
 * Identidad de la superficie, sin registrarla en ningún lado.
 *
 * Se conserva el `useRef` de la variante web —y no un símbolo de módulo— para
 * que la identidad siga siendo POR INSTANCIA: dos gates montados a la vez no
 * comparten id ni acá. Nadie lo lee hoy; que no colisione es lo que hace que
 * seguir sin leerlo no dependa de la suerte.
 */
export function useBootSurface(): BootSurfaceId {
  const guardado = useRef<BootSurfaceId | null>(null);
  return (guardado.current ??= Symbol("boot-surface"));
}

/**
 * El contenido pasa tal cual, sin efectos.
 *
 * `surface` se sigue exigiendo —la firma es la misma— y no se usa: en nativo no
 * hay arranque que marcar. Sin efecto no hay nada que correr al montar ni al
 * desmontar, así que la app nativa no puede quedar esperando un hecho que nadie
 * va a publicar.
 */
export function AtDestination({ children }: { surface: BootSurfaceId; children: ReactNode }) {
  return <>{children}</>;
}
