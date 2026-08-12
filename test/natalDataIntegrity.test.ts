import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveDebugStep } from "../src/domain/onboardingDebug";

const ROOT = join(import.meta.dirname, "..");
const FLOW = readFileSync(join(ROOT, "src/onboarding/OnboardingFlow.tsx"), "utf8");
const PERSIST_RAW = readFileSync(join(ROOT, "src/onboarding/useAccount.ts"), "utf8");
/** Sin comentarios: varios explican de qué se migró y nombran lo viejo. */
const PERSIST = PERSIST_RAW.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const EDITOR = readFileSync(join(ROOT, "app/editar-datos.tsx"), "utf8");
const EMPEZAR = readFileSync(join(ROOT, "app/empezar.tsx"), "utf8");
const ONBOARDING = readFileSync(join(ROOT, "app/onboarding.tsx"), "utf8");
const GATE = readFileSync(join(ROOT, "src/onboarding/OnboardingGate.tsx"), "utf8");
/** Sin comentarios: varios nombran el patrón viejo a propósito. */
const FLOW_CODE = FLOW.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** Cuerpo de un `useEffect`/función a partir de un ancla, balanceando llaves. */
function bloqueDesde(src: string, ancla: string): string {
  const i = src.indexOf(ancla);
  assert.notEqual(i, -1, `no se encontró el ancla: ${ancla}`);
  let depth = 0;
  for (let j = src.indexOf("{", i); j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  return src.slice(i);
}

// --- El incidente ------------------------------------------------------------
// Abrir `?debugStep=14` con sesión activa persistía los valores POR DEFECTO del
// flujo encima de los datos natales de la cuenta y recalculaba la carta: el
// paso 14 auto-ejecutaba `submit()` al montarse.

test("montar el ÚLTIMO paso por debugStep no escribe nada", () => {
  // El paso de cierre se nombra (`FINAL_STEP`) en vez de ir por número: el
  // camino de escritura depende del índice y un renumerado silencioso ya costó
  // datos cuando el alta salió del onboarding.
  assert.ok(/const FINAL_STEP = TOTAL - 1;/.test(FLOW), "el último paso debe estar nombrado");
  const autoSubmit = bloqueDesde(FLOW, "if (step === FINAL_STEP && !PAYWALL_ENABLED)");
  assert.ok(
    /if \(inspeccion\) return;/.test(
      bloqueDesde(FLOW, "useEffect(() => {\n    if (inspeccion) return;\n    if (step === FINAL_STEP")
    ),
    "el efecto de cierre debe cortar en inspección"
  );
  assert.ok(autoSubmit.includes("submit()"), "el efecto sigue siendo el del submit");

  // Y `submit` en sí falla cerrado, por si lo dispara un CTA.
  const submit = bloqueDesde(FLOW, "const submit = async () => {");
  const primerasLineas = submit.split("\n").slice(0, 4).join("\n");
  assert.ok(/if \(inspeccion\) return;/.test(primerasLineas), "submit debe cortar en la primera línea");
});

test("el alta vive en el flujo, y la inspección nunca crea una cuenta", () => {
  assert.ok(/AccountScreen/.test(FLOW_CODE), "la cuenta es un paso del onboarding");
  // La cuenta la crea la UI OFICIAL de Clerk. Los caminos propios de email,
  // código y OAuth ya no existen: reimplementaban la máquina de estados de
  // Clerk y eran, además, dos superficies más que la inspección podía disparar.
  const cuenta = readFileSync(join(ROOT, "src/onboarding/screens/AccountScreen.tsx"), "utf8");
  assert.ok(/<ClerkSignUp\b/.test(cuenta), "el paso monta la UI oficial");
  for (const viejo of ["accountOAuth", "accountNext", "account.oauth(", "account.verify("]) {
    assert.ok(!FLOW_CODE.includes(viejo), `el camino custom no puede volver: ${viejo}`);
  }
  // Los dos efectos del paso de cuenta —guardar el borrador remoto y avanzar
  // cuando Clerk activa la sesión— cortan ANTES de nada bajo inspección:
  // `debugStep` puede DIBUJAR el paso, nunca escribir ni crear una cuenta.
  for (const ancla of [
    "if (step !== STEP_ACCOUNT) return;",
    "if (step !== STEP_ACCOUNT || !sesionActiva) return;"
  ]) {
    const i = FLOW_CODE.indexOf(ancla);
    assert.ok(i > 0, `falta el efecto: ${ancla}`);
    const antes = FLOW_CODE.slice(Math.max(0, i - 120), i);
    assert.ok(/if \(inspeccion\) return;/.test(antes), `${ancla} debe cortar en inspección primero`);
  }
  // Y ni el borrador remoto ni la cadena de cierre se disparan en inspección.
  assert.ok(
    FLOW_CODE.indexOf("if (inspeccion) return;") < FLOW_CODE.indexOf("prepareSignupDraft({"),
    "el borrador remoto no se guarda en inspección"
  );
  const cierre = bloqueDesde(FLOW_CODE, "const submit = async () => {");
  assert.ok(
    /if \(inspeccion\) return;/.test(cierre.split("\n").slice(0, 4).join("\n")),
    "el cierre corta en inspección antes de finalizar"
  );
});

test("nada sale del dispositivo antes de que haya una cuenta activa", () => {
  // El alta junta TODO en el borrador local. El cierre es el único punto que
  // convierte eso en dato remoto, y sólo con un usuario Clerk confirmado: si no
  // hay cuenta vuelve al paso de cuenta con el borrador intacto.
  const guard = FLOW_CODE.slice(FLOW_CODE.indexOf("const cuentaActiva"), FLOW_CODE.indexOf("const cuentaActiva") + 320);
  assert.ok(guard.length > 0, "falta el guard de cuenta activa antes de persistir");
  assert.match(guard, /if \(finalizeOnboarding && !cuentaActiva\) \{/);
  assert.match(guard, /setStep\(STEP_ACCOUNT\);/, "sin cuenta se vuelve al paso de cuenta");
  assert.match(guard, /submitLock\.current = false;/, "y se libera el lock para poder reintentar");
  // El guard va ANTES de cualquier llamada de la cadena de cierre.
  assert.ok(
    FLOW_CODE.indexOf("const cuentaActiva") < FLOW_CODE.indexOf("await finalizeOnboarding("),
    "el guard tiene que preceder a la escritura"
  );
});

test("en inspección no se calcula carta ni se pisa el borrador", () => {
  const triada = bloqueDesde(FLOW, "if (step < STEP_COMPUTE_TRIAD || !computeTriad || !birthPlace) return;");
  assert.ok(/inspeccion/.test(FLOW.slice(FLOW.indexOf("Inspección: no se le pega a la API"), FLOW.indexOf("if (step < STEP_COMPUTE_TRIAD"))));
  assert.ok(triada.length > 0);

  // El borrador local pasó a multilínea al sumarle el `clientDraftId`.
  const borrador = bloqueDesde(FLOW, "writeDraft({");
  assert.ok(borrador.length > 0);
  assert.match(borrador, /clientDraftId: clientDraftId \?\? undefined/, "el id del borrador remoto viaja con él");
  const efectoBorrador = FLOW.slice(FLOW.indexOf("// En inspección no se guarda"), FLOW.indexOf("writeDraft({"));
  assert.ok(/if \(inspeccion\) return;/.test(efectoBorrador), "el borrador real no se sobrescribe");
});

test("sin herramientas internas no hay inspección posible", () => {
  assert.equal(resolveDebugStep({ raw: "14", total: 15, internalToolsEnabled: false }), null);
});

// --- Separación de endpoints -------------------------------------------------

test("el onboarding finaliza desde el borrador remoto autoritativo", () => {
  const inner = bloqueDesde(PERSIST, "function useOnboardingFinalizeInner()");
  assert.ok(/appApi\.onboarding\.completeSignupFromDraft/.test(inner));
  assert.ok(!/appApi\.onboarding\.completeBirthData/.test(inner));
  assert.ok(!/appApi\.onboarding\.markAccountCreated/.test(inner));
  assert.ok(!/upsertForCurrentUser/.test(inner), "el alta no debe usar el endpoint de edición");
});

test("Editar datos persiste por el endpoint de perfil, con source profile", () => {
  const inner = bloqueDesde(PERSIST, "function useProfilePersistInner()");
  assert.ok(/appApi\.birthData\.upsertForCurrentUser/.test(inner));
  assert.ok(/source: "profile"/.test(inner), "la intención tiene que viajar explícita");
  assert.ok(!/completeBirthData/.test(inner), "una edición no es completar el onboarding");
  // Y la pantalla usa ese hook, no el del alta.
  assert.ok(/useProfileBirthDataPersist/.test(EDITOR));
  assert.ok(!/useBackendPersistStrict/.test(EDITOR));
});

test("la persistencia compartida ya no genera el día con la fecha del dispositivo", () => {
  assert.ok(
    !/readings\.generateToday/.test(PERSIST),
    "generateToday usaba fecha y timezone del navegador; el día lo decide el servidor"
  );
  // Se revisan los DOS hooks de persistencia, no todo el archivo: el preview
  // público de la tríada (`useOnboardingComputeTriadInner`) sí usa una fecha del
  // cliente, y ahí es correcto — corre ANTES de que exista la cuenta, cuando
  // todavía no hay zona natal persistida de la cual derivar el día canónico.
  for (const ancla of ["function useBackendPersistInner()", "function useProfilePersistInner()"]) {
    const inner = bloqueDesde(PERSIST, ancla);
    assert.ok(!/new Date\(/.test(inner), `${ancla} no puede tomar el día del dispositivo`);
    assert.ok(!/generateToday/.test(inner), `${ancla} no genera el día`);
  }
});

// --- Una cuenta con datos no vuelve al alta ---------------------------------

test("web y nativo rechazan una cuenta completa por el MISMO gate", () => {
  const sinComentarios = (x: string) =>
    x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const [nombre, src] of [["app/empezar.tsx", EMPEZAR], ["app/onboarding.tsx", ONBOARDING]] as const) {
    const codigo = sinComentarios(src);
    assert.ok(/OnboardingGate/.test(codigo), `${nombre} debe pasar por el gate compartido`);
    assert.ok(
      !/OnboardingFlow/.test(codigo),
      `${nombre} no puede montar el flujo directo: se saltearía el gate`
    );
  }
  // El gate delega en el resolver único; la consulta del estado autoritativo y
  // la redirección viven ahí, no duplicadas en cada superficie.
  assert.ok(/AccountGate surface="onboarding"/.test(GATE), "el gate usa la puerta compartida");
  const puerta = readFileSync(join(ROOT, "src/components/orbita/AccountGate.tsx"), "utf8");
  assert.ok(/HOME_ROUTE/.test(puerta) && /ONBOARDING_ROUTE/.test(puerta) && /SIGN_IN_ROUTE/.test(puerta));
  // Y la recuperación de una cuenta preexistente incompleta: al alta no vuelve.
  assert.ok(/EDIT_BIRTH_DATA_ROUTE/.test(puerta), "falta el destino de recuperación");
  const hook = readFileSync(join(ROOT, "src/hooks/useAccountDestination.tsx"), "utf8");
  assert.ok(
    /appApi\.onboarding\.getCompletionStatus/.test(hook),
    "la autoridad es el estado de completitud, no `birthData` suelto"
  );
  assert.ok(!/birthData\.getCurrent/.test(hook), "existir birthData no prueba que haya carta");
  // No se afirma nada mientras resuelve: sin esto habría un salto visible.
  assert.ok(/completion !== undefined/.test(hook));
});

// --- Una sola ruta de persistencia ------------------------------------------
// Había DOS escrituras al llegar al paso 14: un efecto al montar (sin guarda de
// inspección y con `void`, así que un fallo era invisible) y otra en `submit()`.
// El efecto era el que persistía los valores por defecto en un salto directo.

test("existe exactamente UNA llamada de cierre en el flujo", () => {
  const llamadas = FLOW_CODE.match(/await finalizeOnboarding\(\{/g) ?? [];
  assert.equal(llamadas.length, 1, `se esperaba una sola persistencia, hay ${llamadas.length}`);
  // Y la que había antes no puede convivir: sería una escritura sin el vínculo
  // del borrador anónimo, que es lo que distingue un alta de una recuperación.
  assert.ok(!/persistBackend\(\{/.test(FLOW_CODE), "el camino viejo de persistencia no puede volver");
});

test("no queda ningún cierre con `void` ni el ref calcFired", () => {
  assert.ok(!/void\s+finalizeOnboarding/.test(FLOW_CODE), "un `void` esconde el fallo y navega igual");
  assert.ok(!/void\s+persistBackend/.test(FLOW_CODE));
  assert.ok(!/calcFired/.test(FLOW_CODE), "el efecto de persistencia del paso 14 debe estar eliminado");
});

test("el cierre se espera dentro de submit, y la salida espera sólo los datos", () => {
  const submit = bloqueDesde(FLOW, "const submit = async () => {");
  const i = submit.indexOf("await finalizeOnboarding({");
  assert.notEqual(i, -1, "la persistencia debe estar dentro de submit y con await");
  // `submit` no navega: el retorno de una llamada no reemplaza a la autoridad
  // reactiva. Perfil, limpieza y salida viven en `enterApp`, que corre sólo
  // cuando el estado autoritativo confirma los datos natales persistidos.
  for (const prohibido of ["await createProfile(", "clearDraft()", "router.replace("]) {
    assert.ok(!submit.includes(prohibido), `${prohibido} no puede depender del retorno de la escritura`);
  }
  const salida = bloqueDesde(FLOW, "const enterApp = async () => {");
  const perfil = salida.indexOf("await createProfile(");
  const limpiar = salida.indexOf("clearDraft()");
  const navegar = salida.indexOf("router.replace(");
  assert.ok(perfil !== -1 && limpiar > perfil && navegar > limpiar, "el orden de salida se conserva");
  // La carta no participa de la puerta; `birthDataReady` sí.
  assert.match(FLOW_CODE, /if \(!isBirthDataReady\(completion\)\) return;\s*void enterApp\(\);/);
  // El destino del cierre es la recepción del día 1 (decisión 2026-08-12): la
  // Home directa se saltaba la única entrega ceremonial del alta.
  assert.match(salida, /router\.replace\(\{\s*pathname: RECEPTION_ROUTE,/);
  assert.doesNotMatch(salida, /HOME_ROUTE/);
  assert.match(FLOW_CODE, /if \(enterLock\.current\) return;/, "y se sale una sola vez");
});

test("si la persistencia falla no se crea perfil, no se limpia el borrador y no se navega", () => {
  const submit = bloqueDesde(FLOW, "const submit = async () => {");
  const catchBlock = submit.slice(submit.indexOf("} catch {"));
  assert.ok(/setSubmitError\(/.test(catchBlock), "el fallo tiene que ser visible");
  assert.ok(/return;/.test(catchBlock), "y tiene que cortar el cierre");
  assert.ok(/submitLock\.current = false/.test(catchBlock), "el lock se libera para poder reintentar");
  // El mismo estado de guardado muestra recuperación inline: no existe una
  // pantalla terminal por fallo del cálculo de la carta.
  assert.match(FLOW, /<SavingBirthData[\s\S]*?error=\{submitError\}/);
  assert.match(FLOW, /retrying \? "Guardando…" : "Reintentar guardado"/);
  assert.doesNotMatch(FLOW, /No pudimos guardar tu carta/);
});

// --- El alta normal sigue funcionando ---------------------------------------

test("el alta normal sigue creando datos natales una vez, y el reintento es idempotente", () => {
  // El frontend sólo manda el id estable. Los datos —incluida la timezone ya
  // enriquecida— se copian del borrador remoto dentro de la mutación atómica.
  const inner = bloqueDesde(PERSIST, "function useOnboardingFinalizeInner()");
  assert.ok(!/Date\.now\(\)/.test(inner), "un valor por llamada rompería la idempotencia");
  assert.ok(!/Math\.random/.test(inner));
  assert.match(inner, /clientDraftId: input\.clientDraftId/);
  for (const campo of ["birthDate", "birthTime", "birthPlaceLabel", "latitude", "longitude", "timezone"]) {
    assert.ok(!new RegExp(`input\\.${campo}`).test(inner), `${campo} no vuelve desde el navegador`);
  }
  // Y el flujo canónico usa el cierre del alta.
  assert.ok(/useOnboardingFinalize\(\)/.test(FLOW));
});

test("la cadena obligatoria es atómica y la carta queda en mejor esfuerzo", () => {
  const inner = bloqueDesde(PERSIST, "function useOnboardingFinalizeInner()");
  let prev = -1;
  for (const paso of [
    "appApi.users.getOrCreateCurrentUser",
    "appApi.onboarding.completeSignupFromDraft",
    "appApi.charts.calculateOrCreateNatalChart"
  ]) {
    const i = inner.indexOf(paso);
    assert.ok(i > prev, `${paso} quedó fuera de orden o falta`);
    prev = i;
  }
  // El borrador anónimo se adjunta con SU id: sin eso, quien acaba de crear su
  // cuenta parece una recuperación de cuenta preexistente.
  assert.ok(/clientDraftId: input\.clientDraftId/.test(inner));
  // Reintentos acotados, no un bucle infinito ni un fallo silencioso.
  assert.ok(/runSessionAttempts\(\{/.test(inner));
  assert.ok(/ONBOARDING_FINALIZE_FAILED/.test(inner), "el agotamiento tiene que ser visible");
  const iResult = inner.indexOf('if (result.status === "error")');
  const iChart = inner.indexOf("appApi.charts.calculateOrCreateNatalChart");
  assert.ok(iChart > iResult, "la carta se intenta después de confirmar el guardado");
  assert.match(inner.slice(iChart - 40), /void convex\.action[\s\S]*?\.catch\(\(\) => undefined\)/);
  // Y el editor NO comparte esta cadena: completar el alta y editar el perfil
  // son endpoints distintos a propósito.
  assert.ok(!/upsertForCurrentUser/.test(inner));
});

// --- Persistencia realmente estricta ----------------------------------------
// El hook del alta pasaba por un wrapper que atrapaba TODO fallo del backend y
// resolvía como éxito, así que el catch de `submit` era inalcanzable y el cierre
// creaba perfil, limpiaba borrador y navegaba sin haber escrito en Convex.

test("el hook propaga el fallo de guardado y sólo absorbe el derivado", () => {
  assert.ok(
    !/useBackendPersistSwallowInner/.test(PERSIST),
    "el wrapper que atrapaba los errores debe estar eliminado, no sólo sin usar"
  );
  const hook = bloqueDesde(PERSIST, "export function useOnboardingFinalize()");
  assert.ok(/useOnboardingFinalizeInner\(\)/.test(hook), "el alta usa el cierre estricto");
  // El guardado agota su presupuesto y tira. El único catch pertenece a la
  // carta mejor-esfuerzo, que no puede convertir datos guardados en un error.
  const inner = bloqueDesde(PERSIST, "function useOnboardingFinalizeInner()");
  assert.ok(/throw new Error\("ONBOARDING_FINALIZE_FAILED"\)/.test(inner));
  assert.equal((inner.match(/\.catch\(/g) ?? []).length, 1);
  assert.match(inner, /calculateOrCreateNatalChart[\s\S]*?\.catch\(\(\) => undefined\)/);
});

test("sesión no lista RECHAZA en vez de resolver como éxito", () => {
  const inner = bloqueDesde(PERSIST, "function useOnboardingFinalizeInner()");
  assert.ok(
    /if \(!isSignedIn\) throw new Error\("ONBOARDING_SESSION_NOT_READY"\)/.test(inner),
    "la carrera post-verify no puede resolver sin escribir"
  );
  assert.ok(!/if \(!isSignedIn\) return;/.test(inner));
});

test("el cierre no reconstruye ni completa el payload en el cliente", () => {
  const inner = bloqueDesde(PERSIST, "function useOnboardingFinalizeInner()");
  assert.ok(!/validateBirthPayload\(input\)/.test(inner));
  assert.match(inner, /completeSignupFromDraft/);
  assert.ok(!/"Sin especificar"/.test(inner), "el lugar no se rellena");
  assert.ok(!/deviceTimezone\(\)/.test(inner), "la zona no sale del dispositivo");
});

test("el borrador remoto se guarda y se CONFIRMA antes de abrir Clerk", () => {
  // La zona horaria es un enriquecimiento que el backend resuelve DESPUÉS de
  // guardar, así que acá no se valida el payload: se guarda, y quien decide si
  // el borrador está completo es `confirmSignupDraft`. Sin ese `ready`, no se
  // crea la identidad — una cuenta sin datos no la sabe recuperar nadie.
  const inner = bloqueDesde(PERSIST, "function useOnboardingSignupDraftInner()");
  const iGuarda = inner.indexOf("appApi.onboarding.saveDraft");
  const iConfirma = inner.indexOf("appApi.onboarding.confirmSignupDraft");
  assert.ok(iGuarda !== -1 && iGuarda < iConfirma, "primero se guarda, después se confirma");
  assert.ok(/clientDraftId: input\.clientDraftId/.test(inner), "el borrador es reencontrable");
  assert.ok(/runSessionAttempts\(\{/.test(inner), "un enriquecimiento en vuelo no es un error");
  assert.ok(/throw new Error\("ONBOARDING_SIGNUP_DRAFT_NOT_READY"\)/.test(inner));
  assert.ok(!/deviceTimezone\(\)/.test(inner), "la zona no sale del dispositivo");
  // Y el paso de cuenta no abre Clerk sin ese `ready`.
  const cuenta = readFileSync(join(ROOT, "src/onboarding/screens/AccountScreen.tsx"), "utf8");
  assert.match(cuenta, /phase === "ready" \? \([\s\S]{0,200}<ClerkSignUp\b/);
});

test("el lock de reentrada es un ref sincrónico, no estado de React", () => {
  const submit = bloqueDesde(FLOW, "const submit = async () => {");
  const primeras = submit.split("\n").slice(0, 8).join("\n");
  assert.ok(/submitLock\.current = true/.test(primeras), "el lock se toma en las primeras líneas");
  assert.ok(
    !/if \(submitting\) return/.test(submit),
    "`submitting` es estado: dos taps del mismo render pasarían los dos"
  );
  assert.ok(/const submitLock = useRef\(false\)/.test(FLOW));
});

// --- Validación en el borde de escritura del EDITOR --------------------------
// `birthSaveGate` espera el doc remoto pero NO lo valida. Con un documento
// legado incompleto (lugar "Sin especificar" y sin coordenadas), cambiar sólo la
// fecha o la hora arrastraba ese lugar vacío y lo volvía a escribir,
// recalculando la carta sobre datos que no son de nadie.

test("el editor valida el payload antes de cualquier mutación", () => {
  const inner = bloqueDesde(PERSIST, "function useProfilePersistInner()");
  const iValida = inner.indexOf("validateBirthPayload(input)");
  const iEscribe = inner.indexOf("upsertBirthData({");
  assert.ok(iValida !== -1, "el editor debe validar");
  assert.ok(iValida < iEscribe, "validar ANTES de escribir");
  assert.ok(inner.indexOf("await upsertBirthData") < inner.indexOf("void calculateChart"));
  assert.match(inner, /void calculateChart\(\{\}\)\.catch\(\(\) => undefined\)/);
  assert.doesNotMatch(inner, /await calculateChart/);
});

test("el editor no rellena lugar ni zona", () => {
  const inner = bloqueDesde(PERSIST, "function useProfilePersistInner()");
  assert.ok(!/"Sin especificar"/.test(inner));
  assert.ok(!/deviceTimezone\(\)/.test(inner));
  // Sólo se usan campos del payload validado.
  assert.ok(/birthPlaceLabel: payload\.birthPlaceLabel/.test(inner));
  assert.ok(/timezone: payload\.timezone/.test(inner));
  assert.ok(/latitude: payload\.latitude/.test(inner));
});

test("sesión no lista en el editor RECHAZA: no se actualiza el perfil local", () => {
  const inner = bloqueDesde(PERSIST, "function useProfilePersistInner()");
  assert.ok(/throw new Error\("PROFILE_SESSION_NOT_READY"\)/.test(inner));
  assert.ok(!/if \(!isSignedIn\) return;/.test(inner));
  // Y el editor sólo aplica el cambio local DESPUÉS de esperar el backend.
  const save = bloqueDesde(EDITOR, "const save = async () => {");
  const iBackend = save.indexOf("await persistBackend(");
  const iLocal = save.indexOf("await updateProfile(");
  assert.ok(iBackend !== -1 && iBackend < iLocal, "el rechazo tiene que impedir la escritura local");
});

test("el editor distingue documento incompleto de fallo de conexión", () => {
  assert.ok(/BirthPayloadError/.test(EDITOR), "necesita reconocer el motivo");
  assert.ok(/birthPayloadMessage\(e\.problem\)/.test(EDITOR), "y mostrar el mensaje concreto");
  assert.ok(
    /revisá tu conexión/.test(EDITOR),
    "el mensaje de red sigue existiendo para los fallos que sí son de red"
  );
});

test("no se toca birthSaveGate ni el arrastre del doc remoto", () => {
  const editsSrc = readFileSync(join(ROOT, "src/domain/birthEdits.ts"), "utf8");
  assert.ok(/export function birthSaveGate/.test(editsSrc));
  assert.ok(/keepRemotePlace/.test(editsSrc), "el arrastre sigue siendo útil");
  assert.ok(/birthSaveGate\(/.test(EDITOR), "el editor sigue esperando el doc remoto");
});
