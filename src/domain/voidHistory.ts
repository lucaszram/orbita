import type { VoidAnswerPayload, VoidHistoryItem } from "@/services/appRefs";

/**
 * Historial de El Umbral (`void.history`, handoff docs/handoff-claude-umbral-history.md).
 *
 * Reglas del contrato:
 * - El backend devuelve los intercambios más nuevos primero; acá no se reordena.
 * - Reabrir una respuesta guardada NO llama `void.ask` ni descuenta cupo: se
 *   mapea la fila al mismo estado `respuesta` de la pantalla.
 * - Fila malformada → se descarta (mismo patrón defensivo que el archivo
 *   remoto de guardadas); un payload raro nunca rompe la pantalla.
 */

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** ¿La fila remota trae todo lo que la vista `respuesta` renderiza? */
export function isVoidHistoryItem(value: unknown): value is VoidHistoryItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Partial<VoidHistoryItem> & { basadoEn?: unknown };
  return (
    isNonEmptyString(row.answerId) &&
    isNonEmptyString(row.localDate) &&
    isNonEmptyString(row.question) &&
    isNonEmptyString(row.answer) &&
    isNonEmptyString(row.mejorPregunta) &&
    isNonEmptyString(row.paso) &&
    Array.isArray(row.basadoEn) &&
    row.basadoEn.every((b) => typeof b === "string") &&
    typeof row.createdAt === "number"
  );
}

/** Filtra `void.history` a filas válidas. `undefined`/error/no-array → []. */
export function parseVoidHistory(rows: unknown): VoidHistoryItem[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter(isVoidHistoryItem);
}

const SHORT_MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

/** "HOY" o "DD MMM" ("18 JUL") para la fila del historial. */
export function voidHistoryDateLabel(localDate: string, today: string): string {
  if (localDate === today) return "HOY";
  const [, m, d] = localDate.split("-");
  const month = SHORT_MONTHS[Number(m) - 1];
  if (!month || !d) return localDate;
  return `${Number(d)} ${month}`;
}

/** Fila del historial → la forma que la vista `respuesta` ya renderiza. */
export function historyItemToAnswerPayload(item: VoidHistoryItem): VoidAnswerPayload {
  return {
    question: item.question,
    answer: item.answer,
    basadoEn: item.basadoEn,
    mejorPregunta: item.mejorPregunta,
    paso: item.paso
  };
}

export type VoidBackAction = "volver-a-preguntas" | "salir" | "oculta";

/**
 * Qué hace la flecha del Umbral según fase y contexto de montaje:
 * - `respuesta` (éxito, límite o error) SIEMPRE vuelve a `entrada`, también en
 *   la raíz de tab — antes `showBack=false` dejaba la respuesta sin salida.
 * - `entrada` solo puede salir de la ruta en el montaje profundo (`showBack`).
 * - `escuchando` la oculta: no se abandona una action todavía en vuelo.
 */
export function voidBackAction(
  phase: "entrada" | "escuchando" | "respuesta",
  showBack: boolean
): VoidBackAction {
  if (phase === "respuesta") return "volver-a-preguntas";
  if (phase === "entrada" && showBack) return "salir";
  return "oculta";
}
