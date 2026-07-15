import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  commitProfileCreation,
  onboardingInputFromBirthData,
  resolveProfileOwnerAtCreation,
  resolveStart,
  shouldAdoptPendingProfile,
  type StartSnapshot
} from "../src/domain/sessionStart";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Base: backend configurado, todo cargado, sin sesión ni perfil. */
function snap(overrides: Partial<StartSnapshot> = {}): StartSnapshot {
  return {
    backendConfigured: true,
    localReady: true,
    hasLocalProfile: false,
    localProfileOwner: "none",
    clerkLoaded: true,
    clerkTimedOut: false,
    isSignedIn: false,
    recovery: "idle",
    hasRemoteBirthData: false,
    ...overrides
  };
}

/** Perfil local PROPIO de la sesión activa. */
const OWNED = { hasLocalProfile: true, localProfileOwner: "current" as const };

describe("resolveStart — arranque nativo (matriz del hotfix build 11)", () => {
  it("storage local sin hidratar → loading", () => {
    assert.equal(resolveStart(snap({ localReady: false })), "loading");
    assert.equal(resolveStart(snap({ localReady: false, hasLocalProfile: true })), "loading");
  });

  it("Clerk cargando → loading, NUNCA entrada/guest", () => {
    assert.equal(resolveStart(snap({ clerkLoaded: false })), "loading");
    assert.equal(resolveStart(snap({ clerkLoaded: false, hasLocalProfile: true })), "loading");
    assert.equal(resolveStart(snap({ clerkLoaded: false, isSignedIn: true })), "loading");
  });

  it("P0: perfil con dueño + Clerk sin resolver + timeout → auth-timeout, NUNCA purge-local (ni limpieza)", () => {
    const decision = resolveStart(
      snap({
        clerkLoaded: false,
        clerkTimedOut: true,
        hasLocalProfile: true,
        localProfileOwner: "other"
      })
    );
    assert.equal(decision, "auth-timeout");
    // La única decisión que dispara clearLocalData en el arranque es
    // "purge-local"; con timeout no puede ocurrir bajo ninguna combinación.
    assert.notEqual(decision, "purge-local");
  });

  it("timeout de Clerk → pantalla no destructiva con reintento, en todos los casos", () => {
    const timedOut = { clerkLoaded: false, clerkTimedOut: true } as const;
    assert.equal(resolveStart(snap({ ...timedOut })), "auth-timeout");
    assert.equal(resolveStart(snap({ ...timedOut, hasLocalProfile: true })), "auth-timeout");
    assert.equal(
      resolveStart(snap({ ...timedOut, hasLocalProfile: true, localProfileOwner: "current" })),
      "auth-timeout"
    );
    assert.equal(resolveStart(snap({ ...timedOut, isSignedIn: true })), "auth-timeout");
  });

  it("purge-local exige isLoaded REAL: solo con Clerk resuelto y sin sesión", () => {
    // Con Clerk resuelto y sin sesión, el perfil con dueño sí se purga…
    assert.equal(
      resolveStart(snap({ hasLocalProfile: true, localProfileOwner: "other" })),
      "purge-local"
    );
    // …pero jamás mientras Clerk no haya resuelto (con o sin timeout).
    assert.notEqual(
      resolveStart(snap({ clerkLoaded: false, hasLocalProfile: true, localProfileOwner: "other" })),
      "purge-local"
    );
    assert.notEqual(
      resolveStart(
        snap({ clerkLoaded: false, clerkTimedOut: true, hasLocalProfile: true, localProfileOwner: "other" })
      ),
      "purge-local"
    );
  });

  it("signed-in + perfil local PROPIO → Home (live overlay se encarga del resto)", () => {
    assert.equal(resolveStart(snap({ isSignedIn: true, ...OWNED })), "home");
  });

  it("signed-in + perfil local SIN dueño (guest/legado) → reconciliar con Convex, nunca Home directo", () => {
    assert.equal(
      resolveStart(snap({ isSignedIn: true, hasLocalProfile: true, localProfileOwner: "none" })),
      "recover"
    );
  });

  it("signed-in + perfil local de OTRA cuenta → reconciliar con Convex, nunca Home directo", () => {
    assert.equal(
      resolveStart(snap({ isSignedIn: true, hasLocalProfile: true, localProfileOwner: "other" })),
      "recover"
    );
  });

  it("signed-in + perfil ajeno reconciliado: el remoto manda", () => {
    const foreign = { hasLocalProfile: true, localProfileOwner: "other" as const };
    assert.equal(
      resolveStart(snap({ isSignedIn: true, ...foreign, recovery: "done", hasRemoteBirthData: true })),
      "home"
    );
    assert.equal(
      resolveStart(snap({ isSignedIn: true, ...foreign, recovery: "done", hasRemoteBirthData: false })),
      "resume-onboarding"
    );
    assert.equal(
      resolveStart(snap({ isSignedIn: true, ...foreign, recovery: "error" })),
      "recover-error"
    );
  });

  it("signed-in sin perfil local → recuperar cuenta de Convex", () => {
    assert.equal(resolveStart(snap({ isSignedIn: true })), "recover");
    assert.equal(resolveStart(snap({ isSignedIn: true, recovery: "loading" })), "recover");
  });

  it("signed-in + birthData remota recuperada → Home live", () => {
    assert.equal(
      resolveStart(snap({ isSignedIn: true, recovery: "done", hasRemoteBirthData: true })),
      "home"
    );
  });

  it("signed-in sin birthData → continuar el alta (sin crear segunda cuenta)", () => {
    assert.equal(
      resolveStart(snap({ isSignedIn: true, recovery: "done", hasRemoteBirthData: false })),
      "resume-onboarding"
    );
  });

  it("error recuperando la cuenta → reintento, nunca Home ni entrada", () => {
    assert.equal(resolveStart(snap({ isSignedIn: true, recovery: "error" })), "recover-error");
  });

  it("signed-out + perfil guest local (sin dueño) → Home como invitado", () => {
    assert.equal(resolveStart(snap({ hasLocalProfile: true })), "home");
  });

  it("signed-out + perfil CON dueño (logout que no terminó de limpiar) → purgar, nunca mostrarlo", () => {
    assert.equal(
      resolveStart(snap({ hasLocalProfile: true, localProfileOwner: "other" })),
      "purge-local"
    );
  });

  it("signed-out sin perfil → entrada estable (Empezar / Ya tengo cuenta)", () => {
    assert.equal(resolveStart(snap()), "entry");
  });

  it("sin backend configurado → decide solo por el perfil local", () => {
    assert.equal(resolveStart(snap({ backendConfigured: false, hasLocalProfile: true })), "home");
    assert.equal(resolveStart(snap({ backendConfigured: false, clerkLoaded: false })), "entry");
  });

  it("con perfil PROPIO la sesión activa no espera la recuperación", () => {
    assert.equal(
      resolveStart(snap({ isSignedIn: true, ...OWNED, recovery: "error" })),
      "home"
    );
  });
});

describe("carrera post-verify — el perfil termina con el owner correcto", () => {
  it("verificación exitosa + useAuth stale en el render siguiente + userId después → owner correcto", () => {
    // 1. verify() devolvió ok (la sesión ESTÁ activa), pero en el render del
    //    submit useAuth sigue stale: sin userId todavía.
    const atCreation = resolveProfileOwnerAtCreation({ sessionActive: true, knownUserId: null });
    assert.deepEqual(atCreation, { ownerUserId: null, adoptWhenReady: true });

    // 2. Renders intermedios: el userId todavía no llegó → NO adoptar aún.
    assert.equal(
      shouldAdoptPendingProfile({
        adoptionPending: true,
        hasProfile: true,
        profileOwner: null,
        isSignedIn: false,
        userId: null
      }),
      false
    );

    // 3. useAuth publica isSignedIn + userId → la adopción pendiente dispara
    //    y el perfil queda marcado con el dueño correcto.
    assert.equal(
      shouldAdoptPendingProfile({
        adoptionPending: true,
        hasProfile: true,
        profileOwner: null,
        isSignedIn: true,
        userId: "user_abc"
      }),
      true
    );

    // 4. Adoptado (owner seteado, pendiente apagado): no vuelve a disparar.
    assert.equal(
      shouldAdoptPendingProfile({
        adoptionPending: false,
        hasProfile: true,
        profileOwner: "user_abc",
        isSignedIn: true,
        userId: "user_abc"
      }),
      false
    );
  });

  it("userId ya disponible al crear (resume=datos, sesión previa) → owner directo, sin adopción", () => {
    assert.deepEqual(resolveProfileOwnerAtCreation({ sessionActive: true, knownUserId: "user_abc" }), {
      ownerUserId: "user_abc",
      adoptWhenReady: false
    });
  });

  it("guest (sin sesión) → sin dueño y sin adopción pendiente", () => {
    assert.deepEqual(resolveProfileOwnerAtCreation({ sessionActive: false, knownUserId: null }), {
      ownerUserId: null,
      adoptWhenReady: false
    });
  });

  it("la adopción jamás pisa un perfil con dueño ni corre sin perfil", () => {
    assert.equal(
      shouldAdoptPendingProfile({
        adoptionPending: true,
        hasProfile: true,
        profileOwner: "user_otro",
        isSignedIn: true,
        userId: "user_abc"
      }),
      false
    );
    assert.equal(
      shouldAdoptPendingProfile({
        adoptionPending: true,
        hasProfile: false,
        profileOwner: null,
        isSignedIn: true,
        userId: "user_abc"
      }),
      false
    );
  });
});

describe("commitProfileCreation — carrera de escritura con storage demorado", () => {
  it("la escritura inicial termina ANTES de habilitar la adopción: el dueño en disco no se pisa", async () => {
    const disk: { profile: string | null; owner: string | null } = { profile: null, owner: null };
    const writes: string[] = [];
    let adoptionRan = false;

    // Simula el efecto de adopción: dispara EN CUANTO se publica el estado
    // pendiente (userId ya disponible) y escribe el dueño en disco.
    const adoptNow = async () => {
      adoptionRan = true;
      await delay(5);
      disk.owner = "user_abc";
      writes.push("owner=user_abc");
    };

    await commitProfileCreation({
      // Storage demorado: estas escrituras tardan MÁS que la adopción.
      persistProfile: async () => {
        await delay(20);
        disk.profile = "perfil";
        writes.push("profile");
      },
      persistInitialOwner: async () => {
        await delay(20);
        disk.owner = null;
        writes.push("owner=null");
      },
      publishState: () => {
        void adoptNow();
      }
    });
    await delay(40);

    assert.equal(adoptionRan, true);
    // Orden: perfil → dueño inicial → adopción. La escritura inicial jamás
    // corre después de la adopción (antes: memoria bien, disco sin dueño).
    assert.deepEqual(writes, ["profile", "owner=null", "owner=user_abc"]);
    assert.equal(disk.owner, "user_abc");
  });

  it("sin adopción pendiente el orden igual persiste perfil y dueño antes de publicar", async () => {
    const writes: string[] = [];
    let publishedAt = -1;
    await commitProfileCreation({
      persistProfile: async () => {
        await delay(10);
        writes.push("profile");
      },
      persistInitialOwner: async () => {
        await delay(10);
        writes.push("owner");
      },
      publishState: () => {
        publishedAt = writes.length;
      }
    });
    assert.deepEqual(writes, ["profile", "owner"]);
    assert.equal(publishedAt, 2);
  });
});

describe("onboardingInputFromBirthData — birthData Convex → perfil local", () => {
  it("mapea fecha, hora y lugar", () => {
    const input = onboardingInputFromBirthData({
      birthDate: "2002-07-17",
      birthTime: "13:42",
      birthPlaceLabel: "Lomas de Zamora, Buenos Aires, Argentina"
    });
    assert.equal(input.birthDate, "2002-07-17");
    assert.equal(input.birthTime, "13:42");
    assert.equal(input.birthPlace, "Lomas de Zamora, Buenos Aires, Argentina");
    assert.equal(input.name, "Visitante");
    assert.equal(input.notificationTime, "09:00");
  });

  it("hora desconocida queda sin hora", () => {
    const input = onboardingInputFromBirthData({ birthDate: "1996-01-15" });
    assert.equal(input.birthTime, undefined);
  });

  it('"Sin especificar" (placeholder backend) no se muestra como lugar', () => {
    const input = onboardingInputFromBirthData({
      birthDate: "1996-01-15",
      birthPlaceLabel: "Sin especificar"
    });
    assert.equal(input.birthPlace, undefined);
  });
});
