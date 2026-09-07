/**
 * El puente entre un gate de React y la señal de arranque (`bootState.ts`).
 *
 * Son dos piezas y ninguna decide nada: `useBootSurface` da identidad a una
 * superficie montada, y `AtDestination` declara —por estar montado— que lo que
 * se está mostrando ES el contenido de la ruta y no una espera, un aviso ni una
 * redirección. Un gate no tiene que enumerar sus estados ni mantener un booleano
 * en paralelo con su lógica: envuelve el contenido y listo.
 *
 * Vive acá y no dentro del gate porque el hecho que declara es de la telemetría
 * (CORE-183), no de la sesión: el gate presta la señal, no la consume.
 */
import { useEffect, useRef, type ReactNode } from "react";

import {
  closeBootSurface,
  openBootSurface,
  settleBootSurface,
  unsettleBootSurface,
  type BootSurfaceId
} from "@/analytics/bootState";

/**
 * Registra esta superficie mientras el componente esté montado.
 *
 * El id se crea una vez por instancia: dos gates montados a la vez son dos
 * entradas distintas, y un remount es una superficie nueva —que arranca
 * resolviendo, como corresponde—.
 */
export function useBootSurface(): BootSurfaceId {
  // `useRef` y no `useMemo`: lo que se guarda es IDENTIDAD, y un `useMemo` es
  // una cache que React puede tirar. Un id nuevo a mitad de la vida del
  // componente dejaría la entrada vieja sin cerrar y el arranque no se
  // resolvería nunca.
  const guardado = useRef<BootSurfaceId | null>(null);
  const id = (guardado.current ??= Symbol("boot-surface"));
  useEffect(() => {
    openBootSurface(id);
    return () => closeBootSurface(id);
  }, [id]);
  return id;
}

/**
 * Mientras esto esté montado, la superficie llegó a su destino.
 *
 * Se marca en un efecto y se desmarca al desmontar, así que el estado sigue al
 * árbol REAL —lo que se está mostrando— y no a una intención de render que
 * podría descartarse. El gate que devuelve un spinner o un `<Redirect>` no monta
 * esto, y con eso alcanza para que el arranque siga en `resolving`.
 *
 * Corre ANTES que el efecto del gate que lo monta —React ejecuta los efectos de
 * los hijos primero—, y por eso `openBootSurface` no pisa lo que se marcó acá.
 */
export function AtDestination({
  surface,
  children
}: {
  surface: BootSurfaceId;
  children: ReactNode;
}) {
  useEffect(() => {
    settleBootSurface(surface);
    return () => unsettleBootSurface(surface);
  }, [surface]);
  return <>{children}</>;
}
