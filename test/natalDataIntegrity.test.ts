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

test("montar el paso 14 por debugStep no escribe nada", () => {
  // El auto-submit del paso 14 sale antes si es inspección.
  const autoSubmit = bloqueDesde(FLOW, "if (step === 14 && !PAYWALL_ENABLED)");
  assert.ok(
    /if \(inspeccion\) return;/.test(bloqueDesde(FLOW, "useEffect(() => {\n    if (inspeccion) return;\n    if (step === 14")),
    "el efecto del paso 14 debe cortar en inspección"
  );
  assert.ok(autoSubmit.includes("submit()"), "el efecto sigue siendo el del submit");

  // Y `submit` en sí falla cerrado, por si lo dispara un CTA.
  const submit = bloqueDesde(FLOW, "const submit = async () => {");
  const primerasLineas = submit.split("\n").slice(0, 4).join("\n");
  assert.ok(/if \(inspeccion\) return;/.test(primerasLineas), "submit debe cortar en la primera línea");
});

test("en inspección tampoco se abre OAuth", () => {
  const oauth = bloqueDesde(FLOW, 'const accountOAuth = async (provider: "google" | "apple") => {');
  assert.ok(/if \(inspeccion\) return;/.test(oauth.split("\n").slice(0, 4).join("\n")));
});

test("en inspección no se crea cuenta, ni se calcula carta, ni se pisa el borrador", () => {
  const cuenta = bloqueDesde(FLOW, "const accountNext = async (codeOverride?: string) => {");
  assert.ok(/if \(inspeccion\) return;/.test(cuenta.split("\n").slice(0, 4).join("\n")));

  const triada = bloqueDesde(FLOW, "if (step < 11 || !computeTriad || !birthPlace) return;");
  assert.ok(/inspeccion/.test(FLOW.slice(FLOW.indexOf("Inspección: no se le pega a la API"), FLOW.indexOf("if (step < 11"))));
  assert.ok(triada.length > 0);

  const borrador = bloqueDesde(FLOW, "writeDraft({ step, identity");
  assert.ok(borrador.length > 0);
  const efectoBorrador = FLOW.slice(FLOW.indexOf("// En inspección no se guarda"), FLOW.indexOf("writeDraft({ step"));
  assert.ok(/if \(inspeccion\) return;/.test(efectoBorrador), "el borrador real no se sobrescribe");
});

test("sin herramientas internas no hay inspección posible", () => {
  assert.equal(resolveDebugStep({ raw: "14", total: 15, internalToolsEnabled: false }), null);
});

// --- Separación de endpoints -------------------------------------------------

test("el onboarding persiste por completeBirthData (create-only)", () => {
  const inner = bloqueDesde(PERSIST, "function useBackendPersistInner()");
  assert.ok(/appApi\.onboarding\.completeBirthData/.test(inner));
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
  assert.ok(/birthData\.getCurrent/.test(GATE), "el gate necesita consultar si ya hay datos");
  assert.ok(/Redirect href=\{HOME_ROUTE/.test(GATE), "y redirigir a la Home de la plataforma");
  // No se afirma nada mientras resuelve: sin esto habría un salto visible.
  assert.ok(/birthData === undefined/.test(GATE) && /isAuthLoading/.test(GATE));
});

// --- Una sola ruta de persistencia ------------------------------------------
// Había DOS escrituras al llegar al paso 14: un efecto al montar (sin guarda de
// inspección y con `void`, así que un fallo era invisible) y otra en `submit()`.
// El efecto era el que persistía los valores por defecto en un salto directo.

test("existe exactamente UNA llamada a persistBackend en el flujo", () => {
  const llamadas = FLOW_CODE.match(/persistBackend\(\{/g) ?? [];
  assert.equal(llamadas.length, 1, `se esperaba una sola persistencia, hay ${llamadas.length}`);
});

test("no queda ningún `void persistBackend(...)` ni el ref calcFired", () => {
  assert.ok(!/void\s+persistBackend/.test(FLOW_CODE), "un `void` esconde el fallo y navega igual");
  assert.ok(!/calcFired/.test(FLOW_CODE), "el efecto de persistencia del paso 14 debe estar eliminado");
});

test("la persistencia se ESPERA dentro de submit, antes del perfil y de navegar", () => {
  const submit = bloqueDesde(FLOW, "const submit = async () => {");
  const i = submit.indexOf("await persistBackend({");
  assert.notEqual(i, -1, "la persistencia debe estar dentro de submit y con await");
  const perfil = submit.indexOf("await createProfile(");
  const limpiar = submit.indexOf("clearDraft()");
  const navegar = submit.indexOf("router.replace(");
  for (const [nombre, pos] of [["createProfile", perfil], ["clearDraft", limpiar], ["router.replace", navegar]] as const) {
    assert.ok(pos > i, `${nombre} tiene que ir DESPUÉS de esperar la persistencia`);
  }
});

test("si la persistencia falla no se crea perfil, no se limpia el borrador y no se navega", () => {
  const submit = bloqueDesde(FLOW, "const submit = async () => {");
  const catchBlock = submit.slice(submit.indexOf("} catch {"), submit.indexOf("setSubmitting(false);\n      }"));
  assert.ok(/setSubmitError\(true\)/.test(catchBlock), "el fallo tiene que ser visible");
  assert.ok(/return;/.test(catchBlock), "y tiene que cortar el cierre");
  // Y hay una pantalla de error con reintento.
  assert.ok(/submitError \?/.test(FLOW), "el paso de cierre debe renderizar el error");
  assert.ok(/label=\{submitting \? "Guardando…" : "Reintentar"\}/.test(FLOW), "con reintento y sin reentrada");
});

// --- El alta normal sigue funcionando ---------------------------------------

test("el alta normal sigue creando datos natales una vez, y el reintento es idempotente", () => {
  // El frontend manda SIEMPRE el mismo payload para los mismos datos, que es lo
  // que le permite al backend tratar el reintento como idempotente en vez de
  // conflicto: no hay timestamps ni valores derivados del reloj en el payload.
  const inner = bloqueDesde(PERSIST, "function useBackendPersistInner()");
  assert.ok(!/Date\.now\(\)/.test(inner), "un valor por llamada rompería la idempotencia");
  assert.ok(!/Math\.random/.test(inner));
  assert.ok(/birthTimePrecision: input\.birthTime \? "known" : "unknown"/.test(inner), "derivado del input, no del entorno");
  // Y el flujo canónico sigue llamando a la persistencia del alta.
  assert.ok(/useBackendPersist\(\)/.test(FLOW));
});
