/**
 * Teléfono COMPARTIDO: una cuenta nueva no hereda los datos de la anterior.
 *
 * La garantía existía en la puerta legada de `/iniciar-sesion`
 * (`leaveWithoutSignIn`): quien salía del login para "Crear una cuenta" no
 * había probado ser el dueño del perfil de este teléfono, así que lo suyo se
 * archivaba BAJO SU CUENTA —recuperable, nunca destruido— y se limpiaba antes
 * de soltar el teléfono. Sin eso, `createProfile` reemplaza perfil + dueño y le
 * deja al que entra las lecturas guardadas y el diario del anterior.
 *
 * Al unificar el acceso en `AuthScreen` esa ruta perdió su UI y la garantía se
 * quedó sin dueño. Acá vuelve al flujo canónico, enganchada al ÚNICO punto
 * donde efectivamente empieza un alta: `onBeforeSignup`, que es la `seedMarker`
 * de `startSignupGate`.
 *
 * Lo que este archivo fija:
 *
 * 1. El orden: archivar → limpiar → marcador → Clerk.
 * 2. Falla cerrado: si archivar o limpiar fallan, no avanza NADA y se reintenta.
 * 3. No se dispara por cambiar de pestaña, volver, cancelar ni ingresar.
 * 4. No se repite después de una liberación exitosa.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { releaseSharedDevice, startSignupGate } from "../src/onboarding/authGate";

const ROOT = join(import.meta.dirname, "..");
const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const FLOW = sinComentarios(leer("src/onboarding/OnboardingFlow.tsx"));
const ACCESO = sinComentarios(leer("src/onboarding/screens/AuthScreen.tsx"));
const ALIAS = sinComentarios(leer("app/iniciar-sesion.tsx"));

// ---------------------------------------------------------------------------
// Banco: la MISMA composición que cablea el flujo (alta real, de punta a punta)
// ---------------------------------------------------------------------------

type Fallo = "archive" | "reset" | "marker" | null;

function banco(opciones: { profileOwner: string | null; falla?: Fallo } = { profileOwner: "user_previo" }) {
  const pasos: string[] = [];
  const released = { current: false };
  let profileOwner = opciones.profileOwner;
  let falla: Fallo = opciones.falla ?? null;

  // `onBeforeSignup` del flujo, tal cual está cableado en `OnboardingFlow`.
  const onBeforeSignup = async () => {
    await releaseSharedDevice({
      released,
      profileOwner,
      archiveAccountData: async (userId) => {
        pasos.push(`archive:${userId}`);
        if (falla === "archive") throw new Error("ASYNC_STORAGE_DOWN");
      },
      resetApp: async () => {
        pasos.push("reset");
        if (falla === "reset") throw new Error("ASYNC_STORAGE_DOWN");
        // La limpieza real deja el teléfono sin dueño.
        profileOwner = null;
      }
    });
    pasos.push("persist-id");
    if (falla === "marker") throw new Error("CONVEX_DOWN");
    pasos.push("marker");
  };

  // La pantalla siempre entra por la puerta pura; Clerk es `createAccount`.
  const empezarAlta = () =>
    startSignupGate({
      seedMarker: async () => void (await onBeforeSignup()),
      createAccount: async () => {
        pasos.push("clerk");
      }
    });

  return {
    pasos,
    released,
    empezarAlta,
    arreglar: () => {
      falla = null;
    },
    aparecerDueno: (userId: string) => {
      profileOwner = userId;
    }
  };
}

// ---------------------------------------------------------------------------
// 1 · El orden del alta real: archivar → limpiar → marcador → Clerk
// ---------------------------------------------------------------------------

test("CONDUCTA · con dueño previo, el alta archiva y limpia ANTES del marcador y de Clerk", async () => {
  const b = banco({ profileOwner: "user_previo" });
  assert.equal(await b.empezarAlta(), "started");
  // Archivar bajo la cuenta del dueño anterior (recuperable), después limpiar,
  // y recién entonces el marcador y la identidad.
  assert.deepEqual(b.pasos, ["archive:user_previo", "reset", "persist-id", "marker", "clerk"]);
  assert.equal(b.released.current, true, "el teléfono queda liberado");
});

test("CONDUCTA · sin dueño previo no se archiva ni se limpia nada", async () => {
  const b = banco({ profileOwner: null });
  assert.equal(await b.empezarAlta(), "started");
  assert.deepEqual(b.pasos, ["persist-id", "marker", "clerk"]);
  // Y el candado queda ABIERTO: `useAppState` hidrata de disco, así que un
  // dueño puede aparecer un render después. Cerrarlo sin haber liberado nada
  // dejaría ese caso sin protección.
  assert.equal(b.released.current, false);
  b.aparecerDueno("user_tardio");
  assert.equal(await b.empezarAlta(), "started");
  assert.deepEqual(b.pasos.slice(3), ["archive:user_tardio", "reset", "persist-id", "marker", "clerk"]);
});

// ---------------------------------------------------------------------------
// 2 · Falla cerrado, y se puede reintentar
// ---------------------------------------------------------------------------

test("CONDUCTA · si el archivado falla, no se limpia, no hay marcador y Clerk NO se invoca", async () => {
  const b = banco({ profileOwner: "user_previo", falla: "archive" });
  // El rechazo se convierte en el error visible que ya existía en la pantalla.
  assert.equal(await b.empezarAlta(), "marker_failed");
  assert.deepEqual(b.pasos, ["archive:user_previo"], "nada avanzó después del archivado fallido");
  assert.equal(b.released.current, false, "el candado queda abierto: es reintentable");
  // Reintento exitoso: recién ahí se libera el teléfono y se crea la cuenta.
  b.arreglar();
  assert.equal(await b.empezarAlta(), "started");
  assert.deepEqual(b.pasos.slice(1), ["archive:user_previo", "reset", "persist-id", "marker", "clerk"]);
});

test("CONDUCTA · si la limpieza falla, tampoco avanzan el marcador ni Clerk", async () => {
  const b = banco({ profileOwner: "user_previo", falla: "reset" });
  assert.equal(await b.empezarAlta(), "marker_failed");
  assert.deepEqual(b.pasos, ["archive:user_previo", "reset"]);
  assert.equal(b.released.current, false);
  // Los datos ya están archivados bajo su cuenta: reintentar es seguro y el
  // alta sigue sin poder empezar hasta que la limpieza salga bien.
  b.arreglar();
  assert.equal(await b.empezarAlta(), "started");
  assert.deepEqual(b.pasos.slice(2), ["archive:user_previo", "reset", "persist-id", "marker", "clerk"]);
});

test("CONDUCTA · el marcador sigue siendo imprescindible después de liberar", async () => {
  // La liberación no relaja la puerta anterior: si Convex no guarda el
  // marcador, Clerk tampoco se invoca.
  const b = banco({ profileOwner: "user_previo", falla: "marker" });
  assert.equal(await b.empezarAlta(), "marker_failed");
  assert.deepEqual(b.pasos, ["archive:user_previo", "reset", "persist-id"]);
  // Pero el teléfono YA se liberó: el reintento no vuelve a archivar.
  assert.equal(b.released.current, true);
  b.arreglar();
  assert.equal(await b.empezarAlta(), "started");
  assert.deepEqual(b.pasos.slice(3), ["persist-id", "marker", "clerk"]);
});

// ---------------------------------------------------------------------------
// 3 · No se repite después de una liberación exitosa
// ---------------------------------------------------------------------------

test("CONDUCTA · liberado el teléfono, un alta reintentada no vuelve a archivar", async () => {
  const b = banco({ profileOwner: "user_previo" });
  assert.equal(await b.empezarAlta(), "started");
  assert.deepEqual(b.pasos, ["archive:user_previo", "reset", "persist-id", "marker", "clerk"]);
  // Volver atrás, cambiar de email y crear la cuenta otra vez en la MISMA
  // instancia: ya no hay nada de nadie a la vista, archivar de nuevo
  // sobrescribiría el archivo del dueño anterior con un snapshot vacío.
  assert.equal(await b.empezarAlta(), "started");
  assert.deepEqual(b.pasos.slice(5), ["persist-id", "marker", "clerk"]);
});

test("CONDUCTA · el candado ignora un dueño que reaparezca después de liberar", async () => {
  const b = banco({ profileOwner: "user_previo" });
  assert.equal(await b.empezarAlta(), "started");
  // `profileOwner` puede volver en un render viejo (el estado de React no se
  // refresca dentro del mismo closure): el candado es lo que evita el doble
  // archivado, no el valor del dueño.
  b.aparecerDueno("user_previo");
  assert.equal(await b.empezarAlta(), "started");
  assert.deepEqual(b.pasos.slice(5), ["persist-id", "marker", "clerk"]);
});

// ---------------------------------------------------------------------------
// 4 · Cableado: sólo el alta real, y en ese orden
// ---------------------------------------------------------------------------

test("el flujo libera el teléfono dentro de `onBeforeSignup`, antes del id y del marcador", () => {
  const handler = FLOW.slice(FLOW.indexOf("onBeforeSignup="), FLOW.indexOf("onSignInPath="));
  assert.match(handler, /await releaseSharedDevice\(\{/, "la preparación es la primera espera del alta");
  assert.match(handler, /released: deviceReleased/, "el candado es el ref de la instancia");
  assert.match(handler, /profileOwner,\s*archiveAccountData,\s*resetApp/, "archiva bajo el dueño anterior");
  const iRelease = handler.indexOf("releaseSharedDevice");
  assert.ok(iRelease >= 0 && iRelease < handler.indexOf("persistClientDraftId(clientDraftId)"));
  assert.ok(iRelease < handler.indexOf("markSignup(clientDraftId)"));
  // El flujo toma las tres piezas del estado local compartido…
  assert.match(FLOW, /const \{ createProfile, profileOwner, archiveAccountData, resetApp \} = useAppState\(\);/);
  // …y NO las usa en ningún otro lado: acá no hay una segunda purga.
  for (const pieza of ["releaseSharedDevice", "archiveAccountData", "resetApp", "profileOwner", "deviceReleased"]) {
    const usos = FLOW.split(pieza).length - 1;
    assert.equal(usos, 2, `«${pieza}» aparece ${usos} veces: sólo declaración y el alta`);
  }
});

test("nada más que el alta real dispara la liberación", () => {
  // El camino de INGRESO descarta el marcador y no toca los datos locales:
  // quien entra con su cuenta es el dueño, no hay teléfono que liberar.
  assert.match(FLOW, /onSignInPath=\{inspeccion \? undefined : discardSignupMarker\}/);
  const discard = FLOW.slice(FLOW.indexOf("const discardSignupMarker"), FLOW.indexOf("const signupFellToSignIn"));
  for (const prohibido of ["archiveAccountData", "resetApp", "releaseSharedDevice"]) {
    assert.ok(!discard.includes(prohibido), `el camino de ingreso no puede tocar «${prohibido}»`);
  }
  // Cambiar de pestaña sólo limpia el formulario: nunca llama a la preparación.
  const cambiarModo = ACCESO.slice(ACCESO.indexOf("const cambiarModo"), ACCESO.indexOf("const empezar"));
  for (const prohibido of ["onBeforeSignup", "startSignupGate"]) {
    assert.ok(!cambiarModo.includes(prohibido), `cambiar de pestaña no puede disparar «${prohibido}»`);
  }
  // Volver / cancelar tampoco: `onBack` es el reemplazo a la landing, y ni él
  // ni "Usar otro email" pasan por la puerta del alta.
  const volver = ACCESO.slice(ACCESO.indexOf("const volverAlEmail"), ACCESO.indexOf("if (codePhase)"));
  for (const prohibido of ["onBeforeSignup", "startSignupGate"]) {
    assert.ok(!volver.includes(prohibido), `volver no puede disparar «${prohibido}»`);
  }
  assert.match(FLOW, /onBack=\{IS_WEB && !inspeccion \? \(\) => router\.replace\("\/"\) : undefined\}/);
  // Y la preparación existe SÓLO dentro de las dos puertas de alta: la
  // declaración del prop, el destructuring y las dos `seedMarker`.
  const usos = ACCESO.split("onBeforeSignup").length - 1;
  assert.equal(usos, 6, `«onBeforeSignup» aparece ${usos} veces: prop, destructuring y las dos puertas`);
  assert.equal(ACCESO.split("startSignupGate({").length - 1, 2, "email y OAuth de alta: nada más");
});

test("el modo INGRESAR no pasa por la puerta del alta (ni por email ni por proveedor)", () => {
  // La cola de `empezar` es la rama de ingreso: sin puerta, sin preparación.
  const empezar = ACCESO.slice(ACCESO.indexOf("const empezar"), ACCESO.indexOf("const verificar"));
  const colaSignin = empezar.slice(empezar.indexOf("onSignInPath?.();"));
  assert.match(colaSignin, /await signIn\?\.start\(trimmed\);/);
  assert.ok(!colaSignin.includes("startSignupGate"), "la rama de ingreso no abre la puerta del alta");
  const oauth = ACCESO.slice(ACCESO.indexOf("const oauth ="), ACCESO.indexOf("const volverAlEmail"));
  const colaOauthSignin = oauth.slice(oauth.lastIndexOf("onSignInPath?.();"));
  assert.match(colaOauthSignin, /await flow\?\.oauth\(provider\);/);
  assert.ok(!colaOauthSignin.includes("startSignupGate"));
});

// ---------------------------------------------------------------------------
// 5 · Entrada normal y alias `/iniciar-sesion?mode=signin`
// ---------------------------------------------------------------------------

test("el alias en modo ingreso queda cubierto al cambiar a «Crear cuenta»", () => {
  // El alias reenvía a la MISMA pantalla con `mode=signin`; el param sólo elige
  // el estado inicial del selector.
  assert.match(ALIAS, /<Redirect href=\{\{ pathname: ONBOARDING_ROUTE, params: \{ mode: "signin" \} \}/);
  assert.match(FLOW, /initialMode=\{params\.mode === "signin" \? "signin" : undefined\}/);
  assert.match(ACCESO, /const \[mode, setMode\] = useState<AuthMode>\(initialMode \?\? "signup"\);/);
  // Por eso la preparación NO puede depender de cómo se abrió la puerta: el
  // handler mira el estado local, nunca el param ni el modo inicial.
  const handler = FLOW.slice(FLOW.indexOf("onBeforeSignup="), FLOW.indexOf("onSignInPath="));
  for (const prohibido of ["params.mode", "initialMode", "mode ==="]) {
    assert.ok(!handler.includes(prohibido), `la preparación no puede mirar «${prohibido}»`);
  }
  // Y el CTA del alta es el mismo objeto en las dos entradas: `empezar` decide
  // por el modo VIGENTE, que el selector puede cambiar en cualquier momento.
  assert.match(ACCESO, /if \(mode === "signup"\) \{\s*const outcome = await startSignupGate\(\{/);
  assert.match(ACCESO, /onPress=\{\(\) => cambiarModo\("signup"\)\}/);
});

test("el alias documenta que la garantía se trasladó, no que ya estaba", () => {
  // El comentario decía que "el resto del comportamiento no se perdió, se
  // unificó" cuando el archivado todavía no tenía dueño en el flujo canónico.
  const doc = leer("app/iniciar-sesion.tsx");
  assert.match(doc, /releaseSharedDevice/, "nombra el enganche real de la garantía");
  assert.match(doc, /onBeforeSignup/, "y dónde vive");
  assert.ok(
    !doc.includes("El resto del comportamiento que vivía acá no se perdió, se unificó"),
    "la afirmación falsa no puede volver"
  );
});
