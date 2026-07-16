/**
 * Fases de pantalla — regla anti-flash de mocks (2026-07-16).
 *
 * Toda pantalla productiva decide qué mostrar con estas dos funciones puras:
 *
 * - Sesión cargando/reconectando → "cargando" (pantalla mínima).
 * - Sesión rota → "error" (mensaje real + REINTENTAR).
 * - Invitado CONFIRMADO (Clerk resuelto, sin sesión) → "invitado": es la única
 *   fase que puede mostrar la experiencia demo/mock, siempre como demo.
 * - Con sesión: query/action pendiente → "cargando"; fallo → "error"; el
 *   backend confirmó que no hay datos → "vacio"; datos → "listo".
 *
 * Los mocks siguen existiendo para tests/labs y la demo de invitado, pero
 * ninguna pantalla puede usarlos como fallback durante carga o error.
 */

/** Lo que expone `useLiveApp()` — suficiente para decidir la fase de sesión. */
export type SessionGate = {
  isAuthLoading: boolean;
  userError: boolean;
  isLive: boolean;
};

export type SessionPhase = "cargando" | "error" | "invitado" | "live";

export function sessionPhase(gate: SessionGate): SessionPhase {
  if (gate.isAuthLoading) return "cargando";
  if (gate.userError) return "error";
  return gate.isLive ? "live" : "invitado";
}

/** Fase de un dato con sesión viva. `pending` = la query/action no resolvió
 *  todavía (p. ej. `useQuery` en `undefined`); `failed` = la action tiró o el
 *  backend devolvió un fallo; `empty` = el backend confirmó que no hay datos. */
export type DataPhase = "cargando" | "error" | "vacio" | "listo";

export function dataPhase(input: { pending: boolean; failed?: boolean; empty?: boolean }): DataPhase {
  if (input.failed) return "error";
  if (input.pending) return "cargando";
  if (input.empty) return "vacio";
  return "listo";
}
