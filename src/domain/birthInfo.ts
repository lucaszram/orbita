import { BirthPayloadError, validateBirthPayload } from "@/domain/birthPayload";

/**
 * Estado de los datos natales REMOTOS para presentarlos en el Perfil.
 *
 * La línea de nacimiento salía del perfil LOCAL (`useAppData` → `formatBirthLine`),
 * que cae a `createFallbackProfile()` cuando no hay nada: así se llegó a mostrar
 * "12 Abr 1994" —una fecha inventada— como si fuera de la persona. Acá la
 * autoridad es el documento remoto, y hasta que resuelva no se afirma nada.
 *
 * "Completo" usa la MISMA regla que el borde de escritura
 * (`validateBirthPayload`): fecha, lugar elegido, coordenadas finitas y zona.
 * Si las dos difirieran, se podría guardar algo que después no se puede mostrar.
 */

export type RemoteBirthDoc = {
  birthDate?: string;
  birthTime?: string;
  birthPlaceLabel?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
} | null;

export type BirthInfo =
  /** La query remota todavía no resolvió: no se muestra ni línea ni rueda. */
  | { status: "loading" }
  /** No hay datos, o están incompletos. Nunca se dibuja la rueda. */
  | { status: "incomplete"; message: string }
  /** Datos completos y verificados: se puede mostrar la línea y la rueda. */
  | { status: "complete"; line: string; hasTime: boolean };

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Copy única para datos natales incompletos. */
export const INCOMPLETE_BIRTH_MESSAGE = "Falta completar tu lugar de nacimiento.";

export function formatBirthLine(input: {
  birthDate: string;
  birthTime?: string;
  birthPlaceLabel: string;
}): string {
  const [y, m, d] = input.birthDate.split("-").map((n) => Number(n));
  const fecha = `${d} ${MESES[Math.max(0, Math.min(11, (m ?? 1) - 1))]} ${y}`;
  // Sin hora NO se inventa una: la línea simplemente no la menciona.
  const partes = input.birthTime ? [fecha, input.birthTime, input.birthPlaceLabel] : [fecha, input.birthPlaceLabel];
  return partes.join("  ·  ");
}

export function resolveBirthInfo(input: { doc: RemoteBirthDoc; resolved: boolean }): BirthInfo {
  if (!input.resolved) return { status: "loading" };
  if (!input.doc) return { status: "incomplete", message: INCOMPLETE_BIRTH_MESSAGE };
  try {
    const valid = validateBirthPayload(input.doc);
    return {
      status: "complete",
      line: formatBirthLine({
        birthDate: valid.birthDate,
        birthTime: valid.birthTime,
        birthPlaceLabel: valid.birthPlaceLabel
      }),
      hasTime: !!valid.birthTime
    };
  } catch (e) {
    // Cualquier campo faltante deja el documento inservible como dato personal:
    // no hay versión "a medias" que se pueda mostrar.
    if (e instanceof BirthPayloadError) return { status: "incomplete", message: INCOMPLETE_BIRTH_MESSAGE };
    throw e;
  }
}

/** ¿Se puede dibujar la rueda natal? Sólo con datos remotos completos. */
export function canRenderWheel(info: BirthInfo): boolean {
  return info.status === "complete";
}
