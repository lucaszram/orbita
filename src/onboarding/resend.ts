/**
 * Reenvío del código de verificación (build 13). Clerk manda el código, pero
 * Gmail lo puede tirar a Spam; el usuario necesita poder pedir otro.
 *
 * Este módulo es PURO (sin React ni Clerk) para poder testearlo sin mocks: la
 * pantalla le da el reloj y el estado, y él decide el rótulo del botón, si está
 * habilitado y QUÉ método de Clerk reenvía — sin crear una segunda cuenta ni
 * reiniciar el flujo.
 */

export const RESEND_COOLDOWN_SECONDS = 30;

/** Segundos que faltan para poder reenviar (0 = ya se puede). */
export function secondsUntilResend(nowMs: number, lastSentAtMs: number | null): number {
  if (lastSentAtMs == null) return 0;
  const elapsed = Math.floor((nowMs - lastSentAtMs) / 1000);
  return Math.max(0, Math.min(RESEND_COOLDOWN_SECONDS, RESEND_COOLDOWN_SECONDS - elapsed));
}

export type ResendButton = { disabled: boolean; label: string };

/**
 * Estado del botón "Reenviar código":
 *  - enviando            → deshabilitado, "Reenviando…" (evita múltiples taps).
 *  - dentro del cooldown → deshabilitado, "Reenviar en N s".
 *  - libre               → habilitado, "Reenviar código".
 */
export function resendButton(input: {
  nowMs: number;
  lastSentAtMs: number | null;
  sending: boolean;
}): ResendButton {
  if (input.sending) return { disabled: true, label: "Reenviando…" };
  const left = secondsUntilResend(input.nowMs, input.lastSentAtMs);
  if (left > 0) return { disabled: true, label: `Reenviar en ${left} s` };
  return { disabled: false, label: "Reenviar código" };
}

/**
 * Qué llamada de Clerk reenvía el código según el flujo por el que se pidió:
 *  - alta  (`signUp`) → `prepareEmailAddressVerification` (mismo signUp, no se
 *                       crea una cuenta nueva).
 *  - login (`signIn`) → `prepareFirstFactor` CONSERVANDO el `emailAddressId`
 *                       (mismo intento, no se reinicia el flujo).
 * Ninguna rama vuelve a `create`: reenviar nunca crea una segunda cuenta.
 */
export type ResendPlan =
  | { method: "prepareEmailAddressVerification"; strategy: "email_code" }
  | { method: "prepareFirstFactor"; strategy: "email_code"; emailAddressId: string };

export function planResend(input: {
  flow: "signUp" | "signIn";
  emailAddressId: string | null;
}): ResendPlan {
  if (input.flow === "signUp") {
    return { method: "prepareEmailAddressVerification", strategy: "email_code" };
  }
  return { method: "prepareFirstFactor", strategy: "email_code", emailAddressId: input.emailAddressId ?? "" };
}

/** Resultado de un reenvío: éxito, o error real de Clerk para mostrar. */
export type ResendResult = { ok: true } | { ok: false; error: string };

export const RESEND_OK_MESSAGE = "Código reenviado";
export const SPAM_HINT = "¿No lo encontrás? Revisá Spam o Correo no deseado.";

/**
 * Mensaje visible bajo el botón tras un intento de reenvío:
 *  - éxito → "Código reenviado".
 *  - error → el error real de Clerk (para poder reintentar con contexto).
 *  - sin intento todavía → nada.
 */
export function resendFeedback(
  status: "idle" | "sent" | "error",
  errorMessage: string | null
): string | null {
  if (status === "sent") return RESEND_OK_MESSAGE;
  if (status === "error") return errorMessage ?? "No pudimos reenviar el código. Probá de nuevo.";
  return null;
}
