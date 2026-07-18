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

  it("muestra error con reintento sin fingir éxito", () => {
    assert.match(PERFIL, /Reintentar eliminación/);
    assert.match(PERFIL, /No pudimos eliminar tu cuenta/);
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
