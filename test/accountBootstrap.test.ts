import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  destinationAllows,
  resolveAccountDestination,
  type AccountState
} from "../src/domain/accountDestination";
import { isAccountSwitch } from "../src/domain/sessionStart";

const ROOT = join(import.meta.dirname, "..");
const sinComentarios = (x: string) =>
  x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const CON_SESION: AccountState = {
  backendConfigured: true,
  clerkLoaded: true,
  signedIn: true,
  birthDataResolved: true,
  hasBirthData: true
};

// --- El loop /home ↔ /onboarding --------------------------------------------
// Sesión activa + `birthData` remoto completo + storage local vacío: el gate
// mandaba a Home, el guard de perfil de Home mandaba a onboarding, y el gate del
// onboarding devolvía a Home porque el remoto estaba completo. La sesión que
// teníamos en el navegador no lo mostraba porque ya tenía perfil local.

test("cuenta completa SIN perfil local → bootstrap, nunca Home ni onboarding", () => {
  const d = resolveAccountDestination({ ...CON_SESION, localProfileReady: false });
  assert.equal(d, "bootstrap");
  // Y ese destino no habilita NINGUNA superficie: no redirige, así que no hay loop.
  for (const surface of ["landing", "auth", "onboarding", "app"] as const) {
    assert.ok(!destinationAllows(d, surface), `bootstrap no puede habilitar ${surface}`);
  }
});

test("el storage local sin leer es carga, no bootstrap ni Home", () => {
  assert.equal(
    resolveAccountDestination({ ...CON_SESION, localProfileReady: undefined }),
    "loading",
    "no se decide con el storage a medio leer"
  );
});

test("tras hidratar, la misma cuenta entra a Home", () => {
  assert.equal(resolveAccountDestination({ ...CON_SESION, localProfileReady: true }), "app-home");
});

test("una cuenta INcompleta nunca pasa por bootstrap: va al onboarding", () => {
  // El bootstrap es sólo para hidratar una cuenta que YA completó el alta.
  for (const localProfileReady of [true, false, undefined]) {
    assert.equal(
      resolveAccountDestination({ ...CON_SESION, hasBirthData: false, localProfileReady }),
      "onboarding",
      `localProfileReady=${localProfileReady}`
    );
  }
});

test("el gate no redirige en el estado bootstrap: muestra carga o reintento", () => {
  const gate = sinComentarios(readFileSync(join(ROOT, "src/components/orbita/AccountGate.tsx"), "utf8"));
  const bloque = gate.slice(gate.indexOf('destination === "bootstrap"'), gate.indexOf('destination === "loading"'));
  assert.ok(!/Redirect/.test(bloque), "redirigir acá sería justo el loop");
  assert.ok(/bootstrap\.state === "error"/.test(bloque), "un fallo tiene que ser visible");
  assert.ok(/mostrarError/.test(bloque), "con reintento");
});

// --- Un solo camino de bootstrap --------------------------------------------

test("la entrada con sesión activa y el login usan el MISMO bootstrap", () => {
  const login = readFileSync(join(ROOT, "app/iniciar-sesion.tsx"), "utf8");
  const gate = readFileSync(join(ROOT, "src/components/orbita/AccountGate.tsx"), "utf8");
  for (const [nombre, src] of [["login", login], ["gate", gate]] as const) {
    assert.ok(/useAccountBootstrap/.test(src), `${nombre} debe usar el bootstrap compartido`);
  }
  // Y la lógica de archivar/restaurar/hidratar ya no está duplicada en el login.
  const loginCodigo = sinComentarios(login);
  for (const fn of ["isAccountSwitch", "onboardingInputFromBirthData", "restoreAccountData", "createProfile"]) {
    assert.ok(!new RegExp(fn).test(loginCodigo), `${fn} debe vivir sólo en el bootstrap`);
  }
});

test("el bootstrap no escribe en birthData", () => {
  const src = sinComentarios(readFileSync(join(ROOT, "src/hooks/useAccountBootstrap.tsx"), "utf8"));
  for (const prohibido of ["completeBirthData", "upsertForCurrentUser", "calculateOrCreateNatalChart"]) {
    assert.ok(!new RegExp(prohibido).test(src), `el bootstrap sólo LEE: no puede llamar ${prohibido}`);
  }
});

test("cuenta A local con cuenta B activa: se archiva y limpia antes de restaurar", () => {
  // La regla pura sigue siendo la autoridad del cambio de cuenta.
  assert.equal(isAccountSwitch({ localProfileOwner: "user_A", incomingUserId: "user_B" }), true);
  assert.equal(isAccountSwitch({ localProfileOwner: "user_A", incomingUserId: "user_A" }), false);

  const src = readFileSync(join(ROOT, "src/hooks/useAccountBootstrap.tsx"), "utf8");
  const iArchiva = src.indexOf("archiveAccountData(profileOwner)");
  const iLimpia = src.indexOf("resetApp()");
  const iRestaura = src.indexOf("restoreAccountData(");
  assert.ok(iArchiva !== -1 && iArchiva < iLimpia, "archivar ANTES de limpiar");
  assert.ok(iLimpia < iRestaura, "limpiar ANTES de restaurar: si no, se mezclan las dos cuentas");
  // Y un perfil ajeno no cuenta como listo, así que siempre pasa por acá.
  const hook = readFileSync(join(ROOT, "src/hooks/useAccountDestination.tsx"), "utf8");
  assert.ok(/profileOwner === auth\?\.userId/.test(hook), "el perfil debe ser de la cuenta ACTIVA");
});

test("el bootstrap tiene lock sincrónico: no archiva dos veces", () => {
  const src = readFileSync(join(ROOT, "src/hooks/useAccountBootstrap.tsx"), "utf8");
  assert.ok(/useRef\(false\)/.test(src));
  assert.ok(/if \(running\.current/.test(src), "el lock va antes de cualquier trabajo");
});

// --- "Crear una cuenta" ------------------------------------------------------

test('"Crear una cuenta" va a /crear-cuenta, nunca al onboarding', () => {
  const login = sinComentarios(readFileSync(join(ROOT, "app/iniciar-sesion.tsx"), "utf8"));
  const bloque = login.slice(login.indexOf("const createAccount"), login.indexOf("const createAccount") + 400);
  assert.ok(/SIGN_UP_ROUTE/.test(bloque), "debe ir a la puerta de alta");
  assert.ok(!/nuevo/.test(bloque), "la dependencia de nuevo=1 quedó obsoleta");
  assert.ok(!/onboarding/i.test(bloque), "sin sesión, el onboarding lo rebotaría al login");
  const rutas = readFileSync(join(ROOT, "src/domain/appRoutes.ts"), "utf8");
  assert.match(rutas, /SIGN_UP_ROUTE = "\/crear-cuenta"/);
});

// --- El onboarding sin restos de autenticación -------------------------------

test("el onboarding no conserva restos del alta", () => {
  const flow = sinComentarios(readFileSync(join(ROOT, "src/onboarding/OnboardingFlow.tsx"), "utf8"));
  for (const resto of [
    "AccountScreen",
    "useAccountFlow",
    "STEP_ALTA",
    "sessionActivated",
    "validateSignupPassword",
    "accountFormError",
    "accountCode",
    "params.nuevo"
  ]) {
    assert.ok(!new RegExp(resto.replace(".", "\\.")).test(flow), `resto de auth en el onboarding: ${resto}`);
  }
});
