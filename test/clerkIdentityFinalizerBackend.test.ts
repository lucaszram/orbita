/**
 * Finalizador durable de identidad en Clerk — lado servidor.
 *
 * ## Qué se prueba acá
 *
 * Que el hecho "hay que borrar esta identidad en Clerk" quede **escrito en la
 * base, en la misma transacción que la barrida**, y que el hecho "Clerk ya la
 * borró" quede asentado de forma que sobreviva a la muerte del proceso.
 *
 * Hoy nada de eso existe: el borrado en Clerk lo dispara el cliente y la única
 * constancia vive en un `useState`. Si el proceso muere entre `deleteUser` ok y
 * el checkpoint, no queda rastro y la persona termina en soporte.
 *
 * Corre contra las funciones REALES con la DB en memoria: lo que se mide es lo
 * que queda escrito, no un doble.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  confirmIdentityDeleted,
  deleteAccountData,
  deletionIdentityKey,
  enqueueIdentityDeletionJob,
  FENCE_KEY_VERSION,
  insertDeletionFence,
  isIdentityDeletionConfirmed,
  USER_SCOPED_DELETION_STEPS
} from "../convex/lib/accountDeletion";
import { findUserByTokenIdentifier, getOrCreateUser } from "../convex/lib/users";
import { createMemoryDb, type MemoryDb } from "./convexMemoryDb";
import { ROOT } from "./moduleGraph";

const IDENTIDAD_A = {
  subject: "user_2abcDEFghiJKLmno",
  tokenIdentifier: "https://clerk.dev|user_2abcDEFghiJKLmno",
  email: "a@orbita.test",
  givenName: "Ana"
};

function contexto(memoria: MemoryDb, identity: typeof IDENTIDAD_A | null) {
  return {
    auth: { getUserIdentity: async () => identity },
    db: memoria.db
  } as any;
}

/**
 * El cuerpo real de `deleteAccountV2`, replicado: el handler de Convex no se
 * puede invocar suelto. Los tres pasos son los de producción y van en el mismo
 * orden y la misma transacción.
 */
async function borrarCuenta(memoria: MemoryDb, identity: typeof IDENTIDAD_A) {
  const ctx = contexto(memoria, identity);
  await insertDeletionFence(ctx, identity.subject);
  await enqueueIdentityDeletionJob(ctx, identity.subject);
  const user = await findUserByTokenIdentifier(ctx, identity.tokenIdentifier);
  await deleteAccountData(ctx, {
    userId: user?._id,
    clerkUserIds: user ? [identity.subject, user.clerkUserId] : [identity.subject]
  });
}

describe("finalizador durable — el trabajo queda escrito con la barrida", () => {
  it("borrar la cuenta deja UN trabajo pendiente para esa identidad", async () => {
    const memoria = createMemoryDb();
    await getOrCreateUser(contexto(memoria, IDENTIDAD_A));
    await borrarCuenta(memoria, IDENTIDAD_A);

    const jobs = memoria.rows("identityDeletionJobs");
    assert.equal(jobs.length, 1, "un trabajo, ni cero ni dos");
    assert.equal(jobs[0].status, "pending");
    assert.equal(jobs[0].attempt, 0);
    assert.equal(
      jobs[0].identityKey,
      await deletionIdentityKey(IDENTIDAD_A.subject),
      "el trabajo apunta al fence que va a promover"
    );
    assert.equal(jobs[0].keyVersion, FENCE_KEY_VERSION);
  });

  it("el trabajo guarda el Clerk id en crudo — no se puede borrar sin nombrarla", async () => {
    // Decisión explícita y acotada: el identificador crudo es TRANSITORIO y vive
    // sólo en esta fila, que se borra al terminar. Lo permanente sigue siendo
    // únicamente la clave seudónima del fence.
    const memoria = createMemoryDb();
    await borrarCuenta(memoria, IDENTIDAD_A);
    assert.equal(memoria.rows("identityDeletionJobs")[0].clerkUserId, IDENTIDAD_A.subject);
  });

  it("REPRO: la barrida NO puede llevarse el trabajo", async () => {
    // Si la barrida borrara esta fila, el trabajo moriría en la misma
    // transacción que lo crea y la identidad de Clerk no se borraría nunca.
    const memoria = createMemoryDb();
    await getOrCreateUser(contexto(memoria, IDENTIDAD_A));
    await borrarCuenta(memoria, IDENTIDAD_A);

    assert.equal(memoria.rows("users").length, 0, "la cuenta sí se barre");
    assert.equal(memoria.rows("identityDeletionJobs").length, 1, "el trabajo sobrevive");
    assert.equal(memoria.rows("accountDeletionFences").length, 1, "el fence también");

    assert.ok(
      !USER_SCOPED_DELETION_STEPS.some((step) => step.table === "identityDeletionJobs"),
      "identityDeletionJobs no puede estar en el plan de barrida"
    );
  });

  it("la mutation REAL encola dentro de la misma transacción", () => {
    // Las pruebas de arriba replican el cuerpo de `deleteAccountV2` porque el
    // handler de Convex no se puede invocar suelto. Sin esta regresión, esa
    // réplica podría encolar mientras la mutation de producción no lo hace, y
    // todo daría verde con el agujero abierto.
    const users = readFileSync(join(ROOT, "convex/users.ts"), "utf8");
    const v2 = users.slice(users.indexOf("export const deleteAccountV2"));
    const chequeo = v2.indexOf("identity.subject !== expected");
    const fence = v2.indexOf("insertDeletionFence(");
    const encolar = v2.indexOf("enqueueIdentityDeletionJob(");
    const barrida = v2.indexOf("deleteAuthenticatedAccount(");

    assert.ok(encolar > 0, "deleteAccountV2 tiene que encolar el borrado de identidad");
    assert.ok(chequeo > 0 && encolar > chequeo, "un mismatch de dueño corta antes de encolar");
    assert.ok(fence < encolar, "el fence primero: encolar sin fence deja la cuenta resucitable");
    assert.ok(encolar < barrida, "y todo antes de la barrida, en la MISMA mutation");
  });

  it("encolar es idempotente: un retry no duplica el trabajo", async () => {
    const memoria = createMemoryDb();
    const ctx = contexto(memoria, IDENTIDAD_A);
    await insertDeletionFence(ctx, IDENTIDAD_A.subject);
    await enqueueIdentityDeletionJob(ctx, IDENTIDAD_A.subject);
    await enqueueIdentityDeletionJob(ctx, IDENTIDAD_A.subject);
    assert.equal(memoria.rows("identityDeletionJobs").length, 1);
  });
});

describe("finalizador durable — el tombstone sobrevive al proceso", () => {
  it("antes de que Clerk confirme, la identidad NO está confirmada", async () => {
    const memoria = createMemoryDb();
    await borrarCuenta(memoria, IDENTIDAD_A);
    assert.equal(
      await isIdentityDeletionConfirmed(contexto(memoria, null), IDENTIDAD_A.subject),
      false,
      "sin confirmación de Clerk no se afirma nada"
    );
  });

  it("cuando Clerk confirma: se promueve el fence y el trabajo se retira", async () => {
    const memoria = createMemoryDb();
    await borrarCuenta(memoria, IDENTIDAD_A);
    const ctx = contexto(memoria, null);

    await confirmIdentityDeleted(ctx, IDENTIDAD_A.subject);

    const fence = memoria.rows("accountDeletionFences")[0];
    assert.equal(typeof fence.identityDeletedAt, "number", "el fence queda con su tombstone");
    assert.equal(
      memoria.rows("identityDeletionJobs").length,
      0,
      "el trabajo se retira, y con él el Clerk id en crudo"
    );
    assert.equal(await isIdentityDeletionConfirmed(ctx, IDENTIDAD_A.subject), true);
  });

  it("confirmar dos veces no rompe ni duplica", async () => {
    const memoria = createMemoryDb();
    await borrarCuenta(memoria, IDENTIDAD_A);
    const ctx = contexto(memoria, null);
    await confirmIdentityDeleted(ctx, IDENTIDAD_A.subject);
    const primero = memoria.rows("accountDeletionFences")[0].identityDeletedAt;
    await confirmIdentityDeleted(ctx, IDENTIDAD_A.subject);
    assert.equal(memoria.rows("accountDeletionFences").length, 1);
    assert.equal(
      memoria.rows("accountDeletionFences")[0].identityDeletedAt,
      primero,
      "el primer instante confirmado manda; no se pisa"
    );
  });

  it("una identidad ajena no queda confirmada por arrastre", async () => {
    const memoria = createMemoryDb();
    await borrarCuenta(memoria, IDENTIDAD_A);
    await confirmIdentityDeleted(contexto(memoria, null), IDENTIDAD_A.subject);
    assert.equal(
      await isIdentityDeletionConfirmed(contexto(memoria, null), "user_2zzzYYYxxxWWWvvv"),
      false
    );
  });
});
