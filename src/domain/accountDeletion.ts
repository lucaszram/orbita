// Eliminación completa de cuenta (requisito App Review).
//
// Orden OBLIGATORIO, cerrado ante fallas — nunca se simula éxito:
//   1. Convex `users.deleteAccount()` — con la sesión viva: borra el grafo de
//      datos propio en el backend. Si falla, no se toca nada más (sesión y
//      datos locales intactos, error visible + reintento).
//   2. Marcador local de "eliminación pendiente de limpieza" — DESPUÉS de que
//      Convex confirma y ANTES de borrar Clerk. Si no se puede escribir, NO se
//      borra Clerk: sin marcador, un fallo local posterior dejaría datos
//      huérfanos de una cuenta que ya no existe (el arranque preserva datos
//      ante sesión perdida y ofrecería login a una cuenta eliminada).
//   3. Clerk `user.delete()` — borra la identidad. Recién después de Convex,
//      porque borrar Clerk primero revocaría el token que prueba qué grafo se
//      puede borrar. Si falla, la sesión local se conserva y el reintento
//      vuelve a correr TODO el flujo: la mutación de Convex es idempotente y
//      el marcador se re-escribe. El marcador queda en disco a propósito: si
//      la app muere acá, la purga al arranque solo retira copias locales de
//      datos que Convex ya borró.
//   4. Limpieza local y, ÚLTIMO, retirar el marcador — solo con ambos borrados
//      confirmados. Si la limpieza falla, el marcador queda y el próximo
//      arranque la completa (completePendingAccountDeletion).

export type AccountDeletionPrompts = {
  /** Advertencia clara de qué se borra. false = el usuario canceló. */
  confirmWarning: () => Promise<boolean>;
  /** Segunda confirmación, destructiva. false = el usuario canceló. */
  confirmDestructive: () => Promise<boolean>;
};

export type AccountDeletionSteps = {
  deleteConvexAccount: () => Promise<{ deleted: boolean } | null | undefined>;
  /** Persiste el marcador de limpieza pendiente. Throw = no se borra Clerk. */
  markPendingCleanup: () => Promise<void>;
  deleteClerkUser: () => Promise<void>;
  clearLocalData: () => Promise<void>;
  /** Retira el marcador. Corre ÚLTIMO, solo si la limpieza local terminó. */
  clearPendingCleanup: () => Promise<void>;
  goToEntry: () => void;
};

export type AccountDeletionResult =
  | { status: "cancelled" }
  | { status: "error"; step: "convex" | "marker" | "clerk" }
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
    await steps.markPendingCleanup();
  } catch {
    // Sin marcador no hay red de seguridad para la limpieza: se corta ANTES de
    // Clerk. La sesión sigue viva y el reintento re-corre todo (idempotente).
    return { status: "error", step: "marker" };
  }
  try {
    await steps.deleteClerkUser();
  } catch {
    return { status: "error", step: "clerk" };
  }
  let localCleared = true;
  try {
    await steps.clearLocalData();
    await steps.clearPendingCleanup();
  } catch {
    // El marcador queda en disco: el próximo arranque completa la purga. Por
    // eso acá sí se puede salir a la entrada sin datos colgados para siempre.
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

// ---------------------------------------------------------------------------
// Purga al arranque
// ---------------------------------------------------------------------------

export type PendingDeletionCleanupDeps = {
  /** null = no hay marcador (arranque normal). */
  readMarker: () => Promise<{ userId: string | null } | null>;
  clearLocalData: () => Promise<void>;
  clearAccountSnapshot: (userId: string) => Promise<void>;
  clearMarker: () => Promise<void>;
};

export type PendingDeletionCleanupResult =
  /** Sin marcador: rige la regla normal (preservar datos ante sesión perdida). */
  | "none"
  /** Había marcador y la purga terminó (marcador retirado al final). */
  | "completed"
  /** Había marcador pero la purga volvió a fallar: queda para el próximo
   *  arranque. El caller NO debe publicar datos locales de la cuenta eliminada
   *  ni ofrecer login. */
  | "pending";

/**
 * Completa la limpieza local de una cuenta ya eliminada (Convex + Clerk).
 * SOLO el marcador autoriza purgar: sin él, este arranque no toca nada.
 */
export async function completePendingAccountDeletion(
  deps: PendingDeletionCleanupDeps
): Promise<PendingDeletionCleanupResult> {
  let marker: { userId: string | null } | null = null;
  try {
    marker = await deps.readMarker();
  } catch {
    // Sin lectura no hay autorización: se preservan los datos (regla actual).
    return "none";
  }
  if (!marker) return "none";
  try {
    await deps.clearLocalData();
    if (marker.userId) await deps.clearAccountSnapshot(marker.userId);
    // ÚLTIMO: si algo de arriba falla, el marcador sobrevive y se reintenta.
    await deps.clearMarker();
    return "completed";
  } catch {
    return "pending";
  }
}
