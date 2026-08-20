/**
 * P1 — la cuenta no puede resucitar después de borrarla.
 *
 * `deleteAccountV2(A)` barre la cuenta, pero el JWT de Clerk sigue siendo
 * válido: la identidad se borra después, desde el cliente. En esa ventana
 * cualquier llamada autenticada volvía a entrar por `getOrCreateUser` y
 * **recreaba** la fila `users` con su `account_created`. Lo dispara otro
 * dispositivo, otra pestaña, o el retry tardío de `ensureUser` que ya estaba en
 * vuelo — ninguno de los cuales ve el `cancelled` del cliente.
 *
 * Las pruebas corren contra las funciones REALES con la DB en memoria: lo que
 * se mide es lo que queda escrito.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  ACCOUNT_DELETION_FENCED,
  assertIdentityNotDeletionFenced,
  deleteAccountData,
  deletionIdentityKey,
  FENCE_KEY_VERSION,
  insertDeletionFence,
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

const IDENTIDAD_B = {
  subject: "user_2zzzYYYxxxWWWvvv",
  tokenIdentifier: "https://clerk.dev|user_2zzzYYYxxxWWWvvv",
  email: "a@orbita.test", // MISMO email, subject nuevo: es un alta distinta
  givenName: "Ana"
};

/** El ctx que usan los helpers: auth + db, como en producción. */
function contexto(memoria: MemoryDb, identity: typeof IDENTIDAD_A | null) {
  return {
    auth: { getUserIdentity: async () => identity },
    db: memoria.db
  } as any;
}

/**
 * Lo que hace `deleteAccountV2` adentro de UNA mutation: fence primero, barrida
 * después. Se replica acá porque el handler de Convex no se puede invocar
 * suelto; los dos pasos son los reales.
 */
async function borrarCuenta(memoria: MemoryDb, identity: typeof IDENTIDAD_A) {
  const ctx = contexto(memoria, identity);
  await insertDeletionFence(ctx, identity.subject);
  const user = await findUserByTokenIdentifier(ctx, identity.tokenIdentifier);
  await deleteAccountData(ctx, {
    userId: user?._id,
    clerkUserIds: user ? [identity.subject, user.clerkUserId] : [identity.subject]
  });
  return { deleted: true as const };
}

describe("fence de supresión — la cuenta borrada no vuelve", () => {
  it("ensure → delete: la cuenta queda vacía", async () => {
    const memoria = createMemoryDb();
    const creado = await getOrCreateUser(contexto(memoria, IDENTIDAD_A));
    assert.ok(creado, "la primera vez sí se crea");
    assert.equal(memoria.rows("users").length, 1);
    assert.equal(memoria.rows("productEvents").length, 1);

    await borrarCuenta(memoria, IDENTIDAD_A);
    assert.equal(memoria.rows("users").length, 0);
    assert.equal(memoria.rows("productEvents").length, 0);
  });

  it("REPRO delete → ensure: se rechaza y NO se recrea nada", async () => {
    const memoria = createMemoryDb();
    await getOrCreateUser(contexto(memoria, IDENTIDAD_A));
    await borrarCuenta(memoria, IDENTIDAD_A);

    // El token de A sigue siendo válido: otra pestaña, otro dispositivo o un
    // retry tardío llaman con la MISMA identidad.
    await assert.rejects(
      () => getOrCreateUser(contexto(memoria, IDENTIDAD_A)),
      new RegExp(ACCOUNT_DELETION_FENCED)
    );
    assert.equal(memoria.rows("users").length, 0, "cero users recreados");
    assert.equal(memoria.rows("productEvents").length, 0, "cero account_created");
  });

  it("el retry de la eliminación es idempotente: un solo fence, sigue vacío", async () => {
    const memoria = createMemoryDb();
    await getOrCreateUser(contexto(memoria, IDENTIDAD_A));

    assert.deepEqual(await borrarCuenta(memoria, IDENTIDAD_A), { deleted: true });
    assert.deepEqual(await borrarCuenta(memoria, IDENTIDAD_A), { deleted: true });

    assert.equal(memoria.rows("accountDeletionFences").length, 1, "un solo fence");
    assert.equal(memoria.rows("users").length, 0);
  });

  it("un `expectedClerkUserId` que no coincide NO crea fence ni borra", async () => {
    const memoria = createMemoryDb();
    await getOrCreateUser(contexto(memoria, IDENTIDAD_A));

    // El handler compara ANTES de tocar nada: sin coincidencia, ni fence.
    const users = readFileSync(join(ROOT, "convex/users.ts"), "utf8");
    const v2 = users.slice(users.indexOf("export const deleteAccountV2"));
    const chequeo = v2.indexOf("identity.subject !== expected");
    const fence = v2.indexOf("insertDeletionFence(");
    const barrida = v2.indexOf("deleteAuthenticatedAccount(");
    assert.ok(chequeo > 0 && fence > chequeo, "el mismatch corta antes del fence");
    assert.ok(fence < barrida, "y el fence va antes de la barrida, en la MISMA mutation");

    // La cuenta sigue entera.
    assert.equal(memoria.rows("users").length, 1);
    assert.equal(memoria.rows("accountDeletionFences").length, 0);
  });

  it("el mismo email con un subject NUEVO entra sin problema", async () => {
    const memoria = createMemoryDb();
    await getOrCreateUser(contexto(memoria, IDENTIDAD_A));
    await borrarCuenta(memoria, IDENTIDAD_A);

    // Alta nueva en Clerk: otro `subject`, aunque sea la misma persona y el
    // mismo email. El fence es por identidad, no por persona.
    const nuevo = await getOrCreateUser(contexto(memoria, IDENTIDAD_B));
    assert.ok(nuevo);
    assert.equal(memoria.rows("users").length, 1);
    assert.equal(memoria.rows("users")[0].clerkUserId, IDENTIDAD_B.subject);
  });

  it("la fila del fence NO guarda ningún identificador en crudo", async () => {
    const memoria = createMemoryDb();
    await insertDeletionFence(contexto(memoria, IDENTIDAD_A), IDENTIDAD_A.subject);
    const [fila] = memoria.rows("accountDeletionFences");
    assert.deepEqual(
      Object.keys(fila).filter((k) => !k.startsWith("_")).sort(),
      ["createdAt", "identityKey", "keyVersion"]
    );
    assert.equal(fila.keyVersion, FENCE_KEY_VERSION);
    const serializada = JSON.stringify(fila);
    for (const crudo of [
      IDENTIDAD_A.subject,
      IDENTIDAD_A.tokenIdentifier,
      IDENTIDAD_A.email,
      IDENTIDAD_A.givenName
    ]) {
      assert.equal(serializada.includes(crudo), false, `${crudo} no puede quedar en el fence`);
    }
  });

  it("la clave usa SHA-256 de WebCrypto, no `stableInputHash`", async () => {
    const clave = await deletionIdentityKey(IDENTIDAD_A.subject);
    // 32 bytes en hex: es un digest real, no un hash de 64 bits de caché.
    assert.match(clave, /^[0-9a-f]{64}$/);
    // Determinista y distinta por subject.
    assert.equal(clave, await deletionIdentityKey(IDENTIDAD_A.subject));
    assert.notEqual(clave, await deletionIdentityKey(IDENTIDAD_B.subject));
    // Y con separación de dominio: no es el hash pelado del subject.
    const pelado = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(IDENTIDAD_A.subject))
      )
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    assert.notEqual(clave, pelado);

    const fuente = readFileSync(join(ROOT, "convex/lib/accountDeletion.ts"), "utf8");
    assert.match(fuente, /crypto\.subtle\.digest\("SHA-256"/);
    /**
     * La ausencia se mide sobre el CÓDIGO, no sobre el archivo entero.
     *
     * El comentario de `deletionIdentityKey` nombra `stableInputHash` justamente
     * para explicar por qué NO se usa —un FNV de 64 bits colisiona, y acá una
     * colisión bloquea una cuenta ajena para siempre—. Buscar el nombre en el
     * texto completo daba un falso positivo contra esa explicación. Lo que
     * importa es que no haya import ni llamada.
     */
    const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.equal(
      /stableInputHash/.test(codigo),
      false,
      "un hash de 64 bits colisiona: acá una colisión bloquea una cuenta ajena"
    );
    assert.equal(/from "\.\/stableHash"/.test(fuente), false, "ni siquiera se importa");
    // Y la explicación honesta sigue ahí, en el comentario: clave seudónima, no
    // anonimización, y dicho explícitamente que no es irreversible.
    assert.match(fuente, /NO `stableInputHash`/);
    assert.match(fuente, /clave seudónima de supresión/);
    assert.match(fuente, /No es anonimización/);
    assert.match(fuente, /no es irreversible/);
  });

  it("`assertIdentityNotDeletionFenced` sólo bloquea a la identidad fenced", async () => {
    const memoria = createMemoryDb();
    await insertDeletionFence(contexto(memoria, IDENTIDAD_A), IDENTIDAD_A.subject);
    await assert.rejects(
      () => assertIdentityNotDeletionFenced(contexto(memoria, IDENTIDAD_A), IDENTIDAD_A.subject),
      new RegExp(ACCOUNT_DELETION_FENCED)
    );
    // La otra pasa sin ruido.
    await assertIdentityNotDeletionFenced(contexto(memoria, IDENTIDAD_B), IDENTIDAD_B.subject);
  });

  it("los caminos de ESCRITURA autenticada pasan por el fence", () => {
    const users = readFileSync(join(ROOT, "convex/lib/users.ts"), "utf8");
    for (const helper of ["getOrCreateUser", "requireExistingUser"]) {
      const inicio = users.indexOf(`export async function ${helper}`);
      assert.ok(inicio > 0, `falta ${helper}`);
      const cuerpo = users.slice(inicio, users.indexOf("\n}", inicio));
      assert.match(cuerpo, /assertIdentityNotDeletionFenced\(ctx, identity\.subject\)/, helper);
    }
    // Y en `getOrCreateUser` corre ANTES de cualquier escritura.
    const inicio = users.indexOf("export async function getOrCreateUser");
    const cuerpo = users.slice(inicio, users.indexOf("\n}", inicio));
    const fence = cuerpo.indexOf("assertIdentityNotDeletionFenced");
    const escritura = Math.min(
      ...[cuerpo.indexOf("ctx.db.patch"), cuerpo.indexOf("ctx.db.insert")].filter((i) => i > 0)
    );
    assert.ok(fence < escritura, "el fence va antes del primer patch/insert");
  });

  it("el fence NO se borra con la cuenta ni caduca", () => {
    // La barrida vive en el mismo módulo que el fence, así que la comprobación
    // es sobre el PLAN de borrado y sobre el cuerpo de `deleteAccountData`: la
    // tabla no puede aparecer en ninguno de los dos.
    const fuente = readFileSync(join(ROOT, "convex/lib/accountDeletion.ts"), "utf8");
    const plan = fuente.slice(
      fuente.indexOf("export const USER_SCOPED_DELETION_STEPS"),
      fuente.indexOf("];", fuente.indexOf("export const USER_SCOPED_DELETION_STEPS"))
    );
    assert.equal(
      /accountDeletionFences/.test(plan),
      false,
      "el plan de borrado no puede incluir el fence"
    );
    const barrida = fuente.slice(fuente.indexOf("export async function deleteAccountData"));
    assert.equal(
      /accountDeletionFences/.test(barrida),
      false,
      "la barrida no puede llevarse el fence que acaba de escribir"
    );
    // El sweep no puede aprender la tabla desde el schema tampoco: las tres
    // filas del fence no llevan `userId` ni `clerkUserId` con qué encontrarla.
    assert.equal(USER_SCOPED_DELETION_STEPS.some((paso) => paso.table === "accountDeletionFences"), false);
    // La fila sólo tiene tres campos, y ninguno es una fecha de vencimiento:
    // expirarla reabriría exactamente la ventana del token viejo.
    const schema = readFileSync(join(ROOT, "convex/schema.ts"), "utf8");
    const tabla = schema.slice(
      schema.indexOf("accountDeletionFences: defineTable({"),
      schema.indexOf("by_identityKey")
    );
    assert.match(tabla, /identityKey: v\.string\(\)/);
    assert.match(tabla, /keyVersion: v\.number\(\)/);
    assert.match(tabla, /createdAt: v\.number\(\)/);
    for (const prohibido of ["expiresAt", "clerkUserId", "tokenIdentifier", "email", "userId"]) {
      assert.equal(tabla.includes(prohibido), false, `el fence no puede guardar ${prohibido}`);
    }
  });

  it("el cliente no reintenta `ensureUser` después de cancelar (defensa secundaria)", () => {
    const hook = readFileSync(join(ROOT, "src/hooks/useLiveApp.tsx"), "utf8");
    const bucle = hook.indexOf("for (let i = 0; i < ENSURE_USER_ATTEMPTS; i++)");
    assert.ok(bucle > 0);
    const cuerpo = hook.slice(bucle, hook.indexOf("if (!cancelled) setRowSlot", bucle));
    const corte = cuerpo.indexOf("if (cancelled) return;");
    const llamada = cuerpo.indexOf("await ensureUser({})");
    assert.ok(corte > 0 && corte < llamada, "se corta ANTES de cada intento");
    // Y se dice lo que es: defensa secundaria. El fence es lo que cierra el caso.
    assert.match(cuerpo, /defensa SECUNDARIA/);
  });
});
