import type { DailyRitual } from "../services/appRefs";

/** ¿El ritual está completo y aprobable para la pantalla live?
 *
 *  Regla del handoff v3: la lectura de la carta se muestra COMPLETA o no se muestra
 *  (carga/error). Nunca parcial — esa fue la captura de La Sacerdotisa, que salía con
 *  `significadoGeneral: []`, `enTuDia: ""` y cierre vacío. El backend v3 siempre manda
 *  las cinco partes con exactamente tres facetas; esta guarda cubre la transición de
 *  contrato (payload v2/incompleto).
 *
 *  Módulo puro (sin React Native) para poder testearlo en node. */
export function isRitualComplete(ritual?: DailyRitual): ritual is DailyRitual {
  return Boolean(
    ritual &&
      ritual.esencia?.trim() &&
      Array.isArray(ritual.significadoGeneral) &&
      ritual.significadoGeneral.length === 3 &&
      ritual.significadoGeneral.every((f) => f?.titulo?.trim() && f?.texto?.trim()) &&
      ritual.enTuDia?.trim() &&
      ritual.consejo?.trim() &&
      ritual.cierre?.pregunta?.trim()
  );
}
