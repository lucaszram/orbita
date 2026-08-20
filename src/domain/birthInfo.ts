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

/**
 * La semántica de precisión es de la app NATIVA V4.9.2 y sólo aplica ahí.
 *
 * En web la superficie no cambió: una `birthTime` guardada se sigue mostrando
 * tal cual y sigue contando como hora, aunque el documento la declare
 * aproximada o desconocida. Metro define `EXPO_OS` por bundle, así que la rama
 * se decide al empaquetar y no hay dos APIs que mantener en paralelo.
 *
 * En Node (los tests) `EXPO_OS` no existe: la rama que corre es la nativa, que
 * es la que estas pruebas verifican.
 */
const IS_WEB = process.env.EXPO_OS === "web";

export type RemoteBirthDoc = {
  birthDate?: string;
  birthTime?: string;
  /**
   * `known` · `approximate` · `unknown`. Es la precisión DECLARADA de la hora.
   * En nativo manda sobre la presencia del texto: una fila puede conservar
   * "08:37" y haber sido guardada como aproximada o desconocida. En web se
   * ignora, como siempre.
   */
  birthTimePrecision?: string;
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
  /**
   * Datos completos y verificados: se puede mostrar la línea y la rueda.
   *
   * En NATIVO `hasTime` no es "hay un texto de hora": es "hay una hora exacta".
   * Sólo con `birthTimePrecision: "known"` existen Ascendente, Medio Cielo y
   * casas —una hora aproximada sin margen declarado se trata como desconocida—,
   * así que una fila que conserva "08:37" marcada como aproximada devuelve
   * `false`. En WEB sigue siendo lo de siempre: hay hora si hay texto de hora.
   */
  | { status: "complete"; line: string; hasTime: boolean };

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Copy única para datos natales incompletos. */
export const INCOMPLETE_BIRTH_MESSAGE = "Falta completar tu lugar de nacimiento.";

export function formatBirthLine(input: {
  birthDate: string;
  birthTime?: string;
  birthPlaceLabel: string;
  /** Precisión declarada de la hora; ausente en filas anteriores al campo. */
  birthTimePrecision?: string;
}): string {
  const [y, m, d] = input.birthDate.split("-").map((n) => Number(n));
  const fecha = `${d} ${MESES[Math.max(0, Math.min(11, (m ?? 1) - 1))]} ${y}`;
  // Sin hora NO se inventa una: la línea simplemente no la menciona. En nativo,
  // con una hora declarada desconocida tampoco se muestra el texto que haya
  // quedado guardado, y una aproximada se muestra dicha como aproximada.
  const hora = horaVisible(input.birthTime, input.birthTimePrecision);
  const partes = hora ? [fecha, hora, input.birthPlaceLabel] : [fecha, input.birthPlaceLabel];
  return partes.join("  ·  ");
}

/** El texto de hora que se puede mostrar, según la precisión declarada. */
function horaVisible(birthTime: string | undefined, precision: string | undefined): string | null {
  if (!birthTime) return null;
  // Web: la hora guardada se muestra tal cual, como antes de V4.9.2.
  if (IS_WEB) return birthTime;
  if (precision === "unknown") return null;
  return precision === "approximate" ? `${birthTime} aprox.` : birthTime;
}

/**
 * ¿La hora declarada habilita geometría sensible a la hora (ángulos y casas)?
 *
 * En nativo una hora aproximada o desconocida NO la habilita, aunque el
 * documento conserve el texto: el Ascendente cambia cada dos horas y estimarlo
 * sería inventarlo. En web la regla sigue siendo la de antes: alcanza con que
 * haya una hora guardada.
 */
function horaHabilitaAngulos(birthTime: string | undefined, precision: string | undefined): boolean {
  if (!birthTime) return false;
  if (IS_WEB) return true;
  return precision !== "approximate" && precision !== "unknown";
}

export function resolveBirthInfo(input: { doc: RemoteBirthDoc; resolved: boolean }): BirthInfo {
  if (!input.resolved) return { status: "loading" };
  if (!input.doc) return { status: "incomplete", message: INCOMPLETE_BIRTH_MESSAGE };
  try {
    const valid = validateBirthPayload(input.doc);
    const precision = input.doc.birthTimePrecision?.trim();
    return {
      status: "complete",
      line: formatBirthLine({
        birthDate: valid.birthDate,
        birthTime: valid.birthTime,
        birthPlaceLabel: valid.birthPlaceLabel,
        birthTimePrecision: precision
      }),
      hasTime: horaHabilitaAngulos(valid.birthTime, precision)
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
