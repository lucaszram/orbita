/**
 * Eliminación de cuenta y comercio (B12).
 *
 * Dos huecos: el marcador de compra en vuelo sobrevivía al borrado de la cuenta
 * (y bloqueaba a quien reusara ese Clerk id), y la confirmación no decía que la
 * suscripción de Apple/Stripe **sigue cobrando** hasta que la persona la
 * cancele. Apple es explícito: borrar la cuenta de la app no cancela la
 * suscripción de la App Store.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  finalizePendingDeletionPurge,
  inspectPendingAccountDeletion,
  parsePendingDeletionMarker,
  resolvePendingDeletionBoot,
  runAccountDeletion
} from "../src/domain/accountDeletion";
import { ROOT } from "./moduleGraph";

const NATIVE_COPY = readFileSync(join(ROOT, "src/domain/accountDeletionCopy.ts"), "utf8");
const WEB_COPY = readFileSync(join(ROOT, "src/domain/accountDeletionCopy.web.ts"), "utf8");

/** Purga final cableada como en el hook: registra a quién le borró el guard. */
function purgaDeps(limpiados: string[]) {
  return {
    promoteMarker: async () => undefined,
    clearLocalData: async () => undefined,
    clearAccountSnapshot: async () => undefined,
    clearPurchaseGuard: async (userId: string) => {
      limpiados.push(userId);
    },
    clearMarker: async () => undefined
  };
}

describe("el marcador de compra se borra con la cuenta", () => {
  it("un borrado exitoso limpia el marcador de ESA cuenta (en la purga del boundary)", async () => {
    const limpiados: string[] = [];
    // La pantalla llega hasta el marcador y entrega el control.
    const result = await runAccountDeletion({
      ownerUserId: "user_a",
      markDeletionRequested: async () => undefined
    });
    assert.deepEqual(result, {
      status: "handoff",
      marker: { userId: "user_a", phase: "deletion_requested" }
    });
    assert.deepEqual(limpiados, [], "la pantalla no borra el guard: no es suya esa parte");

    // El boundary termina: identidad borrada, checkpoint, y recién la purga.
    await finalizePendingDeletionPurge(
      { userId: "user_a", phase: "identity_deleted" },
      purgaDeps(limpiados)
    );
    assert.deepEqual(limpiados, ["user_a"]);
  });

  it("la reanudación lo limpia en la PURGA DEL GATE, no en la hidratación", async () => {
    // La hidratación sólo lee: si borrara acá, lo haría antes de saber quién
    // está logueado, y el guard borrado podría ser el de otra cuenta.
    const limpiados: string[] = [];
    const hidratacion = await inspectPendingAccountDeletion({
      readMarker: async () =>
        parsePendingDeletionMarker(JSON.stringify({ userId: "user_a", phase: "identity_deleted" }))
    });
    assert.deepEqual(hidratacion, {
      status: "pending",
      marker: { userId: "user_a", phase: "identity_deleted" }
    });
    assert.deepEqual(limpiados, [], "cero borrados en la hidratación");

    // El gate confirma que la identidad no existe y recién ahí purga.
    assert.equal(
      resolvePendingDeletionBoot({
        marker: hidratacion.marker,
        clerkLoaded: true,
        isSignedIn: false,
        currentUserId: null
      }),
      "purge"
    );
    await finalizePendingDeletionPurge(hidratacion.marker!, purgaDeps(limpiados));
    assert.deepEqual(limpiados, ["user_a"]);
  });

  it("un logout normal NO borra el marcador", async () => {
    // Sin marcador de borrado no hay nada que purgar: cerrar sesión con una
    // compra en el aire tiene que dejarla marcada para cuando la persona vuelva.
    const limpiados: string[] = [];
    const out = await inspectPendingAccountDeletion({
      readMarker: async () => parsePendingDeletionMarker(null)
    });
    assert.deepEqual(out, { status: "none", marker: null });
    assert.deepEqual(limpiados, []);
    assert.equal(resolvePendingDeletionBoot({ marker: out.marker, clerkLoaded: true, isSignedIn: true, currentUserId: "user_a" }), "proceed");
  });

  it("`backend_deleted` todavía no purga: tampoco toca el marcador", async () => {
    const out = await inspectPendingAccountDeletion({
      readMarker: async () =>
        parsePendingDeletionMarker(JSON.stringify({ userId: "user_a", phase: "backend_deleted" }))
    });
    assert.deepEqual(out, {
      status: "pending",
      marker: { userId: "user_a", phase: "backend_deleted" }
    });
    // Con la identidad viva del MISMO dueño, lo que corresponde es terminarla.
    assert.equal(
      resolvePendingDeletionBoot({
        marker: out.marker,
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_a"
      }),
      "finalize-identity"
    );
  });

  it("con la limpieza rota el guard sobrevive Y el marcador no se retira", async () => {
    // El caso comercial: la cuenta ya no existe pero su marcador de compra sigue
    // en disco. Si el borrado del guard falla, el marcador de eliminación tiene
    // que sobrevivir — retirarlo dejaría el guard huérfano y el próximo login con
    // ese Clerk id entraría con el paywall clavado en "Restaurar".
    const limpiados: string[] = [];
    await assert.rejects(
      finalizePendingDeletionPurge(
        { userId: "user_a", phase: "identity_deleted" },
        {
          ...purgaDeps(limpiados),
          clearPurchaseGuard: async () => {
            throw new Error("purchase guard storage down");
          },
          clearMarker: async () => {
            limpiados.push("unmark");
          }
        }
      ),
      /purchase guard/
    );
    assert.deepEqual(limpiados, [], "el marcador de eliminación NO se retira");
  });

  it("la pantalla no puede navegar después del borrado: ya no tiene ese paso", () => {
    // `goToEntry` salía a onboarding con el marcador vivo en disco: cualquier
    // otra cuenta podía entrar ahí mismo.
    const perfil = readFileSync(join(ROOT, "src/screens/PerfilScreen.tsx"), "utf8");
    assert.equal(perfil.includes("goToEntry"), false);
    assert.match(perfil, /publishPendingDeletion\(result\.marker\)/);
  });
});

describe("la advertencia dice que la suscripción sigue cobrando", () => {
  it("la copy nativa pide cancelar la suscripción ANTES de borrar", () => {
    assert.match(NATIVE_COPY, /suscripción/i);
    assert.match(NATIVE_COPY, /no se cancela|sigue|cancelala|cancelá/i);
  });

  it("la copy web dice lo mismo para su canal", () => {
    assert.match(WEB_COPY, /suscripción/i);
  });

  it("ninguna de las dos promete que borrar la cuenta cancela el cobro", () => {
    for (const [nombre, copy] of [["nativa", NATIVE_COPY], ["web", WEB_COPY]] as const) {
      assert.equal(
        /(cancela|cancelamos|damos de baja)\s+(tu|la)\s+suscripci/i.test(copy),
        false,
        `${nombre}: borrar la cuenta no cancela la suscripción de la tienda`
      );
    }
  });
});
