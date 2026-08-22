import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  destinationAllows,
  resolveAccountDestination,
  type AccountState
} from "../src/domain/accountDestination";
import { resolveEntryForPlatform, type ModulePlatform } from "./moduleGraph";

const ROOT = join(import.meta.dirname, "..");
const sinComentarios = (x: string) =>
  x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const fuenteDeEntrada = (ruta: string, plataforma: ModulePlatform) =>
  readFileSync(resolveEntryForPlatform(ruta, plataforma), "utf8");

const BASE: AccountState = {
  backendConfigured: true,
  clerkLoaded: true,
  signedIn: false,
  completionResolved: false
};

/** Estado autoritativo tal como lo devuelve `onboarding.getCompletionStatus`. */
const READY = {
  status: "chart_ready",
  recovery: null,
  profileReady: true,
  birthDataReady: true,
  chartReady: true
} as const;
/** Alta iniciada en este flujo, todavía sin carta. */
const EN_ALTA = {
  status: "onboarding_incomplete",
  recovery: "onboarding",
  profileReady: true,
  birthDataReady: false,
  chartReady: false
} as const;
/** Cuenta que YA existía y quedó incompleta. */
const LEGACY_INCOMPLETA = {
  status: "profile_incomplete",
  recovery: "edit_birth_data",
  profileReady: true,
  birthDataReady: false,
  chartReady: false
} as const;
/** Datos natales completos pero SIN carta persistida. */
const SIN_CARTA = {
  status: "chart_pending",
  recovery: null,
  profileReady: true,
  birthDataReady: true,
  chartReady: false
} as const;

const conCuenta = (completion: AccountState["completion"], extra: Partial<AccountState> = {}) => ({
  ...BASE,
  signedIn: true,
  completionResolved: true,
  completion,
  localProfileReady: true,
  localProfileForeign: false,
  ...extra
});

// --- El resolver: una sola decisión -----------------------------------------

test("sin sesión: sólo landing y login; ni el alta ni la app", () => {
  assert.equal(resolveAccountDestination(BASE), "sign-in");
  assert.ok(destinationAllows("sign-in", "landing"));
  assert.ok(destinationAllows("sign-in", "auth"));
  // Auth-first: el alta arranca con la cuenta ya creada, así que sin sesión no
  // se monta el onboarding — se pasa antes por `auth`.
  assert.ok(!destinationAllows("sign-in", "onboarding"), "el alta no empieza sin cuenta");
  // La app sigue cerrada: sin sesión no se entra a ninguna Home.
  assert.ok(!destinationAllows("sign-in", "app"));
});

test("los datos persistidos abren la app, y con perfil local propio", () => {
  assert.equal(resolveAccountDestination(conCuenta(READY)), "app-home");
  assert.ok(destinationAllows("app-home", "app"));
  // Y no puede quedarse en landing, login ni onboarding.
  for (const surface of ["landing", "auth", "onboarding"] as const) {
    assert.ok(!destinationAllows("app-home", surface), surface);
  }
  // Cuenta completa sin perfil local de ESTA cuenta: se hidrata antes de entrar.
  assert.equal(resolveAccountDestination(conCuenta(READY, { localProfileReady: false })), "bootstrap");
});

test("datos natales persistidos abren Home aunque la carta siga pendiente", () => {
  assert.equal(resolveAccountDestination(conCuenta(SIN_CARTA)), "app-home");
  assert.ok(destinationAllows("app-home", "app"));
  // La disponibilidad del derivado no cambia el acceso si birthData sigue listo.
  assert.equal(
    resolveAccountDestination(conCuenta({ ...READY, chartReady: false })),
    "app-home"
  );
});

test("alta en curso → onboarding; cuenta preexistente incompleta → editar datos", () => {
  // La diferencia la hace `recovery`, que sale del origen persistido del
  // borrador (`anonymous_signup` vs. recuperación). El alta es create-only: una
  // cuenta que ya existía no puede volver ahí.
  assert.equal(resolveAccountDestination(conCuenta(EN_ALTA, { localProfileReady: false })), "onboarding");
  assert.ok(destinationAllows("onboarding", "onboarding"));
  assert.ok(!destinationAllows("onboarding", "app"), "una cuenta sin datos no entra a Home");

  assert.equal(
    resolveAccountDestination(conCuenta(LEGACY_INCOMPLETA, { localProfileReady: false })),
    "edit-birth-data"
  );
  assert.ok(destinationAllows("edit-birth-data", "edit-birth-data"));
  assert.ok(!destinationAllows("edit-birth-data", "onboarding"), "no se la manda al alta");
  // Y el editor sigue siendo la ruta normal de una cuenta completa (Perfil).
  assert.ok(destinationAllows("app-home", "edit-birth-data"));
});

test("Clerk o el estado autoritativo sin resolver → carga estable, nunca un fallback", () => {
  assert.equal(resolveAccountDestination({ ...BASE, clerkLoaded: false }), "loading");
  assert.equal(
    resolveAccountDestination({ ...BASE, signedIn: true, completionResolved: false }),
    "loading",
    "con sesión y sin el estado autoritativo NO se monta onboarding ni landing"
  );
  assert.equal(
    resolveAccountDestination(conCuenta(READY, { localProfileReady: undefined })),
    "loading",
    "el storage local todavía sin leer tampoco decide"
  );
});

test("el aislamiento de datos ajenos va antes que cualquier destino", () => {
  assert.equal(
    resolveAccountDestination(conCuenta(EN_ALTA, { localProfileForeign: true, localProfileReady: false })),
    "bootstrap"
  );
  assert.equal(
    resolveAccountDestination(conCuenta(READY, { localProfileForeign: true })),
    "bootstrap"
  );
});

test("la consulta manda sobre Clerk: `signed_out` vuelve al login", () => {
  assert.equal(
    resolveAccountDestination(
      conCuenta({
        status: "signed_out",
        recovery: null,
        profileReady: false,
        birthDataReady: false,
        chartReady: false
      })
    ),
    "sign-in"
  );
});

test("fallo de recuperación → reintento, y gana sobre todo lo demás", () => {
  assert.equal(resolveAccountDestination({ ...BASE, recoveryFailed: true }), "retry");
  assert.equal(
    resolveAccountDestination(conCuenta(READY, { recoveryFailed: true })),
    "retry",
    "no se adivina un destino con la cuenta sin resolver"
  );
});

test("un perfil local nunca aparece como autoridad: el resolver no lo recibe", () => {
  const src = readFileSync(join(ROOT, "src/domain/accountDestination.ts"), "utf8");
  assert.ok(!/hasLocalProfile|home-local|profileRestored/.test(sinComentarios(src)));
});

test("`birthData` dejó de ser la autoridad de acceso", () => {
  // Existir `birthData` no prueba que la cuenta pueda usar Órbita: sin la carta
  // calculada para ESOS datos, Home no tiene nada que dibujar. La autoridad es
  // `onboarding.getCompletionStatus`.
  const resolver = sinComentarios(readFileSync(join(ROOT, "src/domain/accountDestination.ts"), "utf8"));
  assert.ok(!/hasBirthData|birthDataResolved/.test(resolver), "el resolver no puede volver a mirar birthData");
  assert.ok(/completion/.test(resolver));

  const hook = sinComentarios(readFileSync(join(ROOT, "src/hooks/useAccountDestination.tsx"), "utf8"));
  const sesion = sinComentarios(readFileSync(join(ROOT, "src/hooks/useSessionResilience.tsx"), "utf8"));
  assert.ok(
    /appApi\.onboarding\.getCompletionStatus/.test(sesion),
    "el hook tiene que alimentarse del estado autoritativo"
  );
  assert.ok(!/birthData\.getCurrent/.test(hook + sesion), "y no de la query de datos natales");
  assert.ok(/clientDraftId/.test(sesion), "con el id del borrador, que distingue alta de recuperación");
});

test("las tabs no tienen bypass de web: bloquean hasta datos natales persistidos", () => {
  const wrapper = sinComentarios(readFileSync(join(ROOT, "app/(tabs)/_layout.tsx"), "utf8"));
  assert.match(
    wrapper,
    /export \{ default \} from "@\/routes\/v492\/tabs-layout"/,
    "Expo Router debe delegar en el módulo que Metro resuelve por plataforma"
  );

  const implementaciones = {
    native: resolveEntryForPlatform("app/(tabs)/_layout.tsx", "native"),
    web: resolveEntryForPlatform("app/(tabs)/_layout.tsx", "web")
  } as const;
  assert.equal(implementaciones.native, join(ROOT, "src/routes/v492/tabs-layout.tsx"));
  assert.equal(implementaciones.web, join(ROOT, "src/routes/v492/tabs-layout.web.tsx"));

  for (const [plataforma, archivo] of Object.entries(implementaciones)) {
    const layout = sinComentarios(readFileSync(archivo, "utf8"));
    // El bypass dejaba entrar a la web con cualquier sesión, sin datos ni carta.
    assert.ok(!/IS_WEB\s*\?\s*"allow"/.test(layout), `el bypass de ${plataforma} no puede volver`);
    assert.ok(/AccountGate/.test(layout), `las tabs de ${plataforma} pasan por el gate compartido`);
    assert.ok(/surface="app"/.test(layout), `${plataforma} declara la superficie app`);
    // La regla local (builds sin envs) sigue existiendo, pero sólo ahí.
    assert.ok(/if \(BACKEND_CONFIGURED\)/.test(layout), `${plataforma} conserva la guarda de backend`);
    assert.ok(/resolveTabsGuard/.test(layout), `${plataforma} conserva la decisión local explícita`);
  }
});

// --- Cableado: una sola decisión, no siete ----------------------------------

test("todas las superficies de entrada pasan por el gate compartido", () => {
  const rutas = [
    ["app/index.tsx", "web", "landing"],
    ["app/crear-cuenta.tsx", "web", "auth"],
    ["src/onboarding/OnboardingGate.tsx", "native", "onboarding"],
    ["app/editar-datos.tsx", "native", "edit-birth-data"],
    ["app/(tabs)/_layout.tsx", "native", "app"],
    ["app/(tabs)/_layout.tsx", "web", "app"],
    ["src/components/web/require-session.tsx", "web", "app"]
  ] as const satisfies ReadonlyArray<readonly [string, ModulePlatform, string]>;
  for (const [ruta, plataforma, surface] of rutas) {
    const src = fuenteDeEntrada(ruta, plataforma);
    // El atributo puede quedar en otra línea por el formato multilínea del JSX.
    assert.ok(/AccountGate/.test(src), `${ruta} (${plataforma}) debe usar el gate compartido`);
    assert.ok(
      new RegExp(`surface="${surface}"`).test(src),
      `${ruta} (${plataforma}) debe declarar surface="${surface}"`
    );
  }
});

test("un usuario con sesión no puede montar la pantalla de login", () => {
  // Conductual: con sesión el destino NO es "sign-in", así que la superficie
  // "auth" no está permitida y el gate navega. Antes el test sólo miraba que
  // las constantes de ruta aparecieran en el archivo — un falso positivo que no
  // probaba nada: la ruta seguía renderizando SignInScreen directo.
  assert.equal(resolveAccountDestination(conCuenta(READY)), "app-home");
  assert.ok(!destinationAllows("app-home", "auth"), "una cuenta completa no puede quedarse en el login");

  assert.equal(resolveAccountDestination(conCuenta(EN_ALTA, { localProfileReady: false })), "onboarding");
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

test("el alta la monta un solo destino: `onboarding` y nada más", () => {
  // La protección que motivó el gate sigue intacta: es lo único que impide
  // sobrescribir datos natales desde el onboarding.
  assert.equal(resolveAccountDestination(conCuenta(READY)), "app-home");
  assert.ok(!destinationAllows("app-home", "onboarding"), "una cuenta completa NUNCA monta el alta");
  // Y ahora tampoco entra quien todavía no tiene cuenta: primero `auth`.
  const otros = ["loading", "sign-in", "bootstrap", "edit-birth-data", "app-home", "retry", "degraded"] as const;
  for (const destino of otros) {
    assert.ok(!destinationAllows(destino, "onboarding"), destino);
  }
  assert.ok(destinationAllows("onboarding", "onboarding"));
});

test('"Empezar" entra por el alta auth-first, no por los pasos sin sesión', () => {
  const landing = readFileSync(join(ROOT, "src/components/web/orbita-landing.tsx"), "utf8");
  assert.ok(/href="\/empezar"/.test(landing), '"Empezar" tiene que abrir el alta completa');
  assert.ok(
    !/<WebLinkButton href="\/crear-cuenta"/.test(landing),
    "la landing tiene un solo CTA de arranque, y es /empezar"
  );

  // Y `/empezar` es sólo la puerta: redirige al alta, donde se crea la cuenta.
  // Montar `OnboardingGate` acá abría el onboarding SIN sesión y dejaba la
  // cuenta para el final, colgando de un borrador anónimo.
  for (const plataforma of ["native", "web"] as const) {
    const empezar = sinComentarios(fuenteDeEntrada("app/empezar.tsx", plataforma));
    assert.ok(
      /<Redirect href=\{SIGN_UP_ROUTE\}/.test(empezar),
      `${plataforma} tiene que redirigir al alta`
    );
    assert.ok(!/OnboardingGate/.test(empezar), `${plataforma} no puede montar los pasos sin cuenta`);
  }
});

test("`/crear-cuenta` es la entrada auth-first: selector + UI oficial de Clerk", () => {
  const pantalla = sinComentarios(
    readFileSync(join(ROOT, "src/onboarding/screens/SignUpGateScreen.tsx"), "utf8")
  );
  // Copy VISIBLE: lo que se promete es el orden del alta —primero la cuenta,
  // después los datos de nacimiento—, no el encabezado de un formulario suelto.
  for (const texto of [
    "Creá tu cuenta.",
    "Primero creás tu cuenta y después completás tus datos de nacimiento."
  ]) {
    assert.ok(pantalla.includes(texto), `falta la copy: ${texto}`);
  }
  // Las dos puertas se ven juntas y arriba, antes de escribir nada: siendo esta
  // la PRIMERA pantalla, quien ya tiene cuenta no puede depender de encontrar un
  // enlace chico debajo de un formulario de Clerk que scrollea.
  assert.ok(
    /<AuthModeSwitch\b[\s\S]{0,120}?mode="signUp"/.test(pantalla),
    "monta el selector de auth en modo alta"
  );
  assert.ok(
    !pantalla.includes("Ya tengo cuenta · Iniciar sesión"),
    "el enlace al pie no puede volver: lo reemplaza AuthModeSwitch"
  );
  assert.ok(/<ClerkSignUp email=\{email\} \/>/.test(pantalla), "monta el componente oficial");
  // Ningún campo propio: era una copia del formulario de AccountScreen que
  // había que mantener dos veces y se desfasaba con la instancia de Clerk.
  for (const prohibido of [
    "AccountScreen",
    "TextInput",
    "CodeInput",
    "Repetir contraseña",
    "Verificar código",
    "secureTextEntry"
  ]) {
    assert.ok(!pantalla.includes(prohibido), `el formulario propio no puede volver: ${prohibido}`);
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
  assert.ok(/if \(!desktop\) \{[\s\S]*?return <WebBottomNav/.test(nav), "en angosto sale sólo la inferior");
  assert.ok(/position: "fixed"/.test(nav), "la barra inferior queda pegada al viewport");
  assert.ok(/env\(safe-area-inset-bottom\)/.test(nav), "respeta el área segura");
  // Y el shell reserva alto para que no tape los últimos controles.
  const shell = readFileSync(join(ROOT, "src/components/web/web-app-shell.tsx"), "utf8");
  assert.ok(/WEB_BOTTOM_NAV_HEIGHT/.test(shell), "el contenido reserva espacio para la barra");
  assert.ok(/contentSafeBottom/.test(shell), "y lo hace como padding del contenido, no con un View suelto");
});

test("Perfil es siempre /perfil, nunca el login", () => {
  const nav = readFileSync(join(ROOT, "src/components/web/web-nav.tsx"), "utf8");
  assert.ok(/\{ key: "perfil", label: "Perfil", href: "\/perfil" \}/.test(nav));
});
