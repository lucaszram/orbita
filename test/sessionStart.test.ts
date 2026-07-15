import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  onboardingInputFromBirthData,
  resolveStart,
  type StartSnapshot
} from "../src/domain/sessionStart";

/** Base: backend configurado, todo cargado, sin sesión ni perfil. */
function snap(overrides: Partial<StartSnapshot> = {}): StartSnapshot {
  return {
    backendConfigured: true,
    localReady: true,
    hasLocalProfile: false,
    clerkLoaded: true,
    isSignedIn: false,
    recovery: "idle",
    hasRemoteBirthData: false,
    ...overrides
  };
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

  it("signed-in + perfil local → Home (live overlay se encarga del resto)", () => {
    assert.equal(resolveStart(snap({ isSignedIn: true, hasLocalProfile: true })), "home");
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

  it("signed-out + perfil guest local → Home como invitado", () => {
    assert.equal(resolveStart(snap({ hasLocalProfile: true })), "home");
  });

  it("signed-out sin perfil → entrada estable (Empezar / Ya tengo cuenta)", () => {
    assert.equal(resolveStart(snap()), "entry");
  });

  it("sin backend configurado → decide solo por el perfil local", () => {
    assert.equal(resolveStart(snap({ backendConfigured: false, hasLocalProfile: true })), "home");
    assert.equal(resolveStart(snap({ backendConfigured: false, clerkLoaded: false })), "entry");
  });

  it("con perfil local la sesión activa no espera la recuperación", () => {
    assert.equal(
      resolveStart(snap({ isSignedIn: true, hasLocalProfile: true, recovery: "error" })),
      "home"
    );
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
