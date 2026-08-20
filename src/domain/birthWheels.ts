import { MONTHS } from "@/onboarding/months";

/**
 * Los catálogos de las ruedas de nacimiento y la regla que decide si una
 * elección se puede confirmar.
 *
 * Vive en el dominio y no dentro del componente por una razón concreta: son las
 * dos cosas que la certificación midió mal y que hay que poder verificar sin
 * simulador. El control del sistema traía `January…December` y `AM/PM` en una
 * app en español con voseo (D3), y proponía medianoche cuando no había hora
 * guardada (D6). Acá el idioma y el formato son datos, y "¿se puede confirmar?"
 * es una función pura.
 */

/** Los días posibles del mes. La validación de "31 de febrero" es aparte. */
export const WHEEL_DAYS: readonly string[] = Array.from({ length: 31 }, (_, i) => String(i + 1));

/** Los meses, en español. Es la MISMA lista que usa el alta. */
export const WHEEL_MONTHS: readonly string[] = MONTHS;

/**
 * Las 24 horas del día, `00`…`23`.
 *
 * 24 h y no 12 h con AM/PM: una hora de nacimiento se carga de un documento o
 * de la memoria de alguien, y "las 3" sin sufijo es ambiguo justo en el dato
 * que define el Ascendente.
 */
export const WHEEL_HOURS: readonly string[] = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0")
);

export const WHEEL_MINUTES: readonly string[] = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0")
);

/** Los años elegibles, del actual hacia atrás. */
export function wheelYears(currentYear: number, span = 120): readonly string[] {
  return Array.from({ length: span }, (_, i) => String(currentYear - i));
}

/**
 * ¿Se puede confirmar lo que muestra la rueda?
 *
 * Tres condiciones, y la del medio es D6: cuando el campo venía VACÍO, el valor
 * desde el que arranca la rueda es un punto de partida para mirar, no una
 * propuesta. Confirmarlo sin haber movido nada guardaría un dato que nadie
 * eligió —medianoche, en el caso que se midió—. Con un valor previo no hace
 * falta tocar nada: confirmar lo que ya estaba guardado es una elección válida.
 */
export function canConfirmBirthWheel(input: {
  /** El campo no tenía valor: hay que elegir de verdad. */
  requiresChoice: boolean;
  /** Se movió alguna columna desde que se abrió la hoja. */
  touched: boolean;
  /** Un problema del valor actual (fecha inexistente, futura…), o `null`. */
  problem: string | null;
}): boolean {
  if (input.problem !== null) return false;
  if (input.requiresChoice && !input.touched) return false;
  return true;
}
