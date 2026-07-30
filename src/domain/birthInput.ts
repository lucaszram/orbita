/**
 * Fecha y hora de nacimiento: formatos de intercambio del editor.
 *
 * En web los campos son `<input type="date">` / `<input type="time">` del
 * navegador, que ya hablan exactamente estos formatos (`YYYY-MM-DD` y `HH:MM`),
 * así que estas funciones son el borde que valida lo que el control entrega
 * antes de que llegue al estado. En nativo son la traducción entre el
 * `DateTimePicker` de rueda (que trabaja con `Date`) y los mismos strings.
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

/** `HH:MM` en 24 horas. Acepta los `HH:MM:SS` que emite Firefox y descarta los segundos. */
export function parseTimeInput(text: string): { h: number; m: number } | null {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

/**
 * Normaliza lo que devuelve un control: string válido o `null`.
 *
 * Un `<input type="date">` vacío devuelve `""`. Eso es "no elegí nada", no
 * "elegí el vacío": tiene que llegar al estado como ausencia, para que Guardar
 * siga bloqueado en vez de escribir una fecha inventada.
 */
export function normalizeDateValue(raw: string): string | null {
  const parsed = parseDateInput(raw);
  if (!parsed) return null;
  return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
}

export function normalizeTimeValue(raw: string): string | null {
  const parsed = parseTimeInput(raw);
  if (!parsed) return null;
  return `${String(parsed.h).padStart(2, "0")}:${String(parsed.m).padStart(2, "0")}`;
}

/**
 * Tope del `max` del control de fecha: nadie nació mañana.
 *
 * Toma el `Date` por parámetro (no lee el reloj) para que sea testeable y para
 * que el componente sea el único que decide "ahora".
 */
export function isoDateFrom(now: Date): string {
  const y = String(now.getFullYear()).padStart(4, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `Date` local a mediodía desde `YYYY-MM-DD` (el mediodía evita corrimientos de zona). */
export function dateFromIso(iso: string): Date | null {
  const parsed = parseDateInput(iso);
  if (!parsed) return null;
  return new Date(parsed.y, parsed.m - 1, parsed.d, 12, 0, 0, 0);
}

/** `Date` de hoy con esa hora, para anclar el picker nativo. */
export function dateFromTime(hhmm: string, today: Date): Date | null {
  const parsed = parseTimeInput(hhmm);
  if (!parsed) return null;
  const d = new Date(today);
  d.setHours(parsed.h, parsed.m, 0, 0);
  return d;
}

/** `Date` de la rueda nativa → `YYYY-MM-DD` en componentes LOCALES (nunca UTC). */
export function dateToIsoValue(date: Date): string {
  return isoDateFrom(date);
}

/** `Date` de la rueda nativa → `HH:MM` en componentes LOCALES. */
export function timeToIsoValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
