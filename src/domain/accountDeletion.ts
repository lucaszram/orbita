// Eliminación completa de cuenta (requisito App Review).
//
// Orden OBLIGATORIO, cerrado ante fallas — nunca se simula éxito. Y con UNA
// frontera: la pantalla hace los dos primeros pasos, el boundary global hace el
// resto con el producto desmontado.
//
//   EN LA PANTALLA (`runAccountDeletion`)
//   1. Convex `users.deleteAccountV2()` — con la sesión viva: borra el grafo de
//      datos propio en el backend, revalidando el dueño esperado contra la
//      identidad autenticada. Si falla, no se toca nada más (sesión y datos
//      locales intactos, error visible + reintento).
//   2. Marcador local `backend_deleted` — DESPUÉS de que Convex confirma. Si no
//      se puede escribir, se corta: sin marcador no hay señal para retomar. Con
//      el marcador escrito, la pantalla ENTREGA el control (`handoff`) y no hace
//      nada más — ni navega, ni libera la navegación.
//
//   EN EL BOUNDARY (`PendingDeletionBoundary`, con el producto desmontado)
//   3. Clerk `user.delete()` — borra la identidad. Recién después de Convex,
//      porque borrar Clerk primero revocaría el token que prueba qué grafo se
//      puede borrar. Si falla, la sesión se conserva y el marcador queda en
//      `backend_deleted`: el reintento re-corre (Convex es idempotente).
//   4. Checkpoint `identity_deleted` — la ÚNICA prueba durable de que la
//      identidad ya no existe. Si `user.delete()` respondió ok pero el disco
//      falla, el hecho se retiene en memoria atado a su dueño y se reintenta
//      sólo la promoción; si el proceso muere, se falla cerrado a soporte.
//   5. Purga local — sólo con Clerk cargado, signed-out y sin userId, y
//      revalidando en CADA paso. Retira el marcador ÚLTIMO.
//
// NINGÚN arranque purga a ciegas, en NINGUNA fase (ver
// `resolvePendingDeletionBoot`): estar signed-out no prueba que Clerk se haya
// borrado.

export type PendingDeletionPhase =
  /**
   * La persona confirmó y todavía NO se borró nada.
   *
   * Es la fase que faltaba: la pantalla la escribe ANTES de tocar Convex y se
   * aparta. Sin ella había una ventana en la que la mutación destructiva salía
   * desde el Perfil, con la app entera montada y sin nada en disco que dijera
   * "esta cuenta está siendo borrada" — si el proceso moría ahí, el arranque
   * siguiente no tenía forma de saberlo.
   */
  | "deletion_requested"
  /** Convex confirmó el borrado; la identidad de Clerk puede seguir viva. */
  | "backend_deleted"
  /** Clerk también fue borrado; solo falta terminar la limpieza local. */
  | "identity_deleted";

export type PendingDeletionMarker = {
  /** Dueño del marcador (clerkUserId). SIEMPRE no vacío: ver el parser. */
  userId: string;
  phase: PendingDeletionPhase;
};

// ---------------------------------------------------------------------------
// Lectura del marcador: ausencia, marcador válido y basura son TRES cosas
// ---------------------------------------------------------------------------

/**
 * Por qué un marcador escrito no se puede usar.
 *
 * Existe porque el parser anterior aplanaba todo esto en un marcador "válido":
 * un JSON roto o un objeto sin `userId` se normalizaban a
 * `{ userId: "", phase: "backend_deleted" }` —una fase que el gate interpreta
 * como "la identidad puede seguir viva"— y un error de lectura se devolvía como
 * ausencia, o sea: arranque normal con una eliminación a medias en disco.
 */
export type PendingDeletionInvalidReason =
  /** La lectura de storage tiró: no se sabe si hay marcador. */
  | "unreadable"
  /** Hay una clave escrita pero su contenido está vacío. */
  | "empty"
  /** No es JSON. */
  | "unparsable"
  /** Es JSON pero no nombra un dueño utilizable. */
  | "incomplete"
  /** Nombra una fase que este código no conoce. */
  | "unknown-phase";

/** Resultado TIPADO de leer el marcador. Nunca se colapsa a `null`. */
export type PendingDeletionRead =
  /** No hay nada escrito: arranque normal. */
  | { status: "absent" }
  | { status: "valid"; marker: PendingDeletionMarker }
  | { status: "invalid"; reason: PendingDeletionInvalidReason };

/**
 * Un dueño utilizable: no vacío y SIN espacio alrededor.
 *
 * Se exporta para que el writer aplique exactamente la misma regla que el
 * parser: lo que no se puede leer tampoco se puede escribir.
 */
export function esOwnerCanonico(userId: unknown): userId is string {
  return typeof userId === "string" && userId.length > 0 && userId.trim() === userId;
}

function esFaseConocida(value: unknown): value is PendingDeletionPhase {
  return (
    value === "deletion_requested" ||
    value === "backend_deleted" ||
    value === "identity_deleted"
  );
}

/**
 * Parser ESTRICTO del raw persistido.
 *
 * `raw === null` es la única ausencia real. Todo lo demás que no sea un objeto
 * con `userId` string no vacío y una fase conocida es `invalid`: nada se
 * normaliza, nada se adivina y nada se convierte en ausencia. Un marcador
 * inválido deja el arranque bloqueado con el raw intacto, porque borrarlo sería
 * decidir por cuenta ajena con la información que justamente falta.
 */
export function parsePendingDeletionMarker(raw: string | null | undefined): PendingDeletionRead {
  if (raw === null || raw === undefined) return { status: "absent" };
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { status: "invalid", reason: "empty" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "invalid", reason: "unparsable" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { status: "invalid", reason: "incomplete" };
  }
  const candidate = parsed as { userId?: unknown; phase?: unknown };
  /**
   * El dueño tiene que ser CANÓNICO: ni vacío, ni de puro espacio, ni con
   * padding.
   *
   * Un `" user_a "` nunca va a coincidir con el `identity.subject` real, así que
   * aceptarlo sólo servía para meter un marcador roto por la rama de los
   * válidos. Y canonicalizarlo en silencio —recortarlo para que "funcione"— es
   * peor: sería inventar a qué cuenta pertenece un marcador corrupto y, con eso,
   * autorizar una purga. Se rechaza.
   */
  if (typeof candidate.userId !== "string" || !esOwnerCanonico(candidate.userId)) {
    return { status: "invalid", reason: "incomplete" };
  }
  // Una fase desconocida NO se degrada a `backend_deleted`: no se sabe si la
  // identidad todavía existe, y suponerlo autoriza a borrar una identidad viva.
  if (!esFaseConocida(candidate.phase)) {
    return { status: "invalid", reason: "unknown-phase" };
  }
  return { status: "valid", marker: { userId: candidate.userId, phase: candidate.phase } };
}

export type AccountDeletionPrompts = {
  /** Advertencia clara de qué se borra. false = el usuario canceló. */
  confirmWarning: () => Promise<boolean>;
  /** Segunda confirmación, destructiva. false = el usuario canceló. */
  confirmDestructive: () => Promise<boolean>;
};

/**
 * El ÚNICO paso que corre la pantalla: dejar escrito que esta cuenta se está
 * borrando.
 *
 * Esta lista supo incluir la mutación de Convex, borrar Clerk, limpiar lo local
 * y navegar. Todo eso pasaba en el Perfil, con la app entera montada: entre la
 * confirmación y cada await Clerk podía entregar otra sesión, y el camino FELIZ
 * mismo era una carrera A → B. Ahora la pantalla escribe `deletion_requested` y
 * se aparta; el dueño de todo lo destructivo es el boundary global.
 */
export type AccountDeletionSteps = {
  /**
   * Dueño de esta eliminación (clerkUserId). Obligatorio y no vacío: es el que
   * viaja en el marcador y el que el backend revalida contra `identity.subject`.
   */
  ownerUserId: string;
  /** Persiste `deletion_requested`. Throw = no se sigue, nada se borró. */
  markDeletionRequested: () => Promise<void>;
};

export type AccountDeletionResult =
  | { status: "cancelled" }
  /** No se pudo dejar la marca: NADA se borró, la sesión sigue como estaba. */
  | { status: "error"; step: "marker" }
  /**
   * La intención quedó escrita en disco. **La pantalla termina acá**: entrega el
   * marcador al boundary global y no toca nada más.
   *
   * Se llama `handoff` y no `success` a propósito: no se borró nada todavía.
   */
  | { status: "handoff"; marker: PendingDeletionMarker };

/**
 * Persiste la intención de borrar. Nada más.
 *
 * No pregunta (ver `requestAccountDeletion`), no llama a Convex, no toca Clerk,
 * no limpia nada local y no navega.
 */
export async function runAccountDeletion(steps: AccountDeletionSteps): Promise<AccountDeletionResult> {
  // Sin dueño no hay marcador atribuible: se corta antes de escribir nada.
  const owner = typeof steps.ownerUserId === "string" ? steps.ownerUserId.trim() : "";
  if (!owner) return { status: "error", step: "marker" };
  try {
    await steps.markDeletionRequested();
  } catch {
    // Sin marcador no hay red de seguridad para lo que sigue. Nada se borró.
    return { status: "error", step: "marker" };
  }
  return { status: "handoff", marker: { userId: owner, phase: "deletion_requested" } };
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

export type PendingDeletionInspectDeps = {
  /** Lectura TIPADA del marcador. No recibe nada destructivo a propósito. */
  readMarker: () => Promise<PendingDeletionRead>;
};

export type PendingDeletionHydration =
  /** Sin marcador: rige la regla normal (preservar datos ante sesión perdida). */
  | { status: "none"; marker: null }
  /** Hay una eliminación a medias de un dueño conocido: la resuelve el GATE. */
  | { status: "pending"; marker: PendingDeletionMarker }
  /** Hay algo escrito que no se puede atribuir: arranque bloqueado, cero clears. */
  | { status: "blocked"; marker: null; reason: PendingDeletionInvalidReason };

/**
 * Hidratación local: SÓLO lee y valida. No borra NADA.
 *
 * ## El P0 que cierra
 *
 * Antes esto purgaba la fase `identity_deleted` acá adentro —dentro de
 * `useAppState`, en el arranque, ANTES de que Clerk dijera quién está logueado—.
 * Un marcador de A con la sesión persistida de B ya había borrado los datos
 * locales de B cuando el gate llegaba a mirar el dueño. Y un marcador corrupto,
 * normalizado a la fase conservadora, entraba por el mismo camino.
 *
 * Ahora toda operación destructiva vive en `finalizePendingDeletionPurge`, que
 * corre desde la ruta DESPUÉS de `clerkLoaded` y del control de dueño. La
 * hidratación entrega el marcador y arranca con el estado local sin publicar.
 */
export async function inspectPendingAccountDeletion(
  deps: PendingDeletionInspectDeps
): Promise<PendingDeletionHydration> {
  let read: PendingDeletionRead;
  try {
    read = await deps.readMarker();
  } catch {
    // No se pudo leer: no se sabe si hay una eliminación a medias, así que no se
    // publica nada local ni se deja pasar el arranque.
    return { status: "blocked", marker: null, reason: "unreadable" };
  }
  if (read.status === "absent") return { status: "none", marker: null };
  if (read.status === "invalid") return { status: "blocked", marker: null, reason: read.reason };
  return { status: "pending", marker: read.marker };
}

export type PendingDeletionBootDecision =
  /** Sin marcador: arranque normal. */
  | "proceed"
  /**
   * `deletion_requested` con la sesión del MISMO dueño: recién acá sale la
   * mutación destructiva de Convex (`deleteAccountV2`), con el producto
   * desmontado. Es idempotente, así que un crash antes de promover la fase se
   * reintenta sin consecuencias.
   */
  | "delete-backend"
  /** Identidad demostrada inexistente (`identity_deleted` + signed-out): purgar. */
  | "purge"
  /** `backend_deleted` con identidad activa Y DEL MISMO dueño: bloquear en
   *  "Finalizando eliminación" y reintentar `user.delete()`. */
  | "finalize-identity"
  /** Falta información (Clerk sin cargar, o una sesión que va a caer): esperar. */
  | "wait"
  /**
   * El marcador no se puede atribuir a la sesión vigente.
   *
   * Ni se borra una identidad, ni se purgan datos, ni se retira el marcador: se
   * muestra un error con reintento y todo queda como está.
   */
  | "blocked"
  /**
   * `deleteUser` respondió ok pero el checkpoint `identity_deleted` no se pudo
   * escribir, y el hecho está retenido en memoria para ESTE dueño.
   *
   * No se pide login: la identidad ya no existe y pedirlo sería mandar a alguien
   * a autenticarse contra una cuenta borrada. Se reintenta sólo la promoción.
   * Si el proceso muere antes de lograrla, la memoria se pierde y el caso cae en
   * `needs-owner` — fail closed, nunca se infiere el borrado.
   */
  | "promote-checkpoint"
  /**
   * `deletion_requested` o `backend_deleted` sin ninguna sesión.
   *
   * **Estar signed-out NO demuestra que Clerk se haya borrado.** Puede ser un
   * token expirado, un logout, una reinstalación o una app sin red. Purgar acá
   * —lo que se hacía antes— borraba los datos locales de una cuenta que quizás
   * sigue existiendo, y encima retiraba el marcador, perdiendo la señal para
   * terminar la eliminación de verdad.
   *
   * La única salida honesta es volver a entrar CON LA MISMA cuenta (y ahí el
   * caso pasa a `delete-backend` o `finalize-identity`) o pedir soporte. Nada se
   * toca mientras tanto.
   */
  | "needs-owner";

/**
 * El dueño del marcador, o `null` si no es canónico.
 *
 * Misma regla que el parser y que el writer: un id con padding no se recorta
 * para "arreglarlo" — recortarlo sería adivinar de quién es un marcador roto y
 * usar esa adivinanza para autorizar una purga.
 */
function markerOwner(marker: PendingDeletionMarker): string | null {
  return esOwnerCanonico(marker.userId) ? marker.userId : null;
}

/**
 * Decide qué hacer con un marcador pendiente una vez conocido el estado de Clerk.
 *
 * ## El P0 que cierra `currentUserId`
 *
 * Antes esto sólo miraba `isSignedIn`. Un marcador de **A** con Clerk logueado
 * como **B** devolvía `finalize-identity` y se borraba la identidad
 * equivocada. Un marcador corrupto —que el parser viejo normalizaba a
 * `userId: ""` con fase `backend_deleted`— caía en la misma rama.
 *
 * Ahora la identidad sólo se toca cuando el marcador nombra a un dueño válido y
 * ese dueño es EXACTAMENTE la sesión vigente. Cualquier otra cosa —dueño
 * distinto, dueño ausente, marcador ilegible, sesión sin id verificable, auth
 * contradictorio— cae en `blocked`: cero `deleteIdentity`, cero purga, y el
 * marcador sobrevive.
 *
 * Y NADA se decide antes de que Clerk cargue, tampoco con `identity_deleted`:
 * esa fase purgaba "directo" y con la sesión de B a medio cargar borraba los
 * datos locales de B.
 */
export function resolvePendingDeletionBoot(input: {
  marker: PendingDeletionMarker | null;
  clerkLoaded: boolean;
  isSignedIn: boolean;
  /** Clerk userId de la sesión ACTUAL. `null`/`undefined` = no hay sesión. */
  currentUserId?: string | null;
  /** Había algo escrito que el parser rechazó (ver `PendingDeletionRead`). */
  markerUnreadable?: boolean;
  /**
   * `deleteUser` respondió ok en ESTE proceso para el dueño del marcador, pero
   * el checkpoint todavía no se pudo persistir. Sólo memoria, sólo este dueño.
   */
  identityConfirmedFor?: string | null;
  /**
   * **Prueba durable del servidor** de que la identidad de Clerk ya no existe.
   *
   * La escribe el finalizador server-side, y sólo después de que Clerk lo
   * confirma, así que sobrevive a la muerte del proceso. Es lo que cierra el
   * callejón sin salida de `identityConfirmedFor`, que vive en memoria: si el
   * proceso moría entre `deleteUser` ok y el checkpoint, el arranque siguiente
   * mandaba a `needs-owner`, o sea a entrar con una cuenta ya inexistente.
   *
   * No es una inferencia: un `signed-out` sigue sin demostrar nada por sí solo.
   */
  identityDeletionConfirmedFor?: string | null;
}): PendingDeletionBootDecision {
  // Algo escrito e ilegible bloquea el arranque, con o sin Clerk: no se sabe de
  // quién es, así que no autoriza ni una purga ni un borrado de identidad.
  if (input.markerUnreadable) return "blocked";
  if (!input.marker) return "proceed";

  // Un marcador sin dueño legible no autoriza NADA: no se sabe de quién son los
  // datos que se purgarían ni qué identidad habría que borrar.
  const owner = markerOwner(input.marker);
  if (!owner) return "blocked";

  // El checkpoint pendiente gana antes que cualquier lectura de sesión: la
  // identidad ya se borró en este proceso y lo único que falta es escribirlo.
  if (input.marker.phase === "backend_deleted" && input.identityConfirmedFor === owner) {
    return "promote-checkpoint";
  }

  // NADA se decide antes de saber quién está logueado — tampoco con
  // `identity_deleted`. Esa fase purgaba "directo, no depende de Clerk", y con
  // la sesión de B todavía sin cargar eso borraba los datos locales de B.
  if (!input.clerkLoaded) return "wait";

  const currentUserId = input.currentUserId ?? null;

  /**
   * El servidor confirmó, y dejó asentado, que la identidad de ESTE dueño ya no
   * existe en Clerk. Equivale a la fase `identity_deleted` a todos los efectos,
   * con la diferencia de que sobrevive al proceso.
   *
   * Se exige la coincidencia con el dueño del marcador: una prueba sobre otra
   * cuenta no autoriza tocar estos datos.
   */
  const identityProven = input.identityDeletionConfirmedFor === owner;

  if (input.isSignedIn) {
    // Sesión viva sin id verificable: auth contradictorio, falla cerrado.
    if (!currentUserId) return "blocked";
    // Sesión de OTRA cuenta: ni se purga (son datos de esa persona) ni se borra
    // su identidad.
    if (currentUserId !== owner) return "blocked";
    // Es su propia eliminación, y avanza UNA fase por vez:
    //
    // - `deletion_requested`: todavía no se borró nada. Recién acá sale la
    //   mutación de Convex, con la sesión de su dueño y el producto desmontado.
    // - `backend_deleted`: los datos ya no están; falta la identidad.
    // - `identity_deleted`: la identidad YA se borró y que Clerk todavía
    //   publique una sesión es el eco de un token que va a caer. Se espera a que
    //   caiga en vez de purgar con una sesión viva encima.
    if (input.marker.phase === "deletion_requested") return "delete-backend";
    // Con la prueba del servidor ya no hay identidad que finalizar: lo que sigue
    // publicando sesión es el eco de un token que va a caer. Se espera, igual
    // que con `identity_deleted`, en vez de mandar al cliente a borrar algo que
    // ya no existe.
    if (input.marker.phase === "backend_deleted") {
      return identityProven ? "wait" : "finalize-identity";
    }
    return "wait";
  }

  // Signed-out con un userId publicado es contradictorio: no se toca nada.
  if (currentUserId) return "blocked";

  // Clerk cargado y sin sesión.
  //
  // `identity_deleted` es la ÚNICA fase que demuestra que la identidad ya no
  // existe —la escribimos nosotros después de que `user.delete()` respondió ok—,
  // así que es la única que autoriza la purga.
  if (input.marker.phase === "identity_deleted") return "purge";
  // El tombstone durable del servidor prueba exactamente lo mismo, y es lo que
  // saca a la persona del callejón sin salida: antes, un proceso que moría entre
  // el borrado en Clerk y su checkpoint la mandaba a `needs-owner`, o sea a
  // entrar con una cuenta que ya no existe.
  if (identityProven) return "purge";
  // Las otras dos + signed-out, sin prueba, no demuestran nada: hace falta
  // volver a entrar con la misma cuenta para terminar.
  return "needs-owner";
}

/**
 * Qué salida REAL se le ofrece a la persona cuando el gate no puede avanzar.
 *
 * Un "REINTENTAR" pelado es inerte cuando el problema es que hay otra cuenta
 * logueada o que no hay ninguna: reintentar vuelve a dar exactamente la misma
 * decisión. Cada bloqueo tiene su salida concreta.
 */
export type PendingDeletionRecovery =
  /** No hay nada que ofrecer: el gate está trabajando. */
  | "none"
  /** Falló storage/red: reintentar sirve de verdad (y relee el marcador). */
  | "retry"
  /** `needs-owner`: hay que volver a entrar con la cuenta que se está borrando. */
  | "sign-in-owner"
  /** Hay otra cuenta viva: cerrar esa sesión es lo único que destraba. */
  | "sign-out-other"
  /** El marcador no se puede atribuir a nadie: sólo soporte puede resolverlo. */
  | "support";

export function pendingDeletionRecovery(input: {
  decision: PendingDeletionBootDecision;
  /** El último intento del gate terminó en error de storage/red. */
  attemptFailed: boolean;
  /** Había algo escrito que el parser rechazó. */
  markerUnreadable: boolean;
}): PendingDeletionRecovery {
  if (input.markerUnreadable) return "support";
  if (input.decision === "needs-owner") return "sign-in-owner";
  if (input.decision === "blocked") return "sign-out-other";
  // El checkpoint pendiente se reintenta solo; pedir login mandaría a alguien a
  // autenticarse contra una identidad que ya no existe.
  if (input.decision === "promote-checkpoint") return input.attemptFailed ? "retry" : "none";
  if (input.attemptFailed) return "retry";
  return "none";
}

/**
 * Qué superficie dibuja el arranque, y en qué ORDEN.
 *
 * En web el `return` de la landing estaba ANTES del bloqueo por eliminación
 * pendiente, así que el bloqueo era código inalcanzable: con una eliminación a
 * medias en disco, la web dibujaba la landing (y su gate de cuenta) y dejaba
 * entrar. El bloqueo gana SIEMPRE, en las dos plataformas.
 */
export function bootGateSurface(input: {
  pendingDeletion: boolean;
  isWeb: boolean;
}): "pending-deletion" | "landing" | "app" {
  if (input.pendingDeletion) return "pending-deletion";
  return input.isWeb ? "landing" : "app";
}

/**
 * ¿Se puede borrar la identidad de Clerk AHORA MISMO?
 *
 * Última línea de defensa, en el objetivo destructivo. Todo lo de arriba decide
 * con lo que sabía cuando decidió; entre esa decisión y el `user.delete()` hay
 * awaits, y Clerk puede haber cambiado de cuenta. Acá se exige que el dueño
 * esperado, la sesión vigente y el objeto `user` que se va a borrar sean
 * EXACTAMENTE el mismo id. Cualquier hueco —sin dueño esperado, sin sesión, ids
 * distintos, `user` de otra cuenta— es un no.
 */
export function identityDeleteAuthorized(input: {
  expectedOwner: string | null | undefined;
  isSignedIn: boolean;
  /** userId de la sesión Clerk VIGENTE (leído de una ref, no de un closure). */
  sessionUserId: string | null | undefined;
  /** id del objeto `user` que se va a borrar. */
  userObjectId: string | null | undefined;
}): boolean {
  const expected = typeof input.expectedOwner === "string" ? input.expectedOwner : "";
  if (expected.length === 0) return false;
  if (!input.isSignedIn) return false;
  if (input.sessionUserId !== expected) return false;
  return input.userObjectId === expected;
}

/**
 * Un intento del gate de arranque, con el resultado SIEMPRE publicable: el
 * caller decide qué hacer con "error" mientras siga montado. Un cambio de
 * decisión durante los await (p. ej. Clerk publica signed-out después de
 * `deleteUser`) NO es un unmount y jamás debe silenciar el fallo — de eso se
 * encarga el caller usando este retorno en vez de flags de cancelación.
 *
 * ## `finalize-identity` NO purga
 *
 * Antes, borrar la identidad y purgar eran el mismo intento. Eso purgaba con la
 * sesión de A todavía publicada por Clerk: el `user.delete()` responde ok mucho
 * antes de que el SDK deje de decir `isSignedIn`. Ahora sólo persiste el hecho
 * —`identity_deleted`— y devuelve `identity-deleted`; la purga la decide la
 * siguiente vuelta del gate, ya con Clerk cargado y signed-out.
 */
export async function attemptPendingDeletionFinalize(args: {
  decision: PendingDeletionBootDecision;
  /**
   * Borra el grafo de datos en Convex. Solo se llama con "delete-backend", con
   * la sesión del dueño viva. Es idempotente: un fallo al promover la fase deja
   * `deletion_requested` en disco y el reintento vuelve a llamarla sin daño.
   */
  deleteBackendAccount: () => Promise<void>;
  /** Persiste `backend_deleted` DESPUÉS de que Convex confirmó. */
  promoteBackendDeleted: () => Promise<void>;
  /** Borra la identidad de Clerk. Solo se llama con "finalize-identity". */
  deleteIdentity: () => Promise<void>;
  /**
   * Persiste `identity_deleted` DESPUÉS de que `deleteUser` respondió ok. Es la
   * única prueba de que la identidad ya no existe, y lo que después autoriza a
   * purgar. Si falla, la fase sigue en `backend_deleted` y se reintenta.
   */
  promoteIdentityDeleted: () => Promise<void>;
  /** Purga final (finalizePendingDeletionPurge cableada por el caller). */
  purge: () => Promise<void>;
}): Promise<
  "completed" | "backend-deleted" | "identity-deleted" | "checkpoint-pending" | "error" | "noop"
> {
  if (
    args.decision !== "purge" &&
    args.decision !== "delete-backend" &&
    args.decision !== "finalize-identity" &&
    args.decision !== "promote-checkpoint"
  ) {
    return "noop";
  }
  // Primera fase destructiva: los datos de Convex. Con la sesión de su dueño
  // viva y el producto desmontado.
  if (args.decision === "delete-backend") {
    try {
      await args.deleteBackendAccount();
    } catch {
      // Nada se borró (o el backend rechazó el dueño esperado): se reintenta.
      return "error";
    }
    try {
      await args.promoteBackendDeleted();
      return "backend-deleted";
    } catch {
      // Convex ya borró pero el disco no lo pudo anotar. `deletion_requested`
      // sobrevive y el próximo intento vuelve a llamar a la mutation, que es
      // idempotente. Nunca se avanza a borrar Clerk sin la fase escrita.
      return "error";
    }
  }
  // Sólo falta escribir el checkpoint: la identidad ya se borró en este proceso.
  if (args.decision === "promote-checkpoint") {
    try {
      await args.promoteIdentityDeleted();
      return "identity-deleted";
    } catch {
      return "checkpoint-pending";
    }
  }
  if (args.decision === "finalize-identity") {
    try {
      await args.deleteIdentity();
    } catch {
      // La identidad NO se borró: nada que retener, se reintenta entero.
      return "error";
    }
    try {
      // Persistir el hecho y PARAR. La purga espera a que Clerk confirme que ya
      // no hay sesión: mientras la publique, los datos locales no se tocan.
      await args.promoteIdentityDeleted();
      return "identity-deleted";
    } catch {
      // `deleteUser` ya respondió ok. El hecho es real aunque el disco no lo
      // haya podido guardar: el caller lo retiene en memoria, atado a ESTE
      // dueño, y reintenta sólo la promoción. Pedir login acá mandaría a
      // autenticarse contra una cuenta que ya no existe.
      return "checkpoint-pending";
    }
  }
  try {
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
    /**
     * Estricto y OBLIGATORIO. Este paso faltaba entero: la purga retiraba su
     * marcador de eliminación dejando vivo el marcador de compra de una cuenta
     * que ya no existe, y el próximo login entraba con el paywall en
     * "Restaurar". Si tira, el `clearMarker` de abajo no llega a correr.
     */
    clearPurchaseGuard: (userId: string) => Promise<void>;
    clearMarker: () => Promise<void>;
  }
): Promise<void> {
  await deps.promoteMarker({ userId: marker.userId, phase: "identity_deleted" });
  await deps.clearLocalData();
  if (marker.userId) {
    await deps.clearAccountSnapshot(marker.userId);
    await deps.clearPurchaseGuard(marker.userId);
  }
  // ÚLTIMO, y sólo si todo lo de arriba salió bien.
  await deps.clearMarker();
}

/**
 * Por qué una purga se negó a correr. Ninguno borra ni retira nada.
 */
export type PendingDeletionPurgeOutcome =
  | "completed"
  /** Apareció una sesión viva entre la decisión y el borrado. */
  | "owner-changed"
  /** Los datos locales tienen un dueño distinto al del marcador. */
  | "foreign-local-data"
  /**
   * Web: no hay purga local automática.
   *
   * El almacenamiento es un `localStorage` global del origen, compartido por
   * todas las pestañas, y el borrado es por clave sin dueño. Entre revalidar y
   * borrar, otra pestaña con la sesión de B puede escribir su perfil: es un
   * TOCTOU que no se cierra con un "claim" escrito en el mismo storage.
   */
  | "web-unsupported";

/**
 * La ÚNICA purga que corre en producción: revalida en vivo y recién entonces
 * delega en `finalizePendingDeletionPurge`.
 *
 * Dos revalidaciones, y las dos hacen falta:
 *
 * 1. **`stillSafeToDelete()`**, leído de refs vivas justo antes de cada paso
 *    destructivo. Entre que el gate decidió `purge` (signed-out) y que la purga
 *    corre hay awaits: Clerk puede publicar la sesión de B en el medio, y ahí lo
 *    que se estaría borrando son los datos de B. Se consulta antes de promover,
 *    antes de limpiar y antes de retirar el marcador.
 * 2. **El dueño de los datos locales**. El perfil en disco viene marcado con su
 *    dueño; si NO es el del marcador, esos datos son de otra cuenta —una que
 *    entró después— y no se tocan. Se preserva todo y se bloquea.
 *
 * En los dos casos el marcador SOBREVIVE: la eliminación sigue pendiente y se
 * retoma cuando la situación sea inequívoca.
 */
export async function runGuardedPendingDeletionPurge(
  marker: PendingDeletionMarker,
  deps: {
    /** Refs vivas: `false` = apareció una sesión y hay que abortar. */
    stillSafeToDelete: () => boolean;
    /** Dueño persistido del perfil local. `null` = guest/legado. */
    readProfileOwner: () => Promise<string | null>;
    promoteMarker: (marker: PendingDeletionMarker) => Promise<void>;
    clearLocalData: () => Promise<void>;
    clearAccountSnapshot: (userId: string) => Promise<void>;
    clearPurchaseGuard: (userId: string) => Promise<void>;
    clearMarker: () => Promise<void>;
  }
): Promise<PendingDeletionPurgeOutcome> {
  /**
   * Las DOS comprobaciones, juntas y ANTES de cada paso destructivo.
   *
   * La sesión se lee de refs vivas y el dueño local se RELEE del disco: no
   * alcanza con mirarlo una vez al principio, porque entre paso y paso hay
   * awaits y en esa ventana puede aparecer B —y con B, su perfil marcado con su
   * propio dueño—. Cualquiera de las dos que falle aborta sin borrar nada más.
   */
  const revalidar = async (): Promise<PendingDeletionPurgeOutcome | null> => {
    if (!deps.stillSafeToDelete()) return "owner-changed";
    const localOwner = await deps.readProfileOwner();
    if (typeof localOwner === "string" && localOwner.length > 0 && localOwner !== marker.userId) {
      return "foreign-local-data";
    }
    return deps.stillSafeToDelete() ? null : "owner-changed";
  };

  const inicial = await revalidar();
  if (inicial) return inicial;

  const abortado: { motivo: PendingDeletionPurgeOutcome | null } = { motivo: null };
  /** Corre un paso destructivo sólo si la revalidación de ESE instante pasa. */
  const paso = async (destructivo: () => Promise<void>) => {
    const problema = await revalidar();
    if (problema) {
      abortado.motivo = problema;
      throw new Error("PENDING_DELETION_ABORTED");
    }
    await destructivo();
  };

  try {
    await finalizePendingDeletionPurge(marker, {
      promoteMarker: (next) => paso(() => deps.promoteMarker(next)),
      clearLocalData: () => paso(() => deps.clearLocalData()),
      clearAccountSnapshot: (userId) => paso(() => deps.clearAccountSnapshot(userId)),
      clearPurchaseGuard: (userId) => paso(() => deps.clearPurchaseGuard(userId)),
      clearMarker: () => paso(() => deps.clearMarker())
    });
  } catch (error) {
    // Abortar por seguridad NO es un fallo de storage: se informa como negativa,
    // con el marcador y los datos intactos. Cualquier otro error se propaga.
    if (abortado.motivo) return abortado.motivo;
    throw error;
  }
  return "completed";
}
