import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  commitProfileCreation,
  runSessionAttempts,
  withTimeout,
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

describe("withTimeout — las llamadas Convex encoladas no cuelgan la sesión", () => {
  it("resuelve normal dentro del tope", async () => {
    const value = await withTimeout(Promise.resolve("ok"), 50);
    assert.equal(value, "ok");
  });

  it("una promesa que nunca resuelve (mutation encolada) rechaza al vencer el tope", async () => {
    await assert.rejects(
      withTimeout(new Promise(() => undefined), 30),
      /orbita-session-timeout/
    );
  });

  it("propaga el rechazo original si llega antes del tope", async () => {
    await assert.rejects(withTimeout(Promise.reject(new Error("server")), 50), /server/);
  });
});

describe("runSessionAttempts — el presupuesto de la recuperación es ESTRICTO", () => {
  const never = () => new Promise<never>(() => undefined);

  it("intentos que cuelgan: termina en error DENTRO del presupuesto (nunca ~budget+llamada+pausa)", async () => {
    // Con el loop viejo: intento1 (100ms de tope pleno) + pausa (50) +
    // intento2 con tope PLENO (100) ≈ 250ms+. Con presupuesto estricto, el
    // segundo intento queda acotado al restante → total ≤ ~150ms + scheduler.
    const start = Date.now();
    const result = await runSessionAttempts({
      budgetMs: 150,
      callTimeoutMs: 100,
      retryPauseMs: 50,
      attempt: (timebox) => timebox(never())
    });
    const elapsed = Date.now() - start;
    assert.equal(result.status, "error");
    assert.ok(elapsed < 220, `tardó ${elapsed}ms: el presupuesto no es estricto`);
  });

  it("la pausa también queda acotada al restante (no estira el presupuesto)", async () => {
    const start = Date.now();
    const result = await runSessionAttempts({
      budgetMs: 80,
      callTimeoutMs: 60,
      retryPauseMs: 500,
      attempt: () => Promise.reject(new Error("server"))
    });
    const elapsed = Date.now() - start;
    assert.equal(result.status, "error");
    assert.ok(elapsed < 160, `tardó ${elapsed}ms: la pausa no respetó el restante`);
  });

  it("éxito directo → ok con el valor del intento", async () => {
    const result = await runSessionAttempts({
      budgetMs: 200,
      callTimeoutMs: 100,
      retryPauseMs: 10,
      attempt: async (timebox) => {
        const a = await timebox(Promise.resolve("dato"));
        return { a };
      }
    });
    assert.deepEqual(result, { status: "ok", value: { a: "dato" } });
  });

  it("falla transitoria → reintenta dentro del presupuesto y termina ok", async () => {
    let calls = 0;
    const result = await runSessionAttempts({
      budgetMs: 500,
      callTimeoutMs: 100,
      retryPauseMs: 10,
      attempt: async (timebox) => {
        calls += 1;
        if (calls === 1) throw new Error("token todavía no listo");
        return timebox(Promise.resolve("recuperado"));
      }
    });
    assert.equal(calls, 2);
    assert.deepEqual(result, { status: "ok", value: "recuperado" });
  });

  it("ciclo completo estilo hydrate: 1ª llamada lenta pero OK, 2ª colgada, reintento cerca del deadline → corta en el presupuesto", async () => {
    // El caso original: budget=200, tope por llamada=100, pausa=20.
    // Intento 1: la "mutation" resuelve lenta (50ms) y la "query" cuelga →
    //   timebox la corta a los ~100ms (t≈150); pausa 20 → t≈170.
    // Intento 2 arranca cerca del deadline (restante ≈30): su "mutation",
    //   que resolvería a los 50ms, queda acotada al restante y muere ≈200.
    // Con el bug viejo (tope pleno por llamada sin mirar el restante), el
    // intento 2 correría 50 + 100 completos → total ≥ ~320ms.
    const slowOk = <V,>(ms: number, value: V) =>
      new Promise<V>((resolve) => setTimeout(() => resolve(value), ms));
    let attempts = 0;
    let queryStarts = 0;
    const start = Date.now();
    const result = await runSessionAttempts({
      budgetMs: 200,
      callTimeoutMs: 100,
      retryPauseMs: 20,
      attempt: async (timebox) => {
        attempts += 1;
        await timebox(slowOk(50, "user")); // mutation: lenta pero exitosa
        queryStarts += 1;
        await timebox(never()); // query: encolada para siempre
        return "nunca";
      }
    });
    const elapsed = Date.now() - start;
    assert.equal(result.status, "error");
    assert.equal(attempts, 2, "el reintento cerca del deadline debe ocurrir");
    // La query solo se alcanzó en el intento 1: en el 2 la mutation quedó
    // acotada al restante (~30ms) y murió antes de resolver a los 50ms.
    assert.equal(queryStarts, 1, "la mutation del intento 2 no quedó acotada al restante");
    assert.ok(elapsed < 280, `tardó ${elapsed}ms: el límite por llamada no respeta el restante`);
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
