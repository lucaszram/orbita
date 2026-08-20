import { buildRateLimitBucketKey, evaluateRateLimit, rateLimitSubjectHash } from "./rateLimit";
import { RECONCILE_COOLDOWN } from "./revenueCatRetry";

type DeletionCtx = {
  db: any;
  /** Opcional: sin él, un watchdog agendado no se cancela pero igual muere solo. */
  scheduler?: any;
};

// ---------------------------------------------------------------------------
// Fence de supresión post-borrado
// ---------------------------------------------------------------------------

/**
 * ## El repro que cierra
 *
 * `deleteAccountV2(A)` barre la cuenta, pero el JWT de Clerk sigue siendo
 * válido: la identidad se borra después, desde el cliente, y el token vive
 * hasta expirar. En esa ventana cualquier llamada autenticada vuelve a entrar
 * por `getOrCreateUser` y **recrea** la fila `users` con su `account_created`.
 * Lo dispara otro dispositivo, otra pestaña, o simplemente el retry tardío de
 * `ensureUser` que ya estaba en vuelo.
 *
 * La fila del fence se escribe DENTRO de la misma mutation que barre, así que o
 * commitean las dos cosas o ninguna.
 *
 * ## Sobre la clave
 *
 * `identityKey` es una **clave seudónima de supresión**. No es anonimización y
 * no es irreversible: es `SHA-256(dominio_versionado | subject)` sin secreto, y
 * quien tenga un subject candidato puede comprobar si está fenced. Lo que sí
 * da es que la tabla no contenga identificadores en crudo —ni Clerk id, ni
 * token, ni email, ni userId— y que no sea enumerable, porque los Clerk IDs
 * tienen alta entropía.
 *
 * `FENCE_KEY_VERSION` está para poder migrar a HMAC con secreto más adelante
 * sin reinterpretar las filas viejas: una versión nueva convive con la anterior.
 *
 * ## Por qué vive en ESTE módulo
 *
 * Es el mismo dominio que la barrida y comparte su transacción. Además, el gate
 * de bindings exige que todo módulo de `convex/` esté en `_generated/api.d.ts`,
 * y ese archivo se regenera con `convex codegen` —que este worktree no corre—.
 * Un archivo nuevo rompería la suite sin agregar ninguna separación real.
 */

/** Dominio de separación: la clave no colisiona con ningún otro hash del sistema. */
const FENCE_KEY_DOMAIN = "orbita:account-deletion-fence";

/** v1 = SHA-256 sin secreto. Una v2 con HMAC podrá convivir con ésta. */
export const FENCE_KEY_VERSION = 1;

export const ACCOUNT_DELETION_FENCED = "ACCOUNT_DELETION_IN_PROGRESS";

type FenceCtx = {
  db: any;
};

/**
 * Deriva la clave seudónima de un `identity.subject`.
 *
 * WebCrypto a propósito, NO `stableInputHash`: ése es un FNV/xorshift de 64 bits
 * pensado para claves de caché, con colisiones alcanzables. Acá una colisión
 * bloquearía a una cuenta ajena para siempre.
 */
export async function deletionIdentityKey(subject: string): Promise<string> {
  const material = new TextEncoder().encode(`${FENCE_KEY_DOMAIN}:v${FENCE_KEY_VERSION}|${subject}`);
  const digest = await crypto.subtle.digest("SHA-256", material);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function findFence(ctx: FenceCtx, identityKey: string) {
  return await ctx.db
    .query("accountDeletionFences")
    .withIndex("by_identityKey", (q: any) => q.eq("identityKey", identityKey))
    .first();
}

/**
 * Marca esta identidad como suprimida. Idempotente: un retry de la eliminación
 * no crea una segunda fila.
 *
 * Corre DENTRO de la mutation que barre, antes de borrar: si la barrida falla,
 * el rollback se lleva también el fence.
 */
export async function insertDeletionFence(ctx: FenceCtx, subject: string): Promise<void> {
  const identityKey = await deletionIdentityKey(subject);
  const existing = await findFence(ctx, identityKey);
  if (existing) return;
  await ctx.db.insert("accountDeletionFences", {
    identityKey,
    keyVersion: FENCE_KEY_VERSION,
    createdAt: Date.now()
  });
}

async function findIdentityDeletionJob(ctx: FenceCtx, identityKey: string) {
  return await ctx.db
    .query("identityDeletionJobs")
    .withIndex("by_identityKey", (q: any) => q.eq("identityKey", identityKey))
    .first();
}

/**
 * Encola el borrado de la identidad en Clerk. Idempotente por `identityKey`.
 *
 * Corre DENTRO de la misma mutation que el fence y la barrida: los tres
 * commitean juntos o no commitea ninguno. Nunca una cuenta barrida sin su
 * trabajo, que era exactamente el agujero — el paso siguiente dependía de que el
 * cliente siguiera vivo para darlo.
 *
 * El `clerkUserId` va en claro y es transitorio: ver la nota de la tabla.
 */
export async function enqueueIdentityDeletionJob(
  ctx: FenceCtx,
  subject: string
): Promise<string | null> {
  const identityKey = await deletionIdentityKey(subject);
  const existing = await findIdentityDeletionJob(ctx, identityKey);
  if (existing) return null;
  return await ctx.db.insert("identityDeletionJobs", {
    clerkUserId: subject,
    identityKey,
    keyVersion: FENCE_KEY_VERSION,
    attempt: 0,
    status: "pending" as const,
    createdAt: Date.now()
  });
}

/**
 * Asienta que Clerk confirmó el borrado, y recién ahí retira el trabajo.
 *
 * El orden importa: **primero se promueve el fence, después se borra el
 * trabajo.** Al revés, un fallo entre las dos escrituras dejaría la identidad
 * borrada en Clerk sin nada que lo pruebe y sin nada que lo reintente — el mismo
 * agujero que esto viene a cerrar, sólo que del lado del servidor.
 *
 * Sólo lo llama quien ya tiene la confirmación de Clerk. Idempotente: llamarlo
 * dos veces conserva el primer instante confirmado en vez de pisarlo.
 */
export async function confirmIdentityDeleted(ctx: FenceCtx, subject: string): Promise<void> {
  const identityKey = await deletionIdentityKey(subject);

  const fence = await findFence(ctx, identityKey);
  if (fence && typeof fence.identityDeletedAt !== "number") {
    await ctx.db.patch(fence._id, { identityDeletedAt: Date.now() });
  }

  const job = await findIdentityDeletionJob(ctx, identityKey);
  if (job) await ctx.db.delete(job._id);
}

// ---------------------------------------------------------------------------
// Consulta del tombstone para un cliente SIN sesión
// ---------------------------------------------------------------------------

/**
 * Cupo de la consulta de estado, por sujeto.
 *
 * **Qué frena y qué no, sin maquillaje:** frena el martilleo sobre UN sujeto. NO
 * frena una enumeración amplia — para eso habría que limitar por origen, y
 * Convex no lo expone. Lo que sostiene el diseño es otra cosa: preguntar exige
 * conocer de antemano el `subject` de Clerk, que es el mismo modelo de amenaza
 * que el fence ya aceptó y documentó.
 */
export const IDENTITY_DELETION_STATUS_COOLDOWN = {
  scope: "identity_deletion_status",
  windowMs: 60_000,
  max: 10
} as const;

export type IdentityDeletionStatus =
  /** Clerk confirmó: la identidad no existe. Autoriza purgar. */
  | { status: "confirmed" }
  /** Hay un borrado en curso, todavía sin confirmar. No autoriza nada. */
  | { status: "pending" }
  /** No consta ningún borrado para ese sujeto. Tampoco autoriza nada. */
  | { status: "unknown" }
  /** Se pidió demasiadas veces en la ventana. */
  | { status: "rate_limited"; retryAfterMs: number };

/**
 * ¿Consta que esta identidad ya se borró en Clerk?
 *
 * Sólo `confirmed` autoriza a purgar. `pending` y `unknown` son ambos "no se
 * sabe" y se responden igual de cerrados.
 *
 * **`unknown` no distingue "cuenta viva" de "cuenta que nunca existió"**, a
 * propósito: si lo hiciera, esta superficie serviría para averiguar quién tiene
 * cuenta en Órbita, que es justo lo que no puede hacer. Sólo contesta por
 * identidades que ya pidieron borrarse.
 *
 * El `subject` llega en claro porque quien pregunta ya lo tiene —es el de su
 * propio marcador— y derivarlo en el dispositivo obligaría a meter SHA-256 en el
 * cliente. Se hashea acá, antes de tocar ninguna tabla, y no se registra.
 */
export async function resolveIdentityDeletionStatus(
  ctx: FenceCtx,
  subject: string,
  now: number
): Promise<IdentityDeletionStatus> {
  const bucketKey = buildRateLimitBucketKey(
    IDENTITY_DELETION_STATUS_COOLDOWN.scope,
    subject,
    now,
    IDENTITY_DELETION_STATUS_COOLDOWN.windowMs
  );
  const existing = await ctx.db
    .query("publicRateLimits")
    .withIndex("by_bucketKey", (q: any) => q.eq("bucketKey", bucketKey))
    .first();

  const decision = evaluateRateLimit({
    existing: existing ? { count: existing.count, windowStartedAt: existing.windowStartedAt } : null,
    now,
    config: IDENTITY_DELETION_STATUS_COOLDOWN
  });
  if (!decision.allowed) {
    return { status: "rate_limited", retryAfterMs: decision.retryAfterMs };
  }

  if (existing) {
    await ctx.db.patch(existing._id, {
      count: decision.nextCount,
      windowStartedAt: decision.windowStartedAt,
      expiresAt: decision.expiresAt
    });
  } else {
    await ctx.db.insert("publicRateLimits", {
      bucketKey,
      scope: IDENTITY_DELETION_STATUS_COOLDOWN.scope,
      // Hash, nunca el subject en claro: el contador no puede volverse un
      // registro de quién borró su cuenta.
      subjectHash: rateLimitSubjectHash(subject),
      count: decision.nextCount,
      windowStartedAt: decision.windowStartedAt,
      expiresAt: decision.expiresAt
    });
  }

  const fence = await findFence(ctx, await deletionIdentityKey(subject));
  if (!fence) return { status: "unknown" };
  return typeof fence.identityDeletedAt === "number"
    ? { status: "confirmed" }
    : { status: "pending" };
}

// ---------------------------------------------------------------------------
// La regla: qué respuesta de Clerk prueba un borrado, y qué respuesta no
// ---------------------------------------------------------------------------

/**
 * Cuántas veces se reintenta antes de rendirse y dejarlo para soporte.
 *
 * Ni una (un 503 pasajero condenaría a la persona) ni infinitas (un secreto mal
 * configurado giraría para siempre sin que nadie se entere).
 */
export const CLERK_DELETION_MAX_ATTEMPTS = 12;

/** Techo del backoff: entre intentos nunca pasan más de seis horas. */
const CLERK_DELETION_MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;

export type ClerkDeletionOutcome =
  /** Clerk confirmó. Es lo ÚNICO que autoriza promover el tombstone. */
  | { kind: "deleted" }
  /** Transitorio: reintentar sirve. */
  | { kind: "retry"; reason: string }
  /** No prueba nada. Se reintenta, pero jamás se afirma el borrado. */
  | { kind: "unproven"; reason: string }
  /** Falta `CLERK_SECRET_KEY`: inerte y seguro, el trabajo espera. */
  | { kind: "not_configured" };

/**
 * Traduce la respuesta de `DELETE /v1/users/{id}` a un desenlace.
 *
 * ## El 404, que es todo el problema
 *
 * Un 404 puede significar dos cosas opuestas: "esa identidad no existe, o sea ya
 * está borrada" o "la ruta, el proyecto o la credencial están mal". Tratarlo
 * como éxito a ciegas es el error que ya cometimos leyendo el 404 de RevenueCat,
 * y acá sale más caro: daría por borradas TODAS las cuentas de la cola contra un
 * secreto mal configurado, dejando identidades vivas marcadas como muertas.
 *
 * Por eso el 404 sólo cuenta con `credentialProven`, que se demuestra aparte
 * contra un endpoint que **no depende de este id**. Recién ahí un 404 significa
 * lo que parece.
 *
 * `credentialProven` es una excepción quirúrgica del 404: no convierte ninguna
 * otra respuesta en un borrado.
 */
export function resolveClerkDeletionOutcome(input: {
  /** `null` = no había secreto configurado y no se llamó a nadie. */
  status: number | null;
  credentialProven?: boolean;
}): ClerkDeletionOutcome {
  if (input.status === null) return { kind: "not_configured" };

  if (input.status >= 200 && input.status < 300) return { kind: "deleted" };

  if (input.status === 404) {
    return input.credentialProven
      ? { kind: "deleted" }
      : { kind: "unproven", reason: "not_found_unverified_credential" };
  }

  if (input.status === 401 || input.status === 403) {
    return { kind: "unproven", reason: "unauthorized" };
  }

  if (input.status === 429 || input.status >= 500) {
    return { kind: "retry", reason: `transient_${input.status}` };
  }

  // Cualquier otra cosa es una respuesta que no entendemos. No se interpreta
  // como éxito: no entender nunca es una prueba.
  return { kind: "unproven", reason: `unexpected_${input.status}` };
}

/**
 * Cuándo toca el próximo intento. Backoff exponencial con techo.
 *
 * El techo existe para que la cola siga siendo una cola: sin él, unos pocos
 * fracasos empujaban el próximo intento a días y el trabajo quedaba vivo pero
 * inerte, que es peor que fallar — parece que algo está pasando y no pasa nada.
 */
export function nextIdentityDeletionAttemptAt(input: { attempt: number; now: number }): number {
  const exponente = Math.max(0, input.attempt - 1);
  const espera = Math.min(CLERK_DELETION_MAX_BACKOFF_MS, 30_000 * 2 ** exponente);
  return input.now + espera;
}

/**
 * ¿Está probado que esta identidad ya no existe en Clerk?
 *
 * `false` significa "no se sabe", nunca "sigue existiendo". Quien pregunta tiene
 * que fallar cerrado: sin prueba no se purga nada y no se retira el marcador.
 */
export async function isIdentityDeletionConfirmed(
  ctx: FenceCtx,
  subject: string
): Promise<boolean> {
  const fence = await findFence(ctx, await deletionIdentityKey(subject));
  return typeof fence?.identityDeletedAt === "number";
}

/**
 * Corta cualquier escritura autenticada de una identidad ya suprimida.
 *
 * Se llama ANTES de cualquier `insert`/`patch`: el punto es que no exista un
 * camino en el que la cuenta se recree. Las LECTURAS no pasan por acá — con la
 * fila borrada ya devuelven vacío, que es la degradación correcta.
 */
export async function assertIdentityNotDeletionFenced(
  ctx: FenceCtx,
  subject: string
): Promise<void> {
  const identityKey = await deletionIdentityKey(subject);
  if (await findFence(ctx, identityKey)) {
    throw new Error(ACCOUNT_DELETION_FENCED);
  }
}

type IndexedDeletionStep = {
  table: string;
  index: string;
  field: "userId" | "createdByUserId";
};

/**
 * Every table whose rows belong to one Órbita user.
 *
 * Children are intentionally listed before the documents they reference. Convex
 * does not enforce foreign keys, but this order prevents dangling references and
 * keeps the operation safe if those references become stricter later.
 *
 * When a new user-owned table is added to schema.ts, the structural regression
 * in test/accountDeletion.test.ts forces this plan to be updated too.
 */
export const USER_SCOPED_DELETION_STEPS: readonly IndexedDeletionStep[] = [
  { table: "productEvents", index: "by_user_date", field: "userId" },
  { table: "productActors", index: "by_user", field: "userId" },
  { table: "labRuns", index: "by_createdBy", field: "createdByUserId" },
  { table: "labSubjects", index: "by_createdBy", field: "createdByUserId" },
  { table: "savedReadings", index: "by_user", field: "userId" },
  { table: "journalEntries", index: "by_user", field: "userId" },
  { table: "natalInterpretations", index: "by_user", field: "userId" },
  { table: "profileAstrologyCaches", index: "by_user", field: "userId" },
  { table: "dailyLlmReadings", index: "by_user", field: "userId" },
  { table: "dailyReadings", index: "by_user", field: "userId" },
  { table: "transitReadings", index: "by_user_date", field: "userId" },
  { table: "transitTimelineCaches", index: "by_user_period", field: "userId" },
  { table: "analysisSnapshotsV492", index: "by_user", field: "userId" },
  { table: "natalEphemerisCachesV492", index: "by_user", field: "userId" },
  { table: "relationshipComparisonCachesV492", index: "by_user", field: "userId" },
  { table: "dailyGuides", index: "by_user_date", field: "userId" },
  { table: "voidAnswers", index: "by_user_date", field: "userId" },
  { table: "voidPromptSets", index: "by_user_date", field: "userId" },
  { table: "relationshipProfiles", index: "by_user", field: "userId" },
  { table: "notificationPreferences", index: "by_user", field: "userId" },
  { table: "devices", index: "by_user", field: "userId" },
  { table: "subscriptions", index: "by_user", field: "userId" },
  { table: "natalCharts", index: "by_user", field: "userId" },
  { table: "birthData", index: "by_user", field: "userId" },
  { table: "onboardingDrafts", index: "by_user", field: "userId" }
] as const;

/** Igual que `deleteRowsByIndex`, pero con un índice de dos campos. */
async function deleteRowsByIndexPair(
  ctx: DeletionCtx,
  step: { table: string; index: string },
  equals: Record<string, unknown>
): Promise<number> {
  const rows = await ctx.db
    .query(step.table)
    .withIndex(step.index, (q: any) =>
      Object.entries(equals).reduce((builder, [field, value]) => builder.eq(field, value), q)
    )
    .collect();

  for (const row of rows) {
    await ctx.db.delete(row._id);
  }

  return rows.length;
}

async function deleteRowsByIndex(
  ctx: DeletionCtx,
  step: { table: string; index: string; field: string },
  value: unknown
): Promise<number> {
  const rows = await ctx.db
    .query(step.table)
    .withIndex(step.index, (q: any) => q.eq(step.field, value))
    .collect();

  for (const row of rows) {
    await ctx.db.delete(row._id);
  }

  return rows.length;
}

export async function deleteAccountData(
  ctx: DeletionCtx,
  args: {
    userId?: unknown;
    clerkUserIds: readonly string[];
  }
): Promise<number> {
  let deletedRecords = 0;

  if (args.userId !== undefined) {
    // Los eventos previos al login no tienen userId, pero quedan vinculados al
    // productActor cuando esa instalación se identifica. También deben salir.
    const actors = await ctx.db
      .query("productActors")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .collect();
    for (const actor of actors) {
      deletedRecords += await deleteRowsByIndex(
        ctx,
        { table: "productEvents", index: "by_actor_date", field: "actorId" },
        actor._id
      );
    }

    for (const step of USER_SCOPED_DELETION_STEPS) {
      deletedRecords += await deleteRowsByIndex(ctx, step, args.userId);
    }
  }

  for (const clerkUserId of new Set(args.clerkUserIds.filter(Boolean))) {
    deletedRecords += await deleteRowsByIndex(
      ctx,
      { table: "paymentEvents", index: "by_clerkUserId", field: "clerkUserId" },
      clerkUserId
    );

    // Trabajo de reconciliación pendiente. Sin esto quedaba una fila con el
    // Clerk id y un watchdog agendado que, al despertar, buscaba una cuenta que
    // ya no existe. Se cancela lo agendado cuando el contexto lo permite; el
    // `runReconcileJob` que igual llegue a correr encuentra la fila borrada y
    // no sale a la red.
    const jobs = await ctx.db
      .query("reconcileJobs")
      .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", clerkUserId))
      .collect();
    for (const job of jobs) {
      if (job.watchdogId && typeof ctx.scheduler?.cancel === "function") {
        try {
          await ctx.scheduler.cancel(job.watchdogId);
        } catch {
          /* ya corrió o el scheduler no lo conoce */
        }
      }
      await ctx.db.delete(job._id);
      deletedRecords += 1;
    }

    // Contadores del cupo de reconciliación. Se buscan por HASH del sujeto: la
    // tabla nunca guarda el Clerk id en claro, y aun así la eliminación puede
    // encontrar exactamente sus filas.
    deletedRecords += await deleteRowsByIndexPair(
      ctx,
      { table: "publicRateLimits", index: "by_scope_subjectHash" },
      { scope: RECONCILE_COOLDOWN.scope, subjectHash: rateLimitSubjectHash(clerkUserId) }
    );
  }

  if (args.userId !== undefined) {
    await ctx.db.delete(args.userId);
    deletedRecords += 1;
  }

  return deletedRecords;
}
