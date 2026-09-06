/**
 * Carga del Offering protegida contra un cambio de cuenta a mitad de camino.
 *
 * ## El defecto
 *
 * `retry()` pedía el Offering y publicaba el resultado sin volver a mirar quién
 * era el dueño. Entre el pedido y la respuesta, Clerk puede pasar de A a B: el
 * Offering de A terminaba pintado en la pantalla de B —y, peor, un ERROR de A
 * dejaba a B mirando "no pudimos cargar la oferta" sobre una carga que sí había
 * funcionado.
 *
 * ## La guarda
 *
 * Se captura `(generación, usuario)` ANTES de pedir y se compara DESPUÉS. Si
 * cambió cualquiera de los dos, el resultado pertenece a un ciclo que ya no
 * existe y se descarta —tanto el éxito como el error—. La generación cubre el
 * remonte con la misma cuenta, que también invalida.
 *
 * Es async y sin React a propósito: la carrera se prueba con promesas
 * diferidas, no leyendo el fuente.
 */

export type OfferingGuard = {
  generation: number;
  userId: string | null;
};

export function sameOfferingGuard(a: OfferingGuard, b: OfferingGuard): boolean {
  return a.generation === b.generation && a.userId === b.userId;
}

export async function runGuardedOfferingLoad<T>(args: {
  load: () => Promise<T>;
  /** Guarda vigente en el momento de pedir. */
  capture: () => OfferingGuard;
  /** Guarda vigente cuando la respuesta vuelve. */
  current: () => OfferingGuard;
  publish: (result: T) => void;
  fail: (error: unknown) => void;
}): Promise<void> {
  const captured = args.capture();
  try {
    const result = await args.load();
    if (!sameOfferingGuard(captured, args.current())) return;
    args.publish(result);
  } catch (error) {
    if (!sameOfferingGuard(captured, args.current())) return;
    args.fail(error);
  }
}
