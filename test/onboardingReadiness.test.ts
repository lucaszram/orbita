/**
 * Alta con la UI oficial de Clerk y readiness autoritativo (frontend).
 *
 * Lo que se fija acá no es estética: es que Órbita no se abra antes de guardar
 * los datos, que una cuenta creada en Clerk no pierda lo ya cargado y que el
 * proveedor de cartas no pueda convertir el alta en una pantalla terminal.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createClientDraftId,
  isBirthDataReady,
  isChartReady,
  isClientDraftId,
  isCompletionPending,
  resolveReadinessDestination,
  type OnboardingCompletion
} from "../src/domain/onboardingReadiness";
import { parseDraft, serializeDraft } from "../src/domain/onboardingDraft";

const ROOT = join(import.meta.dirname, "..");
const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const completion = (patch: Partial<OnboardingCompletion>): OnboardingCompletion => ({
  status: "chart_ready",
  recovery: null,
  profileReady: true,
  birthDataReady: true,
  chartReady: true,
  ...patch
});

// --- 1. Qué abre Órbita ------------------------------------------------------

test("los datos PERSISTIDOS abren la app; la carta se deriva aparte", () => {
  assert.equal(resolveReadinessDestination(completion({})), "app");
  assert.equal(isBirthDataReady(completion({})), true);
  assert.equal(isChartReady(completion({})), true);

  for (const status of ["onboarding_incomplete", "profile_incomplete"] as const) {
    assert.equal(isBirthDataReady(completion({ status, birthDataReady: false, chartReady: false })), false, status);
    assert.equal(isChartReady(completion({ status, chartReady: false })), false, status);
  }
  const pending = completion({ status: "chart_pending", recovery: null, chartReady: false });
  assert.equal(resolveReadinessDestination(pending), "app");
  assert.equal(isBirthDataReady(pending), true);
  assert.equal(isChartReady(pending), false);
  assert.equal(isChartReady(completion({ chartReady: false })), false);
  assert.equal(isChartReady(undefined), false, "sin resolver NO es listo");
});

test("estados nuevos vuelven al alta; una cuenta preexistente va a editar datos", () => {
  // La diferencia la hace `recovery`, que el backend deriva del origen
  // persistido del borrador. El alta es create-only: mandar ahí a una cuenta
  // que ya existe termina en ONBOARDING_BIRTH_DATA_CONFLICT.
  assert.equal(
    resolveReadinessDestination(
      completion({ status: "onboarding_incomplete", recovery: "onboarding", chartReady: false, birthDataReady: false })
    ),
    "onboarding"
  );
  assert.equal(resolveReadinessDestination(completion({ status: "chart_pending", recovery: null, chartReady: false })), "app");
  assert.equal(
    resolveReadinessDestination(
      completion({ status: "profile_incomplete", recovery: "edit_birth_data", birthDataReady: false, chartReady: false })
    ),
    "edit-birth-data"
  );
});

test("la consulta manda sobre Clerk cuando dice que no hay identidad", () => {
  assert.equal(
    resolveReadinessDestination(
      completion({ status: "signed_out", recovery: null, profileReady: false, birthDataReady: false, chartReady: false })
    ),
    "sign-in"
  );
});

test("el cierre en vuelo no es un error", () => {
  assert.equal(isCompletionPending(undefined), true, "sin resolver todavía");
  assert.equal(isCompletionPending(completion({ status: "chart_pending", chartReady: false })), false);
  assert.equal(isCompletionPending(completion({ status: "onboarding_incomplete", birthDataReady: false, chartReady: false })), true);
  assert.equal(isCompletionPending(completion({})), false);
});

// --- 2. El borrador remoto sobrevive a la vuelta de Clerk --------------------

test("el id del borrador es opaco, estable y viaja en el borrador local", () => {
  const id = createClientDraftId();
  assert.ok(isClientDraftId(id));
  assert.notEqual(createClientDraftId(), id, "cada alta tiene el suyo");
  // Sin PII: es un identificador, no un dato de la persona.
  assert.doesNotMatch(id, /@|\d{4}-\d{2}-\d{2}/);

  // Ida y vuelta por el borrador local: es lo que permite reencontrar la fila
  // anónima después de que Clerk remonte la pestaña.
  const draft = parseDraft(
    serializeDraft({ step: 13, placeQuery: "", timeUnknown: false, clientDraftId: id }),
    15
  );
  assert.equal(draft?.clientDraftId, id);

  // Un id inventado a mano no puede adjuntar el borrador de otra persona.
  for (const invalido of ["", "otro", "orbita-signup-", "orbita-signup con espacio", 42]) {
    assert.equal(isClientDraftId(invalido), false, String(invalido));
    const sucio = parseDraft(
      JSON.stringify({ step: 13, placeQuery: "", timeUnknown: false, clientDraftId: invalido }),
      15
    );
    assert.equal(sucio?.clientDraftId, undefined, String(invalido));
  }
});

// --- 3. El orden del alta ----------------------------------------------------

test("el borrador remoto se persiste y se CONFIRMA antes de abrir Clerk", () => {
  const flow = sinComentarios(leer("src/onboarding/OnboardingFlow.tsx"));
  // El id se genera una sola vez y viaja con el borrador local.
  assert.match(flow, /ensureClientDraftId\(\)/);
  assert.match(flow, /clientDraftId: clientDraftId \?\? undefined/);
  // Y la puerta: Clerk sólo se monta con el borrador confirmado.
  assert.match(flow, /prepareSignupDraft\(\{/);
  assert.match(flow, /setDraftPhase\("ready"\)/);
  assert.match(flow, /setDraftPhase\("error"\)/);

  const cuenta = sinComentarios(leer("src/onboarding/screens/AccountScreen.tsx"));
  assert.match(
    cuenta,
    /phase === "ready" \? \([\s\S]{0,200}<ClerkSignUp\b/,
    "sin borrador confirmado NO se abre Clerk"
  );

  const hook = sinComentarios(leer("src/onboarding/useAccount.ts"));
  const gate = hook.slice(
    hook.indexOf("function useOnboardingSignupDraftInner"),
    hook.indexOf("export type FinalizeOnboarding")
  );
  assert.ok(gate.length > 0);
  // ANÓNIMO de verdad: por el canal dedicado sin autenticar, nunca por el
  // cliente compartido que Clerk autentica cuando se le da la gana.
  assert.doesNotMatch(gate, /useConvex\(\)/, "el borrador anónimo no usa el cliente de la app");
  assert.match(gate, /anonymousSignupDraftTransport\(\)/);
  assert.match(gate, /persistSignupDraft\(transport, input\)/);

  // Con clientDraftId, y confirmado DESPUÉS de guardar. Las dos llamadas al
  // contrato viven en el transporte dedicado.
  const transporte = sinComentarios(leer("src/services/anonymousOnboardingTransport.ts"));
  assert.ok(
    transporte.indexOf("appApi.onboarding.saveDraft") <
      transporte.indexOf("appApi.onboarding.confirmSignupDraft"),
    "primero se guarda, después se confirma"
  );
  assert.match(transporte, /clientDraftId: args\.clientDraftId/);
  assert.doesNotMatch(transporte, /setAuth/, "el canal no puede recibir un token");

  // Reintentable: la zona horaria la resuelve el backend en segundo plano y un
  // enriquecimiento en vuelo no puede leerse como un error de la persona.
  const cadena = sinComentarios(leer("src/domain/anonymousSignupDraft.ts"));
  assert.ok(
    cadena.indexOf("transport.saveDraft(") < cadena.indexOf("transport.confirmSignupDraft("),
    "primero se guarda, después se confirma"
  );
  assert.match(cadena, /runSessionAttempts\(\{/);
  assert.match(cadena, /ONBOARDING_SIGNUP_DRAFT_NOT_READY/);
});

test("el cierre copia el borrador atómicamente y calcula sólo como mejor esfuerzo", () => {
  const hook = sinComentarios(leer("src/onboarding/useAccount.ts"));
  const cierre = hook.slice(
    hook.indexOf("function useOnboardingFinalizeInner"),
    hook.indexOf("export function useOnboardingCompletion")
  );
  assert.ok(cierre.length > 0);
  const orden = [
    "appApi.users.getOrCreateCurrentUser",
    "appApi.onboarding.completeSignupFromDraft",
    "appApi.charts.calculateOrCreateNatalChart"
  ];
  let prev = -1;
  for (const paso of orden) {
    const i = cierre.indexOf(paso);
    assert.ok(i > prev, `${paso} quedó fuera de orden`);
    prev = i;
  }
  // El borrador anónimo se adjunta con SU id: sin eso la misma persona parece
  // una recuperación de cuenta preexistente y termina en /editar-datos.
  assert.match(cierre, /completeSignupFromDraft, \{\s*clientDraftId: input\.clientDraftId/);
  assert.doesNotMatch(cierre, /birthDate:|birthPlaceLabel:|timezone:/, "el cliente no reenvía datos natales");
  assert.match(cierre, /runSessionAttempts\(\{/);
  assert.match(cierre, /ONBOARDING_FINALIZE_FAILED/);
  assert.match(cierre, /calculateOrCreateNatalChart, \{\}\)\.catch/, "el cálculo no puede rechazar el guardado");
});

test("la salida del alta la autoriza el estado autoritativo, no la escritura", () => {
  const flow = sinComentarios(leer("src/onboarding/OnboardingFlow.tsx"));
  // `submit` ya no navega: sólo escribe.
  const submit = flow.slice(
    flow.indexOf("const submit = async ()"),
    flow.indexOf("if (step === FINAL_STEP && !PAYWALL_ENABLED)")
  );
  assert.ok(submit.length > 0);
  assert.doesNotMatch(submit, /router\.replace/, "el cierre no puede navegar por su cuenta");
  assert.doesNotMatch(submit, /clearDraft\(\)/, "ni dar por terminado el alta");
  // Quien navega es el efecto que espera los datos persistidos.
  assert.match(flow, /if \(!isBirthDataReady\(completion\)\) return;\s*void enterApp\(\);/);
  // Y el destino es la ceremonia de recepción, con la tríada real calculada por
  // el alta viajando en params (la carta puede no estar persistida todavía).
  assert.match(flow, /router\.replace\(\{\s*pathname: RECEPTION_ROUTE,/);
  assert.match(flow, /sol: computed\.sun/);
  assert.match(flow, /luna: computed\.moon/);
  assert.match(flow, /asc: computed\.ascendant/);
  // Y una sola vez: la query es reactiva y puede volver a emitir.
  assert.match(flow, /if \(enterLock\.current\) return;\s*enterLock\.current = true;/);
});

test("Home muestra un estado navegable de carta pendiente antes que cualquier spinner", () => {
  const home = sinComentarios(leer("src/screens/HomeScreen.tsx"));
  const renderState = home.slice(home.indexOf("{!chartReady || !heroTriad"));
  assert.ok(renderState.length > 0);
  assert.ok(
    renderState.indexOf("!chartReady || !heroTriad") < renderState.indexOf('dailyState.status === "error"'),
    "la falta de carta se resuelve antes de esperar la guía diaria"
  );
  assert.match(renderState, /Tus datos ya están guardados\./);
  assert.match(renderState, /router\.push\("\/\(tabs\)\/carta"\)/);
  assert.match(renderState, /VER MI CARTA/);
});

test("Carta intenta calcular al abrir y conserva un reintento manual", () => {
  const carta = sinComentarios(leer("src/screens/CartaScreen.tsx"));
  assert.match(carta, /<RecalculateChart reason="missing" \/>/);
  const retry = carta.slice(carta.indexOf("function RecalculateChart"));
  assert.match(retry, /autoAttempted\.current = true;\s*run\(\);/);
  assert.match(retry, /Tus datos están guardados: probá de nuevo cuando quieras\./);
  assert.match(retry, /state === "failed" \? "REINTENTAR"/);
});
