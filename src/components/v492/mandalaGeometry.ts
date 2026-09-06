/**
 * Qué anillos dibuja el mandala temporal, y dónde.
 *
 * Vive aparte del componente —igual que `wheelGeometry` para la rueda natal—
 * porque es la ÚNICA definición de "cuántos anillos hay", y la usan tres cosas
 * que tienen que coincidir: el SVG, su etiqueta accesible y el pie de figura de
 * la pantalla. Cuando cada una lo calculaba por su cuenta, divergían: el disco
 * dibujaba los ritmos disponibles con avance ubicable, la lista declaraba los
 * disponibles y el pie contaba una tercera cosa.
 */

/** Grosor del trazo y separación entre anillos del mandala, en puntos. */
export const MANDALA_STROKE = 9;
export const MANDALA_GAP = 7;

/** Tamaño por defecto del mandala. Lo comparten el dibujo y quien lo cuenta. */
export const MANDALA_SIZE = 232;

/**
 * Los anillos que se dibujan, con su radio.
 *
 * **Qué anillos hay** lo decide `ring.available` y nada más: si la lista de la
 * pantalla declara dos ritmos disponibles, el disco dibuja dos. Lo que depende
 * del avance es qué se dibuja ADENTRO del anillo —un arco, una franja o el riel
 * vacío—, y eso lo resuelve el componente.
 *
 * El radio lo fija la POSICIÓN del ritmo en el contrato, no su disponibilidad:
 * del más lento afuera al más rápido adentro. Si el que falta corriera a los
 * demás hacia el borde, el disco afirmaría un orden de ciclos que no es el suyo.
 *
 * Un anillo que no entra en el disco se deja afuera —no se encoge ni se
 * superpone—, y por eso el recuento sale de acá y no del largo de la lista.
 */
export function mandalaDrawnRings<T extends { key: string; available: boolean }>(
  rings: readonly T[],
  size: number = MANDALA_SIZE
): { ring: T; radius: number }[] {
  const center = size / 2;
  return rings
    .map((ring, index) => ({
      ring,
      radius: center - MANDALA_STROKE / 2 - index * (MANDALA_STROKE + MANDALA_GAP)
    }))
    .filter((anillo) => anillo.ring.available && anillo.radius > MANDALA_STROKE);
}
