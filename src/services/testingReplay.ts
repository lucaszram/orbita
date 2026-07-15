/** ─── TESTING · SACAR ANTES DEL LAUNCH ──────────────────────────────────────
 *
 *  Replay del "primer día" para el botón de Perfil: el reveal real es
 *  irreversible en el server (regla del ritual), así que esto arma un modo de
 *  sesión en el que la Home trata la carta de HOY como si no estuviera sacada
 *  (boca abajo + intro del tarot), y al tirarla hace el flip local sin tocar el
 *  backend. Es memoria de sesión a propósito: matar la app lo desarma.
 *
 *  Se borra junto con el botón "REPETIR PRIMER DÍA" de perfil.tsx.
 */
let armed = false;

export const testingReplay = {
  arm() {
    armed = true;
  },
  disarm() {
    armed = false;
  },
  isArmed(): boolean {
    return armed;
  }
};
/* ─── FIN TESTING ─────────────────────────────────────────────────────────── */
