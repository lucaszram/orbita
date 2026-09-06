import { signLabels } from "@/domain/zodiac";
import type { ZodiacSign } from "@/domain/types";
import type { VinculoNivel, VinculoResumen } from "@/services/appCoreRefs";

/**
 * Vínculos — el alta de la primera persona y cómo se cuenta la comparación
 * (CORE-212). Módulo puro: validaciones del formulario por nivel, formatos de
 * fecha y hora, y las fracciones de las barras. Ver `test/vinculo.test.ts`.
 */

export const NIVELES: ReadonlyArray<{ key: VinculoNivel; titulo: string; pide: string; detalle: string }> = [
  { key: "signo", titulo: "Signo con signo", pide: "SIN FECHA", detalle: "Solo el nombre y el signo. Lectura de tono, sin contactos." },
  { key: "fecha", titulo: "Fecha con fecha", pide: "PIDE FECHA", detalle: "Suma los planetas del día. Aparecen los contactos principales." },
  { key: "carta", titulo: "Carta con carta", pide: "PIDE FECHA, HORA Y LUGAR", detalle: "El nivel completo: suma casas y ejes a la comparación." }
];

export const TIPOS_DE_VINCULO: ReadonlyArray<{ key: string; label: string }> = [
  { key: "friendship", label: "Amistad" },
  { key: "romantic", label: "Pareja" },
  { key: "sibling", label: "Familia" },
  { key: "work_or_project", label: "Trabajo" }
];

export const SIGNOS: ReadonlyArray<{ key: ZodiacSign; label: string }> = (Object.keys(signLabels) as ZodiacSign[]).map(
  (key) => ({ key, label: signLabels[key] })
);

/** `28/01/1988`, `28 / 01 / 1988` o `1988-01-28` → `1988-01-28`. `null` si no es una fecha real. */
export function fechaIsoDesdeTexto(texto: string): string | null {
  const limpio = texto.trim();
  let y: number;
  let m: number;
  let d: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(limpio);
  const dmy = /^(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})$/.exec(limpio);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (dmy) [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  else return null;
  if (y < 1900 || y > 2100) return null;
  const fecha = new Date(Date.UTC(y, m - 1, d));
  if (fecha.getUTCFullYear() !== y || fecha.getUTCMonth() !== m - 1 || fecha.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** `19:45`, `19.45`, `1945`, `7:05` → `19:45` / `07:05`. `null` si no es una hora. */
export function horaNormalizada(texto: string): string | null {
  const limpio = texto.trim();
  const m = /^(\d{1,2})[:.h]?(\d{2})$/.exec(limpio);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export type AltaForm = {
  nombre: string;
  tipo: string | null;
  nivel: VinculoNivel;
  signo: ZodiacSign | null;
  fecha: string;
  hora: string;
  lugar: { label: string; latitude?: number; longitude?: number } | null;
};

export type AltaErrores = Partial<Record<"nombre" | "signo" | "fecha" | "hora" | "lugar", string>>;

/** Qué le falta al formulario para el nivel elegido. Vacío = se puede guardar. */
export function validarAlta(form: AltaForm): AltaErrores {
  const errores: AltaErrores = {};
  const nombre = form.nombre.trim();
  if (nombre.length < 1) errores.nombre = "Escribí cómo la llamás.";
  else if (nombre.length > 60) errores.nombre = "Un nombre más corto.";
  if (form.nivel === "signo") {
    if (!form.signo) errores.signo = "Elegí su signo solar.";
    return errores;
  }
  if (!fechaIsoDesdeTexto(form.fecha)) errores.fecha = "Una fecha real, día / mes / año.";
  if (form.nivel === "carta") {
    if (!horaNormalizada(form.hora)) errores.hora = "La hora de nacimiento, HH:MM.";
    if (!form.lugar || typeof form.lugar.latitude !== "number" || typeof form.lugar.longitude !== "number") {
      errores.lugar = "Elegí el lugar de la lista para ubicar la carta.";
    }
  } else if (form.hora.trim()) {
    if (!horaNormalizada(form.hora)) errores.hora = "La hora de nacimiento, HH:MM.";
    else if (!form.lugar || typeof form.lugar.latitude !== "number" || typeof form.lugar.longitude !== "number") {
      errores.lugar = "Para usar la hora hace falta el lugar de nacimiento.";
    }
  }
  return errores;
}

/** Fracción 0–1 para dibujar una barra, sin dividir por cero. */
export function fraccionDeBarra(parte: number, total: number): number {
  if (!Number.isFinite(parte) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(1, parte / total));
}

/** `"14 contactos entre tu carta y la de Vera."` · `"Un contacto…"` · `"Sin contactos…"`. */
export function titularDeContactos(total: number, nombre: string): string {
  if (total <= 0) return `Sin contactos dentro de orbe entre tu carta y la de ${nombre}.`;
  if (total === 1) return `Un contacto entre tu carta y la de ${nombre}.`;
  return `${total} contactos entre tu carta y la de ${nombre}.`;
}

export function etiquetaDeNivel(level: VinculoNivel): string {
  return NIVELES.find((n) => n.key === level)?.titulo ?? level;
}

/** El máximo de una dimensión, para que las tres barras compartan escala. */
export function escalaDeDimensiones(resumen: VinculoResumen): number {
  return Math.max(1, ...resumen.dimensions.map((d) => d.total));
}

/** Inicial para el chip de la persona (`Mara` → `M`). */
export function inicial(nombre: string): string {
  const limpio = nombre.trim();
  return limpio ? limpio.charAt(0).toLocaleUpperCase("es") : "?";
}
