// Eliminación completa de cuenta (requisito App Review).
//
// Orden OBLIGATORIO, cerrado ante fallas — nunca se simula éxito:
//   1. Convex `users.deleteAccount()` — con la sesión viva: borra el grafo de
//      datos propio en el backend. Si falla, no se toca nada más (sesión y
//      datos locales intactos, error visible + reintento).
//   2. Clerk `user.delete()` — borra la identidad. Recién después de Convex,
//      porque borrar Clerk primero revocaría el token que prueba qué grafo se
//      puede borrar. Si falla, la sesión local se conserva y el reintento
//      vuelve a correr TODO el flujo: la mutación de Convex es idempotente.
//   3. Limpieza local + vuelta a la entrada — solo con ambos borrados
//      confirmados. Un fallo de limpieza acá no bloquea la salida (la cuenta
//      ya no existe); el arranque purga un perfil con dueño y sin sesión.

export type AccountDeletionPrompts = {
  /** Advertencia clara de qué se borra. false = el usuario canceló. */
  confirmWarning: () => Promise<boolean>;
  /** Segunda confirmación, destructiva. false = el usuario canceló. */
  confirmDestructive: () => Promise<boolean>;
};

export type AccountDeletionSteps = {
  deleteConvexAccount: () => Promise<{ deleted: boolean } | null | undefined>;
  deleteClerkUser: () => Promise<void>;
  clearLocalData: () => Promise<void>;
  goToEntry: () => void;
};

export type AccountDeletionResult =
  | { status: "cancelled" }
  | { status: "error"; step: "convex" | "clerk" }
  | { status: "success"; localCleared: boolean };

/** Corre los borrados en orden estricto. No pregunta nada: ver requestAccountDeletion. */
export async function runAccountDeletion(steps: AccountDeletionSteps): Promise<AccountDeletionResult> {
  try {
    const res = await steps.deleteConvexAccount();
    // Respuesta que no confirma el borrado = error: jamás avanzar a Clerk sin
    // la prueba explícita de que los datos ya no existen.
    if (res?.deleted !== true) return { status: "error", step: "convex" };
  } catch {
    return { status: "error", step: "convex" };
  }
  try {
    await steps.deleteClerkUser();
  } catch {
    return { status: "error", step: "clerk" };
  }
  let localCleared = true;
  try {
    await steps.clearLocalData();
  } catch {
    localCleared = false;
  }
  steps.goToEntry();
  return { status: "success", localCleared };
}

/** Flujo completo: advertencia → confirmación destructiva → borrados en orden. */
export async function requestAccountDeletion(
  prompts: AccountDeletionPrompts,
  steps: AccountDeletionSteps
): Promise<AccountDeletionResult> {
  if (!(await prompts.confirmWarning())) return { status: "cancelled" };
  if (!(await prompts.confirmDestructive())) return { status: "cancelled" };
  return runAccountDeletion(steps);
}
