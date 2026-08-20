import {
  internalActionGeneric as internalAction,
  internalMutationGeneric as internalMutation,
  makeFunctionReference,
  mutationGeneric as mutation,
  queryGeneric as query
} from "convex/server";
import { v } from "convex/values";
import {
  CLERK_DELETION_MAX_ATTEMPTS,
  confirmIdentityDeleted,
  deleteAccountData,
  enqueueIdentityDeletionJob,
  insertDeletionFence,
  nextIdentityDeletionAttemptAt,
  resolveClerkDeletionOutcome,
  resolveIdentityDeletionStatus
} from "./lib/accountDeletion";
import { normalizedProfileName } from "./lib/userProfile";
import {
  findUserByTokenIdentifier,
  getOrCreateUser,
  requireIdentity,
  requireUser,
  type ConvexCtx
} from "./lib/users";

export const current = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    return await findUserByTokenIdentifier(ctx, identity.tokenIdentifier);
  }
});

export const getOrCreateCurrentUser = mutation({
  handler: async (ctx) => {
    return await getOrCreateUser(ctx);
  }
});

/**
 * Persists the profile name captured by the official Clerk signup.
 *
 * The mutation is intentionally idempotent: onboarding recovery can repeat it
 * after a redirect or a failed chart finalization without duplicating records.
 */
export const setCurrentName = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string()
  },
  returns: v.object({
    userId: v.id("users"),
    firstName: v.string(),
    lastName: v.string(),
    name: v.string()
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const profileName = normalizedProfileName(args.firstName, args.lastName);
    await ctx.db.patch(user._id, {
      ...profileName,
      updatedAt: Date.now()
    });

    return {
      userId: user._id,
      ...profileName
    };
  }
});

/**
 * Shared body: deletes everything owned by the authenticated identity.
 *
 * The ctx is the intersection of what the two helpers below need: `ConvexCtx`
 * (auth + db) for the user lookup and the optional `scheduler` that
 * `deleteAccountData` uses to cancel a pending watchdog. Naming it beats a bare
 * `any`: a caller missing `auth` is a compile error here, not a runtime one.
 */
async function deleteAuthenticatedAccount(
  ctx: ConvexCtx & { scheduler?: any },
  identity: { subject: string; tokenIdentifier: string }
) {
  const user = await findUserByTokenIdentifier(ctx, identity.tokenIdentifier);
  const clerkUserIds = user ? [identity.subject, user.clerkUserId] : [identity.subject];

  const deletedRecords = await deleteAccountData(ctx, {
    userId: user?._id,
    clerkUserIds
  });

  console.info("[account.delete]", { deletedRecords });
  return { deleted: true as const };
}

/**
 * **DEPRECATED — kept only so already-installed clients get a clear error.**
 *
 * It used to delete every Convex document owned by whoever was authenticated
 * *when it ran*. That is precisely the hole `deleteAccountV2` closes: the client
 * asks for two confirmations before calling, and those awaits are long enough
 * for Clerk to hand the app a different session (log out + log in, a token
 * refresh landing on the previously signed-in account). A flow started by A
 * could reach this mutation as B and delete B's graph.
 *
 * It now **fails closed**: it deletes nothing and asks the caller to update. An
 * old build loses the ability to delete its account from inside the app — which
 * is recoverable (update, or support) — while the alternative was deleting the
 * wrong account, which is not.
 *
 * ## Rollout
 *
 * 1. Ship `deleteAccountV2` together with a client that only calls V2 (done —
 *    `appApi.users.deleteAccountV2`).
 * 2. Keep this stub deployed while builds without V2 are still in the wild
 *    (App Store review + the tail of users who have not updated), so they get
 *    `ACCOUNT_DELETE_UPDATE_REQUIRED` instead of a missing-function crash.
 * 3. Once the minimum supported build ships V2, delete this function.
 *
 * No client in this repository calls it: that is enforced by a test.
 */
export const deleteAccount = mutation({
  args: {},
  returns: v.object({ deleted: v.literal(true) }),
  handler: async (ctx) => {
    // La identidad se exige igual: un llamado anónimo no merece ni este error.
    await requireIdentity(ctx);
    console.warn("[account.delete] legacy deleteAccount rejected (no expected owner)");
    throw new Error("ACCOUNT_DELETE_UPDATE_REQUIRED");
  }
});

/**
 * Deletes every Convex document owned by the authenticated Clerk identity,
 * **requiring the caller to name the account it started with**.
 *
 * Clerk itself is deleted afterwards by the client's pending-deletion boundary,
 * never before: deleting Clerk first would revoke the token that proves which
 * Convex graph may be removed. The operation is idempotent, so a later failure
 * can safely retry it.
 *
 * `expectedClerkUserId` is a REQUIREMENT, never a target selector: the account
 * being deleted is still, and only, the authenticated identity. It just has to
 * be the same one the caller started with. A mismatch throws before anything is
 * read or removed.
 */
export const deleteAccountV2 = mutation({
  args: { expectedClerkUserId: v.string() },
  returns: v.object({ deleted: v.literal(true) }),
  handler: async (ctx, args) => {
    const expected = args.expectedClerkUserId.trim();
    // Fail closed: an empty (or whitespace-only) expectation names nobody, and
    // would silently degrade back to "delete whoever is authenticated".
    if (expected.length === 0) throw new Error("ACCOUNT_DELETE_OWNER_REQUIRED");

    const identity = await requireIdentity(ctx);
    // The check happens INSIDE the handler, against the live identity, and
    // before any read or write: nothing is touched on a mismatch — not even the
    // fence, so a mismatched call leaves no trace at all.
    if (identity.subject !== expected) throw new Error("ACCOUNT_DELETE_OWNER_MISMATCH");

    /**
     * Suppression fence, written BEFORE the sweep and in the SAME mutation.
     *
     * Clerk's JWT stays valid after this runs — the identity is deleted later,
     * by the client — so any authenticated call in that window used to go
     * through `getOrCreateUser` and recreate the account. Another device,
     * another tab, or just the retry of `ensureUser` that was already in
     * flight.
     *
     * Same mutation means one transaction: either the fence and the sweep both
     * land, or neither does. Never a sweep without its fence.
     */
    await insertDeletionFence(ctx, identity.subject);

    /**
     * Trabajo durable de borrado de la identidad, en ESTA misma transacción.
     *
     * Antes el paso siguiente —borrar la cuenta en Clerk— lo daba el cliente, y
     * la constancia de haberlo dado vivía en memoria. Un proceso que moría en el
     * medio dejaba la cuenta barrida, la identidad viva y a la persona en un
     * callejón sin salida: el arranque le pedía entrar con una cuenta que ya no
     * existía.
     *
     * Encolarlo acá lo vuelve responsabilidad del servidor: si la barrida
     * commitea, el trabajo commitea con ella.
     */
    const jobId = await enqueueIdentityDeletionJob(ctx, identity.subject);

    /**
     * Arranca el trabajo apenas commitea la transacción.
     *
     * `runAfter(0, …)` de Convex es parte de esta transacción: si la mutation
     * hace rollback, la corrida agendada tampoco existe. Y si nunca llegara a
     * correr, el trabajo igual quedó escrito — que es justamente el punto.
     *
     * Durante la transición el cliente TODAVÍA borra Clerk por su cuenta. Los
     * dos caminos conviven sin pisarse: el que llegue segundo recibe un 404, lo
     * verifica contra la credencial y confirma lo mismo. `confirmIdentityDeleted`
     * es idempotente.
     */
    if (jobId && ctx.scheduler) {
      await ctx.scheduler.runAfter(0, runIdentityJobRef, { jobId });
    }

    return await deleteAuthenticatedAccount(ctx, identity);
  }
});

// ---------------------------------------------------------------------------
// Finalizador durable de la identidad en Clerk
// ---------------------------------------------------------------------------

/**
 * Referencias por nombre, no por `internal.*`.
 *
 * `internal.users.loQueSea` exige que el codegen haya corrido; este worktree no
 * lo corre y el gate de bindings lo prohíbe. `makeFunctionReference` resuelve por
 * string y no depende del artifact generado — es el mismo recurso que ya usa
 * `payments/revenuecatRest`.
 */
const runIdentityJobRef = makeFunctionReference<"action">("users:runIdentityDeletionJob");
const settleIdentityJobRef = makeFunctionReference<"mutation">("users:settleIdentityDeletionJob");

const CLERK_API_BASE = "https://api.clerk.com/v1";

/**
 * Toma el trabajo y reserva el intento, en una transacción.
 *
 * El intento se incrementa ACÁ y no después del resultado: si la action muere
 * sin liquidar, el contador ya subió y el trabajo no puede reintentarse infinitas
 * veces por caídas silenciosas. Un intento perdido es barato; una cola que gira
 * para siempre contra un secreto mal configurado, no.
 */
export const claimIdentityDeletionJob = internalMutation({
  args: { jobId: v.string() },
  handler: async (ctx, args) => {
    /**
     * `normalizeId` antes de `db.get`: un id malformado hace que `db.get` TIRE,
     * no que devuelva `null`. Sin esto el trabajo no fallaba cerrado como dice
     * su documentación — reventaba. Verificado contra el deployment real:
     * `Invalid ID length 29` en vez de un no-op.
     */
    const jobRef = ctx.db.normalizeId("identityDeletionJobs", args.jobId);
    if (!jobRef) return null;
    const job = await ctx.db.get(jobRef);
    if (!job || job.status !== "pending") return null;
    if (typeof job.nextAttemptAt === "number" && job.nextAttemptAt > Date.now()) return null;

    await ctx.db.patch(job._id, { attempt: job.attempt + 1 });
    return { clerkUserId: job.clerkUserId as string, attempt: job.attempt + 1 };
  }
});

/**
 * Le pide a Clerk que borre la identidad, y **no decide nada por su cuenta**:
 * traduce la respuesta con `resolveClerkDeletionOutcome` y manda el desenlace a
 * liquidar. Toda la regla vive en esa función pura, que sí está probada.
 *
 * Sin `CLERK_SECRET_KEY` no sale a la red y el desenlace es `not_configured`: el
 * trabajo queda pendiente, nada se promueve y nada se pierde. Inerte y seguro.
 *
 * El secreto no se registra, no se devuelve y no viaja en ningún error.
 */
export const runIdentityDeletionJob = internalAction({
  args: { jobId: v.string() },
  handler: async (ctx, args) => {
    const claim: any = await ctx.runMutation(
      makeFunctionReference<"mutation">("users:claimIdentityDeletionJob"),
      { jobId: args.jobId }
    );
    if (!claim) return null;

    const secret = process.env.CLERK_SECRET_KEY;
    if (!secret) {
      await ctx.runMutation(settleIdentityJobRef, { jobId: args.jobId, kind: "not_configured" });
      return null;
    }

    const authorization = { Authorization: `Bearer ${secret}` };
    let status: number | null = null;
    try {
      const respuesta = await fetch(`${CLERK_API_BASE}/users/${encodeURIComponent(claim.clerkUserId)}`, {
        method: "DELETE",
        headers: authorization
      });
      status = respuesta.status;
    } catch {
      // Red caída: transitorio por definición. No se afirma nada.
      await ctx.runMutation(settleIdentityJobRef, { jobId: args.jobId, kind: "retry" });
      return null;
    }

    /**
     * El 404 se verifica antes de creerle.
     *
     * Sólo acá, y sólo con un 404: se prueba la credencial contra un endpoint
     * que NO depende de este id. Un 200 ahí significa que el secreto y el
     * proyecto son los correctos, y entonces el 404 anterior sí prueba que la
     * identidad no existe. Sin esa verificación, un secreto mal configurado
     * daría por borradas todas las cuentas de la cola.
     */
    let credentialProven = false;
    if (status === 404) {
      try {
        const sonda = await fetch(`${CLERK_API_BASE}/users?limit=1`, { headers: authorization });
        credentialProven = sonda.status >= 200 && sonda.status < 300;
      } catch {
        credentialProven = false;
      }
    }

    const outcome = resolveClerkDeletionOutcome({ status, credentialProven });
    await ctx.runMutation(settleIdentityJobRef, {
      jobId: args.jobId,
      kind: outcome.kind,
      reason: outcome.kind === "deleted" || outcome.kind === "not_configured" ? undefined : outcome.reason
    });
    return null;
  }
});

/**
 * Liquida el trabajo según el desenlace. **Sólo `deleted` promueve el tombstone.**
 *
 * - `deleted`: `confirmIdentityDeleted` promueve el fence y retira el trabajo.
 * - `not_configured`: se deja pendiente tal cual. No es un fracaso: es que falta
 *   configurar el secreto, y el trabajo tiene que seguir esperándolo.
 * - `retry` / `unproven`: reintenta con backoff hasta el máximo. Agotado, queda
 *   `settled` con su motivo — visible para soporte, nunca promovido.
 */
export const settleIdentityDeletionJob = internalMutation({
  args: {
    jobId: v.string(),
    kind: v.string(),
    reason: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    /**
     * `normalizeId` antes de `db.get`: un id malformado hace que `db.get` TIRE,
     * no que devuelva `null`. Sin esto el trabajo no fallaba cerrado como dice
     * su documentación — reventaba. Verificado contra el deployment real:
     * `Invalid ID length 29` en vez de un no-op.
     */
    const jobRef = ctx.db.normalizeId("identityDeletionJobs", args.jobId);
    if (!jobRef) return null;
    const job = await ctx.db.get(jobRef);
    if (!job || job.status !== "pending") return null;

    if (args.kind === "deleted") {
      await confirmIdentityDeleted(ctx, job.clerkUserId as string);
      return null;
    }

    // Falta el secreto: el trabajo espera, sin consumir intentos ni rendirse.
    if (args.kind === "not_configured") return null;

    if (job.attempt >= CLERK_DELETION_MAX_ATTEMPTS) {
      await ctx.db.patch(job._id, {
        status: "settled" as const,
        outcome: args.reason ?? args.kind
      });
      console.warn("[account.delete] identidad no borrada tras agotar reintentos", {
        outcome: args.reason ?? args.kind
      });
      return null;
    }

    const proximo = nextIdentityDeletionAttemptAt({ attempt: job.attempt, now: Date.now() });
    await ctx.db.patch(job._id, { nextAttemptAt: proximo });
    if (ctx.scheduler) {
      await ctx.scheduler.runAt(proximo, runIdentityJobRef, { jobId: args.jobId });
    }
    return null;
  }
});

/**
 * ¿Consta que esta identidad ya se borró en Clerk?
 *
 * **Pública a propósito, y es la única forma de que funcione.** Quien pregunta
 * está SIN sesión: si su identidad se borró, no tiene token con qué
 * autenticarse. Esa es exactamente la persona que quedaba trabada — el arranque
 * le pedía entrar con una cuenta inexistente y la única salida era soporte.
 *
 * Es mutation y no query porque consume cupo, y el cupo se escribe.
 *
 * Qué NO responde: si alguien tiene cuenta en Órbita. Una identidad viva y una
 * que nunca existió devuelven lo mismo (`unknown`). Sólo contesta por
 * identidades que ya pidieron borrarse.
 *
 * El `clerkUserId` no se registra en ningún log.
 */
export const checkIdentityDeletionStatus = mutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const subject = args.clerkUserId.trim();
    // Fail closed: un sujeto vacío no nombra a nadie y no merece ni el cupo.
    if (subject.length === 0) return { status: "unknown" as const };
    return await resolveIdentityDeletionStatus(ctx, subject, Date.now());
  }
});
