/**
 * Onboarding canónico aprobado (auth primero → Carta).
 *
 * Regresiones de la especificación: orden exacto, ausencia de confirmaciones
 * redundantes, resumen editable único, superficie de tríada no bloqueante,
 * comercio real en la paywall y salida directa a la Carta. Se valida la
 * estructura del fuente (no se puede renderizar RN en node), igual que el resto
 * de la suite del alta.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { draftUsableBy } from "../src/domain/onboardingDraft";
import { resolveAuthStepExit } from "../src/onboarding/authExit";
import {
  classifySsoOutcome,
  completionDraftIdFor,
  startSignupGate
} from "../src/onboarding/authGate";
import { STEP_BIRTHDATE, STEP_PROMISE } from "../src/onboarding/steps";
import { observeTriadComputation, triadAutoAdvances } from "../src/onboarding/triadSurface";
import type { OnboardingCompletion } from "../src/domain/onboardingReadiness";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const FLOW = sinComentarios(leer("src/onboarding/OnboardingFlow.tsx"));
const RESUMEN = sinComentarios(leer("src/onboarding/screens/BirthSummaryScreen.tsx"));
const TRIADA = sinComentarios(leer("src/onboarding/screens/TriadScreen.tsx"));
const PAYWALL = sinComentarios(leer("src/onboarding/screens/OnboardingPaywallScreen.tsx"));

// --- 1. Orden exacto, sin confirmaciones redundantes -------------------------

test("el orden del switch es el canónico: auth → promesa → identidad → guía → fecha → lugar → hora → resumen → tríada → antes/después → paywall", () => {
  let prev = -1;
  for (const caso of [
    "case STEP_AUTH:",
    "case STEP_PROMISE:",
    "case STEP_IDENTITY:",
    "case STEP_GUIDANCE:",
    "case STEP_BIRTHDATE:",
    "case STEP_BIRTHPLACE:",
    "case STEP_BIRTHTIME:",
    "case STEP_SUMMARY:",
    "case STEP_TRIAD:",
    "case STEP_BEFORE_AFTER:",
    "case STEP_PAYWALL:"
  ]) {
    const i = FLOW.indexOf(caso);
    assert.ok(i > prev, `${caso} falta o quedó fuera de orden`);
    prev = i;
  }
});

test("las confirmaciones natales sueltas no existen más", () => {
  const pantallas = readdirSync(join(ROOT, "src/onboarding/screens"));
  for (const eliminada of [
    "BirthdateSelectedScreen.tsx",
    "BirthplaceSelectedScreen.tsx",
    "BirthTimeSelectedScreen.tsx",
    "BaseChartScreen.tsx",
    "PersonalizingScreen.tsx",
    "SplashScreen.tsx",
    "AccountScreen.tsx",
    "PaywallScreen.tsx"
  ]) {
    assert.ok(!pantallas.includes(eliminada), `${eliminada} es una pantalla del flujo viejo`);
  }
  // Elegir la ciudad avanza DIRECTO a la hora: sin pantalla intermedia.
  assert.match(FLOW, /editPlace\(p\);\s*setStep\(STEP_BIRTHTIME\);/);
});

test("«No sé la hora» vive DENTRO del paso de hora", () => {
  const hora = sinComentarios(leer("src/onboarding/screens/BirthTimeScreen.tsx"));
  assert.match(hora, /No sé la hora/);
  assert.match(hora, /accessibilityRole="switch"/);
  // Continuar avanza al resumen sin ramificar a una confirmación.
  assert.match(FLOW, /case STEP_BIRTHTIME:[\s\S]{0,500}onNext=\{next\}/);
});

// --- 2. El resumen editable único --------------------------------------------

test("«Estos son tus datos» muestra fecha, lugar, hora y el Sol derivado", () => {
  assert.match(RESUMEN, /Estos son tus datos\./);
  for (const fila of ['label="Fecha"', 'label="Lugar"', 'label="Hora"', 'label="Sol"']) {
    assert.ok(RESUMEN.includes(fila), `falta la fila ${fila}`);
  }
  // El Sol se deriva de la fecha: se muestra como "Derivado", no se edita.
  assert.match(RESUMEN, /action="Derivado"/);
  assert.match(FLOW, /sunSign=\{signLabel\}/);
});

test("cada fila abre su selector SOBRE la misma pantalla y vuelve al resumen", () => {
  // Las hojas son overlays del propio componente: no hay navegación.
  for (const hoja of ["DateSheet", "PlaceSheet", "TimeSheet"]) {
    assert.ok(RESUMEN.includes(`function ${hoja}(`), `falta la hoja ${hoja}`);
  }
  assert.doesNotMatch(RESUMEN, /router\.(push|replace)/, "editar no navega a otra pantalla");
  // Guardar y cancelar cierran la hoja; el foco vuelve a la fila que la abrió.
  assert.match(RESUMEN, /const cerrar = \(kind: Exclude<SheetKind, null>\) => \{/);
  assert.match(RESUMEN, /AccessibilityInfo\.setAccessibilityFocus\(handle\)/);
  assert.match(RESUMEN, /Cancelar/);
  assert.match(RESUMEN, /label="Guardar"/);
});

test("el CTA exacto es «Preparar mi carta» y persiste antes de la generación", () => {
  assert.match(RESUMEN, /"Preparar mi carta"/);
  const preparar = FLOW.slice(FLOW.indexOf("const prepararCarta"), FLOW.indexOf("const retryTriad"));
  // Primero el guardado (await), después el avance; el derivado no bloquea.
  // (El avance aparece dos veces: el atajo sin backend y el camino real; el
  // guardado tiene que preceder al del camino real.)
  assert.ok(
    preparar.indexOf("await saveBirthData({") < preparar.lastIndexOf("setStep(canComputeTriad ? STEP_TRIAD : STEP_BEFORE_AFTER)"),
    "se persiste antes de avanzar"
  );
});

test("cambiar fecha, lugar u hora invalida la tríada anterior", () => {
  assert.match(FLOW, /const invalidateTriad = \(\) => \{/);
  const invalidate = FLOW.slice(FLOW.indexOf("const invalidateTriad"), FLOW.indexOf("const editDate"));
  assert.match(invalidate, /computedSig\.current = null;/);
  assert.match(invalidate, /setComputed\(undefined\);/);
  assert.match(invalidate, /setTriadStatus\("idle"\);/);
  for (const editor of ["const editDate", "const editPlace", "const editTime"]) {
    const bloque = FLOW.slice(FLOW.indexOf(editor), FLOW.indexOf(editor) + 400);
    assert.match(bloque, /invalidateTriad\(\)/, `${editor} no invalida la tríada`);
  }
});

// --- 3. La superficie de tríada ----------------------------------------------

/** Timers manuales para probar la CONDUCTA de la superficie, no su copy. */
function makeManualTimers() {
  let pending: { fn: () => void; ms: number } | null = null;
  return {
    setTimeout(fn: () => void, ms: number) {
      pending = { fn, ms };
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout() {
      pending = null;
    },
    fire() {
      const actual = pending;
      pending = null;
      actual?.fn();
    }
  };
}
const drain = () => new Promise<void>((r) => setTimeout(r, 0));

test("una sola superficie: empieza preparando y se transforma en lista", () => {
  assert.match(TRIADA, /Preparando tu carta…/);
  assert.match(TRIADA, /Tu carta ya está lista\./);
  // Mientras carga NO hay CTA para saltarla; el único CTA aparece revelada.
  assert.match(TRIADA, /\{ready \? <CTA label="Continuar" onPress=\{onContinue\} \/> : null\}/);
  // Los cinco estados del contrato, y ninguno más.
  const hook = sinComentarios(leer("src/onboarding/useAccount.ts"));
  assert.match(hook, /export type TriadStatus = "idle" \| "loading" \| "ready" \| "timed_out" \| "error";/);
});

test("con hora exacta muestra la tríada completa; sin hora, el Ascendente lo explica", () => {
  for (const fila of ['label="Sol"', 'label="Luna"', 'label="Ascendente"']) {
    assert.ok(TRIADA.includes(fila), `falta la fila ${fila}`);
  }
  assert.match(TRIADA, /"Necesita una hora exacta"/);
  assert.match(TRIADA, /Sumá tu hora exacta cuando la tengas\. Podés seguir igual\./);
  assert.match(FLOW, /timeKnown=\{!timeUnknown\}/);
});

test("CONDUCTA · timeout y error avanzan solos; ready espera el Continuar", async () => {
  // Timeout: a los 8 segundos se emite `timed_out` y la regla pura ordena
  // avanzar sin interacción. Una respuesta tardía se descarta.
  const timers = makeManualTimers();
  let resolve!: (v: string) => void;
  const events: string[] = [];
  observeTriadComputation({
    computation: new Promise<string>((r) => (resolve = r)),
    visibleWaitMs: 8000,
    timers,
    onReady: (v) => events.push(`ready:${v}`),
    onTimedOut: () => events.push("timed_out"),
    onError: () => events.push("error")
  });
  timers.fire();
  resolve("tarde");
  await drain();
  assert.deepEqual(events, ["timed_out"]);
  assert.equal(triadAutoAdvances("timed_out"), true);
  assert.equal(triadAutoAdvances("error"), true);
  assert.equal(triadAutoAdvances("ready"), false);
  assert.equal(triadAutoAdvances("loading"), false);
  // Y el flujo cablea exactamente esa regla al paso siguiente (estructura,
  // no copy): el efecto avanza a Antes/Después.
  assert.match(FLOW, /if \(!triadAutoAdvances\(triadStatus\)\) return;\s*setStep\(STEP_BEFORE_AFTER\);/);
});

test("la respuesta tardía NO se recicla: lo que aprovecha Carta es la carta persistida", async () => {
  // Conducta: después del techo, el resultado del cálculo público se descarta
  // (arriba quedó demostrado que no re-emite). Lo que la Carta aprovecha es un
  // cálculo DISTINTO y persistente: `Preparar mi carta` dispara
  // `charts.calculateOrCreateNatalChart` en el servidor, sin esperarlo, y la
  // Carta lo resuelve o lo reintenta al abrirse (ver
  // `test/onboardingReadiness.test.ts` — "Carta intenta calcular al abrir").
  const hook = sinComentarios(leer("src/onboarding/useAccount.ts"));
  const save = hook.slice(hook.indexOf("function useOnboardingBirthDataSaveInner"));
  assert.match(save, /await completeBirthData\(/, "primero el guardado obligatorio");
  assert.match(save, /void calculateChart\(\{\}\)\.catch\(\(\) => undefined\)/, "después el derivado, sin bloquear");
  // La orquestación de la superficie no guarda el resultado tardío en ningún
  // lado: se lo silencia (conducta probada arriba y en onboardingTriad).
  const surface = sinComentarios(leer("src/onboarding/triadSurface.ts"));
  assert.doesNotMatch(surface, /AsyncStorage|writeDraft|persist/, "no hay reciclaje escondido del tardío");
});

test("ningún fallo de cálculo retiene el onboarding ni toca Antes/Después o la paywall", () => {
  // Antes/Después y la paywall no consultan la tríada para montarse.
  const antes = sinComentarios(leer("src/onboarding/screens/BeforeAfterScreen.tsx"));
  assert.doesNotMatch(antes, /triad|Triad/, "Antes/Después no depende de la tríada");
  assert.doesNotMatch(PAYWALL, /triadStatus|TriadStatus/, "la paywall no consulta la tríada");
  const paywallWeb = sinComentarios(leer("src/onboarding/screens/OnboardingPaywallScreen.web.tsx"));
  assert.doesNotMatch(paywallWeb, /triadStatus|TriadStatus/, "la paywall web tampoco");
});

test("la paywall aprobada NO agrega la tríada", () => {
  assert.doesNotMatch(PAYWALL, /Ascendente|ascendant|chart\.sun|chart\.moon/, "la tríada no vive en la paywall");
});

// --- 4. Paywall con comercio real ---------------------------------------------

test("compra exitosa, restauración y «Seguir gratis» entran a Carta", () => {
  // Compra confirmada por la tienda → registrar, reconciliar y salir a Carta.
  const compra = PAYWALL.slice(PAYWALL.indexOf("const purchase = async"), PAYWALL.indexOf("const restore = async"));
  assert.match(compra, /await answerStore\(userId, "store_confirmed"\);/);
  assert.match(compra, /onEnterCarta\(\);/);
  // Restauración con compra activa → misma salida.
  const restaurar = PAYWALL.slice(PAYWALL.indexOf("const restore = async"), PAYWALL.indexOf("const primary"));
  assert.match(restaurar, /await answerStore\(userId, "store_confirmed"\);/);
  assert.match(restaurar, /onEnterCarta\(\);/);
  // "Seguir gratis" sale sin compra.
  assert.match(PAYWALL, /Seguir gratis/);
  assert.match(PAYWALL, /onPress=\{busy \? undefined : onEnterCarta\}/);
});

test("cancelar una compra permanece en la paywall y no es un error", () => {
  const compra = PAYWALL.slice(PAYWALL.indexOf("const purchase = async"), PAYWALL.indexOf("const restore = async"));
  assert.match(compra, /if \(result === "cancelled"\) \{/);
  assert.match(compra, /purchase_cancelled/);
  assert.match(compra, /La compra se canceló\. No se hizo ningún cargo\./);
  // La rama de cancelación retorna SIN navegar y sin marcar fallo.
  const cancel = compra.slice(compra.indexOf('if (result === "cancelled") {'), compra.indexOf('if (result === "inactive") {'));
  assert.doesNotMatch(cancel, /onEnterCarta|router\./, "cancelar no navega");
  assert.doesNotMatch(cancel, /purchase_ambiguous|error/i, "cancelar no se registra como error");
});

test("el comercio es el real: guard antes de la tienda, oferta de la tienda, sin precios inventados", () => {
  // El marcador anti doble cobro se escribe ANTES de tocar la tienda.
  const compra = PAYWALL.slice(PAYWALL.indexOf("const purchase = async"), PAYWALL.indexOf("const restore = async"));
  assert.ok(
    compra.indexOf("await armStoreGuard(userId)") < compra.indexOf("revenueCat.purchase("),
    "el guard va antes de la compra"
  );
  assert.match(PAYWALL, /storePurchaseGuard\(userId, Date\.now\(\)\)/);
  // Los planes y sus importes llegan de la tienda; nada hardcodeado.
  assert.match(PAYWALL, /revenueCat\.plans/);
  assert.doesNotMatch(PAYWALL, /\$\d/, "ningún precio inventado");
  // Y la pantalla nunca navega a la ruta /paywall de la app.
  assert.doesNotMatch(PAYWALL, /"\/paywall"/);
});

test("en inspección la paywall no cuenta impresiones ni ejecuta acciones", () => {
  assert.match(PAYWALL, /inspect = false/);
  assert.match(PAYWALL, /!inspect &&/, "la impresión exige no estar en inspección");
  assert.match(PAYWALL, /if \(inspect \|\| !selected\) return;/, "comprar no corre en inspección");
  assert.match(PAYWALL, /if \(inspect \|\| !restoreReady\) return;/, "restaurar tampoco");
});

// --- 5. Destino y aislamiento -------------------------------------------------

test("la Carta de destino es la última pestaña real (perfil/Carta)", () => {
  const rutas = sinComentarios(leer("src/domain/appRoutes.ts"));
  assert.match(rutas, /CARTA_TAB_ROUTE = IS_WEB \? "\/\(tabs\)\/carta" : "\/perfil"/);
  const tabs = sinComentarios(leer("src/routes/v492/tabs-layout.tsx"));
  // `perfil` (título "Carta") sigue siendo la quinta y última pestaña visible.
  const orden = ["hoy", "transitos", "vinculos", "umbral", "perfil"].map((n) => tabs.indexOf(`name="${n}"`));
  for (let i = 1; i < orden.length; i++) {
    assert.ok(orden[i] > orden[i - 1] && orden[i - 1] >= 0, "el orden de pestañas cambió");
  }
  assert.match(tabs, /name="perfil"[\s\S]{0,80}title: "Carta"/);
});

/** Completions autoritativas de los tres tipos de cuenta. */
const CUENTA_NUEVA: OnboardingCompletion = {
  // Con el marcador de alta en curso sembrado antes de crear la identidad.
  status: "onboarding_incomplete",
  recovery: "onboarding",
  profileReady: true,
  birthDataReady: false,
  chartReady: false
};
const CUENTA_COMPLETA: OnboardingCompletion = {
  status: "chart_ready",
  recovery: null,
  profileReady: true,
  birthDataReady: true,
  chartReady: true
};
const CUENTA_INCOMPLETA_PREEXISTENTE: OnboardingCompletion = {
  // Sin marcador (o con el marcador DESCARTADO al caer al ingreso).
  status: "profile_incomplete",
  recovery: "edit_birth_data",
  profileReady: true,
  birthDataReady: false,
  chartReady: false
};

test("CONDUCTA · el SSO se clasifica SOLO por coincidencia del id de la sesión", () => {
  const session = "sess_abc";
  // La sesión creada coincide con el recurso de ALTA → cuenta nueva.
  assert.equal(
    classifySsoOutcome({
      createdSessionId: session,
      signUpCreatedSessionId: session,
      signInCreatedSessionId: null
    }),
    "new_account"
  );
  // La sesión coincide con el recurso de INGRESO → la cuenta ya existía.
  assert.equal(
    classifySsoOutcome({
      createdSessionId: session,
      signUpCreatedSessionId: null,
      signInCreatedSessionId: session
    }),
    "existing_account"
  );
  // Sin sesión creada (cierre del navegador, MFA, error) → cancelado.
  assert.equal(
    classifySsoOutcome({
      createdSessionId: null,
      signUpCreatedSessionId: null,
      signInCreatedSessionId: null
    }),
    "cancelled"
  );
  // Sin coincidencia clara → lado seguro: existente (descarta marcador; la
  // clasificación queda en manos de lo PERSISTIDO, nunca de un marcador de
  // alta nueva que quizás no corresponde).
  assert.equal(
    classifySsoOutcome({
      createdSessionId: session,
      signUpCreatedSessionId: null,
      signInCreatedSessionId: null
    }),
    "existing_account"
  );
});

test("REGRESIÓN · un recurso de alta PREVIO no reetiqueta el ingreso actual", () => {
  // El caso crítico: `signUp` conserva estado de un intento anterior (incluso
  // `status: "complete"`) con OTRA sesión, mientras la sesión ACTUAL coincide
  // con `signInCreatedSessionId`. La atribución por id lo resuelve como
  // cuenta existente; por eso los `status` no participan de la decisión ni de
  // la firma.
  assert.equal(
    classifySsoOutcome({
      createdSessionId: "sess_actual",
      signUpCreatedSessionId: "sess_intento_previo",
      signInCreatedSessionId: "sess_actual"
    }),
    "existing_account"
  );
  // Y la firma ya no acepta status: la decisión no puede volver a mirarlos.
  const gate = sinComentarios(leer("src/onboarding/authGate.ts"));
  assert.doesNotMatch(gate, /signUpStatus|signInStatus/, "los status salieron de la clasificación");
});

// ---------------------------------------------------------------------------
// Harness del acceso: modela la transición REAL — siembra/descarte del
// marcador, resultado del proveedor (clasificado con la MISMA función pura que
// ejecuta `useSSOOauth`), qué `clientDraftId` recibe `getCompletionStatus` y la
// salida resultante. Apple y Google comparten exactamente esta transición.
// ---------------------------------------------------------------------------

type AccountState = "nueva" | "existente_completa" | "existente_incompleta";
type AccessVia = "email" | "google" | "apple";

const ESC_DRAFT_ID = "orbita-signup-escenario";

/**
 * Modelo fiel de `getCompletionStatus`: el marcador anónimo sólo es visible si
 * la consulta RECIBIÓ su `clientDraftId` (`safeExplicitDraft`); con él, una
 * cuenta incompleta se clasifica alta en curso (`recovery: "onboarding"`); sin
 * él, la clasificación es la persistida (`edit_birth_data`). Una cuenta
 * completa es completa con o sin marcador.
 */
function completionDesdeBackend(
  state: AccountState,
  draftIdRecibido: string | undefined
): OnboardingCompletion {
  if (state === "existente_completa") return CUENTA_COMPLETA;
  const signupInProgress = draftIdRecibido !== undefined;
  return {
    status: signupInProgress ? "onboarding_incomplete" : "profile_incomplete",
    recovery: signupInProgress ? "onboarding" : "edit_birth_data",
    profileReady: true,
    birthDataReady: false,
    chartReady: false
  };
}

function escenarioAcceso(args: { mode: "signup" | "signin"; via: AccessVia; account: AccountState }) {
  let markerDiscarded = false;
  let markerSeeded = false;
  const discard = () => {
    markerDiscarded = true;
  };

  if (args.mode === "signin") {
    // Modo Ingresar: `onSignInPath` descarta ANTES de autenticar.
    discard();
  } else {
    // Modo alta: el marcador se siembra por la puerta (probada arriba).
    markerSeeded = true;
    if (args.via === "email") {
      // Rama email: `existingAccount` del flujo de alta dispara el descarte.
      if (args.account !== "nueva") discard();
    } else {
      // SSO: el resultado del proveedor, tal cual lo emite Clerk, clasificado
      // con la MISMA función que ejecuta `useSSOOauth`; `onExistingAccount`
      // corre ANTES de activar la sesión.
      const session = `sess_${args.via}`;
      const outcome = classifySsoOutcome(
        args.account === "nueva"
          ? {
              createdSessionId: session,
              signUpCreatedSessionId: session,
              signInCreatedSessionId: null
            }
          : {
              createdSessionId: session,
              // Un intento de alta previo puede quedar colgado en el recurso:
              // la sesión ACTUAL es la que manda.
              signUpCreatedSessionId: `sess_previa_${args.via}`,
              signInCreatedSessionId: session
            }
      );
      if (outcome === "existing_account") discard();
    }
  }

  // El argumento EXACTO de `getCompletionStatus`, por el helper real del flujo.
  const draftIdParaCompletion = completionDraftIdFor({ markerDiscarded, clientDraftId: ESC_DRAFT_ID });
  const completion = completionDesdeBackend(args.account, draftIdParaCompletion);
  const exit = resolveAuthStepExit({
    sessionActive: true,
    completion,
    usableDraftStep: null,
    resumeDatos: false
  });
  return { markerSeeded, markerDiscarded, draftIdParaCompletion, exit };
}

test("CONDUCTA · Crear cuenta + OAuth nuevo conserva el marcador y abre el onboarding", () => {
  for (const via of ["google", "apple"] as const) {
    const r = escenarioAcceso({ mode: "signup", via, account: "nueva" });
    assert.equal(r.markerSeeded, true, via);
    assert.equal(r.markerDiscarded, false, via);
    assert.equal(r.draftIdParaCompletion, ESC_DRAFT_ID, `${via}: la completion ve el marcador`);
    assert.deepEqual(r.exit, { kind: "continue", step: STEP_PROMISE }, via);
  }
});

test("CONDUCTA · Crear cuenta + OAuth existente COMPLETO descarta el marcador y va a Inicio", () => {
  for (const via of ["google", "apple"] as const) {
    const r = escenarioAcceso({ mode: "signup", via, account: "existente_completa" });
    assert.equal(r.markerDiscarded, true, via);
    assert.equal(r.draftIdParaCompletion, undefined, `${via}: la completion corre SIN clientDraftId`);
    assert.deepEqual(r.exit, { kind: "home" }, via);
  }
});

test("CONDUCTA · Crear cuenta + OAuth existente INCOMPLETO descarta el marcador y va al editor", () => {
  for (const via of ["google", "apple"] as const) {
    const r = escenarioAcceso({ mode: "signup", via, account: "existente_incompleta" });
    assert.equal(r.markerDiscarded, true, via);
    assert.equal(r.draftIdParaCompletion, undefined, `${via}: la completion corre SIN clientDraftId`);
    assert.deepEqual(r.exit, { kind: "edit-birth-data" }, `${via}: nunca se reclasifica como alta nueva`);
  }
});

test("CONDUCTA · Ingresar: existente completo va a Inicio y existente incompleto al editor", () => {
  for (const via of ["email", "google", "apple"] as const) {
    const completa = escenarioAcceso({ mode: "signin", via, account: "existente_completa" });
    assert.equal(completa.draftIdParaCompletion, undefined, via);
    assert.deepEqual(completa.exit, { kind: "home" }, via);
    const incompleta = escenarioAcceso({ mode: "signin", via, account: "existente_incompleta" });
    assert.equal(incompleta.draftIdParaCompletion, undefined, via);
    assert.deepEqual(incompleta.exit, { kind: "edit-birth-data" }, via);
  }
});

test("CONDUCTA · la rama email del alta conserva su comportamiento", () => {
  const nueva = escenarioAcceso({ mode: "signup", via: "email", account: "nueva" });
  assert.equal(nueva.draftIdParaCompletion, ESC_DRAFT_ID);
  assert.deepEqual(nueva.exit, { kind: "continue", step: STEP_PROMISE });
  const completa = escenarioAcceso({ mode: "signup", via: "email", account: "existente_completa" });
  assert.deepEqual(completa.exit, { kind: "home" });
  const incompleta = escenarioAcceso({ mode: "signup", via: "email", account: "existente_incompleta" });
  assert.equal(incompleta.draftIdParaCompletion, undefined);
  assert.deepEqual(incompleta.exit, { kind: "edit-birth-data" });
});

test("CONDUCTA · matriz Apple/Google: ambos proveedores usan exactamente la misma transición", () => {
  for (const mode of ["signup", "signin"] as const) {
    for (const account of ["nueva", "existente_completa", "existente_incompleta"] as const) {
      assert.deepEqual(
        escenarioAcceso({ mode, via: "google", account }),
        escenarioAcceso({ mode, via: "apple", account }),
        `${mode}/${account}: Apple y Google divergen`
      );
    }
  }
});

test("los bordes de la salida del acceso: borrador usable, sin sesión, sin consulta", () => {
  // Un borrador USABLE retoma su paso; sin sesión o sin consulta, se espera.
  assert.deepEqual(
    resolveAuthStepExit({ sessionActive: true, completion: CUENTA_NUEVA, usableDraftStep: 7, resumeDatos: false }),
    { kind: "continue", step: 7 }
  );
  assert.deepEqual(
    resolveAuthStepExit({ sessionActive: true, completion: CUENTA_NUEVA, usableDraftStep: null, resumeDatos: true }),
    { kind: "continue", step: STEP_BIRTHDATE }
  );
  assert.deepEqual(
    resolveAuthStepExit({ sessionActive: false, completion: CUENTA_COMPLETA, usableDraftStep: null, resumeDatos: false }),
    { kind: "wait" }
  );
  assert.deepEqual(
    resolveAuthStepExit({ sessionActive: true, completion: undefined, usableDraftStep: null, resumeDatos: false }),
    { kind: "wait" }
  );
  // Y el flujo cablea exactamente esta regla (estructura, no copy).
  assert.match(FLOW, /resolveAuthStepExit\(\{/);
  assert.match(FLOW, /usableDraftStep: saved && draftUsableBy\(saved, userId\) \? saved\.step : null/);
});

test("CONDUCTA · si el marcador imprescindible falla, Clerk NO se invoca; el reintento sí crea la cuenta", async () => {
  const llamadas: string[] = [];
  let markerFails = true;
  const seedMarker = async () => {
    llamadas.push("marker");
    if (markerFails) throw new Error("CONVEX_DOWN");
  };
  const createAccount = async () => {
    llamadas.push("clerk");
  };
  // Falla Convex antes del alta → la identidad no se crea.
  assert.equal(await startSignupGate({ seedMarker, createAccount }), "marker_failed");
  assert.deepEqual(llamadas, ["marker"], "Clerk no se invoca sin el marcador guardado");
  // Reintento exitoso → recién entonces se crea la cuenta, en orden.
  markerFails = false;
  assert.equal(await startSignupGate({ seedMarker, createAccount }), "started");
  assert.deepEqual(llamadas, ["marker", "marker", "clerk"]);
  // Cableado: el acceso pasa por esta puerta y muestra el fallo localizado
  // con reintento en la MISMA pantalla.
  const acceso = sinComentarios(leer("src/onboarding/screens/AuthScreen.tsx"));
  assert.match(acceso, /startSignupGate\(\{/);
  assert.match(acceso, /if \(outcome === "marker_failed"\) setLocalError\(MARKER_FAILED_ERROR\);/);
  assert.match(acceso, /tu cuenta todavía no se creó/);
  // Y el hook del marcador PROPAGA el fallo, no lo traga.
  const hook = sinComentarios(leer("src/onboarding/useAccount.ts"));
  const marcador = hook.slice(
    hook.indexOf("function useAnonymousSignupMarkerInner"),
    hook.indexOf("export function useOnboardingSignupDraft")
  );
  assert.doesNotMatch(marcador, /catch/, "el fallo del marcador se propaga");
});

test("«Crear cuenta» con un email preexistente descarta el marcador de alta nueva", () => {
  // Cuando el alta cae a sign-in (`existingAccount`), el marcador se descarta:
  // sin eso, la completion reclasificaba una cuenta preexistente incompleta
  // como alta nueva y la retenía en el onboarding en vez de su recuperación.
  assert.match(FLOW, /const signupFellToSignIn = !!signUpFlow\?\.existingAccount;/);
  assert.match(FLOW, /if \(signupFellToSignIn\) discardSignupMarker\(\);/);
  const discard = FLOW.slice(FLOW.indexOf("const discardSignupMarker"), FLOW.indexOf("const signupFellToSignIn"));
  assert.match(discard, /setMarkerDiscarded\(true\);/);
  assert.match(discard, /clearDraft\(\);/);
  // La completion deja de mirar el marcador descartado: el argumento sale del
  // helper puro ejercitado por los escenarios de arriba.
  assert.match(FLOW, /useOnboardingCompletion\(completionDraftIdFor\(\{ markerDiscarded, clientDraftId \}\)\)/);
  // …y el modo "Ingresar" también lo descarta (el flujo se lo pasa al acceso).
  assert.match(FLOW, /onSignInPath=\{inspeccion \? undefined : discardSignupMarker\}/);
  const acceso = sinComentarios(leer("src/onboarding/screens/AuthScreen.tsx"));
  assert.match(acceso, /onSignInPath\?\.\(\);/);
  // Volver al modo alta lo repone antes de sembrar de nuevo.
  assert.match(FLOW, /setMarkerDiscarded\(false\);\s*persistClientDraftId\(clientDraftId\);/);
});

test("el SSO del alta descarta el marcador ANTES de activar una sesión existente", () => {
  // Cableado del hallazgo OAuth: `useSSOOauth` clasifica con la función pura
  // (probada arriba) y, si la cuenta ya existía, dispara `onExistingAccount`
  // ANTES de `setActive` — la consulta de completion nunca llega a correr con
  // el id de un alta nueva para una cuenta preexistente.
  const hook = sinComentarios(leer("src/onboarding/useAccount.ts"));
  const sso = hook.slice(hook.indexOf("function useSSOOauth"), hook.indexOf("function useAccountFlowInner"));
  assert.match(sso, /classifySsoOutcome\(\{/);
  const iDiscard = sso.indexOf('if (outcome === "existing_account") hooks?.onExistingAccount?.();');
  const iActivate = sso.indexOf("await setActive({ session: createdSessionId });");
  assert.ok(iDiscard > 0 && iActivate > iDiscard, "el descarte va antes de activar la sesión");
  // El acceso conecta ese aviso con el descarte del flujo en el modo alta…
  const acceso = sinComentarios(leer("src/onboarding/screens/AuthScreen.tsx"));
  assert.match(acceso, /flow\?\.oauth\(provider, \{ onExistingAccount: onSignInPath \}\)/);
  // …y el login trata cualquier sesión creada como entrada válida.
  const login = sinComentarios(leer("src/onboarding/screens/SignInScreen.tsx"));
  assert.match(login, /if \(outcome !== "cancelled"\) await finish\(\);/);
});

test("ninguna cuenta hereda el borrador de otra (regla pura)", () => {
  const conDatos = {
    ownerUserId: undefined,
    identity: "ella",
    birthDate: { day: 1, month: 2, year: 1990 },
    birthPlace: { label: "Rosario, Argentina" }
  };
  // Sin identidad: sólo un borrador sin dueño (lo único pre-auth).
  assert.equal(draftUsableBy({ ownerUserId: undefined }, null), true);
  assert.equal(draftUsableBy({ ownerUserId: "user_a" }, null), false);
  // Con identidad: el borrador de ESA cuenta…
  assert.equal(draftUsableBy({ ownerUserId: "user_a" }, "user_a"), true);
  assert.equal(draftUsableBy({ ownerUserId: "user_a" }, "user_b"), false);
  // …o el marcador pre-acceso SIN datos natales, que la cuenta nueva adopta al
  // volver del redirect de Clerk.
  assert.equal(draftUsableBy({ ownerUserId: undefined }, "user_b"), true);
  // Un borrador viejo sin dueño que SÍ carga datos no puede probar de quién
  // son: se descarta entero.
  assert.equal(draftUsableBy(conDatos, "user_b"), false);
  assert.equal(draftUsableBy(null, "user_b"), false);
});

test("el id del borrador remoto sobrevive al redirect de Clerk", () => {
  // `writeDraft` no guarda un borrador vacío, así que el acceso persiste el id
  // explícitamente ANTES de abrir Clerk. Sin esto, el remonte web no
  // reencuentra el marcador de alta en curso y la cuenta nueva se clasifica
  // como recuperación (`edit_birth_data`).
  const dominio = sinComentarios(leer("src/domain/onboardingDraft.ts"));
  assert.match(dominio, /export function persistClientDraftId\(id\?: string\): void \{/);
  const handler = FLOW.slice(FLOW.indexOf("onBeforeSignup="), FLOW.indexOf("onSignInPath="));
  assert.match(handler, /persistClientDraftId\(clientDraftId\);/);
  assert.ok(
    handler.indexOf("persistClientDraftId(clientDraftId)") < handler.indexOf("markSignup(clientDraftId)"),
    "primero el id local, después el marcador remoto"
  );
});

// --- 6. Paywall por plataforma y ausencia de post-paywall ----------------------

test("la paywall web usa el circuito Stripe real: oferta y checkout del backend", () => {
  const web = sinComentarios(leer("src/onboarding/screens/OnboardingPaywallScreen.web.tsx"));
  // La oferta y sus importes salen de Stripe (`getWebOffer`); el cliente no
  // escribe un solo precio.
  assert.match(web, /proposedApi\.getWebOffer/);
  assert.match(web, /offerPhase\(\{ offer, failed \}\)/);
  assert.match(web, /formatPlanPrice\(plan\)/);
  assert.doesNotMatch(web, /\$\d/, "ningún precio inventado");
  // El CTA crea UNA sesión de Checkout con guard sincrónico y abre SÓLO la URL
  // que devolvió el backend.
  assert.match(web, /proposedApi\.createCheckoutSession/);
  assert.match(web, /if \(checkoutLock\.current \|\| phase !== "disponible"\) return;/);
  assert.match(web, /window\.location\.replace\(url\)/);
  // Sin compra posible (comercio apagado, error, sin plan) el camino aprobado
  // de "Seguir gratis" se conserva SIEMPRE; nunca una pantalla de carga sola.
  assert.match(web, /Seguir gratis/);
  assert.match(web, /onPress=\{onEnterCarta\}/);
  // Y nunca navega a la ruta /paywall ni a /recepcion.
  assert.doesNotMatch(web, /"\/paywall"|recepcion/);
});

test("no existe una pantalla post-paywall ni el CTA «Entrar a Órbita»", () => {
  // La paywall queda visible hasta `router.replace(CARTA_TAB_ROUTE)`: no hay
  // superficie intermedia de cierre en el flujo…
  assert.doesNotMatch(FLOW, /EnteringCarta|SavingBirthData/, "la pantalla post-paywall no existe");
  assert.doesNotMatch(FLOW, /Entrar a Órbita/);
  // …y el paso final monta SIEMPRE la paywall (Metro resuelve la variante web).
  const cierre = FLOW.slice(FLOW.indexOf("case STEP_PAYWALL:"));
  assert.match(cierre, /<OnboardingPaywallScreen/);
  assert.doesNotMatch(cierre.slice(0, cierre.indexOf("break;")), /\? \(/, "sin ramas que escondan la paywall");
  const pantallas = readdirSync(join(ROOT, "src/onboarding/screens"));
  assert.ok(pantallas.includes("OnboardingPaywallScreen.tsx"), "variante nativa (RevenueCat)");
  assert.ok(pantallas.includes("OnboardingPaywallScreen.web.tsx"), "variante web (Stripe)");
  for (const rel of [
    "src/onboarding/screens/OnboardingPaywallScreen.tsx",
    "src/onboarding/screens/OnboardingPaywallScreen.web.tsx"
  ]) {
    assert.doesNotMatch(sinComentarios(leer(rel)), /Entrar a Órbita/, `${rel} no tiene el CTA eliminado`);
  }
});

test("el flujo descarta el borrador ajeno apenas conoce la identidad", () => {
  // En cualquier paso (el caso real es `resume=datos` en una pestaña ajena).
  assert.match(FLOW, /if \(!draftUsableBy\(saved, userId\)\) resetNatalState\(\);/);
  const reset = FLOW.slice(FLOW.indexOf("const resetNatalState"), FLOW.indexOf("const ownershipChecked"));
  for (const limpio of ["setBirthPlace(undefined)", "setPlaceQuery(\"\")", "clearDraft()"]) {
    assert.ok(reset.includes(limpio), `resetNatalState no limpia: ${limpio}`);
  }
  // Y el borrador se escribe SIEMPRE con su dueño.
  assert.match(FLOW, /ownerUserId: userId \?\? undefined/);
});
