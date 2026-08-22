/**
 * QA23-008 — cierre técnico: alta nueva completa y pago/restore/reinicio.
 *
 * ## Los tres defectos que este archivo fija
 *
 * 1. **Una cuenta heredaba los datos natales de otra alta.** El `clientDraftId`
 *    del alta anónima vive en memoria de módulo (nativo) y en `sessionStorage`
 *    (web), o sea que sobrevive a la pantalla de login. Entrar por «Ya tengo
 *    cuenta» con ese id todavía puesto hacía dos cosas encadenadas:
 *    `onboarding.getCompletionStatus` recibía el id, encontraba el borrador
 *    ANÓNIMO —sin dueño, así que pasa el control de pertenencia— y contestaba
 *    `recovery: "onboarding"`, con lo cual una cuenta preexistente incompleta
 *    entraba al alta en vez de ir a `/editar-datos`; y ya adentro, el cierre
 *    llamaba `completeSignupFromDraft` con ESE id, que copia los datos natales
 *    **de la fila del borrador**. Resultado: la cuenta que acababa de entrar se
 *    quedaba con la fecha, la hora y el lugar que había cargado el alta
 *    anterior, y lo tipeado en los pasos 4–12 se descartaba en silencio (con la
 *    sesión activa el borrador remoto ya no se vuelve a escribir).
 * 2. **Un fallo del recordatorio diario se reportaba como alta fallida.**
 *    `scheduleDailyReminder` sólo traga el error del permiso; `cancelAll…` y
 *    `scheduleNotificationAsync` pueden tirar con el permiso ya concedido, y
 *    `createProfile` los esperaba DESPUÉS de haber escrito perfil y dueño en
 *    disco. El rechazo se propagaba a los cuatro llamadores como «no se pudo
 *    crear el perfil».
 * 3. **El cierre del alta no tenía salida si fallaba la parte local.**
 *    `enterApp` tomaba su candado y no lo soltaba nunca: un rechazo dejaba la
 *    pantalla en «Guardando tus datos…» sin un solo control, con los datos ya
 *    guardados en la cuenta.
 *
 * ## Qué se prueba y cómo
 *
 * - **Puro y ejecutado:** el ciclo de vida del borrador anónimo sobre un
 *   `sessionStorage` falso, y la cadena de destino
 *   (`resolveReadinessDestination` → `resolveAccountDestination` →
 *   `destinationAllows`) que decide si el alta se puede montar.
 * - **Puro y ejecutado:** los puntos de reinicio del pago — que un marcador
 *   persistido sobreviva al desmontaje y empuje a Restaurar, y que ninguna
 *   respuesta que no sea una cancelación demostrada o un restore vacío levante
 *   el bloqueo.
 * - **Cableado, leyendo la fuente:** que la puerta de login borre el borrador,
 *   que el cierre del alta tenga salida, que el recordatorio no pueda voltear un
 *   perfil ya guardado y que ningún CTA que cobra, restaura o gestiona exista
 *   sin sesión confirmada.
 *
 * Lo que NO prueba: no monta React ni navega, así que fija que el handler
 * revalide y que la ruta declare su exigencia, no cómo se ve; y no reemplaza
 * comprar de verdad en un teléfono con la hoja de StoreKit arriba.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  destinationAllows,
  resolveAccountDestination,
  type AccountState
} from "../src/domain/accountDestination";
import {
  clearDraft,
  ensureClientDraftId,
  ONBOARDING_DRAFT_KEY,
  readClientDraftId,
  readDraft,
  writeDraft
} from "../src/domain/onboardingDraft";
import {
  isClientDraftId,
  resolveReadinessDestination,
  type OnboardingCompletion
} from "../src/domain/onboardingReadiness";
import {
  applyStoreAnswer,
  emptyPurchaseSession,
  nativePrimaryAction,
  purchaseSessionForOwner,
  storeAnswerClearsPurchaseGuard,
  type NativeStoreAnswer
} from "../src/domain/nativeCommerce";
import { parsePurchaseGuardRead, purchaseGuardBlocks } from "../src/domain/purchaseGuard";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
/** Una regla se comprueba sobre el CÓDIGO: los comentarios no ejecutan nada. */
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PASOS = 15;
const DUEÑO = "user_A";
const OTRO = "user_B";

// ---------------------------------------------------------------------------
// 1. El borrador anónimo del alta
// ---------------------------------------------------------------------------

/**
 * `sessionStorage` falso, instalado sólo mientras dura la prueba.
 *
 * `src/domain/onboardingDraft.ts` lo busca en `window` y de forma perezosa, así
 * que alcanza con ponerlo antes de llamar. En nativo no existe y las funciones
 * no-opean; lo que se prueba acá es la web, que es donde el borrador de verdad
 * sobrevive a un remonte.
 */
function instalarSessionStorage(): Map<string, string> {
  const datos = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    sessionStorage: {
      getItem: (clave: string) => (datos.has(clave) ? datos.get(clave)! : null),
      setItem: (clave: string, valor: string) => {
        datos.set(clave, valor);
      },
      removeItem: (clave: string) => {
        datos.delete(clave);
      }
    }
  };
  return datos;
}

function quitarSessionStorage() {
  delete (globalThis as { window?: unknown }).window;
}

/** Un alta anónima que llegó al paso de cuenta con todo cargado. */
function guardarAltaEnPasoDeCuenta(clientDraftId: string) {
  writeDraft({
    step: 13,
    identity: "ella",
    birthDate: { day: 4, month: 3, year: 1990 },
    placeQuery: "",
    birthPlace: {
      label: "Rosario, Argentina",
      latitude: -32.95,
      longitude: -60.66,
      timezone: "America/Argentina/Cordoba"
    },
    birthTime: { hour: 7, minute: 25 },
    timeUnknown: false,
    clientDraftId
  });
}

test("QA23-008 · el id del alta anónima es estable y sobrevive a un remonte", () => {
  const disco = instalarSessionStorage();
  try {
    clearDraft();
    const id = ensureClientDraftId();
    assert.ok(isClientDraftId(id), "el id tiene la forma opaca que emite el alta");
    assert.equal(ensureClientDraftId(), id, "no se regenera: dejaría huérfano el borrador remoto");

    guardarAltaEnPasoDeCuenta(id);
    // Ésta es la propiedad que el alta necesita —y también la que abría el
    // agujero—: el id sigue disponible aunque el flujo se desmonte y se vuelva a
    // montar (la vuelta de Clerk en web).
    assert.equal(readClientDraftId(), id);
    assert.equal(readDraft(PASOS)?.step, 13);
    assert.ok(disco.get(ONBOARDING_DRAFT_KEY)?.includes(id));
  } finally {
    clearDraft();
    quitarSessionStorage();
  }
});

test("QA23-008 · «Ya tengo cuenta» abandona el alta: ni id ni datos tipeados", () => {
  const disco = instalarSessionStorage();
  try {
    clearDraft();
    const id = ensureClientDraftId();
    guardarAltaEnPasoDeCuenta(id);

    // Lo que hace la puerta de login al confirmar la sesión.
    clearDraft();

    assert.equal(
      readClientDraftId(),
      null,
      "sin id, `getCompletionStatus` no puede encontrar el borrador ajeno"
    );
    assert.equal(
      disco.get(ONBOARDING_DRAFT_KEY),
      undefined,
      "la fecha, la hora y el lugar tipeados por la persona anterior tampoco quedan"
    );
    assert.equal(readDraft(PASOS), null);
    assert.notEqual(
      ensureClientDraftId(),
      id,
      "un alta posterior estrena su propio borrador; nunca reusa el abandonado"
    );
  } finally {
    clearDraft();
    quitarSessionStorage();
  }
});

// ---------------------------------------------------------------------------
// 2. Qué destino le corresponde a una cuenta preexistente incompleta
// ---------------------------------------------------------------------------

/** Cuenta con fila interna y SIN datos natales válidos. Cambia sólo `recovery`. */
function incompleta(recovery: OnboardingCompletion["recovery"]): OnboardingCompletion {
  return {
    status: recovery === "onboarding" ? "onboarding_incomplete" : "profile_incomplete",
    recovery,
    profileReady: true,
    birthDataReady: false,
    chartReady: false
  };
}

/** Sesión viva, disco leído y perfil propio: sólo se mueve el estado remoto. */
function estadoConSesion(completion: OnboardingCompletion): AccountState {
  return {
    backendConfigured: true,
    clerkLoaded: true,
    signedIn: true,
    completionResolved: true,
    completion,
    localProfileReady: true,
    localProfileForeign: false
  };
}

test("QA23-008 · una cuenta preexistente incompleta va al editor, no al alta", () => {
  // El borrador ajeno era lo ÚNICO que movía esta decisión: con él, el backend
  // contesta `recovery: "onboarding"` y la cuenta entra a un alta create-only
  // que después copia los datos natales de la fila del borrador.
  assert.equal(resolveReadinessDestination(incompleta("onboarding")), "onboarding");
  assert.equal(resolveReadinessDestination(incompleta("edit_birth_data")), "edit-birth-data");

  assert.equal(resolveAccountDestination(estadoConSesion(incompleta("edit_birth_data"))), "edit-birth-data");
  assert.equal(resolveAccountDestination(estadoConSesion(incompleta("onboarding"))), "onboarding");

  // Y con el destino correcto, el alta no se puede montar ni por deep link.
  assert.equal(destinationAllows("edit-birth-data", "onboarding"), false);
  assert.equal(destinationAllows("edit-birth-data", "edit-birth-data"), true);
  assert.equal(destinationAllows("edit-birth-data", "app"), false);
});

test("QA23-008 · el alta nunca se monta para una cuenta ya completa", () => {
  const completa: OnboardingCompletion = {
    status: "chart_ready",
    recovery: null,
    profileReady: true,
    birthDataReady: true,
    chartReady: true
  };
  assert.equal(resolveAccountDestination(estadoConSesion(completa)), "app-home");
  assert.equal(destinationAllows("app-home", "onboarding"), false);
});

// ---------------------------------------------------------------------------
// 3. Cableado: la puerta de login abandona el alta anónima
// ---------------------------------------------------------------------------

test("QA23-008 · `/iniciar-sesion` borra el borrador al confirmar la sesión", () => {
  const fuente = leer("app/iniciar-sesion.tsx");
  const codigo = sinComentarios(fuente);

  assert.match(
    codigo,
    /import \{ clearDraft \} from "@\/domain\/onboardingDraft"/,
    "la puerta tiene que poder abandonar el alta anónima"
  );
  // `SignInScreen` hace pasar las TRES vías —código, contraseña y Google— por
  // `onSignedIn`, y acá `onSignedIn` es `enter`.
  const enter = /const enter = async \(\) => \{([\s\S]*?)\n  \};/.exec(codigo);
  assert.ok(enter, "`enter` sigue siendo el callback de sesión confirmada");
  assert.match(enter![1], /clearDraft\(\)/, "el borrador se abandona AL entrar");
  assert.match(codigo, /onSignedIn=\{enter\}/);

  // Volver atrás o salir a crear una cuenta NO abandonan nada: ahí el alta
  // sigue siendo de quien la empezó.
  const salir = /const leaveWithoutSignIn = async \(go: \(\) => void\) => \{([\s\S]*?)\n  \};/.exec(codigo);
  assert.ok(salir, "la salida sin iniciar sesión sigue existiendo");
  assert.doesNotMatch(
    salir![1],
    /clearDraft/,
    "salir a crear la cuenta conserva lo cargado: es la misma persona"
  );
});

test("QA23-008 · las tres vías del login pasan por `onSignedIn`", () => {
  const codigo = sinComentarios(leer("src/onboarding/screens/SignInScreen.tsx"));
  assert.match(codigo, /await onSignedIn\(\)/, "`finish` es el único que avisa");
  // Cuatro llamadas a `finish()`: contraseña, código y Google —las tres vías que
  // pueden activar una sesión— más el «Entrar» de una sesión que ya estaba
  // activa. Si aparece una quinta puerta sin pasar por acá, este conteo lo dice.
  assert.equal((codigo.match(/await finish\(\)/g) ?? []).length, 4);
});

test("QA23-008 · el alta web no inicia una cuenta existente dentro del borrador", () => {
  const codigo = sinComentarios(leer("src/onboarding/components/ClerkSignUp.web.tsx"));
  assert.match(codigo, /import \{ SIGN_IN_ROUTE \} from "@\/domain\/appRoutes"/);
  assert.match(codigo, /<SignUp[\s\S]*signInUrl=\{SIGN_IN_ROUTE\}/);
  assert.doesNotMatch(
    codigo,
    /signInUrl=\{?["']?#/,
    "el enlace no puede abrir un sign-in interno que conserve el borrador"
  );
});

// ---------------------------------------------------------------------------
// 4. Cableado: el cierre del alta y el recordatorio diario
// ---------------------------------------------------------------------------

test("QA23-008 · un fallo del cierre local suelta el candado y ofrece entrar", () => {
  const codigo = sinComentarios(leer("src/onboarding/OnboardingFlow.tsx"));

  const enterApp = /const enterApp = async \(\) => \{([\s\S]*?)\n  \};/.exec(codigo);
  assert.ok(enterApp, "`enterApp` sigue siendo el punto único de salida");
  const cuerpo = enterApp![1];
  assert.match(cuerpo, /if \(enterLock\.current\) return;/, "el candado sigue estando");
  assert.match(cuerpo, /try \{[\s\S]*await abrirOrbita\(\)[\s\S]*\} catch \{/);
  assert.match(cuerpo, /catch \{[\s\S]*enterLock\.current = false;/, "un fallo suelta el candado");
  assert.match(cuerpo, /setEntryFailed\(true\)/);

  // El reintento vuelve a ENTRAR, no a reescribir lo que ya está guardado.
  assert.match(codigo, /onRetry=\{entryFailed \? \(\) => void enterApp\(\) : submit\}/);
  // Y no se anuncia como una pérdida de datos: los datos están guardados.
  assert.match(codigo, /errorLabel=\{entryFailed \? "No pudimos abrir Órbita" : undefined\}/);
  assert.match(leer("src/onboarding/OnboardingFlow.tsx"), /quedaron guardados en tu cuenta/);
});

test("QA23-008 · el recordatorio diario no puede voltear un perfil ya guardado", () => {
  const codigo = sinComentarios(leer("src/hooks/useAppState.tsx"));
  const llamadas = codigo.match(/scheduleDailyReminder\([^)]*\)[^;\n]*/g) ?? [];
  assert.equal(llamadas.length, 2, "creación y edición del perfil, y nada más");
  for (const llamada of llamadas) {
    assert.match(
      llamada,
      /\.catch\(/,
      `un fallo de notificaciones no puede propagarse como fallo del perfil: ${llamada}`
    );
  }
  // El orden no cambió: primero el disco, después el efecto lateral.
  assert.match(
    codigo,
    /await commitProfileCreation\(\{[\s\S]*?\}\);\s*await scheduleDailyReminder\(/,
    "el perfil y su dueño se persisten ANTES de programar nada"
  );
});

test("QA23-008 · un toque con el teclado abierto elige la ciudad", () => {
  // El default de React Native (`"never"`) se come el primer toque: cierra el
  // teclado y no lo entrega al hijo. En el paso «¿Dónde naciste?» eso significa
  // que elegir una ciudad pedía DOS toques.
  const shell = sinComentarios(leer("src/onboarding/components/Screen.tsx"));
  assert.match(shell, /keyboardShouldPersistTaps="handled"/);

  const paso = sinComentarios(leer("src/onboarding/screens/BirthplaceSearchScreen.tsx"));
  assert.match(paso, /<Screen [^>]*scroll>/, "el paso monta el shell con scroll");
  assert.match(paso, /onPress=\{\(\) => onSelect\(place\)\}/);
  assert.match(paso, /accessibilityRole="button"/, "cada resultado se anuncia como control");

  // La MISMA interacción en el editor natal ya lo declaraba: las dos
  // superficies tienen que comportarse igual.
  assert.match(sinComentarios(leer("app/editar-datos.tsx")), /keyboardShouldPersistTaps="handled"/);
});

// ---------------------------------------------------------------------------
// 5. Cableado: ningún CTA cobra, restaura ni gestiona sin sesión confirmada
// ---------------------------------------------------------------------------

test("QA23-008 · el pago exige sesión confirmada en la ruta entera", () => {
  const paywall = sinComentarios(leer("src/routes/v492/paywall.tsx"));
  assert.match(paywall, /<AccountGate surface="app" requires="confirmed-session">/);

  // El editor natal lo declara por sí mismo, no por una coincidencia de tabla.
  const editor = sinComentarios(leer("app/editar-datos.tsx"));
  assert.match(editor, /requires="confirmed-session"/);
  assert.match(editor, /useSensitiveOperation\("natal-edit"\)/);
});

test("QA23-008 · toda acción de tienda exige identidad viva y alineada", () => {
  const pantalla = sinComentarios(leer("src/screens/v492/PlusPaywallScreen.tsx"));
  // Restaurar exige la identidad de la tienda Y el plan validado para ESTA
  // cuenta: con el entitlement de A arrastrado sería una acción sobre datos
  // ajenos.
  assert.match(
    pantalla,
    /const restoreReady =\s*revenueCat\.identifiedUserId !== null && entitlementResuelto;/
  );
  assert.match(pantalla, /disabled=\{busy \|\| !restoreReady\}/);
  // Lo que decide plata sale del REMOTO, nunca de la vista efectiva (que
  // incluye el snapshot local: puede poner una etiqueta, no abrir una compra).
  assert.match(pantalla, /const \{ remote: entitlement, resolved: entitlementResuelto \} = useEntitlement\(\)/);
  assert.match(pantalla, /const backendIsPro = entitlement\?\.isPro;/);

  const provider = sinComentarios(leer("src/services/revenuecat/RevenueCatProvider.tsx"));
  // La puerta única: identidad viva del SDK, alineada con Clerk y con `isLive`.
  assert.match(
    provider,
    /const requireIdentity = useCallback\(\(\) => \{\s*if \(!live\.isLive \|\| !liveUserId \|\| identityRef\.current !== liveUserId\)/
  );
  // Comprar, restaurar, el Customer Center, el reintento del Offering, la
  // impresión y el refresh: los seis pasan por ella, y no hay ningún séptimo
  // camino al SDK.
  const acciones = [
    "purchase",
    "restore",
    "presentCustomerCenter",
    "retry",
    "trackPaywallImpression",
    "refreshCustomerInfo"
  ];
  for (const accion of acciones) {
    assert.match(
      provider,
      new RegExp(`const ${accion} = useCallback[\\s\\S]{0,240}?await runOnStore\\(`),
      `${accion} tiene que entrar por la cola con la identidad revalidada`
    );
  }
  assert.equal(
    (provider.match(/await runOnStore\(/g) ?? []).length,
    acciones.length,
    "ninguna acción nueva puede tocar el SDK por afuera"
  );
});

test("QA23-008 · la gestión del plan en Perfil deriva del remoto y de la tienda", () => {
  const bloque = sinComentarios(leer("src/components/orbita/ManageSubscription.tsx"));
  // El snapshot local puede poner una etiqueta; no puede ofrecer una salida:
  // acá sólo entran el remoto y el dueño de Clerk.
  assert.match(bloque, /const \{ remote: entitlement, owner: clerkOwner \} = useEntitlement\(\)/);
  // Sin plan validado no se dibuja ninguna acción.
  assert.match(bloque, /if \(view === "loading"\) \{/);
  // Restaurar y el Customer Center exigen la identidad de RevenueCat.
  assert.match(bloque, /const dueñoTienda = storeOwner;\s*if \(!dueño \|\| !dueñoTienda\) return;/);
  assert.match(bloque, /ready=\{storeOwner !== null\}/);

  const perfil = sinComentarios(leer("src/screens/PerfilScreen.tsx"));
  assert.match(perfil, /useSensitiveOperation\("account-delete"\)/);
  assert.match(perfil, /if \(!eliminacion\.allowed\) return;/, "revalidado en el handler");
  assert.match(perfil, /disabled=\{!eliminacion\.allowed\}/);
});

// ---------------------------------------------------------------------------
// 6. Reinicio en cada punto de control de la compra
// ---------------------------------------------------------------------------

/** Lo que la pantalla ve al REMONTAR: sesión nueva + marcador leído del disco. */
function alRemontar(userId: string, crudo: string | null) {
  const leido = parsePurchaseGuardRead(crudo, userId);
  const bloquea = purchaseGuardBlocks(leido);
  const sesion = {
    ...emptyPurchaseSession(userId),
    guard: bloquea ? ("blocked" as const) : ("clear" as const),
    lastOutcome: bloquea ? ("ambiguous" as const) : ("none" as const)
  };
  return {
    sesion,
    primary: nativePrimaryAction({
      offeringReady: true,
      backendIsPro: false,
      storeConfirmed: false,
      busy: false,
      lastOutcome: sesion.lastOutcome,
      guardLoaded: true
    })
  };
}

test("QA23-008 · una compra en vuelo sobrevive al reinicio y empuja a Restaurar", () => {
  const marcador = JSON.stringify({ userId: DUEÑO, startedAt: 1 });

  assert.equal(alRemontar(DUEÑO, marcador).primary, "restore", "no se ofrece comprar de nuevo");
  assert.equal(alRemontar(DUEÑO, null).primary, "purchase", "sin marcador, la compra es legítima");
  // Un marcador ilegible puede estar TAPANDO un cargo: falla cerrado.
  assert.equal(alRemontar(DUEÑO, "{no es json").primary, "restore");
  // Y el marcador de A no puede frenar la compra de B en el mismo teléfono.
  assert.equal(alRemontar(OTRO, marcador).primary, "purchase");
});

test("QA23-008 · sólo una respuesta demostrada levanta el bloqueo de compra", () => {
  const respuestas: NativeStoreAnswer[] = [
    "purchase_started",
    "purchase_cancelled",
    "purchase_ambiguous",
    "store_confirmed",
    "restore_empty",
    "recheck_empty"
  ];
  const levantan = respuestas.filter(storeAnswerClearsPurchaseGuard);
  assert.deepEqual(levantan, ["purchase_cancelled", "restore_empty"]);

  // El cargo confirmado por la tienda NO levanta nada: falta Convex.
  const cobrada = applyStoreAnswer(
    { userId: DUEÑO, guard: "blocked", lastOutcome: "ambiguous", purchaseReceived: false },
    DUEÑO,
    "store_confirmed"
  );
  assert.equal(cobrada.guard, "blocked");
  assert.equal(cobrada.purchaseReceived, true);
  assert.equal(
    nativePrimaryAction({
      offeringReady: true,
      backendIsPro: false,
      storeConfirmed: true,
      busy: false,
      lastOutcome: cobrada.lastOutcome,
      guardLoaded: true
    }),
    "wait",
    "con el cargo hecho el primario nunca vuelve a ser comprar"
  );
});

test("QA23-008 · un cambio A → B no hereda el estado de compra de A", () => {
  const deA = applyStoreAnswer(emptyPurchaseSession(DUEÑO), DUEÑO, "purchase_ambiguous");
  assert.equal(deA.guard, "blocked");

  // La pantalla lee SIEMPRE a través del dueño vigente.
  const paraB = purchaseSessionForOwner(deA, OTRO);
  assert.equal(paraB.userId, OTRO);
  assert.equal(paraB.guard, "loading", "B no hereda `guardLoaded` de A");
  assert.equal(
    nativePrimaryAction({
      offeringReady: true,
      backendIsPro: false,
      storeConfirmed: false,
      busy: false,
      lastOutcome: paraB.lastOutcome,
      guardLoaded: paraB.guard !== "loading"
    }),
    "wait",
    "hasta leer el marcador de B no se ofrece ninguna acción de cobro"
  );

  // Y una continuación tardía de A no puede publicar sobre la sesión de B.
  assert.equal(applyStoreAnswer(paraB, DUEÑO, "restore_empty"), paraB);
});
