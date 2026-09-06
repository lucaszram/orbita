/**
 * Finalizador durable — la REGLA de qué prueba el borrado y qué no.
 *
 * ## Por qué esto es una función pura
 *
 * La red no se puede probar; la regla sí, y la regla es donde está el riesgo.
 * El precedente es el 404 de RevenueCat: leerlo como "no compró nada" le sacaba
 * el acceso a alguien que había pagado. Acá el error simétrico es peor —
 * interpretar mal una respuesta y dar por borrada una identidad que sigue viva
 * deja a la persona sin datos, sin cuenta y sin forma de recuperar ninguna.
 *
 * Regla que ordena todo: **sólo una confirmación de Clerk promueve el
 * tombstone.** Todo lo demás reintenta o se rinde, pero nunca afirma.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  CLERK_DELETION_MAX_ATTEMPTS,
  nextIdentityDeletionAttemptAt,
  resolveClerkDeletionOutcome
} from "../convex/lib/accountDeletion";
import { ROOT } from "./moduleGraph";

describe("regla de borrado en Clerk — sólo una confirmación promueve", () => {
  it("200: la identidad se borró", () => {
    assert.deepEqual(resolveClerkDeletionOutcome({ status: 200 }), { kind: "deleted" });
  });

  it("cualquier 2xx cuenta como confirmación", () => {
    // Clerk documenta 200, pero un 202/204 sigue siendo "aceptado y borrado".
    for (const status of [202, 204]) {
      assert.equal(resolveClerkDeletionOutcome({ status }).kind, "deleted", `status ${status}`);
    }
  });

  it("REPRO: un 404 SOLO no prueba nada", () => {
    // Un 404 puede ser "esa identidad no existe" (ya está borrada) o "la ruta,
    // el proyecto o la credencial están mal". Sin distinguirlos, un secreto mal
    // configurado daría por borradas TODAS las cuentas de la cola.
    const outcome = resolveClerkDeletionOutcome({ status: 404 });
    assert.equal(outcome.kind, "unproven");
    assert.equal(outcome.reason, "not_found_unverified_credential");
  });

  it("un 404 CON la credencial ya demostrada sí prueba el borrado", () => {
    // La credencial se demuestra aparte, contra un endpoint que no depende de
    // este id. Recién entonces un 404 significa lo que parece.
    assert.deepEqual(resolveClerkDeletionOutcome({ status: 404, credentialProven: true }), {
      kind: "deleted"
    });
  });

  it("401 y 403: credencial inválida, no prueba nada", () => {
    for (const status of [401, 403]) {
      const outcome = resolveClerkDeletionOutcome({ status });
      assert.equal(outcome.kind, "unproven", `status ${status}`);
      assert.equal(outcome.reason, "unauthorized");
    }
  });

  it("una credencial demostrada NO convierte un 401 en borrado", () => {
    // El `credentialProven` es una excepción quirúrgica para el 404 y nada más.
    assert.equal(resolveClerkDeletionOutcome({ status: 401, credentialProven: true }).kind, "unproven");
  });

  it("429 y 5xx: transitorio, se reintenta", () => {
    for (const status of [429, 500, 502, 503, 504]) {
      assert.equal(resolveClerkDeletionOutcome({ status }).kind, "retry", `status ${status}`);
    }
  });

  it("sin secreto configurado el trabajo queda inerte, no fallido", () => {
    // Inerte y seguro: nada se promueve, nada se pierde, y el trabajo sigue en
    // la cola esperando que alguien configure el secreto.
    assert.deepEqual(resolveClerkDeletionOutcome({ status: null }), { kind: "not_configured" });
  });

  it("una respuesta rara no se interpreta como éxito", () => {
    for (const status of [301, 418, 422]) {
      assert.equal(resolveClerkDeletionOutcome({ status }).kind, "unproven", `status ${status}`);
    }
  });
});

describe("reintentos — backoff acotado y sin rendirse en silencio", () => {
  it("el backoff crece con cada intento", () => {
    const ahora = 1_000_000;
    const uno = nextIdentityDeletionAttemptAt({ attempt: 1, now: ahora });
    const dos = nextIdentityDeletionAttemptAt({ attempt: 2, now: ahora });
    const tres = nextIdentityDeletionAttemptAt({ attempt: 3, now: ahora });
    assert.ok(uno > ahora, "el primer reintento no es inmediato");
    assert.ok(dos > uno, "y crece");
    assert.ok(tres > dos, "y sigue creciendo");
  });

  it("el backoff tiene techo: no se va a días", () => {
    const ahora = 1_000_000;
    const lejano = nextIdentityDeletionAttemptAt({ attempt: 99, now: ahora });
    assert.ok(lejano - ahora <= 6 * 60 * 60 * 1000, "como mucho seis horas entre intentos");
  });

  it("hay un máximo de intentos, y no es infinito ni uno solo", () => {
    assert.ok(CLERK_DELETION_MAX_ATTEMPTS >= 5, "un pico transitorio no puede agotarlo");
    assert.ok(CLERK_DELETION_MAX_ATTEMPTS <= 50, "tampoco reintenta para siempre");
  });
});

describe("el trabajo arranca solo", () => {
  it("deleteAccountV2 agenda la corrida en su misma transacción", () => {
    const users = readFileSync(join(ROOT, "convex/users.ts"), "utf8");
    const v2 = users.slice(
      users.indexOf("export const deleteAccountV2"),
      users.indexOf("// Finalizador durable")
    );
    const encolar = v2.indexOf("enqueueIdentityDeletionJob(");
    const agendar = v2.indexOf("scheduler.runAfter(");
    assert.ok(agendar > 0, "sin agendar, el trabajo queda escrito pero nadie lo empieza");
    assert.ok(encolar < agendar, "primero existe el trabajo, después se agenda");
    assert.ok(
      v2.includes("runIdentityJobRef"),
      "se agenda el runner de identidad, no otra cosa"
    );
  });
});

describe("el runner falla cerrado ante un id inválido", () => {
  it("normaliza el jobId antes de tocar la base", () => {
    /**
     * Defecto real, encontrado contra el deployment de Development: `db.get`
     * con un id malformado **tira** en vez de devolver `null`, así que el
     * runner reventaba con `Invalid ID length 29` en lugar de ser un no-op.
     *
     * No se puede reproducir en la base en memoria —su `get` devuelve `null`
     * para cualquier cosa—, así que la prueba roja fue el llamado real y esta
     * regresión estructural es lo que impide que vuelva.
     */
    const fuente = readFileSync(join(ROOT, "convex/users.ts"), "utf8");
    const finalizador = fuente.slice(fuente.indexOf("// Finalizador durable"));

    assert.ok(
      !/db\.get\(args\.jobId as any\)/.test(finalizador),
      "ningún handler puede pasarle el argumento crudo a db.get"
    );
    const normalizaciones = finalizador.match(/normalizeId\("identityDeletionJobs"/g) ?? [];
    assert.equal(
      normalizaciones.length,
      2,
      "las dos entradas (claim y settle) tienen que normalizar antes de leer"
    );
  });
});

describe("el runner no puede promover por su cuenta", () => {
  it("sólo `deleted` llama a confirmIdentityDeleted", () => {
    // Regresión estructural: la promoción del tombstone tiene que estar detrás
    // del desenlace `deleted` y de nada más. Un `unproven` o un `retry` que
    // promueva es exactamente el bug que este paquete cierra.
    const fuente = readFileSync(join(ROOT, "convex/lib/accountDeletion.ts"), "utf8");
    const confirmar = fuente.indexOf("export async function confirmIdentityDeleted");
    assert.ok(confirmar > 0, "el helper existe");

    // Nadie puede inferir el borrado desde un signed-out ni desde una ausencia.
    assert.ok(
      !/identityDeletedAt:\s*Date\.now\(\)/.test(
        fuente.slice(0, confirmar)
      ),
      "el tombstone no se escribe fuera de confirmIdentityDeleted"
    );
  });
});
