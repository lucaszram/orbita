/**
 * Corte 4 — el cliente trabado puede preguntar si ya está borrada.
 *
 * ## El caso que desbloquea
 *
 * Marcador `backend_deleted`, sin sesión, y el `useState` que sostenía la prueba
 * se perdió con el proceso. El arranque decide `needs-owner` y le pide a la
 * persona entrar con una cuenta que ya no existe. Sin una consulta al servidor,
 * ahí termina todo y la salida es soporte.
 *
 * ## Por qué la consulta es pública
 *
 * Quien pregunta está **sin sesión**: si la identidad se borró, no hay token con
 * qué autenticarse. Por eso la superficie es pública y acotada, y la clave se
 * deriva en el servidor.
 *
 * Su límite, dicho sin maquillaje: el cupo frena el martilleo sobre UN sujeto,
 * **no** una enumeración amplia. Para eso haría falta limitar por origen y Convex
 * no lo expone. Lo que sí sostiene el diseño es que preguntar exige conocer de
 * antemano el `subject` de Clerk — el mismo modelo de amenaza que el fence ya
 * aceptó y documentó.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  confirmIdentityDeleted,
  enqueueIdentityDeletionJob,
  IDENTITY_DELETION_STATUS_COOLDOWN,
  insertDeletionFence,
  resolveIdentityDeletionStatus
} from "../convex/lib/accountDeletion";
import { createMemoryDb, type MemoryDb } from "./convexMemoryDb";
import { ROOT } from "./moduleGraph";

const SUBJECT = "user_2abcDEFghiJKLmno";

function ctxDe(memoria: MemoryDb) {
  return { db: memoria.db } as any;
}

async function cuentaBorrada(memoria: MemoryDb) {
  const ctx = ctxDe(memoria);
  await insertDeletionFence(ctx, SUBJECT);
  await enqueueIdentityDeletionJob(ctx, SUBJECT);
}

describe("consulta del tombstone — sólo dice que sí cuando Clerk confirmó", () => {
  it("con el borrado en curso pero sin confirmar: no confirma", async () => {
    const memoria = createMemoryDb();
    await cuentaBorrada(memoria);
    const estado = await resolveIdentityDeletionStatus(ctxDe(memoria), SUBJECT, Date.now());
    assert.equal(estado.status, "pending", "hay borrado en curso, pero sin prueba");
    assert.equal((estado as any).confirmed, undefined);
  });

  it("después de que Clerk confirma: confirmed", async () => {
    const memoria = createMemoryDb();
    await cuentaBorrada(memoria);
    await confirmIdentityDeleted(ctxDe(memoria), SUBJECT);
    const estado = await resolveIdentityDeletionStatus(ctxDe(memoria), SUBJECT, Date.now());
    assert.equal(estado.status, "confirmed");
  });

  it("una identidad que nunca pidió borrarse no existe para esta consulta", async () => {
    // No se distingue "cuenta viva" de "cuenta que nunca existió": la respuesta
    // es la misma, así que la consulta no sirve para saber si alguien tiene
    // cuenta en Órbita. Sólo responde por identidades ya borradas.
    const memoria = createMemoryDb();
    const estado = await resolveIdentityDeletionStatus(ctxDe(memoria), "user_desconocido", Date.now());
    assert.equal(estado.status, "unknown");
  });

  it("REPRO: martillear la misma identidad se corta por cupo", async () => {
    const memoria = createMemoryDb();
    await cuentaBorrada(memoria);
    const ahora = Date.now();

    let cortado = false;
    for (let i = 0; i < IDENTITY_DELETION_STATUS_COOLDOWN.max + 3; i += 1) {
      const estado = await resolveIdentityDeletionStatus(ctxDe(memoria), SUBJECT, ahora);
      if (estado.status === "rate_limited") {
        cortado = true;
        break;
      }
    }
    assert.ok(cortado, "el cupo tiene que cortar dentro de la ventana");
  });

  it("pasada la ventana, se puede volver a preguntar", async () => {
    const memoria = createMemoryDb();
    await cuentaBorrada(memoria);
    const ahora = Date.now();
    for (let i = 0; i < IDENTITY_DELETION_STATUS_COOLDOWN.max + 1; i += 1) {
      await resolveIdentityDeletionStatus(ctxDe(memoria), SUBJECT, ahora);
    }
    const despues = await resolveIdentityDeletionStatus(
      ctxDe(memoria),
      SUBJECT,
      ahora + IDENTITY_DELETION_STATUS_COOLDOWN.windowMs + 1
    );
    assert.notEqual(despues.status, "rate_limited");
  });

  it("el cupo NO guarda el Clerk id en claro", async () => {
    const memoria = createMemoryDb();
    await cuentaBorrada(memoria);
    await resolveIdentityDeletionStatus(ctxDe(memoria), SUBJECT, Date.now());
    const contadores = memoria.rows("publicRateLimits");
    assert.ok(contadores.length > 0, "se escribió el contador");
    for (const fila of contadores) {
      assert.ok(
        !JSON.stringify(fila).includes(SUBJECT),
        "ninguna fila del cupo puede contener el subject en claro"
      );
    }
  });
});

describe("el boundary usa la prueba del servidor", () => {
  it("PendingDeletionBoundary consulta el tombstone y se lo pasa al arranque", () => {
    const fuente = readFileSync(join(ROOT, "src/components/PendingDeletionBoundary.tsx"), "utf8");
    assert.ok(
      fuente.includes("identityDeletionConfirmedFor"),
      "el boundary tiene que pasarle la prueba durable a resolvePendingDeletionBoot"
    );
    assert.ok(
      /identityDeletionConfirmedFor/.test(
        fuente.slice(fuente.indexOf("resolvePendingDeletionBoot("))
      ),
      "y tiene que ir en la llamada real, no sólo declarada"
    );
  });

  it("el camino rápido del cliente sigue existiendo", () => {
    // Decisión de alcance: el cliente conserva su borrado directo porque es lo
    // que hace que la eliminación se sienta inmediata. El servidor es la red,
    // no el reemplazo. Sacarlo obligaba a reescribir la coreografía que
    // codifican las 88 pruebas de accountDeletionFlow.
    const fuente = readFileSync(join(ROOT, "src/components/PendingDeletionBoundary.tsx"), "utf8");
    assert.ok(
      fuente.includes("identityConfirmedFor"),
      "el checkpoint en memoria sigue, pero ya no es la ÚNICA prueba"
    );
  });
});
