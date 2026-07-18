import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

// Verificación ESTRUCTURAL de los requisitos de App Review en Perfil: no se
// puede renderizar RN en node; se valida la estructura del fuente (mismo patrón
// que accountScreenLayout.test.ts).
const PERFIL = readFileSync(path.join(process.cwd(), "app/(tabs)/perfil.tsx"), "utf8");
const PLUS = readFileSync(path.join(process.cwd(), "app/reading/plus.tsx"), "utf8");
const VOID_SRC = readFileSync(path.join(process.cwd(), "src/components/void/VoidExperience.tsx"), "utf8");
const APP_STATE = readFileSync(path.join(process.cwd(), "src/hooks/useAppState.tsx"), "utf8");
const INDEX = readFileSync(path.join(process.cwd(), "app/index.tsx"), "utf8");

describe("Perfil — eliminar cuenta (App Review)", () => {
  it("ofrece 'Eliminar mi cuenta' con el flujo de doble confirmación del dominio", () => {
    assert.match(PERFIL, /Eliminar mi cuenta/);
    assert.match(PERFIL, /requestAccountDeletion/);
    assert.match(PERFIL, /confirmWarning/);
    assert.match(PERFIL, /confirmDestructive/);
    assert.match(PERFIL, /destructive:\s*true/);
  });

  it("cablea los pasos reales en orden: Convex deleteAccount → Clerk deleteUser → limpieza → entrada", () => {
    const convex = PERFIL.indexOf("appApi.users.deleteAccount");
    const clerk = PERFIL.indexOf("auth.deleteUser");
    const clear = PERFIL.indexOf("clearLocalData:");
    const entry = PERFIL.indexOf("goToEntry:");
    assert.ok(convex >= 0, "falta la mutación Convex users.deleteAccount");
    assert.ok(clerk >= 0, "falta el borrado de identidad Clerk");
    assert.ok(clear >= 0 && entry >= 0, "faltan limpieza local / vuelta a la entrada");
    // La limpieza borra también el snapshot por cuenta (no hay nada que restaurar).
    assert.match(PERFIL, /clearAccountSnapshot/);
    // La vuelta a la entrada es la ruta estable de arranque.
    assert.match(PERFIL, /goToEntry:\s*\(\)\s*=>\s*router\.replace\("\/onboarding"\)/);
  });

  it("escribe el marcador por FASES: backend_deleted antes de Clerk, identity_deleted después", () => {
    const backend = PERFIL.indexOf('storePendingAccountDeletion(userId, "backend_deleted")');
    const identity = PERFIL.indexOf('storePendingAccountDeletion(userId, "identity_deleted")');
    assert.ok(backend >= 0, "falta la fase backend_deleted antes de borrar Clerk");
    assert.ok(identity >= 0 && backend < identity, "falta la promoción a identity_deleted tras Clerk");
    assert.match(PERFIL, /clearPendingCleanup:\s*\(\)\s*=>\s*clearPendingAccountDeletion\(\)/);
  });

  it("falla cerrado sin userId: no se crea un marcador sin dueño ni se borra Clerk", () => {
    assert.match(PERFIL, /if \(!userId\) throw new Error/);
  });

  it("bloquea la reentrada con un lock SINCRÓNICO desde la primera línea del handler", () => {
    // useRef, no estado React: dos taps rápidos no deben abrir dos flujos.
    assert.match(PERFIL, /const deletionInFlight = useRef\(false\)/);
    assert.match(
      PERFIL,
      /if \(deletionInFlight\.current \|\| loggingOut\) return;\s*\n\s*deletionInFlight\.current = true;/
    );
    // El logout también respeta el lock (no corre en paralelo con la eliminación).
    assert.match(PERFIL, /if \(loggingOut \|\| deleting \|\| deletionInFlight\.current\) return;/);
    // Se libera al cancelar o fallar (el éxito navega y no vuelve).
    assert.match(PERFIL, /deletionInFlight\.current = false;/);
  });

  it("muestra error con reintento sin fingir éxito", () => {
    assert.match(PERFIL, /Reintentar eliminación/);
    assert.match(PERFIL, /No pudimos eliminar tu cuenta/);
  });
});

describe("Arranque — la purga pendiente corre antes de publicar estado local", () => {
  it("useAppState consulta el marcador al hidratar y arranca vacío si hay eliminación pendiente", () => {
    const purge = APP_STATE.indexOf("completePendingAccountDeletion({");
    const ready = APP_STATE.indexOf("setIsReady(true)");
    assert.ok(purge >= 0, "falta completePendingAccountDeletion en la hidratación");
    assert.ok(ready >= 0 && purge < ready, "la purga debe decidirse ANTES de publicar isReady");
    // Con marcador (cualquier fase) el estado local se publica vacío: nunca el
    // perfil de una cuenta eliminada, nunca login a esa cuenta.
    assert.match(APP_STATE, /if \(pendingDeletion\.status !== "none"\)/);
    // TODO estado con marcador vivo (awaiting-identity Y pending) queda
    // expuesto al gate: solo "completed" libera el arranque normal.
    assert.match(APP_STATE, /pendingDeletion\.status === "completed" \? null : pendingDeletion\.marker/);
  });

  it("el gate de index bloquea el arranque con backend_deleted y decide con Clerk cargado", () => {
    assert.match(INDEX, /resolvePendingDeletionBoot\(/);
    // La pantalla de bloqueo se renderiza ANTES del switch de decisión normal.
    const gate = INDEX.indexOf("if (pendingAccountDeletion)");
    const decisionSwitch = INDEX.indexOf("switch (decision)");
    assert.ok(gate >= 0 && decisionSwitch >= 0 && gate < decisionSwitch, "el gate debe cortar antes de resolveStart");
    // El intento corre por el coordinador del dominio (resultado SIEMPRE
    // publicable) y publica el fallo salvo unmount REAL — nunca lo silencia
    // un cambio de decisión durante los await.
    assert.match(INDEX, /attemptPendingDeletionFinalize\(\{/);
    assert.match(INDEX, /decision: pendingDeletionDecision/);
    assert.match(INDEX, /auth\?\.deleteUser\(\)/);
    assert.match(INDEX, /purge: completePendingDeletionPurge/);
    assert.match(INDEX, /result === "error" && mountedRef\.current/);
    // El efecto del gate no usa cleanup de cancelación que trague el error.
    const effectStart = INDEX.indexOf("attemptPendingDeletionFinalize({");
    const effectSlice = INDEX.slice(effectStart - 800, effectStart + 800);
    assert.equal(/let cancelled/.test(effectSlice), false, "el gate no debe cancelar por re-run de decisión");
    // Estado bloqueante visible + reintento.
    assert.match(INDEX, /Finalizando la eliminación/);
    assert.match(INDEX, /REINTENTAR/);
  });
});

describe("Perfil — links legales visibles", () => {
  it("Privacidad y Soporte apuntan a las URLs correctas", () => {
    assert.match(PERFIL, /https:\/\/orbitaastrologia\.xyz\/privacy/);
    assert.match(PERFIL, /https:\/\/orbitaastrologia\.xyz\/support/);
    assert.match(PERFIL, /Política de privacidad/);
    assert.match(PERFIL, /Soporte/);
    assert.match(PERFIL, /Linking\.openURL/);
  });
});

describe("Primera versión gratuita — Plus no aparece", () => {
  it("Perfil no menciona suscripción, plan ni Plus", () => {
    assert.equal(PERFIL.includes("SUSCRIPCIÓN"), false);
    assert.equal(PERFIL.includes("reading/plus"), false);
    assert.equal(PERFIL.toLowerCase().includes("suscripción"), false);
    assert.equal(/plus/i.test(PERFIL.replace(/hitSlop/g, "")), false);
  });

  it("/reading/plus redirige sin mostrar planes ni precios", () => {
    assert.match(PLUS, /<Redirect href="\/" \/>/);
    assert.equal(PLUS.includes("ANUAL"), false);
    assert.equal(PLUS.includes("SEMANAL"), false);
    assert.equal(PLUS.includes("$"), false);
  });

  it("El Umbral no ofrece desbloqueo con el plan semanal", () => {
    assert.equal(VOID_SRC.includes("DESBLOQUEAR"), false);
    assert.equal(VOID_SRC.includes("SEMANAL"), false);
    assert.equal(VOID_SRC.includes("setStubPro"), false);
  });
});
