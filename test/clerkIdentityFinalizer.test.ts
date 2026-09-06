import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolvePendingDeletionBoot,
  type PendingDeletionMarker
} from "../src/domain/accountDeletion";

/**
 * # Finalizador durable de identidad en Clerk
 *
 * ## El callejón sin salida que estas pruebas reproducen
 *
 * Hoy el CLIENTE borra la identidad de Clerk, y el hecho "ya la borré" vive en
 * `useState(identityConfirmedFor)` dentro de `PendingDeletionBoundary`. Si
 * `user.delete()` responde ok y el proceso muere ANTES de persistir
 * `identity_deleted`, esa memoria se pierde.
 *
 * Al reiniciar: marcador `backend_deleted`, Clerk cargado, signed-out. La
 * decisión es `needs-owner` — "volvé a entrar con tu cuenta así terminamos" —
 * pero la cuenta **ya no existe**, así que el login no puede funcionar nunca.
 * La persona queda trabada para siempre y la única salida es soporte.
 *
 * `needs-owner` es la decisión CORRECTA mientras nadie pueda probar lo
 * contrario: nunca se infiere el borrado a partir de un `signed-out`. Lo que
 * falta no es cambiar esa regla, es una **prueba durable del servidor**.
 *
 * ## Qué exigen estas pruebas
 *
 * Que `resolvePendingDeletionBoot` acepte esa prueba —el tombstone que el
 * finalizador server-side promueve cuando Clerk confirma— y que la use SÓLO
 * cuando existe de verdad. Sin prueba, todo sigue igual de cerrado que hoy.
 */
describe("finalizador durable — el arranque acepta la prueba del servidor", () => {
  const backendDeleted: PendingDeletionMarker = { userId: "user_1", phase: "backend_deleted" };

  it("REPRO: sin prueba del servidor sigue siendo needs-owner, y eso es un callejón sin salida", () => {
    // Esta es la conducta de HOY y tiene que seguir intacta: un signed-out no
    // demuestra nada. Lo que está mal no es la decisión, es que no haya forma
    // de traer una prueba.
    assert.equal(
      resolvePendingDeletionBoot({
        marker: backendDeleted,
        clerkLoaded: true,
        isSignedIn: false,
        currentUserId: null
      }),
      "needs-owner"
    );
  });

  it("con el tombstone del servidor para ESE dueño, purga en vez de pedir un login imposible", () => {
    assert.equal(
      resolvePendingDeletionBoot({
        marker: backendDeleted,
        clerkLoaded: true,
        isSignedIn: false,
        currentUserId: null,
        // El servidor borró la identidad en Clerk y lo dejó asentado. Esto NO
        // es una inferencia del cliente: es una confirmación persistida.
        identityDeletionConfirmedFor: "user_1"
      }),
      "purge"
    );
  });

  it("un tombstone de OTRO dueño no autoriza nada", () => {
    // Si la prueba no es de quien dice el marcador, no es prueba: purgar acá
    // borraría datos locales de alguien que no pidió nada.
    assert.equal(
      resolvePendingDeletionBoot({
        marker: backendDeleted,
        clerkLoaded: true,
        isSignedIn: false,
        currentUserId: null,
        identityDeletionConfirmedFor: "user_OTRO"
      }),
      "needs-owner"
    );
  });

  it("el tombstone NO puede purgar con una sesión viva del mismo dueño encima", () => {
    // El token todavía publica sesión: es el eco de un JWT que va a caer. Se
    // espera a que caiga, igual que con `identity_deleted`. Purgar con una
    // sesión montada fue un P0 real.
    assert.equal(
      resolvePendingDeletionBoot({
        marker: backendDeleted,
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_1",
        identityDeletionConfirmedFor: "user_1"
      }),
      "wait"
    );
  });

  it("el tombstone NO se mira antes de que Clerk cargue", () => {
    // Nada se decide sin saber quién está logueado: con la sesión de B a medio
    // cargar, purgar borraba los datos locales de B.
    assert.equal(
      resolvePendingDeletionBoot({
        marker: backendDeleted,
        clerkLoaded: false,
        isSignedIn: false,
        identityDeletionConfirmedFor: "user_1"
      }),
      "wait"
    );
  });

  it("un marcador ilegible sigue bloqueando aunque haya tombstone", () => {
    // No se sabe de quién es lo que está escrito: ninguna prueba externa
    // autoriza tocar datos que no se pueden atribuir.
    assert.equal(
      resolvePendingDeletionBoot({
        marker: backendDeleted,
        clerkLoaded: true,
        isSignedIn: false,
        markerUnreadable: true,
        identityDeletionConfirmedFor: "user_1"
      }),
      "blocked"
    );
  });

  it("con la sesión de OTRA cuenta viva, el tombstone no destraba nada", () => {
    assert.equal(
      resolvePendingDeletionBoot({
        marker: backendDeleted,
        clerkLoaded: true,
        isSignedIn: true,
        currentUserId: "user_B",
        identityDeletionConfirmedFor: "user_1"
      }),
      "blocked"
    );
  });
});
