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

/** Cuenta completa: la carta ya está persistida y verificada (`chart_ready`). */
const CON_SESION: AccountState = {
  backendConfigured: true,
  clerkLoaded: true,
  signedIn: true,
  completionResolved: true,
  completion: {
    status: "chart_ready",
    recovery: null,
    profileReady: true,
    birthDataReady: true,
    chartReady: true
  }
};

/** Alta iniciada en este flujo que todavía no cerró. */
const EN_ALTA: AccountState["completion"] = {
  status: "onboarding_incomplete",
  recovery: "onboarding",
  profileReady: true,
  birthDataReady: false,
  chartReady: false
};

// --- El loop /home ↔ /onboarding --------------------------------------------
// Sesión activa + cuenta completa en el backend + storage local vacío: el gate
// mandaba a Home, el guard de perfil de Home mandaba a onboarding, y el gate del
// onboarding devolvía a Home porque el remoto estaba completo. La sesión que
// teníamos en el navegador no lo mostraba porque ya tenía perfil local.

test("cuenta completa SIN perfil local → bootstrap, nunca Home ni onboarding", () => {
  const d = resolveAccountDestination({ ...CON_SESION, localProfileReady: false });
  assert.equal(d, "bootstrap");
  // Y ese destino no habilita NINGUNA superficie: no redirige, así que no hay loop.
  for (const surface of ["landing", "auth", "onboarding", "edit-birth-data", "app"] as const) {
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

test("cuenta incompleta SIN datos ajenos → onboarding directo", () => {
  for (const localProfileReady of [true, false]) {
    assert.equal(
      resolveAccountDestination({
        ...CON_SESION,
        completion: EN_ALTA,
        localProfileReady,
        localProfileForeign: false
      }),
      "onboarding",
      `localProfileReady=${localProfileReady}`
    );
  }
});

test("cuenta incompleta CON datos ajenos → primero aislar", () => {
  // Sin esto, quien entra con otra cuenta arrancaba el onboarding llevándose el
  // diario y las guardadas del dueño anterior.
  assert.equal(
    resolveAccountDestination({
      ...CON_SESION,
      completion: EN_ALTA,
      localProfileReady: false,
      localProfileForeign: true
    }),
    "bootstrap"
  );
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

test("el orden y la concurrencia del bootstrap se prueban ejecutándolo", () => {
  // La conducta vive en `test/accountBootstrapTx.test.ts`, que corre la
  // transacción con dobles. Acá sólo se ancla que el provider sea el dueño
  // ÚNICO del lock: dos instancias del hook eran dos locks distintos.
  const provider = sinComentarios(readFileSync(join(ROOT, "src/hooks/useAccountBootstrap.tsx"), "utf8"));
  assert.ok(/AccountBootstrapProvider/.test(provider));
  assert.ok(/useContext\(BootstrapContext\)/.test(provider), "el hook LEE el contexto, no crea estado");
  assert.ok(/running\.current/.test(provider), "la corrida en vuelo se comparte");

  const login = sinComentarios(readFileSync(join(ROOT, "app/iniciar-sesion.tsx"), "utf8"));
  assert.ok(!/useAccountBootstrap/.test(login), "el login no puede tener su propia instancia");

  const layout = readFileSync(join(ROOT, "app/_layout.tsx"), "utf8");
  assert.ok(/<AccountBootstrapProvider>/.test(layout), "el provider va montado sobre el gate");
});

// --- "Crear una cuenta" ------------------------------------------------------

test('"Crear una cuenta" entra al alta completa, con el email ya cargado', () => {
  // La cuenta se crea DENTRO de la secuencia, en su paso original: mandar a un
  // formulario suelto se saltea la experiencia inmersiva entera.
  const login = sinComentarios(readFileSync(join(ROOT, "app/iniciar-sesion.tsx"), "utf8"));
  const bloque = login.slice(login.indexOf("const createAccount"), login.indexOf("const createAccount") + 400);
  assert.ok(/ONBOARDING_ROUTE/.test(bloque), "debe abrir el alta completa");
  assert.ok(!/SIGN_UP_ROUTE/.test(bloque), "el formulario suelto no es la entrada del alta");
  assert.ok(/params: email \? \{ email \}/.test(bloque), "el email tipeado viaja: no se pide dos veces");
});

// --- El onboarding sin restos de autenticación -------------------------------

test("el alta vive dentro del onboarding, en su paso original", () => {
  const flow = sinComentarios(readFileSync(join(ROOT, "src/onboarding/OnboardingFlow.tsx"), "utf8"));
  // Secuencia V4.4: la cuenta es el penúltimo paso, después del before/after y
  // antes del cierre. La experiencia inmersiva va primero.
  assert.match(flow, /const TOTAL = 15;/);
  assert.match(flow, /const STEP_ACCOUNT = 13;/);
  assert.match(flow, /const FINAL_STEP = TOTAL - 1;/);
  assert.match(flow, /case STEP_ACCOUNT:\s*screen = \(\s*<AccountScreen/);
  // El cableado del paso de cuenta después de pasar a la UI oficial de Clerk:
  // ya no hay contraseña ni código propios, sí el borrador remoto confirmado
  // antes de abrir Clerk y la sesión que el propio componente activa.
  for (const pieza of [
    "useAccountFlow",
    "sessionActivated",
    "prepareSignupDraft",
    "ensureClientDraftId"
  ]) {
    assert.match(flow, new RegExp(pieza), `falta el cableado del paso de cuenta: ${pieza}`);
  }
});
