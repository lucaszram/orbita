import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RESEND_COOLDOWN_SECONDS,
  RESEND_OK_MESSAGE,
  planResend,
  resendButton,
  resendFeedback,
  secondsUntilResend
} from "../src/onboarding/resend";

const T0 = 1_000_000; // reloj base arbitrario (ms)

describe("cooldown del reenvío (30 s)", () => {
  it("recién enviado → faltan 30 s y el botón dice 'Reenviar en 30 s' deshabilitado", () => {
    assert.equal(secondsUntilResend(T0, T0), RESEND_COOLDOWN_SECONDS);
    assert.deepEqual(resendButton({ nowMs: T0, lastSentAtMs: T0, sending: false }), {
      disabled: true,
      label: "Reenviar en 30 s"
    });
  });

  it("a mitad del cooldown sigue deshabilitado con la cuenta regresiva real", () => {
    const at15s = T0 + 15_000;
    assert.equal(secondsUntilResend(at15s, T0), 15);
    assert.deepEqual(resendButton({ nowMs: at15s, lastSentAtMs: T0, sending: false }), {
      disabled: true,
      label: "Reenviar en 15 s"
    });
  });

  it("justo antes de los 30 s todavía no se puede (1 s restante)", () => {
    const at29s = T0 + 29_000;
    assert.equal(secondsUntilResend(at29s, T0), 1);
    assert.equal(resendButton({ nowMs: at29s, lastSentAtMs: T0, sending: false }).disabled, true);
  });

  it("a los 30 s se habilita y el botón vuelve a 'Reenviar código'", () => {
    const at30s = T0 + 30_000;
    assert.equal(secondsUntilResend(at30s, T0), 0);
    assert.deepEqual(resendButton({ nowMs: at30s, lastSentAtMs: T0, sending: false }), {
      disabled: false,
      label: "Reenviar código"
    });
  });

  it("sin envío previo (lastSentAt null) el botón está disponible desde el arranque", () => {
    assert.equal(secondsUntilResend(T0, null), 0);
    assert.equal(resendButton({ nowMs: T0, lastSentAtMs: null, sending: false }).disabled, false);
  });

  it("mientras envía queda deshabilitado con 'Reenviando…' (evita múltiples taps), aunque el cooldown haya vencido", () => {
    const at40s = T0 + 40_000;
    assert.deepEqual(resendButton({ nowMs: at40s, lastSentAtMs: T0, sending: true }), {
      disabled: true,
      label: "Reenviando…"
    });
  });
});

describe("planResend — llama al método correcto y no crea una segunda cuenta", () => {
  it("alta (signUp) → prepareEmailAddressVerification con email_code", () => {
    const plan = planResend({ flow: "signUp", emailAddressId: null });
    assert.deepEqual(plan, { method: "prepareEmailAddressVerification", strategy: "email_code" });
  });

  it("login (signIn) → prepareFirstFactor CONSERVANDO el emailAddressId (no se pierde el email)", () => {
    const plan = planResend({ flow: "signIn", emailAddressId: "eadr_123" });
    assert.deepEqual(plan, {
      method: "prepareFirstFactor",
      strategy: "email_code",
      emailAddressId: "eadr_123"
    });
  });

  it("ninguna rama vuelve a 'create': reenviar nunca crea una cuenta ni reinicia el flujo", () => {
    for (const flow of ["signUp", "signIn"] as const) {
      const plan = planResend({ flow, emailAddressId: "eadr_x" });
      assert.doesNotMatch(plan.method, /create/i);
    }
  });

  it("alta con email ya existente cae a signIn: reenvía por prepareFirstFactor, no por signUp", () => {
    // El alta con un email que ya tiene cuenta conmuta internamente a signIn;
    // el reenvío debe seguir ese flujo, preservando el emailAddressId.
    const plan = planResend({ flow: "signIn", emailAddressId: "eadr_existing" });
    assert.equal(plan.method, "prepareFirstFactor");
    assert.equal(plan.strategy === "email_code" ? plan.emailAddressId : null, "eadr_existing");
  });
});

describe("feedback del reenvío — éxito y error quedan visibles", () => {
  it("éxito → 'Código reenviado'", () => {
    assert.equal(resendFeedback("sent", null), RESEND_OK_MESSAGE);
  });

  it("error → muestra el error REAL de Clerk", () => {
    assert.equal(resendFeedback("error", "Demasiados intentos. Esperá un momento."), "Demasiados intentos. Esperá un momento.");
  });

  it("error sin mensaje conocido → texto genérico, nunca vacío", () => {
    const msg = resendFeedback("error", null);
    assert.ok(msg && msg.length > 0);
  });

  it("sin intento todavía → no se muestra nada", () => {
    assert.equal(resendFeedback("idle", null), null);
  });
});
