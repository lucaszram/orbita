/** Estado del ritual para el modo INVITADO (sin sesión).
 *
 *  Con cuenta, `revealedAt` vive en el server y la tira/el Diario son queries
 *  reactivas. Sin cuenta no hay backend que recuerde nada: este módulo guarda
 *  en memoria de la sesión qué día ya sacó su carta, para que la Home, la tira
 *  y el Diario cuenten la MISMA historia (antes cada pantalla tenía su copia
 *  y el Diario mostraba el dorso con la carta recién sacada).
 *
 *  Es memoria de sesión a propósito: el archivo real del Diario es del backend;
 *  esto es solo la vidriera del ritual de hoy.
 */
let revealedDate: string | null = null;

export const guestRitual = {
  markRevealed(localDate: string) {
    revealedDate = localDate;
  },
  isRevealed(localDate: string): boolean {
    return revealedDate === localDate;
  },
};
