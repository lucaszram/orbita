/**
 * Validación del payload natal antes de escribirlo.
 *
 * El onboarding rellenaba lo que faltaba: `birthPlaceLabel ?? "Sin especificar"`
 * y `timezone ?? deviceTimezone()`. Con eso una carta se podía calcular sobre un
 * lugar que la persona nunca eligió y sobre la zona del aparato — que no es la
 * zona natal. Al cerrar el alta no se completa nada: si falta un dato, no se
 * escribe.
 *
 * Las coordenadas hacen falta de verdad: sin ellas no hay ascendente ni casas.
 */

export type BirthPayloadCandidate = {
  birthDate?: string;
  birthTime?: string;
  birthPlaceLabel?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
};

export type ValidBirthPayload = {
  birthDate: string;
  birthTime?: string;
  birthPlaceLabel: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

/** Motivo del rechazo, para que la pantalla pueda decir algo útil. */
export type BirthPayloadProblem =
  | "fechaFaltante"
  | "lugarFaltante"
  | "coordenadasFaltantes"
  | "zonaFaltante";

export class BirthPayloadError extends Error {
  readonly problem: BirthPayloadProblem;
  constructor(problem: BirthPayloadProblem) {
    super(`BIRTH_PAYLOAD_INVALID:${problem}`);
    this.name = "BirthPayloadError";
    this.problem = problem;
  }
}

const finito = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export function validateBirthPayload(input: BirthPayloadCandidate): ValidBirthPayload {
  const birthDate = (input.birthDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) throw new BirthPayloadError("fechaFaltante");

  const birthPlaceLabel = (input.birthPlaceLabel ?? "").trim();
  // "Sin especificar" era el relleno viejo: no es un lugar elegido.
  if (!birthPlaceLabel || birthPlaceLabel.toLowerCase() === "sin especificar") {
    throw new BirthPayloadError("lugarFaltante");
  }

  if (!finito(input.latitude) || !finito(input.longitude)) {
    throw new BirthPayloadError("coordenadasFaltantes");
  }
  // Fuera de rango es tan inservible como faltante.
  if (Math.abs(input.latitude) > 90 || Math.abs(input.longitude) > 180) {
    throw new BirthPayloadError("coordenadasFaltantes");
  }

  const timezone = (input.timezone ?? "").trim();
  if (!timezone) throw new BirthPayloadError("zonaFaltante");

  return {
    birthDate,
    birthTime: input.birthTime,
    birthPlaceLabel,
    latitude: input.latitude,
    longitude: input.longitude,
    timezone
  };
}

/** Mensaje para la pantalla de cierre; sin jerga ni culpa. */
export function birthPayloadMessage(problem: BirthPayloadProblem): string {
  switch (problem) {
    case "fechaFaltante":
      return "Falta tu fecha de nacimiento. Volvé un paso y completala.";
    case "lugarFaltante":
      return "Falta elegir tu lugar de nacimiento de la lista. Volvé un paso y buscalo.";
    case "coordenadasFaltantes":
      return "El lugar que elegiste no trajo su ubicación exacta. Volvé un paso y elegilo de nuevo.";
    case "zonaFaltante":
      return "No pudimos determinar la zona horaria de tu lugar. Volvé un paso y elegilo de nuevo.";
  }
}
