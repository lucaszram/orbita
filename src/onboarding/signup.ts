/**
 * Alta con contraseña (Clerk Producción tiene `password: required`).
 *
 * Módulo PURO (sin React ni Clerk) para testear sin mocks:
 *  - validar email + contraseña + confirmación antes de crear el intento;
 *  - interpretar el resultado de `attemptEmailAddressVerification` sin confundir
 *    "faltan requisitos" (email YA verificado) con "código incorrecto";
 *  - un guard de reentrada para que auto-submit + botón no verifiquen dos veces.
 */

/** Mínimo de Clerk Producción por defecto; el server igual valida su política. */
export const MIN_PASSWORD_LENGTH = 8;

/** Valida la contraseña del alta. Devuelve el error a mostrar, o null si va. */
export function validateSignupPassword(password: string, confirm: string): string | null {
  if (!password) return "Elegí una contraseña.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña necesita al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password !== confirm) return "Las contraseñas no coinciden.";
  return null;
}

const MISSING_FIELD_LABELS: Record<string, string> = {
  password: "una contraseña",
  first_name: "tu nombre",
  last_name: "tu apellido",
  username: "un nombre de usuario"
};

/** Mensaje legible de los requisitos que Clerk todavía marca como faltantes. */
export function describeMissingRequirements(missingFields?: string[] | null): string {
  const named = (missingFields ?? []).map((f) => MISSING_FIELD_LABELS[f] ?? f).filter(Boolean);
  if (named.length === 0) return "Falta completar unos datos para crear tu cuenta.";
  if (named.length === 1) return `Falta ${named[0]} para crear tu cuenta.`;
  return `Faltan ${named.slice(0, -1).join(", ")} y ${named[named.length - 1]} para crear tu cuenta.`;
}

/** Forma mínima del `signUp` tras `attemptEmailAddressVerification`. */
export type SignUpAttemptResult = {
  status?: string | null;
  createdSessionId?: string | null;
  missingFields?: string[] | null;
  verifications?: { emailAddress?: { status?: string | null } | null } | null;
};

export type SignUpOutcome =
  | { kind: "complete"; sessionId: string | null }
  | { kind: "missing"; message: string };

/**
 * Interpreta el intento de verificación del ALTA.
 *
 * Un código INCORRECTO hace que `attemptEmailAddressVerification` LANCE (lo
 * agarra el catch del hook). Si llegó acá sin lanzar, el código fue aceptado y
 * el email quedó verificado: si el alta no está `complete`, es porque faltan
 * requisitos (típicamente la contraseña) — NUNCA "el código no coincide".
 */
export function interpretSignUpAttempt(result: SignUpAttemptResult): SignUpOutcome {
  if (result.status === "complete") {
    return { kind: "complete", sessionId: result.createdSessionId ?? null };
  }
  return { kind: "missing", message: describeMissingRequirements(result.missingFields) };
}

/** Forma mínima del `signIn` tras `attemptFirstFactor` (password o email_code). */
export type SignInAttemptResult = {
  status?: string | null;
  createdSessionId?: string | null;
};

export type SignInOutcome =
  | { kind: "complete"; sessionId: string | null }
  | { kind: "incomplete"; message: string };

/**
 * Interpreta el intento de LOGIN. Password y código pasan por acá: ambos, al
 * quedar `complete`, terminan en `setActive(sessionId)` (misma hidratación).
 * Si no está completo (p. ej. `needs_second_factor`) no se inventa una sesión.
 */
export function interpretSignInAttempt(result: SignInAttemptResult): SignInOutcome {
  if (result.status === "complete") {
    return { kind: "complete", sessionId: result.createdSessionId ?? null };
  }
  return { kind: "incomplete", message: "No pudimos completar el ingreso. Probá con un código por email." };
}

/**
 * Guard de reentrada: evita que un código completo dispare DOS verificaciones
 * (auto-submit del CodeInput + tap del botón). La segunda llamada mientras la
 * primera está en vuelo devuelve `whenBusy` sin re-ejecutar.
 */
export function makeReentrancyGuard() {
  let active = false;
  return {
    async run<T>(fn: () => Promise<T>, whenBusy: T): Promise<T> {
      if (active) return whenBusy;
      active = true;
      try {
        return await fn();
      } finally {
        active = false;
      }
    }
  };
}
