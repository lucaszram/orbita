import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  commitProfileCreation,
  isAccountSwitch,
  mapSignInStartError,
  runSessionAttempts,
  withTimeout,
  onboardingInputFromBirthData,
  resolveFirstFactor,
  resolveProfileOwnerAtCreation,
  resolveSignInDestination,
  resolveStart,
  resolveTabsGuard,
  shouldAdoptPendingProfile,
  shouldOfferSignup,
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
    profileAdoptionPending: false,
    recovery: "idle",
    hasRemoteBirthData: false,
    ...overrides
  };
}

/** Perfil local PROPIO de la sesión activa. */
const OWNED = { hasLocalProfile: true, localProfileOwner: "current" as const };

/** Producto cartesiano de TODOS los estados posibles del snapshot. */
function everySnapshot(): StartSnapshot[] {
  const out: StartSnapshot[] = [];
  for (const backendConfigured of [true, false])
    for (const localReady of [true, false])
      for (const hasLocalProfile of [true, false])
        for (const localProfileOwner of ["none", "current", "other"] as const)
          for (const clerkLoaded of [true, false])
            for (const clerkTimedOut of [true, false])
              for (const isSignedIn of [true, false])
                for (const profileAdoptionPending of [true, false])
                  for (const recovery of ["idle", "loading", "done", "error"] as const)
                    for (const hasRemoteBirthData of [true, false])
                      out.push({
                        backendConfigured,
                        localReady,
                        hasLocalProfile,
                        localProfileOwner,
                        clerkLoaded,
                        clerkTimedOut,
                        isSignedIn,
                        profileAdoptionPending,
                        recovery,
                        hasRemoteBirthData
                      });
  return out;
}

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

  it("P0: perfil con dueño + Clerk sin resolver + timeout → auth-timeout (no destructivo)", () => {
    const decision = resolveStart(
      snap({
        clerkLoaded: false,
        clerkTimedOut: true,
        hasLocalProfile: true,
        localProfileOwner: "other"
      })
    );
    assert.equal(decision, "auth-timeout");
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

  it("signed-out confirmado + perfil con dueño → login (la sesión perdida NO es un logout)", () => {
    // El caso del build 11: Clerk carga, no hay sesión y el perfil tiene
    // dueño. Antes era "purge-local" (borrar todo). Un upgrade que invalida la
    // sesión produce ESTE MISMO estado: la salida es volver a entrar.
    assert.equal(
      resolveStart(snap({ hasLocalProfile: true, localProfileOwner: "other" })),
      "sign-in"
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

  it("signed-out + perfil guest legado (sin dueño) → entrada, NUNCA Home (no hay modo invitado)", () => {
    const decision = resolveStart(snap({ hasLocalProfile: true, localProfileOwner: "none" }));
    assert.equal(decision, "entry");
    assert.notEqual(decision, "home");
  });

  it("signed-out + perfil CON dueño → login, NUNCA Home invitada", () => {
    const decision = resolveStart(snap({ hasLocalProfile: true, localProfileOwner: "other" }));
    assert.equal(decision, "sign-in");
    assert.notEqual(decision, "home");
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

describe("resolveTabsGuard — navegación restaurada directo a (tabs)", () => {
  // El agujero del build 11: Expo Router restaura la navegación y monta
  // `(tabs)` sin pasar por el arranque, así que la regla tiene que vivir
  // también acá o la Home invitada se renderiza igual.

  it("REGRESIÓN: tabs restauradas + signed-out + perfil con dueño → login, nunca Home invitada", () => {
    for (const owner of ["other", "current"] as const) {
      const guard = resolveTabsGuard(snap({ hasLocalProfile: true, localProfileOwner: owner }));
      assert.equal(guard, "sign-in", `owner=${owner}`);
      assert.notEqual(guard, "allow");
    }
  });

  it("Clerk cargando → carga mínima, sin redirect prematuro (ni a login ni a la entrada)", () => {
    for (const s of [
      snap({ clerkLoaded: false }),
      snap({ clerkLoaded: false, hasLocalProfile: true }),
      snap({ clerkLoaded: false, hasLocalProfile: true, localProfileOwner: "other" }),
      snap({ clerkLoaded: false, isSignedIn: true })
    ]) {
      assert.equal(resolveTabsGuard(s), "loading");
    }
  });

  it("Clerk sin resolver + timeout → delega en '/' (pantalla de reintento), nunca renderiza la pestaña", () => {
    assert.equal(
      resolveTabsGuard(
        snap({ clerkLoaded: false, clerkTimedOut: true, hasLocalProfile: true, localProfileOwner: "other" })
      ),
      "start"
    );
    assert.equal(resolveTabsGuard(snap({ clerkLoaded: false, clerkTimedOut: true })), "start");
  });

  it("REGRESIÓN: perfil guest legado sin sesión NO entra a las tabs → entrada", () => {
    assert.equal(resolveTabsGuard(snap({ hasLocalProfile: true, localProfileOwner: "none" })), "entry");
  });

  it("sesión activa CON perfil local → allow (la reconciliación de dueño es del arranque)", () => {
    for (const owner of ["none", "current", "other"] as const) {
      assert.equal(
        resolveTabsGuard(snap({ isSignedIn: true, hasLocalProfile: true, localProfileOwner: owner })),
        "allow"
      );
    }
  });

  it("REGRESIÓN: sesión activa SIN perfil local → '/' (recupera de Convex), nunca la pestaña", () => {
    // La Home monta useRequireProfile: sin perfil te manda al onboarding y el
    // alta PISA en Convex la carta real de la cuenta. El arranque la recupera.
    assert.equal(resolveTabsGuard(snap({ isSignedIn: true })), "start");
  });

  it("REGRESIÓN: alta recién terminada (adopción pendiente, Clerk stale) → esperar, no la entrada", () => {
    // El perfil existe, todavía sin dueño en disco, y useAuth no publicó la
    // sesión: sin este caso, quien acaba de crear su cuenta volvía al paso 0.
    const s = snap({ hasLocalProfile: true, localProfileOwner: "none", profileAdoptionPending: true });
    assert.equal(resolveTabsGuard(s), "loading");
    assert.notEqual(resolveTabsGuard(s), "entry");
    assert.equal(resolveStart(s), "loading");
  });

  it("signed-out sin perfil → entrada del onboarding", () => {
    assert.equal(resolveTabsGuard(snap()), "entry");
  });

  it("storage sin hidratar → loading", () => {
    assert.equal(resolveTabsGuard(snap({ localReady: false, hasLocalProfile: true })), "loading");
  });
});

describe("ninguna ruta de sesión borra perfil, guardadas ni diario", () => {
  // `purge-local` era la ÚNICA decisión del arranque que disparaba
  // clearLocalData. Se eliminó del dominio: mientras estos dos barridos pasen,
  // ningún estado de arranque/tabs puede terminar en una purga.
  const ALLOWED_START = new Set([
    "loading",
    "home",
    "entry",
    "recover",
    "recover-error",
    "resume-onboarding",
    "sign-in",
    "auth-timeout"
  ]);
  const ALLOWED_TABS = new Set(["allow", "loading", "sign-in", "entry", "start"]);

  it("resolveStart: ningún estado produce una decisión destructiva", () => {
    const all = everySnapshot();
    assert.ok(all.length > 1000, "la matriz debe ser exhaustiva");
    for (const s of all) {
      const d = resolveStart(s);
      assert.ok(ALLOWED_START.has(d), `decisión inesperada ${d} en ${JSON.stringify(s)}`);
      assert.notEqual(d as string, "purge-local");
    }
  });

  it("resolveTabsGuard: ningún estado produce una decisión destructiva", () => {
    for (const s of everySnapshot()) {
      const g = resolveTabsGuard(s);
      assert.ok(ALLOWED_TABS.has(g), `guard inesperado ${g} en ${JSON.stringify(s)}`);
    }
  });

  it("con backend y Clerk resuelto, un perfil con dueño y sin sesión SIEMPRE va a login", () => {
    for (const owner of ["current", "other"] as const)
      for (const recovery of ["idle", "loading", "done", "error"] as const) {
        const s = snap({ hasLocalProfile: true, localProfileOwner: owner, recovery });
        assert.equal(resolveStart(s), "sign-in");
        assert.equal(resolveTabsGuard(s), "sign-in");
      }
  });
});

describe("REGLA 6: sin sesión confirmada no se renderiza ninguna pestaña", () => {
  // Órbita no tiene Home invitada. Barrido exhaustivo: con backend
  // configurado, NINGÚN estado sin sesión puede terminar en Home ni en
  // "allow" — da igual qué perfil haya en disco o cómo venga la recuperación.
  it("resolveStart: signed-out nunca decide 'home'", () => {
    let checked = 0;
    for (const s of everySnapshot()) {
      if (!s.backendConfigured || s.isSignedIn) continue;
      checked += 1;
      assert.notEqual(resolveStart(s), "home", `Home sin sesión en ${JSON.stringify(s)}`);
    }
    assert.ok(checked > 100, "el barrido debe cubrir el espacio signed-out");
  });

  it("resolveTabsGuard: signed-out nunca decide 'allow'", () => {
    for (const s of everySnapshot()) {
      if (!s.backendConfigured || s.isSignedIn) continue;
      assert.notEqual(resolveTabsGuard(s), "allow", `pestaña sin sesión en ${JSON.stringify(s)}`);
    }
  });

  it("Clerk cargando (sin timeout) nunca decide nada: solo carga", () => {
    for (const s of everySnapshot()) {
      if (!s.backendConfigured || !s.localReady || s.clerkLoaded || s.clerkTimedOut) continue;
      assert.equal(resolveStart(s), "loading");
      assert.equal(resolveTabsGuard(s), "loading");
    }
  });

  it("la única rama que entra sin sesión es la app sin backend (builds locales)", () => {
    assert.equal(resolveStart(snap({ backendConfigured: false, hasLocalProfile: true })), "home");
    assert.equal(resolveTabsGuard(snap({ backendConfigured: false, hasLocalProfile: true })), "allow");
  });
});

describe("login: email inexistente y cuenta existente", () => {
  it("REGRESIÓN: con el error de email inexistente se puede ir a crear cuenta", () => {
    // El error de Clerk `form_identifier_not_found` deja el flujo en la fase
    // email (no avanza a código), y en esa fase la salida al alta se ofrece
    // siempre: el usuario no queda encerrado.
    const notFound = mapSignInStartError({ errors: [{ code: "form_identifier_not_found" }] });
    assert.equal(notFound.identifierNotFound, true);
    assert.match(notFound.message, /No encontramos una cuenta/);
    assert.equal(shouldOfferSignup({ phase: "email", isSignedIn: false }), true);
  });

  it("otros errores de Clerk conservan su mensaje y tampoco encierran", () => {
    const other = mapSignInStartError({ errors: [{ longMessage: "Demasiados intentos." }] });
    assert.equal(other.identifierNotFound, false);
    assert.equal(other.message, "Demasiados intentos.");
    assert.equal(shouldOfferSignup({ phase: "email", isSignedIn: false }), true);
  });

  it("error sin forma conocida → mensaje genérico, nunca vacío", () => {
    assert.match(mapSignInStartError({}).message, /Probá de nuevo/);
  });

  it("la salida al alta no aparece cuando ya no aplica (código en curso o sesión activa)", () => {
    assert.equal(shouldOfferSignup({ phase: "code", isSignedIn: false }), false);
    assert.equal(shouldOfferSignup({ phase: "email", isSignedIn: true }), false);
  });

  it("la salida al alta también está en la pantalla de contraseña", () => {
    assert.equal(shouldOfferSignup({ phase: "password", isSignedIn: false }), true);
  });

  it("cuenta CON contraseña → se pide contraseña (la de revisión de Apple entra por acá)", () => {
    assert.equal(resolveFirstFactor([{ strategy: "password" }, { strategy: "email_code" }]), "password");
    assert.equal(resolveFirstFactor([{ strategy: "password" }]), "password");
  });

  it("cuenta SIN contraseña → código por email (el flujo normal no cambia)", () => {
    assert.equal(resolveFirstFactor([{ strategy: "email_code" }]), "email_code");
    assert.equal(resolveFirstFactor([]), "email_code");
    assert.equal(resolveFirstFactor(undefined), "email_code");
  });

  it("REGRESIÓN: login de una cuenta existente → hidrata Convex y vuelve a Home con datos reales", () => {
    assert.equal(
      resolveSignInDestination({ hasRemoteBirthData: true, hasLocalProfile: false, profileRestored: false }),
      "home-remote"
    );
    // El remoto manda aunque este teléfono ya tenga perfil.
    assert.equal(
      resolveSignInDestination({ hasRemoteBirthData: true, hasLocalProfile: true, profileRestored: true }),
      "home-remote"
    );
  });

  it("cuenta sin datos en Convex pero con perfil en este teléfono → Home con lo local", () => {
    assert.equal(
      resolveSignInDestination({ hasRemoteBirthData: false, hasLocalProfile: true, profileRestored: false }),
      "home-local"
    );
    // Perfil restaurado del archivo de la cuenta (logout previo en este teléfono).
    assert.equal(
      resolveSignInDestination({ hasRemoteBirthData: false, hasLocalProfile: false, profileRestored: true }),
      "home-local"
    );
  });

  it("REGRESIÓN: entra OTRA cuenta en el mismo teléfono → hay que separar los datos", () => {
    // Sin purga en el arranque, lo local del usuario anterior sigue en disco.
    // Si entra otro, sus guardadas y su diario NO pueden viajar a la sesión
    // nueva: el caller archiva bajo el dueño viejo y limpia antes de restaurar.
    assert.equal(isAccountSwitch({ localProfileOwner: "user_A", incomingUserId: "user_B" }), true);
  });

  it("la misma cuenta volviendo a entrar NO se toca (conserva perfil, guardadas y diario)", () => {
    assert.equal(isAccountSwitch({ localProfileOwner: "user_A", incomingUserId: "user_A" }), false);
  });

  it("guest legado que crea/usa cuenta no es cambio de cuenta: es upgrade, se conserva", () => {
    assert.equal(isAccountSwitch({ localProfileOwner: null, incomingUserId: "user_B" }), false);
  });

  it("sin userId del backend no se asume cambio (no se toca nada por las dudas)", () => {
    assert.equal(isAccountSwitch({ localProfileOwner: "user_A", incomingUserId: null }), false);
    assert.equal(isAccountSwitch({ localProfileOwner: "user_A", incomingUserId: undefined }), false);
  });

  it("cuenta sin datos y teléfono sin perfil → continuar el alta (sin segunda cuenta)", () => {
    assert.equal(
      resolveSignInDestination({ hasRemoteBirthData: false, hasLocalProfile: false, profileRestored: false }),
      "resume-onboarding"
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
