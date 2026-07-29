/**
 * Salto de paso del onboarding (`?debugStep=N`).
 *
 * Era un control de desarrollo servido en producción: cualquiera podía forzar
 * el onboarding a un paso arbitrario desde la barra de direcciones. Es la misma
 * clase de agujero que `?live=1`, y choca con la regla P0 de que ningún estado
 * de prueba se elija por query param público.
 *
 * Ahora sólo lo honra un build con las herramientas internas encendidas
 * (`EXPO_PUBLIC_ORBITA_INTERNAL_TOOLS`), que queda SIN setear en producción.
 *
 * `resume` y `nuevo` NO pasan por acá: son intenciones reales del flujo
 * (continuar un alta sin datos de nacimiento, o venir de "Crear una cuenta"),
 * no estados de prueba.
 */
export function resolveDebugStep(input: {
  /** Valor crudo del query param. */
  raw: unknown;
  /** Cantidad de pasos del flujo; el índice tiene que caer adentro. */
  total: number;
  /** `INTERNAL_TOOLS_ENABLED`. Apagado en producción. */
  internalToolsEnabled: boolean;
}): number | null {
  if (!input.internalToolsEnabled) return null;
  const raw = Array.isArray(input.raw) ? input.raw[0] : input.raw;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n >= input.total) return null;
  return n;
}
