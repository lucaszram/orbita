import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describeMissingRequirements,
  interpretSignInAttempt,
  interpretSignUpAttempt,
  makeReentrancyGuard,
  MIN_PASSWORD_LENGTH,
  validateSignupPassword
} from "../src/onboarding/signup";
import { resolveFirstFactor } from "../src/domain/sessionStart";

describe("validateSignupPassword — email + contraseña + confirmación", () => {
  it("contraseña vacía → pide elegir una", () => {
    assert.match(validateSignupPassword("", "") ?? "", /Elegí una contraseña/);
  });

  it("contraseña corta → exige el mínimo", () => {
    const err = validateSignupPassword("abc123", "abc123") ?? "";
    assert.match(err, new RegExp(String(MIN_PASSWORD_LENGTH)));
  });

  it("confirmación distinta → 'no coinciden'", () => {
    assert.match(validateSignupPassword("supersecreta", "otracosa123") ?? "", /no coinciden/i);
  });

  it("contraseña válida y confirmada → sin error", () => {
    assert.equal(validateSignupPassword("supersecreta", "supersecreta"), null);
  });
});

describe("interpretSignUpAttempt — alta con contraseña + código", () => {
  it("status complete → sesión activa (kind complete + sessionId)", () => {
    const out = interpretSignUpAttempt({ status: "complete", createdSessionId: "sess_1" });
    assert.deepEqual(out, { kind: "complete", sessionId: "sess_1" });
  });

  it("REGRESIÓN: código correcto con missing_requirements NO dice 'código incorrecto'; dice qué falta", () => {
    const out = interpretSignUpAttempt({
      status: "missing_requirements",
      missingFields: ["password"],
      verifications: { emailAddress: { status: "verified" } }
    });
    assert.equal(out.kind, "missing");
    const msg = out.kind === "missing" ? out.message : "";
    assert.match(msg, /contraseña/i);
    assert.doesNotMatch(msg, /no coincide|incorrecto|no coincid/i);
  });

  it("describeMissingRequirements traduce campos conocidos y tolera vacío", () => {
    assert.match(describeMissingRequirements(["password"]), /contraseña/i);
    assert.match(describeMissingRequirements([]), /Falta completar/i);
    assert.match(describeMissingRequirements(["password", "last_name"]), /contraseña.*apellido|apellido.*contraseña/i);
  });
});

describe("interpretSignInAttempt — login por contraseña o por código", () => {
  it("login con contraseña: attemptFirstFactor(password) complete → termina en setActive", () => {
    const out = interpretSignInAttempt({ status: "complete", createdSessionId: "sess_pw" });
    assert.deepEqual(out, { kind: "complete", sessionId: "sess_pw" });
  });

  it("login alternativo por código: attemptFirstFactor(email_code) complete → termina en setActive", () => {
    const out = interpretSignInAttempt({ status: "complete", createdSessionId: "sess_code" });
    assert.deepEqual(out, { kind: "complete", sessionId: "sess_code" });
  });

  it("no completo (needs_second_factor) → no inventa sesión, propone el código", () => {
    const out = interpretSignInAttempt({ status: "needs_second_factor" });
    assert.equal(out.kind, "incomplete");
  });

  it("cuenta con contraseña → el login la enruta primero (código queda como alternativa)", () => {
    assert.equal(resolveFirstFactor([{ strategy: "password" }, { strategy: "email_code" }]), "password");
  });
});

describe("makeReentrancyGuard — auto-submit + botón no verifican dos veces", () => {
  it("dos llamadas solapadas ejecutan la verificación UNA sola vez", async () => {
    const guard = makeReentrancyGuard();
    let calls = 0;
    const attempt = () => {
      calls += 1;
      return new Promise<boolean>((res) => setTimeout(() => res(true), 20));
    };
    const [a, b] = await Promise.all([guard.run(attempt, false), guard.run(attempt, false)]);
    assert.equal(calls, 1, "la verificación corrió una sola vez");
    assert.equal(a, true);
    assert.equal(b, false, "la segunda (auto-submit o botón) no re-ejecutó");
  });

  it("tras terminar, una nueva verificación sí puede correr (p. ej. otro código)", async () => {
    const guard = makeReentrancyGuard();
    let calls = 0;
    const attempt = () => {
      calls += 1;
      return Promise.resolve(true);
    };
    await guard.run(attempt, false);
    await guard.run(attempt, false);
    assert.equal(calls, 2);
  });
});
