// Eliminación completa de cuenta (requisito App Review).
//
// Orden OBLIGATORIO, cerrado ante fallas — nunca se simula éxito:
//   1. Convex `users.deleteAccount()` — con la sesión viva: borra el grafo de
//      datos propio en el backend. Si falla, no se toca nada más (sesión y
//      datos locales intactos, error visible + reintento).
//   2. Marcador local `backend_deleted` — DESPUÉS de que Convex confirma y
//      ANTES de borrar Clerk. Si no se puede escribir (o no hay userId), NO se
//      borra Clerk: sin marcador, un fallo posterior dejaría datos huérfanos o
//      una identidad viva sin señal para retomar la eliminación.
//   3. Clerk `user.delete()` — borra la identidad. Recién después de Convex,
//      porque borrar Clerk primero revocaría el token que prueba qué grafo se
//      puede borrar. Si falla, la sesión se conserva, el marcador queda en
//      `backend_deleted` y el reintento re-corre TODO el flujo (Convex es
//      idempotente). Un arranque con `backend_deleted` NUNCA purga a ciegas:
//      espera a Clerk (ver resolvePendingDeletionBoot).
//   4. Marcador `identity_deleted` (best-effort) + limpieza local + retirar el
//      marcador ÚLTIMO. Si la promoción o la limpieza fallan, el próximo
//      arranque completa lo que falte a partir de la fase persistida y del
//      estado real de Clerk.

export type PendingDeletionPhase =
  /** Convex confirmó el borrado; la identidad de Clerk puede seguir viva. */
  | "backend_deleted"
  /** Clerk también fue borrado; solo falta terminar la limpieza local. */
  | "identity_deleted";

export type PendingDeletionMarker = {
  /** Dueño del marcador (clerkUserId). "" solo si el marcador quedó ilegible. */
  userId: string;
  phase: PendingDeletionPhase;
};

export type AccountDeletionPrompts = {
  /** Advertencia clara de qué se borra. false = el usuario canceló. */
  confirmWarning: () => Promise<boolean>;
  /** Segunda confirmación, destructiva. false = el usuario canceló. */
  confirmDestructive: () => Promise<boolean>;
};

export type AccountDeletionSteps = {
  deleteConvexAccount: () => Promise<{ deleted: boolean } | null | undefined>;
  /** Persiste el marcador `backend_deleted`. Throw = no se borra Clerk. */
  markPendingCleanup: () => Promise<void>;
  deleteClerkUser: () => Promise<void>;
  /** Promueve el marcador a `identity_deleted`. Best-effort: si falla, el
   *  arranque igual resuelve por el estado real de Clerk (signed-out). */
  markIdentityDeleted: () => Promise<void>;
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
    // Sin marcador no hay red de seguridad para lo que sigue: se corta ANTES
    // de Clerk. La sesión sigue viva y el reintento re-corre todo (idempotente).
    return { status: "error", step: "marker" };
  }
  try {
    await steps.deleteClerkUser();
  } catch {
    // El marcador queda en `backend_deleted` a propósito: el arranque ve la
    // fase y NO purga mientras la identidad siga activa.
    return { status: "error", step: "clerk" };
  }
  try {
    await steps.markIdentityDeleted();
  } catch {
    // Best-effort: si además falla la limpieza, el arranque ve
    // `backend_deleted` + Clerk signed-out y completa la purga igual.
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
// Arranque: purga pendiente por fase
// ---------------------------------------------------------------------------

export type PendingDeletionCleanupDeps = {
  /** null = no hay marcador (arranque normal). */
  readMarker: () => Promise<PendingDeletionMarker | null>;
  clearLocalData: () => Promise<void>;
  clearAccountSnapshot: (userId: string) => Promise<void>;
  clearMarker: () => Promise<void>;
};

export type PendingDeletionCleanupResult = {
  status:
    /** Sin marcador: rige la regla normal (preservar datos ante sesión perdida). */
    | "none"
    /** `identity_deleted`: la purga terminó (marcador retirado al final). */
    | "completed"
    /** `identity_deleted` pero la purga volvió a fallar: queda para el próximo
     *  arranque. El caller NO debe publicar datos locales de la cuenta. */
    | "pending"
    /** `backend_deleted`: la identidad de Clerk puede seguir viva. NO se purga
     *  ni se retira el marcador acá; el gate de arranque decide con Clerk
     *  cargado (resolvePendingDeletionBoot). El caller arranca vacío. */
    | "awaiting-identity";
  marker: PendingDeletionMarker | null;
};

/**
 * Corre en la hidratación local (ANTES de conocer el estado de Clerk). Solo la
 * fase `identity_deleted` autoriza purgar acá; `backend_deleted` se resuelve
 * en el gate de arranque, nunca a ciegas.
 */
export async function completePendingAccountDeletion(
  deps: PendingDeletionCleanupDeps
): Promise<PendingDeletionCleanupResult> {
  let marker: PendingDeletionMarker | null = null;
  try {
    marker = await deps.readMarker();
  } catch {
    // Sin lectura no hay autorización: se preservan los datos (regla actual).
    return { status: "none", marker: null };
  }
  if (!marker) return { status: "none", marker: null };
  if (marker.phase === "backend_deleted") return { status: "awaiting-identity", marker };
  try {
    await deps.clearLocalData();
    if (marker.userId) await deps.clearAccountSnapshot(marker.userId);
    // ÚLTIMO: si algo de arriba falla, el marcador sobrevive y se reintenta.
    await deps.clearMarker();
    return { status: "completed", marker };
  } catch {
    return { status: "pending", marker };
  }
}

export type PendingDeletionBootDecision =
  /** Sin marcador: arranque normal. */
  | "proceed"
  /** Identidad confirmada inexistente: completar la purga local. */
  | "purge"
  /** `backend_deleted` con identidad activa: bloquear en "Finalizando
   *  eliminación" y reintentar `user.delete()`. */
  | "finalize-identity"
  /** `backend_deleted` sin confirmación de Clerk: esperar, no tocar nada. */
  | "wait";

/** Decide qué hacer con un marcador pendiente una vez conocido el estado de Clerk. */
export function resolvePendingDeletionBoot(input: {
  marker: PendingDeletionMarker | null;
  clerkLoaded: boolean;
  isSignedIn: boolean;
}): PendingDeletionBootDecision {
  if (!input.marker) return "proceed";
  if (input.marker.phase === "identity_deleted") return "purge";
  if (!input.clerkLoaded) return "wait";
  // Clerk cargado: signed-out = la identidad ya no existe (crash después del
  // delete) → completar; signed-in = la identidad sigue viva → terminarla.
  return input.isSignedIn ? "finalize-identity" : "purge";
}

/**
 * Un intento del gate de arranque, con el resultado SIEMPRE publicable: el
 * caller decide qué hacer con "error" mientras siga montado. Un cambio de
 * decisión durante los await (p. ej. Clerk publica signed-out después de
 * `deleteUser`) NO es un unmount y jamás debe silenciar el fallo — de eso se
 * encarga el caller usando este retorno en vez de flags de cancelación.
 */
export async function attemptPendingDeletionFinalize(args: {
  decision: PendingDeletionBootDecision;
  /** Borra la identidad de Clerk. Solo se llama con "finalize-identity". */
  deleteIdentity: () => Promise<void>;
  /** Purga final (finalizePendingDeletionPurge cableada por el caller). */
  purge: () => Promise<void>;
}): Promise<"completed" | "error" | "noop"> {
  if (args.decision !== "purge" && args.decision !== "finalize-identity") return "noop";
  try {
    if (args.decision === "finalize-identity") {
      // Identidad todavía activa: terminarla ANTES de purgar. Si esto pasa
      // pero la purga falla, el reintento recae en "purge" (la sesión quedó
      // signed-out) sin repetir user.delete().
      await args.deleteIdentity();
    }
    await args.purge();
    return "completed";
  } catch {
    return "error";
  }
}

/**
 * Purga final una vez confirmado que la identidad ya no existe. Promueve el
 * marcador PRIMERO (persistir el hecho antes de limpiar: si esto muere a
 * mitad, el próximo arranque completa solo) y lo retira ÚLTIMO. Lanza si algo
 * falla: el caller muestra reintento y el marcador sigue protegiendo.
 */
export async function finalizePendingDeletionPurge(
  marker: PendingDeletionMarker,
  deps: {
    promoteMarker: (marker: PendingDeletionMarker) => Promise<void>;
    clearLocalData: () => Promise<void>;
    clearAccountSnapshot: (userId: string) => Promise<void>;
    clearMarker: () => Promise<void>;
  }
): Promise<void> {
  await deps.promoteMarker({ userId: marker.userId, phase: "identity_deleted" });
  await deps.clearLocalData();
  if (marker.userId) await deps.clearAccountSnapshot(marker.userId);
  await deps.clearMarker();
}
