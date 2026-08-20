/**
 * Reconciliación server-side del entitlement de la tienda.
 *
 * El diseño en una línea: **el teléfono pide que miremos, nosotros miramos.**
 * El cliente no manda su identidad, ni su `CustomerInfo`, ni un recibo. La
 * superficie pública deriva el Clerk id de `ctx.auth`, el backend consulta la
 * REST de RevenueCat con una credencial que sólo vive acá, y una mutation
 * proyecta el resultado. Nada de lo que viaja desde el teléfono concede acceso.
 *
 * ## Durabilidad: mutation pública → trabajo persistido → action
 *
 * La superficie que usa la app es una **mutation** (`requestStoreReconcile`).
 * Antes era una action pública: una action es at-most-once y puede morir antes
 * de crear nada, así que el toque de la persona se perdía sin dejar rastro.
 * Ahora, dentro de UNA transacción, se consume el cupo y se deja escrito el
 * trabajo; recién después alguien sale a la red.
 *
 * El trabajo lo sostiene un **watchdog** (`runReconcileJob`, otra mutation
 * agendada) sobre `reconcileJobs`. Es el modelo que documenta Convex para el
 * error handling de scheduled functions: las mutations se reintentan ante
 * fallos transitorios y su `scheduler.runAfter` es parte de su transacción. El
 * watchdog no pregunta si la action corrió: mira el estado y, si sigue
 * `pending`, la relanza.
 *
 * ## Señales, generaciones y lease
 *
 * Cada pedido incrementa `requestedSeq`, incluso si ya hay una corrida en
 * vuelo. Una corrida sólo puede liquidar el trabajo si la señal que atiende
 * (`startedSeq`) sigue siendo la última: si llegó un webhook nuevo mientras
 * leía, su snapshot ya es viejo y en vez de cerrar el trabajo dispara otra
 * corrida. El `leaseToken` (`generación:señal:intento`) viaja con la action y
 * se revalida antes de la red, antes de proyectar y al liquidar, así que un
 * resultado tardío nunca pisa —ni cancela el watchdog de— una corrida nueva.
 *
 * `REVENUECAT_SECRET_API_KEY` es un secreto de backend: no tiene prefijo
 * `EXPO_PUBLIC_`, no se registra y no aparece en la auditoría.
 */
import {
  internalActionGeneric as internalAction,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery,
  makeFunctionReference,
  mutationGeneric as mutation
} from "convex/server";
import { v } from "convex/values";

import { PRO_ENTITLEMENT } from "../lib/entitlements";
import { buildRateLimitBucketKey, evaluateRateLimit, rateLimitSubjectHash } from "../lib/rateLimit";
import {
  hasReconcileAttemptsLeft,
  isRetryableReconcileReason,
  RECONCILE_COOLDOWN,
  RECONCILE_FETCH_TIMEOUT_MS,
  reconcileRetryDelayMs,
  reconcileWatchdogDelayMs
} from "../lib/revenueCatRetry";

import { isRevenueCatEnvironmentAllowed } from "../lib/revenueCatEvents";
import {
  interpretRevenueCatSubscriber,
  revenueCatSubscriberUrl,
  summarizeReconciliation,
  type RevenueCatReconcileOutcome,
  type RevenueCatRevocationScope
} from "../lib/revenueCatRest";
import { omitUndefined } from "../lib/users";

const projectRef = makeFunctionReference<"mutation">(
  "payments/revenuecatRest:projectRevenueCatSubscriber"
);
const reconcileRef = makeFunctionReference<"action">(
  "payments/revenuecatRest:reconcileStoreEntitlement"
);
const enqueueRef = makeFunctionReference<"mutation">(
  "payments/revenuecatRest:enqueueStoreReconcile"
);
const projectResultRef = makeFunctionReference<"mutation">(
  "payments/revenuecatRest:projectReconcileResult"
);
const runJobRef = makeFunctionReference<"mutation">("payments/revenuecatRest:runReconcileJob");
const settleJobRef = makeFunctionReference<"mutation">("payments/revenuecatRest:settleReconcileJob");
const leaseRef = makeFunctionReference<"query">("payments/revenuecatRest:reconcileLeaseIsCurrent");

/**
 * Referencia estable para agendar el encolado desde OTRA transacción.
 *
 * El webhook ya no la usa: llama a `enqueueStoreReconcileJob` directo con su
 * mismo `ctx`, para que la señal quede escrita en su propia transacción (ver
 * P1 A en `convex/CHANGELOG.md`). Se conserva para cualquier caller que sí
 * necesite diferirlo.
 */
export const ENQUEUE_STORE_RECONCILE_REF = enqueueRef;

const providerEnvironment = v.union(v.literal("sandbox"), v.literal("production"));

/**
 * Validador CERRADO del resultado de la lectura.
 *
 * Antes era `v.any()` y el handler hacía `...outcome.patch` sobre la fila: un
 * cuerpo con campos de más entraba entero a `subscriptions`. Ahora cada campo
 * que puede tocar el acceso está enumerado, y lo que no está acá no llega.
 */
const reconcilePatchValidator = v.object({
  entitlement: v.optional(v.union(v.literal("free"), v.literal("orbita_pro"))),
  status: v.optional(
    v.union(
      v.literal("inactive"),
      v.literal("trialing"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("billing_issue"),
      v.literal("canceled"),
      v.literal("expired")
    )
  ),
  plan: v.optional(
    v.union(v.literal("monthly"), v.literal("weekly"), v.literal("yearly"), v.literal("lifetime"))
  ),
  productId: v.optional(v.string()),
  currentPeriodEnd: v.optional(v.number()),
  isLifetime: v.optional(v.boolean()),
  willRenew: v.optional(v.boolean())
});

/**
 * Alcance del apagado, también validado.
 *
 * Es `v.optional` a propósito: un resultado que no lo declare no revoca nada
 * (el handler cae en `{ kind: "none" }`). Fallar hacia "no toco nada" es la
 * única dirección segura para un campo que puede apagar acceso pago.
 */
const revocationValidator = v.union(
  v.object({ kind: v.literal("none") }),
  v.object({ kind: v.literal("environment"), environment: providerEnvironment }),
  v.object({ kind: v.literal("global") })
);

const reconcileOutcomeValidator = v.union(
  v.object({ kind: v.literal("unavailable"), reason: v.string() }),
  v.object({
    kind: v.literal("resolved"),
    patch: reconcilePatchValidator,
    observedAt: v.number(),
    environment: v.optional(providerEnvironment),
    productId: v.optional(v.string()),
    subscriberId: v.optional(v.string()),
    revocation: v.optional(revocationValidator)
  })
);

// ---------------------------------------------------------------------------
// Cupo y trabajo durable — helpers compartidos por la superficie pública y las
// mutations internas. Una mutation no puede llamar a otra, así que la lógica
// vive en funciones planas y cada handler la usa dentro de su transacción.
// ---------------------------------------------------------------------------

/** Cupo de la comprobación pedida por la app, por cuenta. */
async function consumeCooldown(
  ctx: any,
  clerkUserId: string,
  now: number
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const bucketKey = buildRateLimitBucketKey(
    RECONCILE_COOLDOWN.scope,
    clerkUserId,
    now,
    RECONCILE_COOLDOWN.windowMs
  );
  const existing = await ctx.db
    .query("publicRateLimits")
    .withIndex("by_bucketKey", (q: any) => q.eq("bucketKey", bucketKey))
    .first();

  const decision = evaluateRateLimit({
    existing: existing ? { count: existing.count, windowStartedAt: existing.windowStartedAt } : null,
    now,
    config: RECONCILE_COOLDOWN
  });
  if (!decision.allowed) return { allowed: false, retryAfterMs: decision.retryAfterMs };

  if (existing) {
    await ctx.db.patch(existing._id, {
      count: decision.nextCount,
      windowStartedAt: decision.windowStartedAt,
      expiresAt: decision.expiresAt
    });
  } else {
    await ctx.db.insert("publicRateLimits", {
      bucketKey,
      scope: RECONCILE_COOLDOWN.scope,
      // Hash, no el Clerk id: es lo único que hace falta para poder borrar
      // estos contadores cuando la cuenta se elimina.
      subjectHash: rateLimitSubjectHash(clerkUserId),
      count: decision.nextCount,
      windowStartedAt: decision.windowStartedAt,
      expiresAt: decision.expiresAt
    });
  }
  return { allowed: true, retryAfterMs: 0 };
}

async function findUserByClerkId(ctx: any, clerkUserId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", clerkUserId))
    .first();
}

const leaseTokenFor = (job: { generation: number; startedSeq: number; attempt: number }) =>
  `${job.generation}:${job.startedSeq}:${job.attempt}`;

/**
 * Deja escrita una señal de reparación para esta cuenta.
 *
 * Idempotente en la CANTIDAD de trabajo (una sola fila y una sola cadena de
 * reintentos por cuenta) pero **no** en la señal: cada pedido incrementa
 * `requestedSeq` aunque ya haya un trabajo en curso. Ése era el "lost wakeup":
 * el segundo webhook volvía sin dejar rastro y la corrida en vuelo, con un
 * snapshot anterior a ese webhook, cerraba el trabajo como si estuviera al día.
 */
async function enqueueJob(ctx: any, clerkUserId: string, trigger: string): Promise<void> {
  const now = Date.now();
  const existing = await ctx.db
    .query("reconcileJobs")
    .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", clerkUserId))
    .first();

  if (!existing) {
    const jobId = await ctx.db.insert("reconcileJobs", {
      clerkUserId,
      trigger,
      generation: 1,
      requestedSeq: 1,
      startedSeq: 0,
      attempt: 0,
      status: "pending" as const,
      createdAt: now,
      updatedAt: now
    });
    if (ctx.scheduler) await ctx.scheduler.runAfter(0, runJobRef, { jobId });
    return;
  }

  if (existing.status === "pending") {
    // Sólo la señal: la cadena de reintentos ya está viva y su watchdog
    // también. Duplicarla sería pegarle dos veces a la API por lo mismo.
    await ctx.db.patch(existing._id, {
      requestedSeq: existing.requestedSeq + 1,
      trigger,
      updatedAt: now
    });
    return;
  }

  // Trabajo cerrado (resuelto, agotado o permanente) y llega una señal nueva:
  // se reabre en una generación NUEVA, con los intentos en cero. La generación
  // forma parte del lease, así que nada de la anterior puede tocar ésta.
  await ctx.db.patch(existing._id, {
    trigger,
    generation: existing.generation + 1,
    requestedSeq: existing.requestedSeq + 1,
    startedSeq: 0,
    attempt: 0,
    status: "pending" as const,
    outcome: undefined,
    leaseToken: undefined,
    watchdogId: undefined,
    nextCheckAt: undefined,
    updatedAt: now
  });
  if (ctx.scheduler) await ctx.scheduler.runAfter(0, runJobRef, { jobId: existing._id });
}

/**
 * Superficie PÚBLICA que usa la app.
 *
 * Es una **mutation** a propósito. Como action, podía morir antes de crear el
 * trabajo y el pedido de la persona se perdía sin dejar nada escrito. Acá el
 * cupo y el trabajo quedan en la misma transacción; la red la toca después la
 * action que el watchdog lanza.
 *
 * `args` está vacío A PROPÓSITO: cualquier `clerkUserId`, `customerInfo`,
 * `entitlement` o recibo que el cliente adjunte es rechazado por el validador
 * y, aunque llegara, este handler no lo lee.
 */
export const requestStoreReconcile = mutation({
  args: {},
  returns: v.object({
    status: v.union(v.literal("queued"), v.literal("cooldown"), v.literal("unauthenticated"))
  }),
  handler: async (ctx: any) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) return { status: "unauthenticated" as const };
    const clerkUserId: string = identity.subject;

    // Sin fila local no hay dónde proyectar: no se encola ni se gasta cupo.
    const user = await findUserByClerkId(ctx, clerkUserId);
    if (!user) return { status: "unauthenticated" as const };

    const cooldown = await consumeCooldown(ctx, clerkUserId, Date.now());
    if (!cooldown.allowed) return { status: "cooldown" as const };

    await enqueueJob(ctx, clerkUserId, "client_check");
    return { status: "queued" as const };
  }
});

/**
 * Deja la señal de reconciliación escrita **en la transacción de quien llama**.
 *
 * ## Por qué es una función y no una mutation agendada
 *
 * El webhook aplicaba el evento y después hacía
 * `scheduler.runAfter(0, enqueueStoreReconcile, …)`. Esa mutation corre
 * DESPUÉS, así que `requestedSeq` recién subía más tarde. En el hueco entre las
 * dos, una corrida en vuelo con un snapshot anterior al webhook seguía viendo
 * `requestedSeq === startedSeq` y `projectReconcileResult` la daba por vigente:
 * un `EXPIRATION` que acababa de dejar la fila en Free podía ser reescrito a
 * Pro por la lectura vieja. La protección sólo servía si la señal ya estaba
 * persistida.
 *
 * Llamada así, la señal, el evento aplicado y su auditoría son la MISMA
 * transacción, y el `runAfter` del watchdog también entra en ella.
 *
 * Devuelve `false` cuando no hay cuenta local: no hay dónde proyectar y no debe
 * quedar trabajo apuntando a un id que ya no existe.
 */
export async function enqueueStoreReconcileJob(
  ctx: any,
  clerkUserId: string,
  trigger: string
): Promise<boolean> {
  const user = await findUserByClerkId(ctx, clerkUserId);
  if (!user) return false;
  await enqueueJob(ctx, clerkUserId, trigger);
  return true;
}

/** Encolado interno para callers que sí necesitan una mutation propia. */
export const enqueueStoreReconcile = internalMutation({
  args: { clerkUserId: v.string(), trigger: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx: any, { clerkUserId, trigger }: { clerkUserId: string; trigger?: string }) => {
    await enqueueStoreReconcileJob(ctx, clerkUserId, trigger ?? "unknown");
    return null;
  }
});

/**
 * El WATCHDOG. Mutation agendada que lanza —o relanza— el intento.
 *
 * Las tres escrituras —intento, action lanzada, próxima vigilancia— viven en
 * una sola transacción. Si el `runAfter` de la action rechaza, no queda un
 * intento consumido sin sucesor: se deshace todo y Convex reintenta.
 */
export const runReconcileJob = internalMutation({
  args: { jobId: v.id("reconcileJobs") },
  returns: v.null(),
  handler: async (ctx: any, { jobId }: { jobId: any }) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "pending") return null;

    // La cuenta pudo borrarse mientras el trabajo esperaba. Se retira el
    // trabajo entero: nadie tiene que salir a preguntarle a la tienda por un id
    // que ya no existe.
    const user = await findUserByClerkId(ctx, job.clerkUserId);
    if (!user) {
      await ctx.db.delete(jobId);
      return null;
    }

    const now = Date.now();
    // Una señal nueva reinicia los intentos: lo que se agotó fue el snapshot
    // anterior, no éste.
    const señalNueva = job.requestedSeq > job.startedSeq;
    if (!señalNueva && !hasReconcileAttemptsLeft(job.attempt)) {
      await ctx.db.patch(jobId, {
        status: "settled",
        outcome: "exhausted",
        leaseToken: undefined,
        watchdogId: undefined,
        nextCheckAt: undefined,
        updatedAt: now
      });
      return null;
    }
    if (!ctx.scheduler) return null;

    const attempt = (señalNueva ? 0 : job.attempt) + 1;
    const startedSeq = job.requestedSeq;
    const leaseToken = leaseTokenFor({ generation: job.generation, startedSeq, attempt });

    // La vigilancia se agenda ANTES que el trabajo: si algo de esto rechaza, la
    // transacción entera se deshace y no queda un intento a medio consumir.
    const watchdogId = await ctx.scheduler.runAfter(reconcileWatchdogDelayMs(attempt), runJobRef, {
      jobId
    });
    await ctx.scheduler.runAfter(0, reconcileRef, {
      clerkUserId: job.clerkUserId,
      trigger: job.trigger,
      jobId,
      lease: leaseToken
    });
    await ctx.db.patch(jobId, {
      attempt,
      startedSeq,
      leaseToken,
      watchdogId: String(watchdogId),
      nextCheckAt: now + reconcileWatchdogDelayMs(attempt),
      updatedAt: now
    });
    return null;
  }
});

/**
 * ¿El lease de esta corrida sigue siendo el vigente?
 *
 * La action lo consulta ANTES de tocar la red y otra vez ANTES de proyectar.
 * Verifica las cuatro cosas a la vez: el trabajo existe y sigue abierto, es de
 * esta cuenta, la cuenta todavía existe, y la corrida sigue siendo la dueña.
 */
export const reconcileLeaseIsCurrent = internalQuery({
  args: { jobId: v.id("reconcileJobs"), clerkUserId: v.string(), lease: v.string() },
  returns: v.boolean(),
  handler: async (
    ctx: any,
    { jobId, clerkUserId, lease }: { jobId: any; clerkUserId: string; lease: string }
  ) => {
    const job = await ctx.db.get(jobId);
    if (!leaseOwnsJob(job, clerkUserId, lease)) return false;
    const user = await findUserByClerkId(ctx, clerkUserId);
    return Boolean(user);
  }
});

/**
 * ¿Esta corrida sigue siendo la dueña del trabajo, y su señal la vigente?
 *
 * Las dos preguntas juntas, porque separadas dejaban pasar el caso peligroso:
 * con `requestedSeq: 2` y `startedSeq: 1`, el lease `1:1:1` seguía siendo el
 * del trabajo y la validación decía "sí" — pero el snapshot que esa corrida
 * traía era ANTERIOR al webhook que subió la señal.
 */
function leaseOwnsJob(job: any, clerkUserId: string, lease: string): boolean {
  if (!job || job.status !== "pending") return false;
  if (job.clerkUserId !== clerkUserId) return false;
  return job.leaseToken === lease;
}

function snapshotIsCurrent(job: any): boolean {
  return job.requestedSeq === job.startedSeq;
}

/**
 * Cierra el trabajo, o adelanta su próximo intento.
 *
 * Es lo ÚNICO que la action puede hacerle al trabajo durable, y sólo si su
 * lease sigue siendo el vigente. Un resultado tardío no liquida nada y —esto es
 * lo que importa— tampoco cancela el watchdog de la corrida nueva.
 */
export const settleReconcileJob = internalMutation({
  args: {
    jobId: v.id("reconcileJobs"),
    clerkUserId: v.string(),
    lease: v.string(),
    result: v.union(v.literal("settled"), v.literal("retry")),
    outcome: v.optional(v.string())
  },
  returns: v.null(),
  handler: async (
    ctx: any,
    {
      jobId,
      clerkUserId,
      lease,
      result,
      outcome
    }: {
      jobId: any;
      clerkUserId: string;
      lease: string;
      result: "settled" | "retry";
      outcome?: string;
    }
  ) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "pending") return null;
    if (job.clerkUserId !== clerkUserId) return null;
    // Lease viejo: esta respuesta es de una corrida que ya fue reemplazada.
    if (job.leaseToken !== lease) return null;

    const now = Date.now();
    const cancelarWatchdog = async () => {
      if (!job.watchdogId || typeof ctx.scheduler?.cancel !== "function") return;
      try {
        await ctx.scheduler.cancel(job.watchdogId);
      } catch {
        /* ya corrió, ya se canceló, o el scheduler no lo conoce */
      }
    };

    // Llegó una señal nueva mientras esta corrida leía: su snapshot ya es
    // viejo. No liquida — dispara otra corrida ya mismo.
    if (job.requestedSeq > job.startedSeq) {
      if (!ctx.scheduler) return null;
      const watchdogId = await ctx.scheduler.runAfter(0, runJobRef, { jobId });
      await cancelarWatchdog();
      await ctx.db.patch(jobId, {
        // Los intentos se reinician con la señal nueva.
        attempt: 0,
        leaseToken: undefined,
        watchdogId: String(watchdogId),
        nextCheckAt: now,
        updatedAt: now
      });
      return null;
    }

    if (result === "settled") {
      await cancelarWatchdog();
      await ctx.db.patch(jobId, {
        status: "settled",
        outcome,
        leaseToken: undefined,
        watchdogId: undefined,
        nextCheckAt: undefined,
        updatedAt: now
      });
      return null;
    }

    if (!hasReconcileAttemptsLeft(job.attempt)) {
      await cancelarWatchdog();
      await ctx.db.patch(jobId, {
        status: "settled",
        outcome: "exhausted",
        leaseToken: undefined,
        watchdogId: undefined,
        nextCheckAt: undefined,
        updatedAt: now
      });
      return null;
    }
    if (!ctx.scheduler) return null;
    // Fallo transitorio ya reportado: no hace falta esperar al watchdog largo.
    const delayMs = reconcileRetryDelayMs(job.attempt);
    const watchdogId = await ctx.scheduler.runAfter(delayMs, runJobRef, { jobId });
    await cancelarWatchdog();
    await ctx.db.patch(jobId, {
      leaseToken: undefined,
      watchdogId: String(watchdogId),
      nextCheckAt: now + delayMs,
      outcome,
      updatedAt: now
    });
    return null;
  }
});

/**
 * Lectura autoritativa contra RevenueCat.
 *
 * Interna y **siempre** dentro de un trabajo durable: `jobId` y `lease` son
 * obligatorios. No queda ningún camino público at-most-once.
 */
export const reconcileStoreEntitlement = internalAction({
  args: {
    clerkUserId: v.string(),
    trigger: v.optional(v.string()),
    jobId: v.id("reconcileJobs"),
    lease: v.string()
  },
  returns: v.object({
    status: v.union(
      v.literal("resolved"),
      v.literal("unavailable"),
      v.literal("not_configured"),
      v.literal("stale")
    )
  }),
  handler: async (
    ctx: any,
    {
      clerkUserId,
      trigger,
      jobId,
      lease
    }: { clerkUserId: string; trigger?: string; jobId: any; lease: string }
  ) => {
    const liquidar = async (result: "settled" | "retry", outcome: string) => {
      await ctx.runMutation(settleJobRef, { jobId, clerkUserId, lease, result, outcome });
    };
    const leaseVigente = async (): Promise<boolean> =>
      await ctx.runQuery(leaseRef, { jobId, clerkUserId, lease });

    // ANTES de la red: el trabajo, la cuenta y el lease tienen que seguir
    // vigentes. Tras un borrado de cuenta, una action ya agendada sale por acá
    // sin consultar RevenueCat.
    if (!(await leaseVigente())) return { status: "stale" as const };

    const secret = process.env.REVENUECAT_SECRET_API_KEY;
    // Sin credencial no se inventa nada: el acceso queda como está. Y no se
    // reintenta: la próxima corrida encuentra exactamente la misma ausencia.
    if (!secret) {
      await liquidar("settled", "not_configured");
      return { status: "not_configured" as const };
    }

    let outcome: RevenueCatReconcileOutcome;
    // Una lectura colgada no puede quedarse con el job: se corta sola.
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), RECONCILE_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(revenueCatSubscriberUrl(clerkUserId), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: "application/json"
        },
        signal: abort.signal
      });
      // Un cuerpo que no es JSON se trata como shape inválida, no como vacío.
      const body = await response.json().catch(() => null);
      // La identidad se valida DENTRO del intérprete, contra la cuenta que se
      // pidió: `GET /subscribers/B` puede devolver el CustomerInfo de A.
      outcome = interpretRevenueCatSubscriber(response.status, body, {
        expectedAppUserId: clerkUserId
      });
    } catch (error) {
      // Nunca se registra el error crudo: puede arrastrar la URL con el id.
      outcome = {
        kind: "unavailable",
        reason: (error as { name?: string })?.name === "AbortError" ? "timeout" : "network_error"
      };
    } finally {
      clearTimeout(timeout);
    }

    // Proyección y validación en la MISMA transacción.
    //
    // Antes esto eran dos pasos: un query que confirmaba el lease y, después,
    // una mutation de proyección que no sabía nada del trabajo. Entre los dos
    // cabía un webhook nuevo, y el snapshot ya viejo mutaba el acceso igual.
    // Ahora la mutation vuelve a mirar el trabajo con la fila tomada: si el
    // lease dejó de ser nuestro o la señal avanzó, no toca nada y lo dice.
    //
    // Si esto tira, la action muere sin liquidar y el watchdog la recupera.
    const proyeccion = await ctx.runMutation(projectResultRef, {
      jobId,
      clerkUserId,
      lease,
      outcome,
      trigger: trigger ?? "unknown"
    });

    if (proyeccion.status === "stale") {
      // El snapshot quedó viejo. Se liquida con el lease que TODAVÍA es nuestro
      // para que `settleReconcileJob` vea la señal nueva y adelante la próxima
      // corrida ya mismo, en vez de dejarla esperando al watchdog largo. Si el
      // lease ya no es nuestro, `settle` no hace nada y el dueño real sigue.
      await liquidar("retry", "superseded_by_new_signal");
      return { status: "stale" as const };
    }

    if (outcome.kind === "resolved") {
      await liquidar("settled", "resolved");
      return { status: "resolved" as const };
    }
    await liquidar(isRetryableReconcileReason(outcome.reason) ? "retry" : "settled", outcome.reason);
    return { status: "unavailable" as const };
  }
});

type SubscriptionRowDoc = Record<string, any> & { _id: unknown };

/** Filas que este alcance autoriza a apagar. Nunca incluye otros proveedores. */
function revocationTargets(
  rows: SubscriptionRowDoc[],
  revocation: RevenueCatRevocationScope
): SubscriptionRowDoc[] {
  if (revocation.kind === "environment") {
    return rows.filter((row) => row.environment === revocation.environment);
  }
  if (revocation.kind === "global") return rows;
  return [];
}

/**
 * Qué se le escribe a UNA fila que el alcance autorizó a apagar.
 *
 * `null` = esta fila no se toca.
 *
 * **Un acceso permanente NUNCA se retira desde la REST.** La v1 no documenta un
 * campo de reembolso en `non_subscriptions`, así que cualquier "evidencia" que
 * se construyera ahí saldría de un campo inventado. Un lifetime sólo puede caer
 * por un webhook de reembolso del MISMO producto. La ausencia en una lectura no
 * es un reembolso: es una ausencia.
 */
function revocationPatchFor(
  row: SubscriptionRowDoc,
  patch: Record<string, unknown>
): Record<string, unknown> | null {
  return row.isLifetime === true ? null : patch;
}

/**
 * Qué se le escribe a una fila que la lectura vuelve a poner en Pro.
 *
 * Una concesión también puede DEGRADAR: si la persona tiene un lifetime legado
 * y además un mensual vigente, `entitlements.orbita_pro.product_identifier`
 * nombra el mensual, y proyectarlo tal cual escribiría `isLifetime: false`
 * encima del acceso permanente. Se aplica el resto del patch —estado, fecha,
 * renovación— y se preservan los tres campos que identifican lo permanente.
 */
function grantPatchFor(
  existing: SubscriptionRowDoc | undefined,
  patch: Record<string, unknown>
): Record<string, unknown> {
  if (existing?.isLifetime !== true) return patch;
  if (patch.isLifetime === true && patch.productId === existing.productId) return patch;

  const preserved = { ...patch };
  delete preserved.isLifetime;
  delete preserved.plan;
  delete preserved.productId;
  return preserved;
}

/**
 * Proyecta la lectura sobre las filas de RevenueCat del usuario.
 *
 * Idempotente por construcción: la proyección es un `patch` con el estado
 * completo, no un delta. Correrla dos veces con la misma lectura deja la misma
 * fila.
 *
 * La identidad real de una fila de la tienda es (usuario, proveedor, ENTORNO):
 * una cuenta de review puede tener una fila `production` y otra `sandbox` a la
 * vez y conviven. Conceder toca UNA —la del entorno demostrado—; revocar toca
 * las que el alcance de la lectura autorice, y nunca un permanente.
 */
export const projectRevenueCatSubscriber = internalMutation({
  args: {
    clerkUserId: v.string(),
    outcome: reconcileOutcomeValidator,
    trigger: v.optional(v.string())
  },
  returns: v.null(),
  handler: async (ctx: any, args: any) => await applyProjection(ctx, args)
});

/**
 * Proyecta SÓLO si esta corrida sigue siendo la dueña del trabajo **y** su
 * snapshot sigue siendo el vigente — todo dentro de la misma transacción.
 *
 * ## El agujero que cierra
 *
 * La action validaba el lease con un query y después proyectaba con otra
 * mutation. Entre las dos cabía un webhook: `enqueueStoreReconcile` subía
 * `requestedSeq` sin tocar el lease, así que la corrida vieja seguía siendo
 * "dueña" y su snapshot —anterior a ese webhook— mutaba el acceso igual. Y aun
 * comprobando la señal en el query, quedaba la ventana entre el query y la
 * mutation.
 *
 * Devuelve un resultado EXPLÍCITO para que la action sepa qué pasó: con
 * `stale` no toca nada y liquida pidiendo reintento, lo que hace que
 * `settleReconcileJob` adelante la señal nueva en el acto en vez de dejarla
 * esperando al watchdog.
 */
export const projectReconcileResult = internalMutation({
  args: {
    jobId: v.id("reconcileJobs"),
    clerkUserId: v.string(),
    lease: v.string(),
    outcome: reconcileOutcomeValidator,
    trigger: v.optional(v.string())
  },
  returns: v.object({ status: v.union(v.literal("applied"), v.literal("stale")) }),
  handler: async (ctx: any, { jobId, clerkUserId, lease, outcome, trigger }: any) => {
    const job = await ctx.db.get(jobId);
    if (!leaseOwnsJob(job, clerkUserId, lease)) return { status: "stale" as const };
    // Señal nueva mientras esta corrida leía: su snapshot describe un momento
    // anterior al webhook que la subió. No puede tocar el acceso.
    if (!snapshotIsCurrent(job)) return { status: "stale" as const };
    // La cuenta pudo borrarse entre el disparo y esta transacción.
    if (!(await findUserByClerkId(ctx, clerkUserId))) return { status: "stale" as const };

    await applyProjection(ctx, { clerkUserId, outcome, trigger });
    return { status: "applied" as const };
  }
});

/**
 * El cuerpo de la proyección, compartido por las dos entradas.
 *
 * No conoce el trabajo durable a propósito: quien decide si esta observación
 * puede tocar el acceso es `projectReconcileResult`, en su transacción.
 */
async function applyProjection(
  ctx: any,
  { clerkUserId, outcome, trigger }: { clerkUserId: string; outcome: any; trigger?: string }
): Promise<null> {
  {
    // Forma DESCONOCIDA (llegó por un camino interno que no pasó por el
    // validador): no concede, no revoca y tampoco audita algo que no se
    // entiende. Salida segura y silenciosa — nunca una excepción que tumbe la
    // proyección y deje el trabajo durable sin liquidar.
    const kind = outcome?.kind;
    if (kind !== "resolved" && kind !== "unavailable") return null;

    const user = await findUserByClerkId(ctx, clerkUserId);
    // El usuario todavía no existe localmente —o ya no existe—: no hay dónde
    // proyectar y tampoco hay acceso que reparar.
    if (!user) return null;

    const now = Date.now();

    /**
     * Auditoría IDEMPOTENTE de la observación.
     *
     * También audita los `unavailable`: un `subscriber_identity_mismatch` es
     * justo lo que hay que poder ver después, y sin esta fila no dejaba rastro.
     * El resumen no lleva el cuerpo crudo, ni aliases, ni el id del suscriptor.
     */
    const auditar = async (eventId: string) => {
      const yaAuditado = await ctx.db
        .query("paymentEvents")
        .withIndex("by_provider_eventId", (q: any) =>
          q.eq("provider", "revenuecat").eq("eventId", eventId)
        )
        .first();
      if (yaAuditado) return null;
      await ctx.db.insert(
        "paymentEvents",
        omitUndefined({
          provider: "revenuecat" as const,
          eventId,
          eventType: "RECONCILE",
          clerkUserId: user.clerkUserId,
          rawPayload: summarizeReconciliation(outcome, trigger ?? "unknown"),
          processedAt: now
        })
      );
      return null;
    };

    // Una respuesta que no se entiende no concede ni revoca. Se audita igual, y
    // con un id propio para no colisionar con una observación resuelta.
    if (outcome.kind !== "resolved") {
      const motivo = typeof outcome.reason === "string" && outcome.reason ? outcome.reason : "unknown";
      return await auditar(`reconcile-unavailable:${user.clerkUserId}:${now}:${motivo}`);
    }

    // Segunda barrera de identidad: SÓLO el id exacto de la cuenta consultada.
    // Un id anónimo tampoco vale — el cliente es custom-ID-only y el mismo id
    // anónimo puede estar aliased a dos cuentas de Clerk.
    if (typeof outcome.subscriberId === "string" && outcome.subscriberId !== clerkUserId) {
      return null;
    }

    const revenueCatRows: SubscriptionRowDoc[] = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_provider", (q: any) =>
        q.eq("userId", user._id).eq("provider", "revenuecat")
      )
      .collect();

    const observedAt: number = outcome.observedAt ?? now;
    const patch: Record<string, unknown> = { ...(outcome.patch ?? {}) };
    const revocation: RevenueCatRevocationScope = outcome.revocation ?? { kind: "none" };
    const eventId = `reconcile:${user.clerkUserId}:${observedAt}`;

    const base: Record<string, unknown> = {
      userId: user._id,
      clerkUserId: user.clerkUserId,
      provider: "revenuecat" as const,
      providerCustomerId: user.clerkUserId,
      lastEventAt: observedAt,
      updatedAt: now
    };

    // -----------------------------------------------------------------
    // CONCESIÓN
    // -----------------------------------------------------------------
    // Sólo el entitlement canónico concede. Un patch SIN `entitlement` no dice
    // nada sobre el acceso y no puede leerse como un sí.
    if (patch.entitlement === PRO_ENTITLEMENT) {
      if (!outcome.environment) return await auditar(eventId);
      if (!isRevenueCatEnvironmentAllowed(outcome.environment, { clerkUserId })) {
        return await auditar(eventId);
      }

      const existing = revenueCatRows.find((row) => row.environment === outcome.environment);
      // Un webhook más nuevo ya contó una verdad posterior a esta lectura.
      if (existing?.lastEventAt && observedAt < existing.lastEventAt) return await auditar(eventId);

      const fields: Record<string, unknown> = {
        ...base,
        environment: outcome.environment,
        ...grantPatchFor(existing, patch)
      };
      if (existing) await ctx.db.patch(existing._id, omitUndefined(fields));
      else await ctx.db.insert("subscriptions", omitUndefined(fields));
      return await auditar(eventId);
    }

    // -----------------------------------------------------------------
    // REVOCACIÓN
    // -----------------------------------------------------------------
    if (patch.entitlement === "free") {
      for (const row of revocationTargets(revenueCatRows, revocation)) {
        if (row.lastEventAt && observedAt < row.lastEventAt) continue;
        const rowPatch = revocationPatchFor(row, patch);
        if (!rowPatch) continue;
        const fields: Record<string, unknown> = {
          ...base,
          environment: row.environment,
          ...rowPatch
        };
        await ctx.db.patch(row._id, omitUndefined(fields));
      }
      // Revocar nunca crea una fila: sin fila previa no hay acceso que apagar.
      return await auditar(eventId);
    }

    // Un patch sin entitlement no concede ni revoca. Queda auditado igual.
    return await auditar(eventId);
  }
  return null;
}
