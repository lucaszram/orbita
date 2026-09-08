/**
 * ¿El arranque llegó a su destino? (CORE-183)
 *
 * La web de Órbita no muestra la ruta que pediste: muestra la que los gates
 * deciden. `/` puede terminar en la landing o en Home, `/iniciar-sesion` puede
 * rebotar a Home, y cualquier ruta de producto espera a que Clerk y Convex
 * contesten antes de saber si abre. Entre que el router publica un `pathname` y
 * el producto queda en su lugar hay renders con rutas que NADIE visitó.
 *
 * La primera versión de esta tarjeta esperaba 200 ms y contaba lo que quedaba.
 * Era una apuesta sobre el reloj: si un gate tardaba más —una sesión lenta, un
 * backend frío— la ruta intermedia se contaba igual, y una navegación real más
 * rápida que la ventana se cancelaba. Este módulo reemplaza el plazo por un
 * hecho: cada superficie declara si YA llegó a su destino, y la telemetría emite
 * cuando ninguna sigue resolviendo.
 *
 * Es un store diminuto y a nivel de módulo, sin React adentro a propósito: el
 * hecho es de la aplicación entera —no de un árbol de componentes—, sobrevive a
 * un remount y se puede probar sin montar nada. El puente con React vive en
 * `bootSurface.tsx`, y quien lo lee es `pageviewStream.ts`.
 */

/** `resolving`: alguna superficie todavía puede mover la ruta. */
export type BootPhase = "resolving" | "resolved";

/**
 * Identidad de una superficie montada. Es un `symbol` para que dos gates
 * montados a la vez —el layout de tabs y la pantalla adentro— nunca compartan
 * entrada por accidente: no hay nombre que colisione ni contador que se
 * desincronice.
 */
export type BootSurfaceId = symbol;

/** Superficies montadas → ¿llegó a su destino? */
const surfaces = new Map<BootSurfaceId, boolean>();
const listeners = new Set<() => void>();

/**
 * Sin superficies montadas el arranque está RESUELTO, y eso es una decisión.
 *
 * Las rutas públicas —`/privacy`, `/terminos`, `/support`— no montan ningún
 * gate: no tienen nada que resolver y son su propio destino. Si el estado
 * inicial fuera "resolviendo" haría falta que alguien las marcara, y una ruta
 * nueva que se olvidara de hacerlo dejaría de medirse en silencio.
 *
 * Lo que sostiene esta decisión es CUÁNDO se lee: la telemetría no pregunta
 * dentro del commit sino al final de la tanda de efectos, con el árbol ya
 * montado y los gates ya declarados (ver `pageviewStream.ts`).
 */
export function bootPhase(): BootPhase {
  for (const settled of surfaces.values()) {
    if (!settled) return "resolving";
  }
  return "resolved";
}

/**
 * Una superficie se montó. Si es nueva arranca RESOLVIENDO; si ya estaba, no se
 * pisa lo que haya declarado.
 *
 * Ese "no se pisa" es lo que hace que el orden de los efectos de React no
 * importe: los efectos de los hijos corren antes que los del padre, así que el
 * gate registra su superficie DESPUÉS de que su propio contenido ya la marcó
 * como llegada. Sin la guarda, el padre volvería a ponerla en "resolviendo" y
 * la primera visita de cada carga se perdería.
 */
export function openBootSurface(id: BootSurfaceId): void {
  if (surfaces.has(id)) return;
  change(() => surfaces.set(id, false));
}

/** La superficie está mostrando el contenido de su ruta: no mueve nada más. */
export function settleBootSurface(id: BootSurfaceId): void {
  change(() => surfaces.set(id, true));
}

/**
 * La superficie volvió a resolver: espera, redirige o no pudo abrir.
 *
 * A una superficie ya cerrada no se la resucita, y eso importa: al desmontar, la
 * limpieza del hijo —que desmarca— y la del padre —que cierra— corren una
 * después de la otra, y si el orden fuera el inverso una entrada muerta dejaría
 * el arranque resolviendo para siempre. Marcar CREA la entrada (el hijo corre
 * primero al montar); desmarcar, no.
 */
export function unsettleBootSurface(id: BootSurfaceId): void {
  if (!surfaces.has(id)) return;
  change(() => surfaces.set(id, false));
}

/** La superficie se desmontó: deja de contar para el arranque. */
export function closeBootSurface(id: BootSurfaceId): void {
  change(() => surfaces.delete(id));
}

/**
 * Avisa cuando el arranque CAMBIA de fase, y sólo entonces.
 *
 * Quien escucha reacciona a un hecho de la aplicación, no a cada render: un gate
 * que se remonta sin cambiar de fase no despierta a nadie.
 */
export function subscribeBootPhase(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function change(mutate: () => void): void {
  const antes = bootPhase();
  mutate();
  if (bootPhase() === antes) return;
  for (const listener of [...listeners]) listener();
}

/**
 * Vuelve al estado de una carga nueva. Existe para las pruebas: en el navegador
 * el arranque se reinicia recargando, que es lo mismo que volver a evaluar este
 * módulo.
 */
export function resetBootState(): void {
  surfaces.clear();
  listeners.clear();
}
