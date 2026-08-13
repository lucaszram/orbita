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
 * Código de aplicación de un `ConvexError`.
 *
 * `new ConvexError({ code })` viaja al cliente en `error.data`; el `message`
 * queda en "Server Error" y NO trae el marcador. Se exige que `data` sea un
 * objeto con `code` string: así un valor cualquiera con forma parecida no puede
 * colar un límite falso.
 */
function convexErrorCode(error: Error): string | null {
  const data = (error as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return null;
  const code = (data as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * Clasifica el fallo de `daily.revealCard`.
 *
 * Dos formas, ambas reales:
 *
 * 1. `ConvexError({ code })` — lo que tira producción hoy. El marcador llega en
 *    `error.data.code` y se compara por igualdad exacta. Mirar sólo el mensaje
 *    era justo el bug: devolvía `desconocido`, la carta volvía al dorso y nunca
 *    aparecía `DESBLOQUEAR TAROT DIARIO`.
 * 2. `Error` común — Convex lo envuelve en un mensaje más largo (request id,
 *    "Uncaught Error", ubicación del handler), así que ahí se busca el marcador
 *    DENTRO del mensaje, mismo criterio que `checkoutStartErrorKind`.
 *
 * Cualquier otra cosa —error de red, fallo desconocido, o un valor que ni
 * siquiera es un `Error`— cae en `desconocido` y conserva el comportamiento de
 * siempre: el flip se revierte y no se inventa una explicación de plan.
 */
export function revealFailureKind(error: unknown): RevealFailureKind {
  if (!(error instanceof Error)) return "desconocido";
  if (convexErrorCode(error) === FREE_TAROT_LIMIT_MARKER) return "limite_free";
  return error.message.includes(FREE_TAROT_LIMIT_MARKER) ? "limite_free" : "desconocido";
}
