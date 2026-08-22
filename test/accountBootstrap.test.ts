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
  const inicio = gate.indexOf('if (destination === "bootstrap") {');
  const fin = gate.indexOf('if (destination === "loading") {', inicio);
  const bloque = gate.slice(inicio, fin);
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

// --- "Crear una cuenta": la cuenta va PRIMERO --------------------------------

/** El bloque de `createAccount` del login, ya sin comentarios. */
const bloqueCrearCuenta = () => {
  const login = sinComentarios(readFileSync(join(ROOT, "app/iniciar-sesion.tsx"), "utf8"));
  const inicio = login.indexOf("const createAccount");
  assert.ok(inicio >= 0, "el login sigue ofreciendo crear una cuenta");
  return login.slice(inicio, inicio + 400);
};

test('"Crear una cuenta" abre el alta auth-first, con el email ya cargado', () => {
  // El alta es auth-first: la cuenta se crea con la UI oficial de Clerk
  // (`/crear-cuenta`) ANTES de los pasos, así que cuando empiezan ya hay sesión
  // donde persistir. Mandar acá al onboarding montaba los pasos inmersivos sin
  // cuenta, y el resolver —que sin sesión resuelve `sign-in`— los rebotaba.
  const bloque = bloqueCrearCuenta();
  assert.ok(/SIGN_UP_ROUTE/.test(bloque), "debe abrir el alta auth-first");
  assert.ok(!/ONBOARDING_ROUTE/.test(bloque), "los pasos inmersivos no son la entrada sin sesión");
  assert.ok(/params: email \? \{ email \}/.test(bloque), "el email tipeado viaja: no se pide dos veces");

  // Y esa constante es la pantalla de Clerk, no un alias del onboarding.
  const rutas = sinComentarios(readFileSync(join(ROOT, "src/domain/appRoutes.ts"), "utf8"));
  assert.match(rutas, /export const SIGN_UP_ROUTE = "\/crear-cuenta";/);
});

test("crear una cuenta ABANDONA el borrador antes de navegar", () => {
  // Con el alta auth-first ya no se produce borrador anónimo, pero una
  // instalación vieja puede tener uno colgado: no tiene dueño, así que pasa el
  // control de pertenencia y la cuenta recién creada nacería con los datos
  // natales de otra persona. Se abandona acá, que es donde se declara "esta
  // cuenta no es la del borrador".
  const bloque = bloqueCrearCuenta();
  const salida = bloque.indexOf("leaveWithoutSignIn");
  const borrado = bloque.indexOf("clearDraft()");
  const navegacion = bloque.indexOf("router.replace");
  assert.ok(salida >= 0, "sigue archivando lo del dueño anterior antes de soltar el teléfono");
  assert.ok(borrado > salida, "el borrado va DENTRO del `go`: si el archivado falla, no se borra nada");
  assert.ok(navegacion > borrado, "primero se abandona el borrador, después se navega");

  const login = sinComentarios(readFileSync(join(ROOT, "app/iniciar-sesion.tsx"), "utf8"));
  assert.match(login, /import \{ clearDraft \} from "@\/domain\/onboardingDraft";/);
});

// --- El onboarding sin restos de autenticación -------------------------------

test("el onboarding ya no crea la cuenta: sólo carga los datos natales", () => {
  const flow = sinComentarios(readFileSync(join(ROOT, "src/onboarding/OnboardingFlow.tsx"), "utf8"));
  // Trece pasos: Align (0) → cierre (12). Sin portada y sin paso de cuenta. Los
  // índices se prueban a propósito: el camino de escritura depende de ellos y un
  // renumerado silencioso ya costó datos.
  assert.match(flow, /const TOTAL = 13;/);
  assert.match(flow, /const FINAL_STEP = 12;/);
  // Ni la pantalla de alta ni su cableado sobreviven acá. Un resto que volviera
  // a crear una cuenta sería un SEGUNDO camino de alta corriendo sobre una
  // sesión que ya existe.
  for (const resto of [
    "AccountScreen",
    "STEP_ACCOUNT",
    "prepareSignupDraft",
    "useOnboardingFinalize",
    "useAccountFlow",
    "sessionActivated"
  ]) {
    assert.ok(!new RegExp(resto).test(flow), `el paso de cuenta ya no vive acá: ${resto}`);
  }
});

test("el cierre persiste los datos natales contra la cuenta ya activa", () => {
  const flow = sinComentarios(readFileSync(join(ROOT, "src/onboarding/OnboardingFlow.tsx"), "utf8"));
  // Una sola escritura, y va contra la sesión que ya existe: no hay borrador
  // remoto que confirmar después del alta.
  assert.match(flow, /const persistBirthData = useOnboardingBirthDataPersist\(\);/);
  // Nada sale del dispositivo sin sesión confirmada: si el token está en vuelo
  // no se escribe ni se navega, y lo cargado queda intacto para reintentar.
  assert.match(flow, /if \(persistBirthData && !auth\?\.isSignedIn\)/);
  // El último caso del switch es el cierre, en el mismo índice que FINAL_STEP.
  assert.match(flow, /case FINAL_STEP:\s*default:/);
  // El id local del alta sobrevive, pero ya no adjunta ninguna fila anónima a la
  // cuenta: le cobra a ese id el cupo de reintentos del cálculo de la tríada.
  assert.match(flow, /ensureClientDraftId/);
});

test("la puerta del onboarding no es sticky: decide el resolver en cada render", () => {
  const gate = sinComentarios(readFileSync(join(ROOT, "src/onboarding/OnboardingGate.tsx"), "utf8"));
  assert.match(gate, /<AccountGate surface="onboarding"[\s\S]*?<OnboardingFlow \/>/);
  // Una puerta que se "pega" —que recuerda haber entrado y sigue montando los
  // pasos— deja el alta viva sobre una cuenta que ya resolvió Home o editor de
  // datos, que es justo lo que `destinationAllows` existe para impedir.
  for (const pegote of ["sticky", "useRef", "useState", "keepMounted", "everEntered"]) {
    assert.ok(!new RegExp(pegote).test(gate), `la puerta no puede recordar nada: ${pegote}`);
  }
});
