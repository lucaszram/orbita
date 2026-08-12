import type { BirthPayloadCandidate } from "./birthPayload";

/**
 * ¿Hay que resolver la zona horaria del lugar antes de escribir?
 *
 * Photon (el autocomplete de ciudades) devuelve etiqueta y coordenadas pero no
 * timezone, y `validateBirthPayload` exige la zona antes de persistir: por eso
 * una selección perfectamente válida terminaba en "No pudimos determinar la
 * zona horaria". La zona se deriva de las COORDENADAS en el backend
 * (`placeTimezone.atCoordinates`), nunca del reloj del dispositivo — para
 * alguien nacido en otra zona, la del aparato es la zona equivocada.
 *
 * Reglas:
 * - Con zona ya presente no se consulta nada: un dato remoto vigente jamás se
 *   pisa con una resolución nueva.
 * - Sin coordenadas usables no hay nada que resolver. `validateBirthPayload`
 *   rechaza ese payload con `coordenadasFaltantes`, que es el mensaje correcto;
 *   preguntarle al backend sólo agregaría un error técnico antes del real.
 *
 * Módulo puro (sin React ni Convex) para poder testear la decisión.
 */
export type TimezoneLookup = { latitude: number; longitude: number };

const usable = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export function timezoneLookupFor(input: BirthPayloadCandidate): TimezoneLookup | null {
  if ((input.timezone ?? "").trim()) return null;
  if (!usable(input.latitude) || !usable(input.longitude)) return null;
  if (Math.abs(input.latitude) > 90 || Math.abs(input.longitude) > 180) return null;
  return { latitude: input.latitude, longitude: input.longitude };
}

/**
 * Payload con la zona resuelta. Se aplica ANTES de validar y de escribir: si la
 * resolución falla, quien llama propaga el error y no se persiste ni se toca el
 * perfil local (fallar cerrado). Una zona vacía tampoco se acepta — cae en
 * `zonaFaltante`, el mismo camino que si el backend no hubiera respondido.
 */
export function withResolvedTimezone<T extends BirthPayloadCandidate>(input: T, timezone: string): T {
  return { ...input, timezone: timezone.trim() };
}
