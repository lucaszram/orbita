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

/** Visibilidad del reveal de la carta del día — resuelve el intervalo entre que la
 *  mutation confirma y `getStrip` actualiza el prop `revealed` (reactivo, llega después).
 *
 *  - `revealed`: estado del server (getStrip + carta válida).
 *  - `confirmed`: la mutation `revealCard` YA devolvió true (confirmación optimista).
 *  - `pulling`: el tirón está en vuelo (flip animándose, mutation pendiente).
 *
 *  Reglas (regresión del bug cara+CTA, 2026-07-18):
 *  - Apenas `onReveal()` devuelve true (`confirmed`), la pantalla pasa atómicamente a
 *    revelada: cara + "Te salió…" + orientación + ritual. No espera a `getStrip`.
 *  - El CTA de carta cerrada se oculta apenas empieza el tirón (`pulling`), así la cara
 *    NUNCA convive con el CTA.
 *  - Si el tirón falla (`!confirmed && !pulling`), vuelve al dorso y reaparece el CTA. */
export function cartaRevealView(s: { revealed: boolean; confirmed: boolean; pulling: boolean }): {
  isRevealed: boolean;
  showCta: boolean;
  showRitual: boolean;
} {
  const isRevealed = s.revealed || s.confirmed;
  return { isRevealed, showCta: !isRevealed && !s.pulling, showRitual: isRevealed };
}

// ---------------------------------------------------------------------------
// Límite Free del Tarot
// ---------------------------------------------------------------------------

/** Marcador estable que tira `daily.revealCard` cuando una cuenta Free ya gastó
 *  sus siete revelaciones. Lo publica `convex/lib/tarotAccess.ts`; acá se copia
 *  el TEXTO a propósito: el cliente no importa módulos del backend. */
export const FREE_TAROT_LIMIT_MARKER = "FREE_TAROT_REVEAL_LIMIT_REACHED";

export type RevealFailureKind = "limite_free" | "desconocido";

/**
 * Clasifica el fallo de `daily.revealCard`.
 *
 * Convex envuelve el `Error` del backend dentro de un mensaje más largo
 * (request id, "Uncaught Error", ubicación del handler), así que se busca el
 * marcador DENTRO del mensaje en vez de comparar igualdad exacta — mismo
 * criterio que `checkoutStartErrorKind`. Cualquier otra cosa —error de red,
 * fallo desconocido, o un valor que ni siquiera es un `Error`— cae en
 * `desconocido` y conserva el comportamiento de siempre: el flip se revierte y
 * no se inventa una explicación de plan.
 */
export function revealFailureKind(error: unknown): RevealFailureKind {
  if (!(error instanceof Error)) return "desconocido";
  return error.message.includes(FREE_TAROT_LIMIT_MARKER) ? "limite_free" : "desconocido";
}
