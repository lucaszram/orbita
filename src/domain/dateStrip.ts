/** Fechas de la tira del Diario.
 *
 *  Todo el Diario habla en `localDate` (YYYY-MM-DD, hora local del dispositivo), que es la
 *  misma clave con la que el backend indexa `dailyGuides` por (userId, localDate). Nunca
 *  usar `toISOString()` para esto: convierte a UTC y a la noche te tira el día siguiente.
 */

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre"
];

/** YYYY-MM-DD en hora LOCAL (no UTC). */
export function toLocalDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Los últimos N días terminando HOY, del más viejo al más nuevo. La tira mira hacia
 *  atrás: no se muestran días futuros porque no se puede sacar la carta de mañana. */
export function lastNDays(n: number, today = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(toLocalDate(d));
  }
  return out;
}

/** "JULIO 2026" a partir de un localDate. */
export function monthLabel(localDate: string): string {
  const [y, m] = localDate.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/** "MARTES 8 · HOY" / "SÁBADO 5 · HACE 3 DÍAS" — el rótulo del día en el detalle. */
export function dayLabel(localDate: string, today = toLocalDate()): string {
  const date = new Date(`${localDate}T12:00:00`);
  const names = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const base = `${names[date.getDay()]} ${date.getDate()}`;

  if (localDate === today) return `${base} · hoy`;

  const diff = Math.round(
    (new Date(`${today}T12:00:00`).getTime() - date.getTime()) / 86_400_000
  );
  if (diff === 1) return `${base} · ayer`;
  return `${base} · hace ${diff} días`;
}
