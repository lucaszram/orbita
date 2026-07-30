import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  destinationAllows,
  resolveAccountDestination,
  type AccountState
} from "../src/domain/accountDestination";

const ROOT = join(import.meta.dirname, "..");
const sinComentarios = (x: string) =>
  x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const BASE: AccountState = {
  backendConfigured: true,
  clerkLoaded: true,
  signedIn: false,
  birthDataResolved: false,
  hasBirthData: false
};

// --- El resolver: una sola decisión -----------------------------------------

test("sin sesión → login (la landing es la única superficie pública)", () => {
  assert.equal(resolveAccountDestination(BASE), "sign-in");
  assert.ok(destinationAllows("sign-in", "landing"));
  assert.ok(destinationAllows("sign-in", "auth"));
  assert.ok(!destinationAllows("sign-in", "app"));
  assert.ok(!destinationAllows("sign-in", "onboarding"));
});

test("cuenta completa CON perfil local propio → Home de la app", () => {
  const s = { ...BASE, signedIn: true, birthDataResolved: true, hasBirthData: true, localProfileReady: true };
  assert.equal(resolveAccountDestination(s), "app-home");
  assert.ok(destinationAllows("app-home", "app"));
  // Y no puede quedarse en landing, login ni onboarding.
  for (const surface of ["landing", "auth", "onboarding"] as const) {
    assert.ok(!destinationAllows("app-home", surface), surface);
  }
});

test("cuenta incompleta → onboarding", () => {
  const s = {
    ...BASE,
    signedIn: true,
    birthDataResolved: true,
    hasBirthData: false,
    localProfileReady: false,
    localProfileForeign: false
  };
  assert.equal(resolveAccountDestination(s), "onboarding");
  assert.ok(destinationAllows("onboarding", "onboarding"));
  assert.ok(!destinationAllows("onboarding", "app"), "una cuenta sin carta no entra a Home");
});

test("Clerk o birthData sin resolver → carga estable, nunca un fallback", () => {
  assert.equal(resolveAccountDestination({ ...BASE, clerkLoaded: false }), "loading");
  assert.equal(
    resolveAccountDestination({ ...BASE, signedIn: true, birthDataResolved: false }),
    "loading",
    "con sesión y sin saber si hay datos NO se monta onboarding ni landing"
  );
});

test("fallo de recuperación → reintento, y gana sobre todo lo demás", () => {
  assert.equal(resolveAccountDestination({ ...BASE, recoveryFailed: true }), "retry");
  assert.equal(
    resolveAccountDestination({ ...BASE, signedIn: true, birthDataResolved: true, hasBirthData: true, recoveryFailed: true }),
    "retry",
    "no se adivina un destino con la cuenta sin resolver"
  );
});

test("un perfil local nunca aparece como autoridad: el resolver no lo recibe", () => {
  const src = readFileSync(join(ROOT, "src/domain/accountDestination.ts"), "utf8");
  assert.ok(!/hasLocalProfile|home-local|profileRestored/.test(sinComentarios(src)));
});

// --- Cableado: una sola decisión, no siete ----------------------------------

test("todas las superficies de entrada pasan por el gate compartido", () => {
  const rutas = {
    "app/index.tsx": "landing",
    "app/crear-cuenta.tsx": "auth",
    "src/onboarding/OnboardingGate.tsx": "onboarding",
    "src/components/web/require-session.tsx": "app"
  } as const;
  for (const [ruta, surface] of Object.entries(rutas)) {
    const src = readFileSync(join(ROOT, ruta), "utf8");
    // El atributo puede quedar en otra línea por el formato multilínea del JSX.
    assert.ok(/AccountGate/.test(src), `${ruta} debe usar el gate compartido`);
    assert.ok(
      new RegExp(`surface="${surface}"`).test(src),
      `${ruta} debe declarar surface="${surface}"`
    );
  }
});

test("un usuario con sesión no puede montar la pantalla de login", () => {
  // Conductual: con sesión el destino NO es "sign-in", así que la superficie
  // "auth" no está permitida y el gate navega. Antes el test sólo miraba que
  // las constantes de ruta aparecieran en el archivo — un falso positivo que no
  // probaba nada: la ruta seguía renderizando SignInScreen directo.
  const completa = { ...BASE, signedIn: true, birthDataResolved: true, hasBirthData: true, localProfileReady: true };
  assert.equal(resolveAccountDestination(completa), "app-home");
  assert.ok(!destinationAllows("app-home", "auth"), "una cuenta completa no puede quedarse en el login");

  const incompleta = {
    ...BASE,
    signedIn: true,
    birthDataResolved: true,
    hasBirthData: false,
    localProfileReady: false,
    localProfileForeign: false
  };
  assert.equal(resolveAccountDestination(incompleta), "onboarding");
  assert.ok(!destinationAllows("onboarding", "auth"), "una cuenta incompleta tampoco");

  // Y estructuralmente: la ruta envuelve la UI de ingreso en el gate.
  const login = readFileSync(join(ROOT, "app/iniciar-sesion.tsx"), "utf8");
  const antesDeLaUI = login.slice(0, login.indexOf("function SignInSurface"));
  assert.ok(/surface="auth"/.test(antesDeLaUI), "la ruta debe montar el gate antes de la UI");
  // Se mira el USO en JSX, no el import ni el docstring.
  assert.ok(!/<SignInScreen/.test(antesDeLaUI), "SignInScreen no puede renderizarse antes del gate");
});

test("home-local sólo vale sin backend configurado", () => {
  const dominio = sinComentarios(readFileSync(join(ROOT, "src/domain/sessionStart.ts"), "utf8"));
  assert.ok(
    /if \(!s\.backendConfigured && \(s\.hasLocalProfile \|\| s\.profileRestored\)\) return "home-local";/.test(dominio)
  );
});

// --- El alta salió del onboarding ------------------------------------------

test("crear cuenta es una ruta propia, no un paso del onboarding", () => {
  const flow = sinComentarios(readFileSync(join(ROOT, "src/onboarding/OnboardingFlow.tsx"), "utf8"));
  assert.ok(!/AccountScreen/.test(flow));
  const alta = readFileSync(join(ROOT, "app/crear-cuenta.tsx"), "utf8");
  assert.ok(/SignUpGateScreen/.test(alta));
  // La landing manda ahí.
  const landing = readFileSync(join(ROOT, "src/components/web/orbita-landing.tsx"), "utf8");
  assert.ok(/href="\/crear-cuenta"/.test(landing), 'la landing debe abrir el alta desde "Empezar"');
});

test("la copy del alta es la del handoff", () => {
  const pantalla = readFileSync(join(ROOT, "src/onboarding/screens/SignUpGateScreen.tsx"), "utf8");
  for (const texto of [
    "Creá tu cuenta.",
    "Guardamos tu carta y tus lecturas en un solo lugar.",
    "Repetir contraseña",
    "Crear mi cuenta",
    "Verificar código",
    "Ya tengo cuenta · Iniciar sesión",
    "Ya existe una cuenta con ese email. Iniciá sesión para continuar."
  ]) {
    assert.ok(pantalla.includes(texto), `falta la copy: ${texto}`);
  }
});

// --- Chrome de la app autenticada ------------------------------------------

test("la barra de la app no tiene avatar, botón de entrar ni atajo de cuenta", () => {
  const nav = sinComentarios(readFileSync(join(ROOT, "src/components/web/web-nav.tsx"), "utf8"));
  for (const prohibido of ["avatar", "Entrar", "AuthArea", "AuthPill", "useOrbitaAuth"]) {
    assert.ok(!new RegExp(prohibido, "i").test(nav), `la barra autenticada no puede tener ${prohibido}`);
  }
  assert.ok(!/\/iniciar-sesion/.test(nav), "la barra de la app no enlaza al login");
});

test("en móvil no hay barra superior, sólo la inferior fija con área segura", () => {
  const nav = readFileSync(join(ROOT, "src/components/web/web-nav.tsx"), "utf8");
  assert.ok(/if \(isNarrow\) \{[\s\S]*?return <WebBottomNav/.test(nav), "en angosto sale sólo la inferior");
  assert.ok(/position: "fixed"/.test(nav), "la barra inferior queda pegada al viewport");
  assert.ok(/env\(safe-area-inset-bottom\)/.test(nav), "respeta el área segura");
  // Y el shell reserva alto para que no tape los últimos controles.
  const shell = readFileSync(join(ROOT, "src/components/web/web-app-shell.tsx"), "utf8");
  assert.ok(/WEB_BOTTOM_NAV_HEIGHT/.test(shell), "el contenido reserva espacio para la barra");
});

test("Perfil es siempre /perfil, nunca el login", () => {
  const nav = readFileSync(join(ROOT, "src/components/web/web-nav.tsx"), "utf8");
  assert.ok(/\{ key: "perfil", label: "Perfil", href: "\/perfil" \}/.test(nav));
});
