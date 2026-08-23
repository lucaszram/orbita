import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  destinationAllows,
  mountedOnboardingRetainsCompletion,
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

test("sin sesión: landing, login y el ALTA; nunca la app", () => {
  assert.equal(resolveAccountDestination(BASE), "sign-in");
  assert.ok(destinationAllows("sign-in", "landing"));
  assert.ok(destinationAllows("sign-in", "auth"));
  // El alta se monta sin sesión: junta todo en el borrador local y pide cuenta
  // en su paso original. Es lo que permite que la experiencia enganche primero.
  assert.ok(destinationAllows("sign-in", "onboarding"), "el alta empieza sin cuenta");
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

test("una cuenta COMPLETA no puede entrar al alta, con o sin sesión", () => {
  // La protección que motivó el gate sigue intacta: es lo único que impide
  // sobrescribir datos natales desde el onboarding.
  assert.equal(resolveAccountDestination(conCuenta(READY)), "app-home");
  assert.ok(!destinationAllows("app-home", "onboarding"), "una cuenta completa NUNCA monta el alta");
  assert.equal(
    mountedOnboardingRetainsCompletion({
      sticky: true,
      mounted: false,
      surface: "onboarding",
      destination: "app-home"
    }),
    false,
    "un deep link inicial no adquiere continuidad"
  );
});

test("el onboarding ya montado conserva el cierre hasta paywall y Carta", () => {
  // Secuencia real del build 27: la cuenta nueva empieza incompleta y el gate
  // permite montar el flujo. `Preparar mi carta` persiste birthData, pero el
  // perfil local todavía NO existe: se crea recién al salir de la paywall. La
  // query reactiva cambia por eso a bootstrap ANTES de Antes/Después.
  const inicial = resolveAccountDestination(conCuenta(EN_ALTA, { localProfileReady: false }));
  assert.equal(inicial, "onboarding");
  assert.equal(destinationAllows(inicial, "onboarding"), true);

  const despuesDeGuardar = resolveAccountDestination(
    conCuenta(SIN_CARTA, { localProfileReady: false })
  );
  assert.equal(despuesDeGuardar, "bootstrap");
  assert.equal(destinationAllows(despuesDeGuardar, "onboarding"), false);
  assert.equal(
    mountedOnboardingRetainsCompletion({
      sticky: true,
      mounted: true,
      surface: "onboarding",
      destination: despuesDeGuardar
    }),
    true,
    "bootstrap no puede desmontar el flujo antes de la paywall"
  );

  const conPerfilLocal = resolveAccountDestination(conCuenta(SIN_CARTA));
  assert.equal(conPerfilLocal, "app-home");
  assert.equal(
    mountedOnboardingRetainsCompletion({
      sticky: true,
      mounted: true,
      surface: "onboarding",
      destination: conPerfilLocal
    }),
    true,
    "la siguiente actualización reactiva tampoco expulsa el cierre"
  );
});

test("la continuidad resuelta es exclusiva del onboarding sticky ya montado", () => {
  for (const caso of [
    { sticky: false, mounted: true, surface: "onboarding" as const, destination: "app-home" as const },
    { sticky: true, mounted: false, surface: "onboarding" as const, destination: "app-home" as const },
    { sticky: true, mounted: true, surface: "auth" as const, destination: "app-home" as const },
    { sticky: true, mounted: true, surface: "app" as const, destination: "app-home" as const },
    { sticky: false, mounted: true, surface: "onboarding" as const, destination: "bootstrap" as const },
    { sticky: true, mounted: false, surface: "onboarding" as const, destination: "bootstrap" as const },
    { sticky: true, mounted: true, surface: "onboarding" as const, destination: "edit-birth-data" as const }
  ]) {
    assert.equal(mountedOnboardingRetainsCompletion(caso), false, JSON.stringify(caso));
  }
});

test("el gate cablea la continuidad sin ampliar destinationAllows", () => {
  const gate = sinComentarios(readFileSync(join(ROOT, "src/components/orbita/AccountGate.tsx"), "utf8"));
  const onboardingGate = sinComentarios(readFileSync(join(ROOT, "src/onboarding/OnboardingGate.tsx"), "utf8"));
  assert.match(gate, /mountedOnboardingRetainsCompletion\(\{/);
  assert.match(gate, /mounted: montado\.current/);
  assert.match(gate, /if \(retieneCierreOnboarding\) return;/);
  assert.ok(
    gate.indexOf("if (retieneCierreOnboarding) return <>{children}</>;") <
      gate.indexOf('if (destination === "bootstrap")'),
    "la continuidad debe ganar antes de que bootstrap desmonte el onboarding"
  );
  assert.match(onboardingGate, /surface="onboarding" sticky/);
  assert.equal(destinationAllows("app-home", "onboarding"), false);
});

test('"Empezar" abre la experiencia inmersiva, no un formulario suelto', () => {
  const landing = readFileSync(join(ROOT, "src/components/web/orbita-landing.tsx"), "utf8");
  assert.ok(/href="\/empezar"/.test(landing), '"Empezar" tiene que abrir el alta completa');
  assert.ok(
    !/<WebLinkButton href="\/crear-cuenta"/.test(landing),
    "la landing no puede abrir el formulario de cuenta como primera pantalla"
  );
});

test("el alta suelta usa la UI oficial de Clerk, no un segundo formulario propio", () => {
  const pantalla = readFileSync(join(ROOT, "src/onboarding/screens/SignUpGateScreen.tsx"), "utf8");
  // La copy de encabezado del handoff se conserva; el formulario es de Clerk.
  for (const texto of [
    "Creá tu cuenta.",
    "Guardamos tu carta y tus lecturas en un solo lugar.",
    "Ya tengo cuenta · Iniciar sesión"
  ]) {
    assert.ok(pantalla.includes(texto), `falta la copy: ${texto}`);
  }
  assert.ok(/<ClerkSignUp email=\{email\} \/>/.test(pantalla), "monta el componente oficial");
  // Ningún campo propio: era una copia del formulario de AccountScreen que
  // había que mantener dos veces y se desfasaba con la instancia de Clerk.
  for (const prohibido of ["TextInput", "CodeInput", "Repetir contraseña", "Verificar código", "secureTextEntry"]) {
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
