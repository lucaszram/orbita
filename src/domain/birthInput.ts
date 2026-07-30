/**
 * Parseo de lo que se TIPEA en los campos de fecha y hora de nacimiento.
 *
 * Vive en el dominio y no en el componente por dos razones: es lógica pura, y
 * los tests no pueden importar un módulo que arrastre `react-native`.
 *
 * Estricto a propósito: un texto que no sea una fecha u hora válida NO llega al
 * estado, así que no se puede guardar basura. Rechaza además días que no
 * existen (31 de febrero, 29 de febrero en un año no bisiesto).
 */
/** `YYYY-MM-DD` válido y real (rechaza 2026-02-30). */
export function parseDateInput(text: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const probe = new Date(y, mo - 1, d);
  // Un día que "se corre" al normalizar no existía (31 de febrero, etc.).
  if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) return null;
  return { y, m: mo, d };
}

/** `HH:MM` en 24 horas. */
export function parseTimeInput(text: string): { h: number; m: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}
