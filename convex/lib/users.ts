import { makeFunctionReference, type UserIdentity } from "convex/server";
import { assertIdentityNotDeletionFenced } from "./accountDeletion";
import { userFieldsFromIdentity } from "./orbita";
import { recordBackendProductEvent } from "./productAnalytics";

/** Exported so callers that compose helpers (auth + deletion) can name it. */
export type ConvexCtx = {
  auth: {
    getUserIdentity(): Promise<UserIdentity | null>;
  };
  db: any;
  /**
   * Sólo lo traen las mutations. Es opcional a propósito: este mismo tipo lo
   * comparten los helpers de lectura (`findCurrentUser`, `requireExistingUser`),
   * que corren en queries y no pueden agendar nada.
   */
  scheduler?: {
    runAfter(delayMs: number, functionReference: any, args: any): Promise<unknown>;
  };
};

/**
 * Referencia por nombre, no por `internal.*`: el codegen lo corre Codex y el
 * gate de bindings prohíbe editar `convex/_generated/**` a mano. Es el mismo
 * recurso que ya usan `users.ts` y `payments/revenuecatRest`.
 */
export const SEND_SIGNUP_REF_NAME = "coreControl:sendSignup";
const sendSignupRef = makeFunctionReference<"action">(SEND_SIGNUP_REF_NAME);

export function omitUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

export async function requireIdentity(ctx: ConvexCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required");
  }

  return identity;
}

export async function findUserByTokenIdentifier(ctx: ConvexCtx, tokenIdentifier: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", tokenIdentifier))
    .first();
}

/**
 * Read-only lookup for reactive queries during auth/account transitions.
 *
 * Account deletion removes the Convex user before the native Clerk identity.
 * Queries can therefore rerun briefly with a valid token but no `users` row.
 * That is a normal empty state, not an exceptional one. Mutations/actions must
 * continue using `requireExistingUser`/`requireUser` so writes fail closed.
 */
export async function findCurrentUser(ctx: ConvexCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await findUserByTokenIdentifier(ctx, identity.tokenIdentifier);
}

export async function requireExistingUser(ctx: ConvexCtx) {
  const identity = await requireIdentity(ctx);
  // El token de una cuenta ya borrada sigue siendo válido hasta que expira: un
  // camino de escritura no puede aceptarlo.
  await assertIdentityNotDeletionFenced(ctx, identity.subject);
  const user = await findUserByTokenIdentifier(ctx, identity.tokenIdentifier);
  if (!user) {
    throw new Error("User record not found");
  }

  return user;
}

export async function getOrCreateUser(ctx: ConvexCtx) {
  const identity = await requireIdentity(ctx);
  /**
   * El fence, ANTES de cualquier `insert`/`patch`.
   *
   * Éste es exactamente el camino que resucitaba la cuenta: `deleteAccountV2`
   * barría, y una llamada autenticada posterior —otro dispositivo, otra
   * pestaña, el retry tardío de `ensureUser`— volvía a crear `users` y su
   * `account_created` con el mismo token viejo.
   */
  await assertIdentityNotDeletionFenced(ctx, identity.subject);
  const now = Date.now();
  const fields = omitUndefined(userFieldsFromIdentity(identity, now));
  const existing = await findUserByTokenIdentifier(ctx, identity.tokenIdentifier);

  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return { ...existing, ...fields };
  }

  const userId = await ctx.db.insert(
    "users",
    omitUndefined({
      ...fields,
      locale: "es-AR",
      createdAt: now,
      updatedAt: now
    })
  );

  await recordBackendProductEvent(ctx, {
    eventName: "account_created",
    userId,
    dedupeKey: String(userId),
    occurredAt: now
  });

  /**
   * El aviso de alta a core-control se agenda ACÁ, pegado al único `insert` que
   * crea una cuenta.
   *
   * Colgarlo de `users.getOrCreateCurrentUser` dejaba altas sin aviso: veintitrés
   * mutations llegan a este helper por `requireUser`, y `onboarding.saveDraft`
   * lo llama directo. Si cualquiera de ellas insertaba la fila primero, el
   * `ensureUser` posterior ya encontraba la cuenta creada y no avisaba nunca.
   *
   * Sólo viaja el `userId`. El email se lee recién dentro de la action, así que
   * no queda escrito en los argumentos del trabajo agendado, que Convex sí
   * persiste.
   */
  await ctx.scheduler?.runAfter(0, sendSignupRef, { userId });

  return await ctx.db.get(userId);
}

export async function requireUser(ctx: ConvexCtx) {
  const user = await getOrCreateUser(ctx);
  if (!user) {
    throw new Error("Unable to load user");
  }

  return user;
}
