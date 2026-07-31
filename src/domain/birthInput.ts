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

// --- Partes del alta ↔ strings de control -----------------------------------
//
// El onboarding guarda la fecha y la hora en PARTES (`{day, month, year}` y
// `{hour, minute}`) porque así las dibujaba la rueda. Los controles del
// navegador hablan `YYYY-MM-DD` y `HH:MM`. Estas funciones son el único puente
// entre las dos formas, y son puras para poder probar la paridad exacta entre
// lo que se ve y lo que se guarda — que es justo lo que se rompió en web.

export type BirthDatePartsValue = { day: number; month: number; year: number };
export type BirthTimePartsValue = { hour: number; minute: number };

/** ¿Estas partes son un día que existe? (31 de febrero no lo es.) */
export function isRealDateParts(parts: BirthDatePartsValue): boolean {
  const { day, month, year } = parts;
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(year, month - 1, day);
  return probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day;
}

/**
 * Partes → `YYYY-MM-DD`, o `null` si el día no existe.
 *
 * `null` no es un detalle: un `<input type="date">` con un valor imposible lo
 * descarta y queda VACÍO. Devolver null hace que la pantalla lo sepa y pueda
 * bloquear "Continuar" en vez de dejar que se guarde un 31 de febrero.
 */
export function partsToDateValue(parts: BirthDatePartsValue): string | null {
  if (!isRealDateParts(parts)) return null;
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** `YYYY-MM-DD` → partes, o `null` si no es una fecha real. */
export function dateValueToParts(raw: string): BirthDatePartsValue | null {
  const parsed = parseDateInput(raw);
  if (!parsed) return null;
  return { day: parsed.d, month: parsed.m, year: parsed.y };
}

/** Partes → `HH:MM`, o `null` si la hora no existe. */
export function partsToTimeValue(parts: BirthTimePartsValue): string | null {
  const { hour, minute } = parts;
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** `HH:MM` → partes, o `null` si no es una hora real. */
export function timeValueToParts(raw: string): BirthTimePartsValue | null {
  const parsed = parseTimeInput(raw);
  if (!parsed) return null;
  return { hour: parsed.h, minute: parsed.m };
}

/**
 * ¿Estas partes caen DESPUÉS de hoy?
 *
 * Lo hacía el atributo `max` del `<input type="date">`. Al reemplazarlo por la
 * rueda propia hay que seguir sosteniéndolo: la columna de años ya corta en el
 * año actual, pero dentro de ese año todavía se podría elegir un mes o un día
 * que no llegó. Nadie nació mañana.
 */
export function isFutureDateParts(parts: BirthDatePartsValue, today: Date): boolean {
  const value = partsToDateValue(parts);
  if (value === null) return false;
  return value > isoDateFrom(today);
}
