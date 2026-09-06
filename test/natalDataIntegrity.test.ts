import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveDebugStep } from "../src/domain/onboardingDebug";
import { ROOT, resolveEntryForPlatform } from "./moduleGraph";

const FLOW = readFileSync(join(ROOT, "src/onboarding/OnboardingFlow.tsx"), "utf8");
const PERSIST_RAW = readFileSync(join(ROOT, "src/onboarding/useAccount.ts"), "utf8");
/** Sin comentarios: varios explican de qué se migró y nombran lo viejo. */
const PERSIST = PERSIST_RAW.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const EDITOR = readFileSync(join(ROOT, "app/editar-datos.tsx"), "utf8");
const EMPEZAR = readFileSync(resolveEntryForPlatform("app/empezar.tsx", "web"), "utf8");
const ONBOARDING = readFileSync(resolveEntryForPlatform("app/onboarding.tsx", "native"), "utf8");
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
// Abrir el último paso por `debugStep` con sesión activa persistía los valores
// POR DEFECTO del flujo encima de los datos natales de la cuenta y recalculaba
// la carta: el paso final auto-ejecutaba la escritura al montarse. La regla
// sobrevive al rediseño auth-first: la inspección NUNCA escribe.

test("montar el ÚLTIMO paso por debugStep no escribe nada", () => {
  // El paso de cierre se nombra (`STEP_PAYWALL`) en vez de ir por número: el
  // camino de escritura depende del índice y un renumerado silencioso ya costó
  // datos cuando el alta salió del onboarding.
  assert.ok(/case STEP_PAYWALL:/.test(FLOW), "el último paso debe estar nombrado");
  // El cierre ya NO tiene ningún efecto de montaje que escriba o navegue: la
  // paywall se monta siempre y las salidas son acciones de la persona.
  assert.ok(
    !FLOW_CODE.includes("if (step !== STEP_PAYWALL) return;"),
    "no puede volver un efecto automático del cierre"
  );
  // La paywall se monta en modo inspección (sin impresión ni acciones)…
  assert.match(FLOW_CODE, /inspect=\{inspeccion\}/);

  // …y las dos escrituras en sí fallan cerradas, por si las dispara un CTA.
  const preparar = bloqueDesde(FLOW, "const prepararCarta = async () => {");
  assert.ok(
    /if \(inspeccion\) return;/.test(preparar.split("\n").slice(0, 3).join("\n")),
    "prepararCarta debe cortar en la primera línea"
  );
  const salida = bloqueDesde(FLOW, "const enterCarta = async () => {");
  assert.ok(
    /if \(inspeccion\) return;/.test(salida.split("\n").slice(0, 3).join("\n")),
    "enterCarta debe cortar en la primera línea"
  );
});

test("el acceso vive en el flujo, y la inspección nunca crea una cuenta", () => {
  assert.ok(/AuthScreen/.test(FLOW_CODE), "el acceso es el primer paso del onboarding");
  // La salida del paso de acceso —que puede navegar y limpiar el borrador—
  // corta ANTES de nada bajo inspección: `debugStep` puede DIBUJAR el paso,
  // nunca escribir ni crear una cuenta.
  const iSalida = FLOW_CODE.indexOf("if (step !== STEP_AUTH) return;");
  assert.ok(iSalida > 0, "falta el efecto de salida del acceso");
  const antes = FLOW_CODE.slice(Math.max(0, iSalida - 160), iSalida);
  assert.ok(/if \(inspeccion \|\| !HAS_BACKEND\) return;/.test(antes), "la salida corta en inspección primero");
  // El marcador remoto de alta en curso tampoco se siembra en inspección: el
  // flujo ni siquiera le pasa el handler a la pantalla.
  assert.match(FLOW_CODE, /inspeccion \|\| !clientDraftId \|\| !markSignup\s*\? undefined/);
  assert.match(FLOW_CODE, /markSignup\(clientDraftId\)/);
  // Y el paywall se monta en modo inspección: sin impresión y sin acciones.
  assert.match(FLOW_CODE, /inspect=\{inspeccion\}/);
});

test("nada se escribe sin una cuenta activa", () => {
  // Con el acceso PRIMERO, los datos natales se escriben por el camino
  // autenticado. El guard vive en el hook: sin sesión, RECHAZA — jamás se
  // resuelve como éxito ni se escribe "por si acaso".
  const inner = bloqueDesde(PERSIST, "function useOnboardingBirthDataSaveInner()");
  assert.match(inner, /if \(!isSignedIn\) throw new Error\("ONBOARDING_SESSION_NOT_READY"\)/);
  assert.ok(!/if \(!isSignedIn\) return;/.test(inner));
  // Y la pantalla del resumen traduce esa carrera a un reintento, no a un cierre.
  const preparar = bloqueDesde(FLOW_CODE, "const prepararCarta = async () => {");
  assert.match(preparar, /ONBOARDING_SESSION_NOT_READY/);
  assert.match(preparar, /setSaveError\(/);
});

test("en inspección no se calcula carta ni se pisa el borrador", () => {
  // El efecto de la tríada corta en inspección antes de pegarle a la API.
  const iTriada = FLOW_CODE.indexOf("if (step !== STEP_TRIAD) return;");
  assert.ok(iTriada > 0, "falta el efecto de la tríada");
  const antesTriada = FLOW_CODE.slice(Math.max(0, iTriada - 120), iTriada);
  assert.ok(/if \(inspeccion\) return;/.test(antesTriada), "la tríada no se calcula en inspección");
  // Sin backend, sin lugar o sin borrador tampoco se calcula: el flujo saltea
  // la superficie y el guard del efecto corta sin tocar nada.
  assert.match(FLOW_CODE, /if \(!computeTriad \|\| !birthPlace \|\| !clientDraftId\) return;/);
  assert.match(FLOW_CODE, /const canComputeTriad = Boolean\(computeTriad && birthPlace && clientDraftId\);/);

  // El borrador local viaja con su id remoto Y su dueño.
  const borrador = bloqueDesde(FLOW, "writeDraft({");
  assert.ok(borrador.length > 0);
  assert.match(borrador, /clientDraftId: clientDraftId \?\? undefined/, "el id del borrador remoto viaja con él");
  assert.match(borrador, /ownerUserId: userId \?\? undefined/, "el dueño viaja con el borrador");
  const efectoBorrador = FLOW.slice(FLOW.indexOf("// En inspección no se guarda"), FLOW.indexOf("writeDraft({"));
  assert.ok(/if \(inspeccion\) return;/.test(efectoBorrador), "el borrador real no se sobrescribe");
});

test("sin herramientas internas no hay inspección posible", () => {
  assert.equal(resolveDebugStep({ raw: "10", total: 11, internalToolsEnabled: false }), null);
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
  // Y NO el del alta: una edición no cierra el onboarding (CORE-268 reancla
  // este guard, que apuntaba al hook borrado `useBackendPersistStrict`).
  assert.ok(!/useOnboardingBirthDataSave/.test(EDITOR));
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
  // `useBackendPersistInner` se borró con CORE-268 (nadie lo llamaba desde que
  // el alta cierra con `useOnboardingBirthDataSaveInner`), así que el contrato
  // se afirma sobre los dos caminos de escritura que SÍ corren.
  for (const ancla of ["function useOnboardingBirthDataSaveInner()", "function useProfilePersistInner()"]) {
    const inner = bloqueDesde(PERSIST, ancla);
    assert.ok(!/new Date\(/.test(inner), `${ancla} no puede tomar el día del dispositivo`);
    assert.ok(!/generateToday/.test(inner), `${ancla} no genera el día`);
  }
});

// --- Una cuenta con datos no vuelve al alta ---------------------------------

test("web y nativo rechazan una cuenta completa por el MISMO gate", () => {
  const sinComentarios = (x: string) =>
    x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const [nombre, src] of [
    ["app/empezar.tsx (web)", EMPEZAR],
    ["app/onboarding.tsx (nativo)", ONBOARDING]
  ] as const) {
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
  const sesion = readFileSync(join(ROOT, "src/hooks/useSessionResilience.tsx"), "utf8");
  assert.ok(
    /appApi\.onboarding\.getCompletionStatus/.test(sesion),
    "la autoridad es el estado de completitud, no `birthData` suelto"
  );
  assert.ok(!/birthData\.getCurrent/.test(hook + sesion), "existir birthData no prueba que haya carta");
  // No se afirma nada mientras resuelve: sin esto habría un salto visible.
  assert.ok(/completion !== undefined/.test(sesion));
});

// --- Una sola ruta de persistencia ------------------------------------------
// El único punto que escribe los datos natales es "Preparar mi carta". Ningún
// efecto de montaje persiste nada, y el fallo nunca es invisible.

test("existe exactamente UNA llamada de persistencia natal en el flujo", () => {
  const llamadas = FLOW_CODE.match(/await saveBirthData\(\{/g) ?? [];
  assert.equal(llamadas.length, 1, `se esperaba una sola persistencia, hay ${llamadas.length}`);
  // Los caminos viejos no pueden convivir: serían una segunda escritura.
  assert.ok(!/persistBackend\(\{/.test(FLOW_CODE), "el camino viejo de persistencia no puede volver");
  assert.ok(!/finalizeOnboarding\(\{/.test(FLOW_CODE), "el cierre por borrador anónimo salió del flujo");
});

test("no queda ningún cierre con `void` ni el ref calcFired", () => {
  assert.ok(!/void\s+saveBirthData/.test(FLOW_CODE), "un `void` esconde el fallo y navega igual");
  assert.ok(!/void\s+persistBackend/.test(FLOW_CODE));
  assert.ok(!/calcFired/.test(FLOW_CODE), "el efecto de persistencia del cierre debe seguir eliminado");
});

test("la persistencia se espera en «Preparar mi carta», y el derivado nunca la bloquea", () => {
  const preparar = bloqueDesde(FLOW, "const prepararCarta = async () => {");
  const i = preparar.indexOf("await saveBirthData({");
  assert.notEqual(i, -1, "la persistencia debe estar dentro de prepararCarta y con await");
  // `prepararCarta` no navega fuera del flujo ni toca el perfil local: eso vive
  // en `enterCarta`, la única salida.
  for (const prohibido of ["await createProfile(", "clearDraft()", "router.replace("]) {
    assert.ok(!preparar.includes(prohibido), `${prohibido} no pertenece a la persistencia`);
  }
  // El cálculo derivado de la carta corre en mejor esfuerzo DENTRO del hook:
  // guardar es obligatorio, la carta nunca convierte un guardado en error.
  const inner = bloqueDesde(PERSIST, "function useOnboardingBirthDataSaveInner()");
  assert.ok(inner.indexOf("await completeBirthData(") < inner.indexOf("void calculateChart"));
  assert.match(inner, /void calculateChart\(\{\}\)\.catch\(\(\) => undefined\)/);
  assert.doesNotMatch(inner, /await calculateChart/);

  // La salida única: perfil local con dueño → limpiar borrador → marcar la
  // primera vez → Carta. Ningún camino nuevo pasa por /recepcion.
  const salida = bloqueDesde(FLOW, "const enterCarta = async () => {");
  const perfil = salida.indexOf("await createProfile(");
  const limpiar = salida.indexOf("clearDraft()");
  const navegar = salida.indexOf("router.replace(CARTA_TAB_ROUTE");
  assert.ok(perfil !== -1 && limpiar > perfil && navegar > limpiar, "el orden de salida se conserva");
  assert.doesNotMatch(salida, /RECEPTION_ROUTE/);
  assert.match(FLOW_CODE, /if \(enterLock\.current\) return;/, "y se sale una sola vez");
});

test("si la persistencia falla no se avanza, no se limpia nada y se puede reintentar", () => {
  const preparar = bloqueDesde(FLOW, "const prepararCarta = async () => {");
  const catchBlock = preparar.slice(preparar.indexOf("} catch (e) {"));
  assert.ok(/setSaveError\(/.test(catchBlock), "el fallo tiene que ser visible");
  assert.ok(/return;/.test(catchBlock), "y tiene que cortar el avance");
  assert.ok(/saveLock\.current = false/.test(catchBlock), "el lock se libera para poder reintentar");
  // El error se dice EN el resumen, con reintento inline: no existe una
  // pantalla terminal de fallo.
  assert.match(FLOW_CODE, /saveError=\{saveError\}/);
  const resumen = readFileSync(join(ROOT, "src/onboarding/screens/BirthSummaryScreen.tsx"), "utf8");
  assert.match(resumen, /accessibilityRole="alert"/);
  assert.match(resumen, /\{saveError\}/);
  assert.doesNotMatch(FLOW, /No pudimos guardar tu carta/);
});

// --- El alta normal sigue funcionando ---------------------------------------

test("el alta normal escribe los datos validados una vez, con reintento seguro", () => {
  // El guardado auth-first valida en el borde de escritura y no rellena nada:
  // sin lugar elegido, coordenadas o zona, no se escribe.
  const inner = bloqueDesde(PERSIST, "function useOnboardingBirthDataSaveInner()");
  assert.match(inner, /validateBirthPayload\(resolved\)/);
  assert.match(inner, /timezoneLookupFor\(input\)/, "la zona se deriva del lugar, nunca del aparato");
  assert.ok(!/deviceTimezone\(\)/.test(inner));
  assert.ok(!/"Sin especificar"/.test(inner), "el lugar no se rellena");
  // El `clientDraftId` viaja para adjuntar el marcador de alta en curso.
  assert.match(inner, /clientDraftId: input\.clientDraftId/);
  // Y el flujo canónico usa este guardado.
  assert.ok(/useOnboardingBirthDataSave\(\)/.test(FLOW));
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
  //
  // La cadena se mudó a `src/domain/anonymousSignupDraft.ts` y las dos llamadas
  // al contrato a `src/services/anonymousOnboardingTransport.ts`, porque el
  // canal tiene que ser uno SIN autenticar (ver `anonymousSignupDraftRace`).
  // Las mismas garantías se siguen exigiendo, cada una donde ahora vive.
  const inner = bloqueDesde(PERSIST, "function useOnboardingSignupDraftInner()");
  assert.ok(
    !/useConvex\(\)/.test(inner),
    "el borrador anónimo no puede viajar por el cliente atado a Clerk"
  );
  assert.ok(/anonymousSignupDraftTransport\(\)/.test(inner), "el transporte es el dedicado");
  assert.ok(/persistSignupDraft\(transport, input\)/.test(inner), "la cadena es la del dominio");
  assert.ok(!/deviceTimezone\(\)/.test(inner), "la zona no sale del dispositivo");

  const TRANSPORTE = readFileSync(join(ROOT, "src/services/anonymousOnboardingTransport.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const iGuarda = TRANSPORTE.indexOf("appApi.onboarding.saveDraft");
  const iConfirma = TRANSPORTE.indexOf("appApi.onboarding.confirmSignupDraft");
  assert.ok(iGuarda !== -1 && iGuarda < iConfirma, "primero se guarda, después se confirma");
  assert.ok(
    /clientDraftId: args\.clientDraftId/.test(TRANSPORTE),
    "el borrador es reencontrable"
  );
  assert.ok(!/setAuth/.test(TRANSPORTE), "sobre este cliente no se setea auth");
  assert.ok(!/deviceTimezone\(\)/.test(TRANSPORTE), "la zona no sale del dispositivo");

  const CADENA = readFileSync(join(ROOT, "src/domain/anonymousSignupDraft.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  // Sin `bloqueDesde`: la firma trae un `{ now, sleep }` opcional, así que la
  // primera llave NO es la del cuerpo. La cadena es lo último del archivo.
  const chain = CADENA.slice(CADENA.indexOf("export async function persistSignupDraft("));
  assert.ok(chain.length > 0, "no se encontró la cadena del borrador");
  assert.ok(
    chain.indexOf("transport.saveDraft(") < chain.indexOf("transport.confirmSignupDraft("),
    "primero se guarda, después se confirma"
  );
  assert.ok(/runSessionAttempts\(\{/.test(chain), "un enriquecimiento en vuelo no es un error");
  assert.ok(
    /clientDraftId: input\.clientDraftId/.test(chain),
    "la confirmación apunta al MISMO borrador"
  );
  assert.ok(/throw new Error\(SIGNUP_DRAFT_NOT_READY\)/.test(chain));
  assert.ok(
    /SIGNUP_DRAFT_NOT_READY = "ONBOARDING_SIGNUP_DRAFT_NOT_READY"/.test(CADENA),
    "el código de error que interpreta el alta no cambió"
  );
  assert.ok(!/deviceTimezone\(\)/.test(CADENA), "la zona no sale del dispositivo");

});

test("el lock de reentrada es un ref sincrónico, no estado de React", () => {
  const preparar = bloqueDesde(FLOW, "const prepararCarta = async () => {");
  const primeras = preparar.split("\n").slice(0, 6).join("\n");
  assert.ok(/saveLock\.current = true/.test(primeras), "el lock se toma en las primeras líneas");
  assert.ok(
    !/if \(saving\) return/.test(preparar),
    "`saving` es estado: dos taps del mismo render pasarían los dos"
  );
  assert.ok(/const saveLock = useRef\(false\)/.test(FLOW));
});

// --- Validación en el borde de escritura del EDITOR --------------------------
// `birthSaveGate` espera el doc remoto pero NO lo valida. Con un documento
// legado incompleto (lugar "Sin especificar" y sin coordenadas), cambiar sólo la
// fecha o la hora arrastraba ese lugar vacío y lo volvía a escribir,
// recalculando la carta sobre datos que no son de nadie.

test("el editor valida el payload antes de cualquier mutación", () => {
  const inner = bloqueDesde(PERSIST, "function useProfilePersistInner()");
  // La zona horaria del lugar se resuelve ANTES de validar (Photon no la trae):
  // lo validado es el payload YA completo, no el crudo del editor.
  const iZona = inner.indexOf("timezoneLookupFor(input)");
  const iValida = inner.indexOf("validateBirthPayload(resolved)");
  const iEscribe = inner.indexOf("upsertBirthData({");
  assert.ok(iZona !== -1, "el editor debe resolver la zona faltante");
  assert.ok(iValida !== -1, "el editor debe validar");
  assert.ok(iZona < iValida, "la zona se resuelve antes de validar");
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
