/**
 * QA23-007 — un timeout no es un signed-out.
 *
 * ## El defecto medido en el build 23
 *
 * Con la sesión restaurada del llavero y sin red, la app no distinguía "no se
 * puede confirmar" de "no hay cuenta". Las dos formas del mismo error:
 *
 * 1. **El spinner infinito.** `useConvexAuth` nunca valida el token, así que
 *    `liveAppGate` deja `isAuthLoading` en true, `resolveAccountDestination`
 *    contesta `loading` y `AccountGate` dibuja `MinimalLoading` para siempre.
 * 2. **La pantalla de error sobre toda la app.** Si `getOrCreateCurrentUser`
 *    agota sus tres intentos, el destino pasa a `retry` y el producto entero
 *    queda tapado, aunque en disco estuviera todo lo de esa misma cuenta.
 *
 * ## Lo que se prueba acá
 *
 * 1. **Los cinco estados existen y no se colapsan.** `loading`,
 *    `confirmed-signed-in`, `confirmed-signed-out`, `transient-unavailable` y
 *    `degraded-local`, recorridos sobre la matriz COMPLETA de señales (73728
 *    combinaciones), con las invariantes que ninguna puede violar.
 * 2. **La identidad no se afloja.** Degradar exige un dueño vigente —vivo o
 *    previamente confirmado en el llavero— que sea exactamente el dueño
 *    persistido del perfil, y que cada snapshot coincida. Instalación nueva,
 *    perfil de invitado, perfil ajeno, llavero ilegible o web conservan el gate.
 * 3. **La identidad previa es fail-closed.** Se escribe sólo con la sesión
 *    confirmada, se borra ante un signed-out confirmado y ante cualquier cambio
 *    de dueño —primero borrar, después escribir—, y un formato desconocido se
 *    lee como ausencia en vez de migrarse. Y los dos pasos son dos **de
 *    verdad**: con una operación en vuelo no arranca la segunda y no se publica
 *    ningún dueño, así que el resultado no depende de cuál promesa del llavero
 *    resuelva última.
 * 4. **Nunca datos de otra cuenta.** `ownedDataReadable` es falso para todo par
 *    de dueños distintos, para todo dueño ausente y para toda confianza que no
 *    abra el shell; `publishableViewer` nunca publica un dueño que no cerró
 *    contra el disco.
 * 5. **Las operaciones sensibles.** Producto cartesiano operación × confianza:
 *    sólo `confirmed-signed-in` autoriza, y cada bloqueo tiene copy en español
 *    que dice que NO pasó nada.
 * 6. **El destino y las superficies.** El shell abre degradado; el pago y el
 *    editor natal no.
 * 7. **La integración.** Que el gate, el layout raíz, el pago, el editor natal,
 *    los tres handlers de escritura de Vínculos, el Perfil y el ciclo de capas
 *    estén realmente cableados, y que el aviso sea accesible y sin un color
 *    escrito a mano.
 *
 * Lo que estas pruebas NO reemplazan, dicho sin redondear:
 *
 * - **Apagar el wifi con la app abierta.** El comportamiento REAL de Clerk sin
 *   red —si resuelve `isLoaded` desde su caché o se queda colgado— sólo se ve en
 *   un teléfono.
 * - **El llavero de verdad.** Acá se prueba la POLÍTICA (qué se escribe, cuándo
 *   se borra, qué se lee de un registro roto) y el CABLEADO (que el provider la
 *   use). Que `expo-secure-store` devuelva lo guardado tras reinstalar, tras un
 *   restore de backup o con el dispositivo bloqueado es una prueba de
 *   dispositivo, no de este archivo.
 * - **Que las pantallas rendericen.** Los bloqueos de Vínculos y del editor
 *   natal se comprueban leyendo el código, no montando React: lo que se fija es
 *   que el handler revalide y que el control se apague, no cómo se ve.
 * - **Que React ejecute la serialización.** El bucle de `correrLlavero`
 *   reproduce el orden del provider sobre la política pura, y el cableado se
 *   fija leyendo el archivo. El doble efecto de `StrictMode` y el render
 *   concurrente —que es para lo que está el candado en `useRef`— sólo se ven
 *   corriendo la app.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  destinationAllows,
  resolveAccountDestination,
  type AccountDestination,
  type AccountSurface
} from "../src/domain/accountDestination";
import type { OnboardingCompletion } from "../src/domain/onboardingReadiness";
import { sessionPhase } from "../src/domain/screenPhase";
import type { UserRowState } from "../src/domain/screenPhase";
import {
  nextSecureIdentityStep,
  parseSecureIdentity,
  publishSecureIdentity,
  SECURE_IDENTITY_KEY,
  SECURE_IDENTITY_VERSION,
  SECURE_SLOT_BROKEN,
  SECURE_SLOT_EMPTY,
  SECURE_SLOT_HYDRATING,
  secureIdentityAction,
  secureSlotBusy,
  secureSlotSettled,
  serializeSecureIdentity,
  type SecureIdentityAction,
  type SecureIdentityPublication,
  type SecureIdentitySlot
} from "../src/domain/secureIdentity";
import {
  applySessionResilience,
  confidenceOpensShell,
  DEGRADED_SESSION_A11Y_HINT,
  DEGRADED_SESSION_BODY,
  DEGRADED_SESSION_COVERAGE,
  DEGRADED_SESSION_TITLE,
  localIdentityIsSecure,
  ownedDataReadable,
  publishableViewer,
  resolveLocalIdentity,
  resolveLocalViewer,
  resolveSessionConfidence,
  SENSITIVE_OPERATIONS,
  SESSION_CONFIDENCES,
  SESSION_CONFIRMATION_TIMEOUT_MS,
  SESSION_RETRY_LABEL,
  sensitiveOperationAllowed,
  sensitiveOperationBlockMessage,
  sessionPhaseUnderConfidence,
  surfaceOpensUnderConfidence,
  TRANSIENT_SESSION_BODY,
  TRANSIENT_SESSION_TITLE,
  UNCONFIRMED_SESSION_BODY,
  UNCONFIRMED_SESSION_TITLE,
  type SessionConfidence,
  type SessionSignals,
  type SurfaceRequirement
} from "../src/domain/sessionResilience";
import { importsOf, ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
/** Una regla se comprueba sobre el código: los comentarios no ejecutan nada. */
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const cuantas = (source: string, re: RegExp) => (source.match(re) ?? []).length;

const DUEÑO = "user_A";
const OTRO = "user_B";

/** Sesión confirmada y sana. Cada prueba parte de acá y mueve UNA cosa. */
const SANA: SessionSignals = {
  backendConfigured: true,
  localReady: true,
  clerkLoaded: true,
  clerkSignedIn: true,
  clerkUserId: DUEÑO,
  convexAuthenticated: true,
  userRow: "ready",
  authoritativeResolved: true,
  confirmationTimedOut: false,
  hasLocalProfile: true,
  localOwner: DUEÑO,
  // Plataforma nativa con el llavero ya leído y su registro de esta misma
  // cuenta: el estado normal de alguien que abrió la app y confirmó su sesión.
  secureIdentitySupported: true,
  secureIdentityReady: true,
  secureIdentityError: false,
  secureOwner: DUEÑO
};

/** El caso de aceptación: Clerk no cargó, la cuenta era válida, hay llavero. */
const TIMEOUT_TOTAL_DE_CLERK: SessionSignals = {
  ...SANA,
  clerkLoaded: false,
  clerkSignedIn: false,
  clerkUserId: null,
  convexAuthenticated: false,
  userRow: "idle",
  authoritativeResolved: false,
  confirmationTimedOut: true
};

// ---------------------------------------------------------------------------
// 1 · Los cinco estados
// ---------------------------------------------------------------------------

test("QA23-007 · los cinco estados de confianza son distintos y están declarados", () => {
  assert.deepEqual([...SESSION_CONFIDENCES], [
    "loading",
    "confirmed-signed-in",
    "confirmed-signed-out",
    "transient-unavailable",
    "degraded-local"
  ]);
  assert.equal(new Set(SESSION_CONFIDENCES).size, 5);
});

test("QA23-007 · la sesión sana es la única que se afirma confirmada", () => {
  assert.equal(resolveSessionConfidence(SANA), "confirmed-signed-in");
  // Cada pieza que falta la baja de confirmada. Ninguna es opcional.
  const piezas: Array<Partial<SessionSignals>> = [
    { convexAuthenticated: false },
    { userRow: "pending" },
    { userRow: "idle" },
    { userRow: "error" },
    { authoritativeResolved: false },
    { clerkLoaded: false },
    { localReady: false }
  ];
  for (const pieza of piezas) {
    assert.notEqual(
      resolveSessionConfidence({ ...SANA, ...pieza }),
      "confirmed-signed-in",
      `faltando ${JSON.stringify(pieza)} no puede seguir siendo confirmada`
    );
  }
  // Y la identidad previa NO puede fabricar una confirmación: confirmar sigue
  // dependiendo del remoto, no de lo que este teléfono recuerde.
  assert.notEqual(
    resolveSessionConfidence({ ...SANA, convexAuthenticated: false, secureOwner: DUEÑO }),
    "confirmed-signed-in"
  );
});

test("QA23-007 · EL defecto: el timeout de Clerk no es un signed-out", () => {
  const clerkColgado: SessionSignals = {
    ...TIMEOUT_TOTAL_DE_CLERK,
    // Sin identidad previa: el estado exacto del build 23.
    secureOwner: null
  };
  assert.equal(resolveSessionConfidence(clerkColgado), "transient-unavailable");
  assert.notEqual(resolveSessionConfidence(clerkColgado), "confirmed-signed-out");
  // Sin vencer el plazo todavía es espera, no fracaso.
  assert.equal(
    resolveSessionConfidence({ ...clerkColgado, confirmationTimedOut: false }),
    "loading"
  );
});

test("QA23-007 · EL caso de aceptación: cuenta previamente válida + timeout completo", () => {
  // Clerk no publica NADA —ni sesión ni userId— y el plazo venció. Con la
  // identidad previamente confirmada en el llavero, y sólo si coincide con el
  // dueño del perfil, se abre el shell con los últimos datos de ESA cuenta.
  assert.equal(resolveSessionConfidence(TIMEOUT_TOTAL_DE_CLERK), "degraded-local");
  assert.equal(publishableViewer(TIMEOUT_TOTAL_DE_CLERK), DUEÑO);
  assert.equal(resolveLocalViewer(TIMEOUT_TOTAL_DE_CLERK).source, "secure-prior");
  // Y mientras el plazo no venció sigue siendo espera: la identidad previa no
  // adelanta la degradación, sólo la hace posible cuando el plazo fracasa.
  assert.equal(
    resolveSessionConfidence({ ...TIMEOUT_TOTAL_DE_CLERK, confirmationTimedOut: false }),
    "loading"
  );
});

test("QA23-007 · Clerk que SÍ resolvió y dice que no hay sesión es una respuesta", () => {
  const sinSesion: SessionSignals = {
    ...SANA,
    clerkSignedIn: false,
    clerkUserId: null,
    convexAuthenticated: false,
    userRow: "idle",
    authoritativeResolved: false
  };
  // Con y sin plazo vencido: un signed-out confirmado nunca degrada ni se
  // vuelve transitorio. El gate se conserva y nada local se toca.
  assert.equal(resolveSessionConfidence(sinSesion), "confirmed-signed-out");
  assert.equal(
    resolveSessionConfidence({ ...sinSesion, confirmationTimedOut: true }),
    "confirmed-signed-out"
  );
  // Ni siquiera con la identidad previa guardada: un signed-out CONFIRMADO no
  // es un fallo de red, y lo que corresponde es volver al login.
  assert.equal(
    resolveSessionConfidence({ ...sinSesion, confirmationTimedOut: true, secureOwner: DUEÑO }),
    "confirmed-signed-out"
  );
});

test("QA23-007 · handshake de Convex sin cerrar + identidad segura = degradada", () => {
  // El caso real: la sesión está en el llavero, Clerk la publica, y Convex no
  // puede validar el token porque no hay red.
  const sinHandshake: SessionSignals = {
    ...SANA,
    convexAuthenticated: false,
    userRow: "pending",
    authoritativeResolved: false
  };
  assert.equal(resolveSessionConfidence(sinHandshake), "loading");
  // El mismo estado con el plazo vencido. Se nombra una vez, tipado como señales
  // de sesión: `resolveLocalViewer` sólo pide las de identidad local, y un
  // literal con `confirmationTimedOut` adentro no es una de ésas.
  const sinHandshakeVencido: SessionSignals = { ...sinHandshake, confirmationTimedOut: true };
  assert.equal(resolveSessionConfidence(sinHandshakeVencido), "degraded-local");
  // Acá el dueño sale de Clerk, no del llavero: la vía viva manda siempre.
  assert.equal(resolveLocalViewer(sinHandshakeVencido).source, "live");
  // Sin perfil propio en disco NO se degrada: no hay nada que se pueda atribuir.
  assert.equal(
    resolveSessionConfidence({
      ...sinHandshake,
      confirmationTimedOut: true,
      hasLocalProfile: false,
      localOwner: null,
      secureOwner: null
    }),
    "transient-unavailable"
  );
});

test("QA23-007 · la fila users en error no espera al plazo: ya agotó el suyo", () => {
  // `getOrCreateCurrentUser` reintenta tres veces con espera creciente. Ese ES
  // su timeout: pedirle además el plazo global sería esperar dos veces.
  const filaRota: SessionSignals = {
    ...SANA,
    convexAuthenticated: true,
    userRow: "error",
    authoritativeResolved: false,
    confirmationTimedOut: false
  };
  assert.equal(resolveSessionConfidence(filaRota), "degraded-local");
  assert.equal(
    resolveSessionConfidence({
      ...filaRota,
      hasLocalProfile: false,
      localOwner: null,
      secureOwner: null
    }),
    "transient-unavailable"
  );
});

test("QA23-007 · el estado autoritativo que no llega también degrada", () => {
  // La sesión puede estar viva y la app igual no saber qué mostrar: si
  // `onboarding.getCompletionStatus` no resuelve, el destino se queda en
  // `loading` para siempre. Eso también es una confirmación que no llegó.
  const sinAutoridad: SessionSignals = { ...SANA, authoritativeResolved: false };
  assert.equal(resolveSessionConfidence(sinAutoridad), "loading");
  assert.equal(
    resolveSessionConfidence({ ...sinAutoridad, confirmationTimedOut: true }),
    "degraded-local"
  );
});

test("QA23-007 · sin backend configurado no hay sesión que confirmar", () => {
  assert.equal(
    resolveSessionConfidence({ ...SANA, backendConfigured: false }),
    "confirmed-signed-out"
  );
  // Y con todo en contra tampoco inventa un estado transitorio: sin envs no hay
  // red que pueda fallar.
  assert.equal(
    resolveSessionConfidence({
      ...SANA,
      backendConfigured: false,
      clerkLoaded: false,
      confirmationTimedOut: true,
      userRow: "error"
    }),
    "confirmed-signed-out"
  );
});

test("QA23-007 · el plazo es el mismo que ya usaba el arranque", () => {
  assert.equal(SESSION_CONFIRMATION_TIMEOUT_MS, 8000);
  for (const archivo of ["src/routes/v492/index.tsx", "src/routes/v492/tabs-layout.tsx"]) {
    assert.match(
      leer(archivo),
      /CLERK_LOAD_TIMEOUT_MS = 8000/,
      `${archivo} decide sobre el mismo hecho y tiene que vencer en el mismo momento`
    );
  }
});

// ---------------------------------------------------------------------------
// 2 · La matriz completa
// ---------------------------------------------------------------------------

/** Todas las señales, cruzadas. Nada se decide "casi siempre". */
function* matriz(): Generator<SessionSignals> {
  const filas: readonly UserRowState[] = ["idle", "pending", "ready", "error"];
  const dueños: readonly (string | null)[] = [DUEÑO, OTRO, null];
  for (const localReady of [true, false])
    for (const clerkLoaded of [true, false])
      for (const clerkSignedIn of [true, false])
        for (const clerkUserId of [DUEÑO, null])
          for (const convexAuthenticated of [true, false])
            for (const userRow of filas)
              for (const authoritativeResolved of [true, false])
                for (const confirmationTimedOut of [true, false])
                  for (const hasLocalProfile of [true, false])
                    for (const localOwner of dueños)
                      for (const secureIdentitySupported of [true, false])
                        for (const secureIdentityReady of [true, false])
                          for (const secureIdentityError of [true, false])
                            for (const secureOwner of dueños)
                              yield {
                                backendConfigured: true,
                                localReady,
                                clerkLoaded,
                                clerkSignedIn,
                                clerkUserId,
                                convexAuthenticated,
                                userRow,
                                authoritativeResolved,
                                confirmationTimedOut,
                                hasLocalProfile,
                                localOwner,
                                secureIdentitySupported,
                                secureIdentityReady,
                                secureIdentityError,
                                secureOwner
                              };
}

test("QA23-007 · la matriz completa: total, sin estados imposibles y con invariantes", () => {
  const vistos = new Set<SessionConfidence>();
  const vias = new Set<string>();
  let combinaciones = 0;

  for (const s of matriz()) {
    combinaciones += 1;
    const confianza = resolveSessionConfidence(s);
    if (!(SESSION_CONFIDENCES as readonly string[]).includes(confianza)) {
      assert.fail(`estado desconocido para ${JSON.stringify(s)}`);
    }
    vistos.add(confianza);

    // Invariante 1 — confirmar exige TODAS las piezas, y ninguna es local.
    if (confianza === "confirmed-signed-in") {
      const completa =
        s.localReady &&
        s.clerkLoaded &&
        s.clerkSignedIn &&
        s.convexAuthenticated &&
        s.userRow === "ready" &&
        s.authoritativeResolved;
      if (!completa) assert.fail(`confirmada sin una pieza: ${JSON.stringify(s)}`);
    }

    // Invariante 2 — degradar exige identidad local SEGURA atada a un dueño
    // vigente, y sólo hay dos vías por las que ese dueño puede existir.
    if (confianza === "degraded-local") {
      const via = resolveLocalViewer(s);
      vias.add(via.source);
      if (!s.localReady) assert.fail("degradar sin haber leído el disco");
      if (!s.hasLocalProfile) assert.fail("degradar sin perfil local");
      if (s.localOwner === null) assert.fail("degradar con un perfil sin dueño");
      if (via.source !== "live" && via.source !== "secure-prior") {
        assert.fail(`degradó sin dueño vigente: ${JSON.stringify(s)}`);
      }
      if (via.owner !== s.localOwner) {
        assert.fail(`degradó con dueños distintos: ${JSON.stringify(s)}`);
      }
      if (via.source === "live" && s.clerkUserId !== s.localOwner) {
        assert.fail(`la vía viva no coincide con el disco: ${JSON.stringify(s)}`);
      }
      if (via.source === "secure-prior") {
        // La identidad previa sólo habla donde EXISTE, ya contestó, no falló, y
        // sólo mientras Clerk no publique ninguna sesión.
        const usable =
          s.secureIdentitySupported === true &&
          s.secureIdentityError !== true &&
          s.secureIdentityReady !== false &&
          s.secureOwner === s.localOwner &&
          s.clerkSignedIn === false &&
          // Un Clerk CARGADO que dice que no hay sesión es `confirmed-signed-out`
          // y nunca llega acá: la vía previa vive sólo bajo el timeout.
          s.clerkLoaded === false;
        if (!usable) assert.fail(`identidad previa usada mal: ${JSON.stringify(s)}`);
      }
      // Y siempre después de un fracaso, nunca durante la espera normal.
      if (!(s.confirmationTimedOut || s.userRow === "error")) {
        assert.fail(`degradó sin que venciera nada: ${JSON.stringify(s)}`);
      }
      // El dueño publicable es EXACTAMENTE el del disco.
      assert.equal(publishableViewer(s), s.localOwner);
    }

    // Invariante 3 — un signed-out confirmado sólo puede salir de un Clerk
    // cargado que efectivamente dice que no hay sesión.
    if (confianza === "confirmed-signed-out") {
      if (!(s.localReady && s.clerkLoaded && !s.clerkSignedIn)) assert.fail(JSON.stringify(s));
    }

    // Invariante 4 — nada que no sea confirmar autoriza una operación sensible.
    if (confianza !== "confirmed-signed-in") {
      for (const op of SENSITIVE_OPERATIONS) {
        assert.equal(sensitiveOperationAllowed(op, confianza), false, `${op} · ${confianza}`);
      }
    }

    // Invariante 5 — con dueños distintos jamás se abre nada, venga el dueño de
    // Clerk o del llavero.
    if (s.localOwner === OTRO && s.clerkUserId === DUEÑO && s.clerkSignedIn) {
      if (confianza === "degraded-local") {
        assert.fail(`datos ajenos degradados (vivo): ${JSON.stringify(s)}`);
      }
      assert.equal(
        ownedDataReadable({ confidence: confianza, viewer: s.clerkUserId, dataOwner: s.localOwner }),
        false
      );
    }
    if (!s.clerkSignedIn && s.secureOwner !== null && s.secureOwner !== s.localOwner) {
      if (confianza === "degraded-local") {
        assert.fail(`datos ajenos degradados (previo): ${JSON.stringify(s)}`);
      }
    }

    // Invariante 6 — la identidad previa a medio leer no decide nada.
    if (s.secureIdentityReady === false && !s.clerkSignedIn) {
      if (confianza === "degraded-local") {
        assert.fail(`degradó con el llavero sin contestar: ${JSON.stringify(s)}`);
      }
    }
  }

  assert.equal(combinaciones, 73728);
  // Los cinco son alcanzables: si alguno no lo fuera, sobraría.
  assert.equal(vistos.size, 5, `estados no alcanzados: ${JSON.stringify([...vistos])}`);
  // Y las DOS vías del dueño se ejercitan de verdad: si sólo apareciera la viva,
  // esta matriz no estaría probando el caso de aceptación del bloque.
  assert.deepEqual([...vias].sort(), ["live", "secure-prior"]);
});

// ---------------------------------------------------------------------------
// 3 · Identidad local, identidad previa y ownership
// ---------------------------------------------------------------------------

test("QA23-007 · la identidad local distingue los seis casos", () => {
  const base = {
    localReady: true,
    hasLocalProfile: true,
    localOwner: DUEÑO,
    clerkUserId: DUEÑO,
    clerkSignedIn: true
  };
  assert.equal(resolveLocalIdentity({ ...base, localReady: false }), "unknown");
  assert.equal(resolveLocalIdentity({ ...base, hasLocalProfile: false }), "none");
  assert.equal(resolveLocalIdentity({ ...base, localOwner: null }), "unowned");
  // Sin dueño vigente no se puede atribuir lo que hay en disco: no es un
  // conflicto de cuentas, es falta de prueba, y tampoco abre. Sin declarar la
  // fuente segura, el default es que NO existe.
  assert.equal(resolveLocalIdentity({ ...base, clerkSignedIn: false }), "unproven");
  assert.equal(resolveLocalIdentity({ ...base, clerkUserId: null }), "unproven");
  assert.equal(resolveLocalIdentity({ ...base, localOwner: OTRO }), "foreign");
  assert.equal(resolveLocalIdentity(base), "secure");

  // Sólo `secure` autoriza.
  for (const binding of ["unknown", "none", "unowned", "unproven", "foreign"] as const) {
    assert.equal(localIdentityIsSecure(binding), false, binding);
  }
  assert.equal(localIdentityIsSecure("secure"), true);
});

test("QA23-007 · la identidad previa abre sólo cuando existe, cerró y coincide", () => {
  // Clerk no publica nada: es la única situación en la que el llavero habla.
  const previo = {
    localReady: true,
    hasLocalProfile: true,
    localOwner: DUEÑO,
    clerkUserId: null,
    clerkSignedIn: false,
    secureIdentitySupported: true,
    secureIdentityReady: true,
    secureIdentityError: false,
    secureOwner: DUEÑO
  };
  assert.equal(resolveLocalIdentity(previo), "secure");
  assert.equal(publishableViewer(previo), DUEÑO);
  assert.equal(resolveLocalViewer(previo).source, "secure-prior");

  // Web: no hay almacenamiento seguro, así que no hay identidad previa que
  // valga. Se falla cerrado sin inventar seguridad con `localStorage`.
  assert.equal(
    resolveLocalIdentity({ ...previo, secureIdentitySupported: false }),
    "unproven"
  );
  assert.equal(publishableViewer({ ...previo, secureIdentitySupported: false }), null);
  assert.equal(resolveLocalViewer({ ...previo, secureIdentitySupported: false }).source, "none");

  // El llavero falló: un error de lectura no abre nada.
  assert.equal(resolveLocalIdentity({ ...previo, secureIdentityError: true }), "unproven");
  assert.equal(publishableViewer({ ...previo, secureIdentityError: true }), null);

  // Todavía no contestó: no se decide, y `unknown` tampoco abre.
  assert.equal(resolveLocalIdentity({ ...previo, secureIdentityReady: false }), "unknown");
  assert.equal(publishableViewer({ ...previo, secureIdentityReady: false }), null);
  assert.equal(resolveLocalViewer({ ...previo, secureIdentityReady: false }).source, "pending");

  // Sin registro: instalación nueva o sesión nunca confirmada en este teléfono.
  assert.equal(resolveLocalIdentity({ ...previo, secureOwner: null }), "unproven");

  // Registro de OTRA cuenta que la del perfil: jamás.
  assert.equal(resolveLocalIdentity({ ...previo, secureOwner: OTRO }), "foreign");
  assert.equal(publishableViewer({ ...previo, secureOwner: OTRO }), null);

  // Perfil sin dueño (invitado o legado) con un registro previo: tampoco. No se
  // le puede adjudicar a nadie un perfil que no declara dueño.
  assert.equal(resolveLocalIdentity({ ...previo, localOwner: null }), "unowned");
});

test("QA23-007 · cuenta B confirmada jamás ve el perfil de A", () => {
  // Lo peor que podría pasar, en las dos vías. B tiene sesión viva; en disco hay
  // un perfil de A y —peor— un registro previo que dice A.
  const bMirandoAA = {
    localReady: true,
    hasLocalProfile: true,
    localOwner: DUEÑO,
    clerkUserId: OTRO,
    clerkSignedIn: true,
    secureIdentitySupported: true,
    secureIdentityReady: true,
    secureIdentityError: false,
    secureOwner: DUEÑO
  };
  assert.equal(resolveLocalIdentity(bMirandoAA), "foreign");
  // El dueño vigente es B —eso es cierto— pero el dato es de A y no se publica.
  assert.equal(publishableViewer(bMirandoAA), OTRO);
  assert.equal(resolveLocalViewer(bMirandoAA).source, "live");
  for (const confidence of SESSION_CONFIDENCES) {
    assert.equal(ownedDataReadable({ confidence, viewer: OTRO, dataOwner: DUEÑO }), false);
  }
  // Y con la sesión de B sin confirmar tampoco degrada a los datos de A.
  const signals: SessionSignals = {
    ...SANA,
    clerkUserId: OTRO,
    localOwner: DUEÑO,
    secureOwner: DUEÑO,
    convexAuthenticated: false,
    userRow: "pending",
    authoritativeResolved: false,
    confirmationTimedOut: true
  };
  assert.equal(resolveSessionConfidence(signals), "transient-unavailable");
});

test("QA23-007 · Clerk que afirma sesión sin decir de quién no se adivina", () => {
  // `isSignedIn` sin `userId` es una ventana real de Clerk. Caer al último dueño
  // confirmado ahí sería atribuirle a una sesión nueva la identidad de la vieja.
  const ambigua = {
    localReady: true,
    hasLocalProfile: true,
    localOwner: DUEÑO,
    clerkUserId: null,
    clerkSignedIn: true,
    secureIdentitySupported: true,
    secureIdentityReady: true,
    secureIdentityError: false,
    secureOwner: DUEÑO
  };
  assert.equal(resolveLocalViewer(ambigua).source, "none");
  assert.equal(resolveLocalIdentity(ambigua), "unproven");
  assert.equal(publishableViewer(ambigua), null);
});

test("QA23-007 · un snapshot de otra cuenta rompe la identidad segura", () => {
  const base = {
    localReady: true,
    hasLocalProfile: true,
    localOwner: DUEÑO,
    clerkUserId: DUEÑO,
    clerkSignedIn: true
  };
  assert.equal(resolveLocalIdentity({ ...base, snapshotOwners: [DUEÑO, DUEÑO] }), "secure");
  assert.equal(resolveLocalIdentity({ ...base, snapshotOwners: [DUEÑO, OTRO] }), "foreign");
  // Un snapshot SIN dueño tampoco se puede atribuir.
  assert.equal(resolveLocalIdentity({ ...base, snapshotOwners: [null] }), "foreign");
  // Una lista vacía no afirma nada: no hay snapshot que contradiga.
  assert.equal(resolveLocalIdentity({ ...base, snapshotOwners: [] }), "secure");
});

test("QA23-007 · ningún snapshot ambiguo abre, tampoco por la vía previa", () => {
  const previo = {
    localReady: true,
    hasLocalProfile: true,
    localOwner: DUEÑO,
    clerkUserId: null,
    clerkSignedIn: false,
    secureIdentitySupported: true,
    secureIdentityReady: true,
    secureIdentityError: false,
    secureOwner: DUEÑO
  };
  assert.equal(resolveLocalIdentity({ ...previo, snapshotOwners: [DUEÑO] }), "secure");
  // Ajeno, sin dueño, y con uno bueno y uno malo mezclados: los tres cierran.
  for (const snapshotOwners of [[OTRO], [null], [DUEÑO, null], [DUEÑO, OTRO]]) {
    assert.equal(
      resolveLocalIdentity({ ...previo, snapshotOwners }),
      "foreign",
      JSON.stringify(snapshotOwners)
    );
    assert.equal(publishableViewer({ ...previo, snapshotOwners }), null);
  }
  // Y a nivel confianza: con un snapshot ambiguo, el timeout NO degrada.
  assert.equal(
    resolveSessionConfidence({ ...TIMEOUT_TOTAL_DE_CLERK, snapshotOwners: [null] }),
    "transient-unavailable"
  );
  assert.equal(
    resolveSessionConfidence({ ...TIMEOUT_TOTAL_DE_CLERK, snapshotOwners: [DUEÑO] }),
    "degraded-local"
  );
});

test("QA23-007 · nunca se publica un dato de otra cuenta", () => {
  for (const confidence of SESSION_CONFIDENCES) {
    // Mismo dueño: sólo abre con el shell abierto.
    assert.equal(
      ownedDataReadable({ confidence, viewer: DUEÑO, dataOwner: DUEÑO }),
      confidenceOpensShell(confidence),
      confidence
    );
    // Dueños distintos: nunca, en ninguna confianza y en las dos direcciones.
    assert.equal(ownedDataReadable({ confidence, viewer: DUEÑO, dataOwner: OTRO }), false);
    assert.equal(ownedDataReadable({ confidence, viewer: OTRO, dataOwner: DUEÑO }), false);
    // Sin dueño de un lado o del otro: tampoco. No se puede demostrar de quién es.
    assert.equal(ownedDataReadable({ confidence, viewer: null, dataOwner: DUEÑO }), false);
    assert.equal(ownedDataReadable({ confidence, viewer: DUEÑO, dataOwner: null }), false);
    assert.equal(ownedDataReadable({ confidence, viewer: null, dataOwner: null }), false);
  }
  assert.deepEqual(SESSION_CONFIDENCES.filter(confidenceOpensShell), [
    "confirmed-signed-in",
    "degraded-local"
  ]);
});

// ---------------------------------------------------------------------------
// 4 · La identidad previa en disco: formato y secuencia
// ---------------------------------------------------------------------------

test("QA23-007 · la clave del llavero es válida para expo-secure-store", () => {
  // `expo-secure-store` sólo admite alfanuméricos, `.`, `-` y `_`: el prefijo
  // `orbita:` de AsyncStorage haría fallar la escritura en el dispositivo, y ese
  // fallo se leería como "no hay identidad previa" para siempre.
  assert.match(SECURE_IDENTITY_KEY, /^[A-Za-z0-9._-]+$/);
  assert.doesNotMatch(SECURE_IDENTITY_KEY, /:/);
});

test("QA23-007 · el registro previo se lee versionado y sin migrar nada", () => {
  assert.equal(parseSecureIdentity(serializeSecureIdentity(DUEÑO)), DUEÑO);
  // Todo lo que no se entiende es ausencia. Perder la identidad previa cuesta un
  // bloqueo con reintento; aceptar un formato desconocido costaría mostrar los
  // datos de otra cuenta.
  const basura = [
    null,
    undefined,
    "",
    "   ",
    "no es json",
    "[]",
    "null",
    '"user_A"',
    JSON.stringify({ owner: DUEÑO }),
    JSON.stringify({ v: SECURE_IDENTITY_VERSION + 1, owner: DUEÑO }),
    JSON.stringify({ v: String(SECURE_IDENTITY_VERSION), owner: DUEÑO }),
    JSON.stringify({ v: SECURE_IDENTITY_VERSION, owner: 42 }),
    JSON.stringify({ v: SECURE_IDENTITY_VERSION, owner: "" }),
    // Padding: `" user_A"` compara distinto que `"user_A"`, y esa diferencia
    // decide quién ve qué.
    JSON.stringify({ v: SECURE_IDENTITY_VERSION, owner: ` ${DUEÑO}` }),
    JSON.stringify({ v: SECURE_IDENTITY_VERSION, owner: `${DUEÑO} ` })
  ];
  for (const raw of basura) {
    assert.equal(parseSecureIdentity(raw), null, JSON.stringify(raw));
  }
});

test("QA23-007 · sólo una sesión confirmada escribe la identidad previa", () => {
  for (const confidence of SESSION_CONFIDENCES) {
    const accion = secureIdentityAction({
      confidence,
      liveOwner: DUEÑO,
      storedOwner: null
    });
    assert.equal(
      accion === "write",
      confidence === "confirmed-signed-in",
      `${confidence} no puede escribir`
    );
  }
  // Ya guardada y sin cambios: no se reescribe en cada render.
  assert.equal(
    secureIdentityAction({
      confidence: "confirmed-signed-in",
      liveOwner: DUEÑO,
      storedOwner: DUEÑO
    }),
    "keep"
  );
});

test("QA23-007 · un signed-out confirmado borra la identidad previa", () => {
  assert.equal(
    secureIdentityAction({
      confidence: "confirmed-signed-out",
      liveOwner: null,
      storedOwner: DUEÑO
    }),
    "clear"
  );
  // Y sin nada guardado no hay nada que borrar: la operación no se repite sola.
  assert.equal(
    secureIdentityAction({
      confidence: "confirmed-signed-out",
      liveOwner: null,
      storedOwner: null
    }),
    "keep"
  );
});

test("QA23-007 · el cambio de identidad borra ANTES de escribir", () => {
  // Con la sesión ya confirmada como B y un registro de A, el primer paso es
  // borrar. Escribir directamente dejaría, ante un cierre en el medio, un disco
  // con A y una app que cree estar en B.
  assert.equal(
    secureIdentityAction({
      confidence: "confirmed-signed-in",
      liveOwner: OTRO,
      storedOwner: DUEÑO
    }),
    "clear"
  );
  // Y recién en la vuelta siguiente, con el registro ya vacío, se escribe.
  assert.equal(
    secureIdentityAction({
      confidence: "confirmed-signed-in",
      liveOwner: OTRO,
      storedOwner: null
    }),
    "write"
  );
  // El borrado por cambio de identidad no espera a que la sesión confirme: un
  // dueño vivo distinto del guardado invalida el guardado en cualquier estado.
  for (const confidence of SESSION_CONFIDENCES) {
    assert.equal(
      secureIdentityAction({ confidence, liveOwner: OTRO, storedOwner: DUEÑO }),
      "clear",
      confidence
    );
  }
});

test("QA23-007 · un corte de red no toca el disco, y la secuencia converge", () => {
  // Espera, timeout y degradación conservan lo que haya: son estados de red.
  for (const confidence of ["loading", "transient-unavailable", "degraded-local"] as const) {
    assert.equal(
      secureIdentityAction({ confidence, liveOwner: DUEÑO, storedOwner: DUEÑO }),
      "keep",
      confidence
    );
    assert.equal(
      secureIdentityAction({ confidence, liveOwner: null, storedOwner: DUEÑO }),
      "keep",
      confidence
    );
  }
  // Ninguna secuencia se queda pedaleando: aplicar la acción y volver a
  // preguntar llega a `keep` en un máximo de dos pasos, para toda confianza.
  for (const confidence of SESSION_CONFIDENCES) {
    for (const liveOwner of [DUEÑO, OTRO, null]) {
      for (const inicial of [DUEÑO, OTRO, null]) {
        let stored = inicial;
        let pasos = 0;
        while (pasos < 5) {
          const accion = secureIdentityAction({ confidence, liveOwner, storedOwner: stored });
          if (accion === "keep") break;
          stored = accion === "write" ? liveOwner : null;
          pasos += 1;
        }
        assert.ok(
          pasos <= 2,
          `no converge: ${confidence} · vivo ${liveOwner} · guardado ${inicial}`
        );
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 4 bis · La secuencia es una SECUENCIA: una operación por vez
// ---------------------------------------------------------------------------

/**
 * El bucle del provider, sin React.
 *
 * Mismo orden que `SessionResilienceProviderInner`: un render decide UN paso con
 * `nextSecureIdentityStep`, el paso marca el registro en vuelo, el llavero
 * contesta y recién ahí el render siguiente decide el paso que sigue. Lo que se
 * fija acá es la SECUENCIA —qué operaciones salen, en qué orden, qué se publica
 * en el medio y con qué termina—, no que React re-renderice.
 *
 * Sin esto, la prueba de «dos pasos» sólo miraba `secureIdentityAction`, que
 * contesta sobre un registro quieto y por lo tanto no puede ver la carrera: el
 * `clear` de un cambio de identidad y el `write` que decide el render siguiente
 * quedaban en vuelo a la vez, y con el orden de resolución al revés el `clear`
 * borraba al dueño que el `write` acababa de escribir.
 */
function correrLlavero(input: {
  inicial: SecureIdentitySlot;
  confidence: SessionConfidence;
  liveOwner: string | null;
  /** Qué contesta el llavero, operación por operación. Default: todo bien. */
  llavero?: readonly boolean[];
}): {
  operaciones: SecureIdentityAction[];
  publicadoEnVuelo: SecureIdentityPublication[];
  final: SecureIdentitySlot;
} {
  const { confidence, liveOwner } = input;
  const operaciones: SecureIdentityAction[] = [];
  const publicadoEnVuelo: SecureIdentityPublication[] = [];
  let slot = input.inicial;
  let vueltas = 0;
  while (vueltas < 6) {
    const paso = nextSecureIdentityStep({ slot, confidence, liveOwner });
    if (paso === "keep") break;
    vueltas += 1;
    operaciones.push(paso);
    // Arranca la operación: el registro queda en vuelo y deja de publicar.
    slot = secureSlotBusy(slot);
    publicadoEnVuelo.push(publishSecureIdentity(slot));
    // La invariante dura: con una operación en vuelo, NINGÚN render puede
    // arrancar la segunda. Es exactamente la carrera que este bloque corrige.
    assert.equal(
      nextSecureIdentityStep({ slot, confidence, liveOwner }),
      "keep",
      `arrancó una segunda operación con ${paso} en vuelo`
    );
    // Y recién ahora contesta el llavero.
    const ok = input.llavero?.[vueltas - 1] ?? true;
    if (!ok) slot = SECURE_SLOT_BROKEN;
    else if (paso === "write") slot = secureSlotSettled(liveOwner);
    else slot = SECURE_SLOT_EMPTY;
  }
  // Cota dura: una secuencia que no converge falla acá en vez de colgar la suite.
  assert.ok(vueltas < 6, `la secuencia no converge: ${JSON.stringify(operaciones)}`);
  return { operaciones, publicadoEnVuelo, final: slot };
}

test("QA23-007 · el cambio de identidad se SERIALIZA: primero clear, después write", () => {
  const corrida = correrLlavero({
    inicial: secureSlotSettled(DUEÑO),
    confidence: "confirmed-signed-in",
    liveOwner: OTRO
  });
  // Dos operaciones, en ese orden, y nunca a la vez: lo segundo lo comprueba
  // `correrLlavero` en cada paso.
  assert.deepEqual(corrida.operaciones, ["clear", "write"]);
  assert.deepEqual(corrida.final, secureSlotSettled(OTRO));
  // Y en las dos transiciones no se publicó ningún dueño ni se dijo «ya está».
  // Publicar A mientras se lo está borrando es afirmar algo que este proceso ya
  // sabe viejo; publicar B mientras se lo está escribiendo es afirmar algo que
  // el disco todavía no confirmó.
  assert.equal(corrida.publicadoEnVuelo.length, 2);
  for (const publicado of corrida.publicadoEnVuelo) {
    assert.deepEqual(publicado, { ready: false, error: false, owner: null });
  }
});

test("QA23-007 · una operación en vuelo no publica dueño ni se declara resuelta", () => {
  for (const owner of [DUEÑO, OTRO, null])
    for (const error of [true, false])
      for (const hydrated of [true, false]) {
        const publicado = publishSecureIdentity({ hydrated, busy: true, error, owner });
        assert.equal(publicado.ready, false, JSON.stringify({ hydrated, error, owner }));
        assert.equal(publicado.owner, null, JSON.stringify({ hydrated, error, owner }));
      }
  // El marcador de arranque además baja el dueño en memoria: el registro deja de
  // conocerse ANTES de que el llavero se toque, no cuando contesta.
  assert.deepEqual(secureSlotBusy(secureSlotSettled(DUEÑO)), {
    hydrated: true,
    busy: true,
    error: false,
    owner: null
  });
  // Y los cuatro estados sin nada en vuelo, para que se vea qué publica cada uno
  // y que el único que publica un dueño es el registro leído, quieto y sano.
  assert.deepEqual(publishSecureIdentity(SECURE_SLOT_HYDRATING), {
    ready: false,
    error: false,
    owner: null
  });
  assert.deepEqual(publishSecureIdentity(SECURE_SLOT_EMPTY), {
    ready: true,
    error: false,
    owner: null
  });
  assert.deepEqual(publishSecureIdentity(SECURE_SLOT_BROKEN), {
    ready: true,
    error: true,
    owner: null
  });
  assert.deepEqual(publishSecureIdentity(secureSlotSettled(DUEÑO)), {
    ready: true,
    error: false,
    owner: DUEÑO
  });
});

test("QA23-007 · con el llavero en vuelo, el timeout NO abre el shell degradado", () => {
  // El instante exacto de la carrera: se decidió cambiar el registro y el disco
  // todavía no contestó. Abrir ahí con el dueño previo sería abrir con una
  // identidad que este proceso ya sabe vieja.
  const publicado = publishSecureIdentity(secureSlotBusy(secureSlotSettled(DUEÑO)));
  const enVuelo: SessionSignals = {
    ...TIMEOUT_TOTAL_DE_CLERK,
    secureIdentityReady: publicado.ready,
    secureIdentityError: publicado.error,
    secureOwner: publicado.owner
  };
  assert.equal(resolveLocalViewer(enVuelo).source, "pending");
  assert.equal(resolveLocalIdentity(enVuelo), "unknown");
  assert.equal(publishableViewer(enVuelo), null);
  assert.equal(resolveSessionConfidence(enVuelo), "transient-unavailable");
  // Y con el registro quieto y confirmado —el mismo caso, un instante después—
  // recién ahí se abre. La diferencia es la transición, no las señales de red.
  const quieto = publishSecureIdentity(secureSlotSettled(DUEÑO));
  assert.equal(
    resolveSessionConfidence({
      ...enVuelo,
      secureIdentityReady: quieto.ready,
      secureIdentityError: quieto.error,
      secureOwner: quieto.owner
    }),
    "degraded-local"
  );
});

test("QA23-007 · con el registro quieto, el paso es la política de siempre", () => {
  // `nextSecureIdentityStep` no puede ser una segunda política: sobre un
  // registro quieto tiene que contestar exactamente lo mismo que la tabla ya
  // probada, y las tres esperas son las únicas que agrega.
  for (const confidence of SESSION_CONFIDENCES)
    for (const liveOwner of [DUEÑO, OTRO, null])
      for (const owner of [DUEÑO, OTRO, null]) {
        assert.equal(
          nextSecureIdentityStep({ slot: secureSlotSettled(owner), confidence, liveOwner }),
          secureIdentityAction({ confidence, liveOwner, storedOwner: owner }),
          `${confidence} · vivo ${liveOwner} · guardado ${owner}`
        );
        const esperas: readonly SecureIdentitySlot[] = [
          // Sin la lectura inicial.
          { hydrated: false, busy: false, error: false, owner },
          // Con una operación en vuelo.
          { hydrated: true, busy: true, error: false, owner },
          // Con el llavero roto: terminal en este proceso.
          { hydrated: true, busy: false, error: true, owner }
        ];
        for (const slot of esperas) {
          assert.equal(
            nextSecureIdentityStep({ slot, confidence, liveOwner }),
            "keep",
            `${JSON.stringify(slot)} no puede arrancar nada`
          );
        }
      }
});

test("QA23-007 · ninguna secuencia se pisa, se cuelga ni queda en vuelo", () => {
  const iniciales: readonly SecureIdentitySlot[] = [
    SECURE_SLOT_HYDRATING,
    SECURE_SLOT_EMPTY,
    SECURE_SLOT_BROKEN,
    secureSlotSettled(DUEÑO),
    secureSlotSettled(OTRO)
  ];
  // Los tres llaveros posibles: el que anda, el que falla en la primera y el que
  // falla en la segunda (el `write` de un cambio de identidad).
  const llaveros: readonly (readonly boolean[])[] = [
    [true, true],
    [false, true],
    [true, false]
  ];
  for (const confidence of SESSION_CONFIDENCES)
    for (const liveOwner of [DUEÑO, OTRO, null])
      for (const inicial of iniciales)
        for (const llavero of llaveros) {
          const caso = `${confidence} · vivo ${liveOwner} · ${JSON.stringify(inicial)} · ${llavero}`;
          const corrida = correrLlavero({ inicial, confidence, liveOwner, llavero });
          // Como mucho dos operaciones, igual que la política quieta.
          assert.ok(corrida.operaciones.length <= 2, `${caso}: ${corrida.operaciones}`);
          // Nada queda en vuelo al final: un registro ocupado para siempre sería
          // el llavero muerto en un árbol vivo, sin publicar y sin poder avanzar.
          assert.equal(corrida.final.busy, false, caso);
          // Un fallo del llavero corta la secuencia ahí mismo y deja BROKEN, que
          // no publica dueño y por lo tanto no abre nada.
          if (corrida.final.error) {
            assert.deepEqual(publishSecureIdentity(corrida.final), {
              ready: true,
              error: true,
              owner: null
            });
            assert.equal(
              nextSecureIdentityStep({ slot: corrida.final, confidence, liveOwner }),
              "keep",
              `${caso}: un llavero roto no se reintenta en bucle`
            );
          }
          // Y si terminó con un dueño, es el vivo. La única otra posibilidad es
          // que no hubiera dueño vivo y no se tocara nada: un corte de red no
          // altera el disco.
          if (corrida.final.owner !== null) {
            assert.ok(corrida.final.owner === liveOwner || liveOwner === null, caso);
          }
        }
});

test("QA23-007 · el llavero roto no abre nada, venga de leer, borrar o escribir", () => {
  // Las tres formas de romperse terminan en el mismo estado publicable.
  const roto = publishSecureIdentity(SECURE_SLOT_BROKEN);
  assert.deepEqual(roto, { ready: true, error: true, owner: null });
  const signals: SessionSignals = {
    ...TIMEOUT_TOTAL_DE_CLERK,
    secureIdentityReady: roto.ready,
    secureIdentityError: roto.error,
    secureOwner: roto.owner
  };
  assert.equal(resolveLocalViewer(signals).source, "none");
  assert.equal(resolveLocalIdentity(signals), "unproven");
  assert.equal(publishableViewer(signals), null);
  assert.equal(resolveSessionConfidence(signals), "transient-unavailable");
  // Y un `clear` que falla en un cambio de identidad no deja pasar al `write`:
  // el registro puede haber quedado con el dueño viejo, así que este proceso no
  // vuelve a tocarlo y no publica a nadie.
  const corrida = correrLlavero({
    inicial: secureSlotSettled(DUEÑO),
    confidence: "confirmed-signed-in",
    liveOwner: OTRO,
    llavero: [false]
  });
  assert.deepEqual(corrida.operaciones, ["clear"]);
  assert.deepEqual(corrida.final, SECURE_SLOT_BROKEN);
});

// ---------------------------------------------------------------------------
// 5 · Operaciones sensibles
// ---------------------------------------------------------------------------

test("QA23-007 · operación × confianza: sólo la sesión confirmada autoriza", () => {
  assert.deepEqual([...SENSITIVE_OPERATIONS], [
    "purchase",
    "restore-purchase",
    "manage-subscription",
    "account-delete",
    "natal-edit",
    "account-write"
  ]);
  for (const op of SENSITIVE_OPERATIONS) {
    for (const confidence of SESSION_CONFIDENCES) {
      assert.equal(
        sensitiveOperationAllowed(op, confidence),
        confidence === "confirmed-signed-in",
        `${op} · ${confidence}`
      );
    }
  }
});

test("QA23-007 · el shell degradado NO habilita comprar, borrar ni editar la carta", () => {
  // El estado exacto del bloque: shell abierto, cero autoridad de escritura.
  assert.equal(confidenceOpensShell("degraded-local"), true);
  for (const op of SENSITIVE_OPERATIONS) {
    assert.equal(sensitiveOperationAllowed(op, "degraded-local"), false, op);
  }
});

test("QA23-007 · cada bloqueo se explica en español y aclara que no pasó nada", () => {
  const mensajes = SENSITIVE_OPERATIONS.map((op) => sensitiveOperationBlockMessage(op));
  assert.equal(new Set(mensajes).size, mensajes.length, "dos operaciones no pueden decir lo mismo");
  for (const op of SENSITIVE_OPERATIONS) {
    const mensaje = sensitiveOperationBlockMessage(op);
    assert.ok(mensaje.length > 40, `${op}: el mensaje tiene que explicar, no rotular`);
    assert.match(mensaje, /sesión/, `${op}: tiene que decir qué falta`);
    // Ni promesas de tiempo ni culpa: se dice qué falta y qué se puede hacer.
    assert.doesNotMatch(mensaje, /segundos|enseguida|en un momento|error/i, op);
    assert.match(mensaje, /probá de nuevo/, `${op}: tiene que ofrecer la salida`);
  }
  // Las tres operaciones destructivas o con cargo dicen explícitamente que no
  // hicieron nada. Es lo primero que alguien necesita saber.
  assert.match(sensitiveOperationBlockMessage("purchase"), /No se hizo ningún cargo/);
  assert.match(sensitiveOperationBlockMessage("account-delete"), /No borramos nada/);
  assert.match(sensitiveOperationBlockMessage("natal-edit"), /No cambiamos nada/);
  // Y la escritura de cuenta dice que lo que se intentaba NO quedó guardado.
  assert.match(sensitiveOperationBlockMessage("account-write"), /no guardamos esto/);
});

// ---------------------------------------------------------------------------
// 6 · Destino y superficies
// ---------------------------------------------------------------------------

const DESTINOS: readonly AccountDestination[] = [
  "loading",
  "sign-in",
  "bootstrap",
  "onboarding",
  "edit-birth-data",
  "app-home",
  "retry",
  "degraded"
];

test("QA23-007 · la resiliencia sólo degrada un «todavía no sé»", () => {
  for (const base of DESTINOS) {
    // Ninguna otra confianza mueve un destino.
    for (const confidence of SESSION_CONFIDENCES) {
      if (confidence === "degraded-local") continue;
      assert.equal(applySessionResilience(base, confidence), base, `${base} · ${confidence}`);
    }
    const degradado = applySessionResilience(base, "degraded-local");
    if (base === "loading" || base === "retry") {
      assert.equal(degradado, "degraded", base);
    } else {
      // `sign-in` manda: Clerk confirmó que no hay sesión y eso no es un fallo
      // de red. `bootstrap` tampoco se toca: hay datos locales sin aislar.
      assert.equal(degradado, base, base);
    }
  }
});

test("QA23-007 · el destino degradado abre el shell y NADA más", () => {
  const superficies: readonly AccountSurface[] = [
    "landing",
    "auth",
    "onboarding",
    "edit-birth-data",
    "app"
  ];
  for (const surface of superficies) {
    assert.equal(
      destinationAllows("degraded", surface),
      surface === "app",
      `degradado no puede montar ${surface}`
    );
  }
  // En particular: el editor natal conserva el gate.
  assert.equal(destinationAllows("degraded", "edit-birth-data"), false);
  // Y el alta de una instalación nueva también.
  assert.equal(destinationAllows("degraded", "onboarding"), false);
});

test("QA23-007 · una ruta que existe para escribir no abre degradada", () => {
  const requisitos: readonly SurfaceRequirement[] = ["read", "confirmed-session"];
  for (const requirement of requisitos) {
    for (const confidence of SESSION_CONFIDENCES) {
      const abre = surfaceOpensUnderConfidence(requirement, confidence);
      if (confidence === "confirmed-signed-in") assert.equal(abre, true, requirement);
      else if (confidence === "degraded-local") assert.equal(abre, requirement === "read");
      else assert.equal(abre, false, `${requirement} · ${confidence}`);
    }
  }
});

test("QA23-007 · el resolver de destino no cambió para los caminos de siempre", () => {
  // Regresión: la resiliencia se aplica DESPUÉS, así que `resolveAccountDestination`
  // sigue contestando exactamente lo mismo que antes de este bloque.
  const completa: OnboardingCompletion = {
    status: "chart_ready",
    recovery: null,
    profileReady: true,
    birthDataReady: true,
    chartReady: true
  };
  assert.equal(
    resolveAccountDestination({
      backendConfigured: true,
      clerkLoaded: true,
      signedIn: false,
      completionResolved: false
    }),
    "sign-in"
  );
  assert.equal(
    resolveAccountDestination({
      backendConfigured: true,
      clerkLoaded: false,
      signedIn: false,
      completionResolved: false
    }),
    "loading"
  );
  assert.equal(
    resolveAccountDestination({
      backendConfigured: true,
      clerkLoaded: true,
      signedIn: true,
      completionResolved: true,
      completion: completa,
      localProfileReady: true,
      localProfileForeign: false
    }),
    "app-home"
  );
  assert.equal(
    resolveAccountDestination({
      backendConfigured: true,
      clerkLoaded: true,
      signedIn: true,
      completionResolved: true,
      completion: completa,
      localProfileReady: false,
      localProfileForeign: true
    }),
    "bootstrap"
  );
  assert.equal(
    resolveAccountDestination({
      backendConfigured: true,
      clerkLoaded: true,
      signedIn: true,
      completionResolved: false,
      recoveryFailed: true
    }),
    "retry"
  );
});

// ---------------------------------------------------------------------------
// 7 · Fase por sección
// ---------------------------------------------------------------------------

test("QA23-007 · sin confirmar, cada sección muestra error y reintento (no spinner)", () => {
  // La fase cruda de una sesión que no cierra el handshake es «cargando»: eso
  // es lo que dejaba cada sección girando para siempre.
  const cruda = sessionPhase({ isAuthLoading: true, userError: false, isLive: false });
  assert.equal(cruda, "cargando");
  assert.equal(sessionPhaseUnderConfidence(cruda, "degraded-local"), "error");
  assert.equal(sessionPhaseUnderConfidence(cruda, "transient-unavailable"), "error");
  // Mientras todavía hay plazo, la espera sigue siendo espera.
  assert.equal(sessionPhaseUnderConfidence(cruda, "loading"), "cargando");
  // Y una sesión confirmada no se toca.
  const viva = sessionPhase({ isAuthLoading: false, userError: false, isLive: true });
  assert.equal(viva, "live");
  assert.equal(sessionPhaseUnderConfidence(viva, "confirmed-signed-in"), "live");
  assert.equal(sessionPhaseUnderConfidence("invitado", "confirmed-signed-out"), "invitado");
});

// ---------------------------------------------------------------------------
// 8 · Integración real
// ---------------------------------------------------------------------------

const GATE = sinComentarios(leer("src/components/orbita/AccountGate.tsx"));
const LAYOUT = sinComentarios(leer("app/_layout.tsx"));
const AVISO = sinComentarios(leer("src/components/orbita/SessionNotice.tsx"));
const PAYWALL = sinComentarios(leer("src/routes/v492/paywall.tsx"));
const PERFIL = sinComentarios(leer("src/screens/PerfilScreen.tsx"));
const CAPAS = sinComentarios(leer("src/hooks/useLayers.tsx"));
const RESILIENCIA = sinComentarios(leer("src/hooks/useSessionResilience.tsx"));
const DESTINO = sinComentarios(leer("src/hooks/useAccountDestination.tsx"));
const EDITOR = sinComentarios(leer("app/editar-datos.tsx"));
const CONECTAR = sinComentarios(leer("src/screens/v492/VinculosConnectScreen.tsx"));
const RESULTADO = sinComentarios(leer("src/screens/v492/VinculosResultScreen.tsx"));
const LLAVERO = sinComentarios(leer("src/services/secureIdentity.ts"));
const LLAVERO_WEB = sinComentarios(leer("src/services/secureIdentity.web.ts"));
const ARRANQUE = sinComentarios(leer("src/routes/v492/index.tsx"));

test("QA23-007 · el gate resuelve la sesión degradada y NUNCA la redirige", () => {
  assert.match(GATE, /destination === "degraded"/);
  assert.match(GATE, /DegradedSessionBanner/);
  assert.match(GATE, /UnconfirmedSessionScreen/);
  assert.match(GATE, /surfaceOpensUnderConfidence/);
  // El switch de redirects no puede tener un caso para la sesión degradada:
  // mandar al login a alguien con la sesión viva en el llavero es el defecto.
  assert.doesNotMatch(GATE, /case "degraded"/);
  // Y el estado sin identidad segura tampoco redirige: muestra reintento. El
  // motivo cambia según qué esperaba la superficie: sólo donde hace falta una
  // cuenta se dice que no se muestran datos sin verificar.
  assert.match(GATE, /confidence === "transient-unavailable"/);
  assert.match(GATE, /surface === "app" \|\| surface === "edit-birth-data"/);
  assert.match(GATE, /variant=\{esperaCuenta \? "unattributable" : "confirmed-session"\}/);
  // `sticky` sigue mandando: un corte de red en el paso 13 del alta no puede
  // desmontar el flujo con la cuenta recién creada.
  assert.match(GATE, /sesionSinConfirmar && sticky && montado\.current/);
});

test("QA23-007 · el layout raíz monta la confianza de sesión una sola vez", () => {
  assert.match(LAYOUT, /SessionResilienceProvider/);
  assert.equal(
    cuantas(LAYOUT, /<SessionResilienceProvider>/g),
    1,
    "dos providers serían dos plazos distintos sobre el mismo hecho"
  );
  // Dentro de AppState (lee el dueño del perfil) y envolviendo al Stack (todo
  // `AccountGate` vive adentro).
  const iAppState = LAYOUT.indexOf("<AppStateProvider>");
  const iResiliencia = LAYOUT.indexOf("<SessionResilienceProvider>");
  const iStack = LAYOUT.indexOf("<Stack");
  assert.ok(iAppState >= 0 && iResiliencia > iAppState && iStack > iResiliencia);
  // Y dentro de `EntitlementProvider`: la resiliencia declara el snapshot del
  // plan entre los dueños contra los que la identidad tiene que cerrar.
  const iPlan = LAYOUT.indexOf("<EntitlementProvider>");
  assert.ok(iPlan >= 0 && iResiliencia > iPlan);
});

test("QA23-007 · el plazo NO se disfraza de «Clerk cargado»", () => {
  // Si el vencimiento se pasara como `clerkLoaded: true`, el resolver leería un
  // signed-out confirmado que nunca ocurrió. Es literalmente el defecto.
  assert.match(RESILIENCIA, /clerkLoaded: auth \? auth\.isLoaded : false/);
  assert.match(RESILIENCIA, /confirmationTimedOut: timedOut/);
  assert.match(RESILIENCIA, /SESSION_CONFIRMATION_TIMEOUT_MS/);
  // El shell degradado no rearma el plazo: hacerlo lo devolvería a un spinner y
  // desmontaría lo que la persona está leyendo.
  assert.match(RESILIENCIA, /confidenceRef\.current !== "degraded-local"/);
});

test("QA23-007 · el provider hidrata la identidad previa y la publica entera", () => {
  // Las cuatro señales tienen que viajar: sin `supported` la web abriría, sin
  // `ready` se decidiría con el llavero a medio leer, sin `error` un fallo se
  // leería como ausencia benigna y sin `secureOwner` no habría nada que probar.
  assert.match(RESILIENCIA, /secureIdentitySupported: SECURE_IDENTITY_SUPPORTED/);
  assert.match(RESILIENCIA, /secureIdentityReady: secure\.ready/);
  assert.match(RESILIENCIA, /secureIdentityError: secure\.error/);
  assert.match(RESILIENCIA, /secureOwner: secure\.owner/);
  assert.match(RESILIENCIA, /readSecureIdentity\(\)/);
  assert.match(RESILIENCIA, /writeSecureIdentity\(liveOwner\)/);
  assert.match(RESILIENCIA, /clearSecureIdentity\(\)/);
  // Lo publicado sale de la política pura y no de un objeto armado a mano: es la
  // que apaga `ready` y el dueño mientras hay una operación en vuelo.
  assert.match(RESILIENCIA, /const secure = publishSecureIdentity\(slot\);/);
  // Y lo que se decide hacer también: `nextSecureIdentityStep` es el que no
  // decide con la lectura sin terminar, no arranca una segunda operación y no
  // vuelve a tocar un llavero roto.
  assert.match(RESILIENCIA, /nextSecureIdentityStep\(\{ slot, confidence, liveOwner \}\)/);
  // El dueño publicable sale de la política, no de una comparación a mano.
  assert.match(RESILIENCIA, /const viewer = publishableViewer\(signals\);/);
  // El snapshot del plan entra como dueño a verificar, y sólo cuando es el
  // snapshot el que se está mostrando.
  assert.match(RESILIENCIA, /origenDelPlan === "cache"/);
  assert.match(RESILIENCIA, /snapshotOwners,/);
});

test("QA23-007 · el provider serializa las operaciones del llavero de verdad", () => {
  // El candado se toma ANTES de cualquier otra cosa, y lo primero que se hace
  // con él tomado es dejar de publicar la identidad previa.
  assert.match(RESILIENCIA, /if \(enVuelo\.current\) return;/);
  assert.match(RESILIENCIA, /enVuelo\.current = true;\s+setSlot\(secureSlotBusy\);/);
  // Y se suelta SIEMPRE, incluso si el árbol ya no está: un candado tomado para
  // siempre deja el llavero muerto y con él la degradación offline.
  assert.match(RESILIENCIA, /enVuelo\.current = false;\s+if \(montado\.current\) setSlot\(resultado\);/);
  assert.match(RESILIENCIA, /montado\.current = false;/);
  // El fallo del llavero es el mismo por las dos vías: promesa que falla o
  // resultado negativo, las dos terminan en BROKEN, que no abre nada.
  assert.match(RESILIENCIA, /cerrarOperacion, \(\) => cerrarOperacion\(SECURE_SLOT_BROKEN\)/);
  // La lectura inicial sólo puede HIDRATAR: si llega tarde, lo que este proceso
  // escribió o borró manda sobre lo que el disco decía antes.
  assert.match(RESILIENCIA, /previo\.hydrated \|\| previo\.busy \? previo : leido/);
  // La serialización no se apoya en ningún plazo: el único `setTimeout` del
  // archivo sigue siendo el de la confirmación de sesión.
  assert.equal(
    cuantas(RESILIENCIA, /setTimeout/g),
    1,
    "el único plazo del provider es el de la confirmación"
  );
  // Ni en el orden en que resuelvan las promesas: no puede haber dos en vuelo,
  // así que no hay carrera que ordenar con `Promise.all`/`race`.
  assert.doesNotMatch(RESILIENCIA, /Promise\.(all|race|allSettled|any)/);
});

test("QA23-007 · el llavero nativo no toca Clerk y escribe borrando primero", () => {
  assert.match(LLAVERO, /from "expo-secure-store"/);
  assert.match(LLAVERO, /export const SECURE_IDENTITY_SUPPORTED = true/);
  // Nada de Clerk: ni su almacén, ni su clave, ni su token.
  assert.doesNotMatch(LLAVERO, /clerk/i);
  assert.doesNotMatch(LLAVERO, /token/i);
  // Escribir es borrar y después escribir (secuencia fail-closed).
  const iBorrado = LLAVERO.indexOf("deleteItemAsync");
  const iEscritura = LLAVERO.indexOf("setItemAsync");
  assert.ok(iBorrado >= 0 && iEscritura > iBorrado);
  // Ninguna función tira: un llavero que no contesta es una respuesta, y la más
  // restrictiva. Tres `catch` para tres funciones.
  assert.equal(cuantas(LLAVERO, /catch/g), 3);
  assert.match(LLAVERO, /return \{ ok: false, owner: null \}/);
});

test("QA23-007 · en web no hay identidad previa y no se finge una", () => {
  assert.match(LLAVERO_WEB, /export const SECURE_IDENTITY_SUPPORTED = false/);
  // Ni almacenamiento seguro nativo, ni el sucedáneo del navegador.
  assert.doesNotMatch(LLAVERO_WEB, /expo-secure-store/);
  assert.doesNotMatch(LLAVERO_WEB, /localStorage|sessionStorage|document\.cookie/);
  // La lectura termina bien y sin registro: es ausencia, no fallo.
  assert.match(LLAVERO_WEB, /return \{ ok: true, owner: null \}/);
});

test("QA23-007 · la política y el registro previo no dependen del runtime", () => {
  for (const modulo of ["src/domain/sessionResilience.ts", "src/domain/secureIdentity.ts"]) {
    const fuente = sinComentarios(leer(modulo));
    assert.doesNotMatch(fuente, /from "react/, `${modulo}: ni React ni React Native`);
    assert.doesNotMatch(fuente, /from "convex/, modulo);
    assert.doesNotMatch(fuente, /AsyncStorage|expo-secure-store/, modulo);
    // Lo único que importan son TIPOS, así que los módulos no arrastran nada al
    // ejecutarse: `importsOf` descarta los `import type` porque el bundler
    // también los borra.
    assert.deepEqual(importsOf(join(ROOT, modulo)), [], `${modulo} no puede importar runtime`);
  }
});

test("QA23-007 · el arranque en frío deja pasar al shell degradado", () => {
  // Sin esto, el resto del bloque no se llega a ver en el caso que más importa:
  // `resolveStart` contesta `auth-timeout` en el arranque sin red y esa pantalla
  // tapaba el producto entero antes de que ningún gate opinara.
  assert.match(ARRANQUE, /useSessionResilience/);
  assert.match(ARRANQUE, /if \(confidence === "degraded-local"\) return <Redirect href="\/hoy" \/>;/);
  // El bloqueo se conserva para todo lo demás: es la salida no destructiva de
  // una instalación nueva, un perfil ajeno o un llavero que no se pudo leer.
  assert.match(ARRANQUE, /<AuthTimeout/);
  assert.match(ARRANQUE, /case "auth-timeout":/);
  // Y `resolveStart` NO cambió: sigue decidiendo con lo que Clerk dice, y el
  // plazo sigue sin disfrazarse de "cargado".
  assert.match(ARRANQUE, /clerkLoaded: auth \? auth\.isLoaded : true/);
  assert.match(ARRANQUE, /clerkTimedOut,/);
});

test("QA23-007 · el destino aplica la resiliencia después de resolver", () => {
  assert.match(DESTINO, /applySessionResilience\(base, confidence\)/);
  // La consulta autoritativa y el plazo dejaron de vivir por gate: se comparten.
  assert.doesNotMatch(DESTINO, /useQuery/);
  assert.doesNotMatch(DESTINO, /setTimeout/);
  assert.match(DESTINO, /useSessionResilience/);
});

test("QA23-007 · el pago exige sesión confirmada, y el editor natal LO DECLARA", () => {
  assert.match(PAYWALL, /requires="confirmed-session"/);
  // El editor no se apoya en que `destinationAllows("degraded", "edit-birth-data")`
  // hoy sea `false`: lo exige por sí mismo. Depender de esa coincidencia dejaría
  // la protección en manos de una tabla que no se escribió para esto.
  assert.match(EDITOR, /surface="edit-birth-data"/);
  assert.match(EDITOR, /requires="confirmed-session"/);
});

test("QA23-007 · el editor natal revalida en el handler y explica el bloqueo", () => {
  assert.match(EDITOR, /useSensitiveOperation\("natal-edit"\)/);
  assert.match(EDITOR, /const edicionBloqueada = backendConfig\.isConfigured && !edicion\.allowed;/);
  assert.match(EDITOR, /bloqueoRef\.current = edicionBloqueada;/);
  // Dos revalidaciones: al entrar al handler y pegada a la escritura remota, que
  // está detrás de un `await` del candado.
  assert.equal(
    cuantas(EDITOR, /if \(bloqueoRef\.current\) \{/g),
    2,
    "el handler tiene que revalidar al entrar Y antes de escribir"
  );
  assert.match(EDITOR, /sensitiveOperationBlockMessage\("natal-edit"\)/);
  // El control se apaga y el motivo se anuncia: un Guardar muerto sin
  // explicación se lee como un editor roto.
  assert.match(EDITOR, /edicionBloqueada \|\| !canSaveBirthEditor\(readiness\)/);
  assert.match(EDITOR, /\{edicionBloqueada \? \(/);
  assert.match(EDITOR, /accessibilityRole="alert"/);
  // Y el reintento de sincronización sobrevive al bloqueo: es la salida.
  assert.match(EDITOR, /readiness !== "retry-remote" &&/);
});

test("QA23-007 · Vínculos · guardar una persona revalida antes de la mutation", () => {
  assert.match(CONECTAR, /useSensitiveOperation\("account-write"\)/);
  assert.match(CONECTAR, /escrituraRef\.current = escritura\.allowed;/);
  // Dos veces: al entrar al handler y después del `await` que resuelve la zona
  // horaria contra el backend.
  assert.equal(
    cuantas(CONECTAR, /!escrituraRef\.current/g),
    2,
    "guardar tiene que revalidar al entrar Y antes de `savePerson`"
  );
  assert.match(CONECTAR, /sensitiveOperationBlockMessage\("account-write"\)/);
  // El control se apaga con copy accesible; salir al perfil ya guardado no.
  assert.match(
    CONECTAR,
    /disabled=\{saving \|\| \(!tipoSinGuardar && \(block !== null \|\| !escritura\.allowed\)\)\}/
  );
  assert.match(CONECTAR, /accessibilityHint=\{\s*!tipoSinGuardar && !escritura\.allowed/);
});

test("QA23-007 · Vínculos · recalcular y borrar revalidan antes de escribir", () => {
  assert.match(RESULTADO, /useSensitiveOperation\("account-write"\)/);
  assert.match(RESULTADO, /escrituraRef\.current = escritura\.allowed;/);
  // Tres puntos de escritura: `recalcular` (que es una action que persiste),
  // la entrada al borrado y el borde pegado a `removePerson`.
  assert.equal(
    cuantas(RESULTADO, /!escrituraRef\.current/g),
    3,
    "recalcular y las dos puertas del borrado tienen que revalidar"
  );
  assert.match(RESULTADO, /if \(!escrituraRef\.current\) return Promise\.resolve\(\);/);
  // El ciclo automático tampoco puede escribir, y NO marca la clave como pedida:
  // si la marcara, al reconectar no volvería a intentarlo solo.
  assert.match(RESULTADO, /if \(!escritura\.allowed\) return;/);
  assert.match(RESULTADO, /recalcular, escritura\.allowed\]/);
  // Los tres controles se apagan y anuncian por qué.
  assert.match(RESULTADO, /disabled=\{recalculando \|\| !escritura\.allowed\}/);
  assert.match(RESULTADO, /disabled=\{borrando \|\| !escritura\.allowed\}/);
  assert.match(
    RESULTADO,
    /accessibilityState=\{\{ disabled: borrando \|\| !escritura\.allowed \}\}/
  );
  assert.match(RESULTADO, /onRetry=\{recalculando \|\| !escritura\.allowed \? undefined : recalcular\}/);
  assert.match(RESULTADO, /sensitiveOperationBlockMessage\("account-write"\)/);
});

test("QA23-007 · el Perfil bloquea el borrado en la vista Y en el handler", () => {
  assert.match(PERFIL, /useSensitiveOperation\("account-delete"\)/);
  assert.match(PERFIL, /if \(!eliminacion\.allowed\) return;/);
  assert.match(PERFIL, /disabled=\{!eliminacion\.allowed\}/);
  assert.match(PERFIL, /accessibilityState=\{\{ disabled: !eliminacion\.allowed \}\}/);
  assert.match(PERFIL, /sensitiveOperationBlockMessage\("account-delete"\)/);
});

test("QA23-007 · la gestión de suscripción sigue exigiendo el remoto confirmado", () => {
  // No hace falta un gate nuevo: el bloque ya deriva del REMOTO, que sin sesión
  // viva es `undefined`, y `nativeSubscriptionView(undefined)` es "loading".
  // Se fija acá para que nadie lo cambie a la vista efectiva (el snapshot), que
  // ofrecería portal y restore con la sesión sin confirmar.
  const gestion = sinComentarios(leer("src/components/orbita/ManageSubscription.tsx"));
  assert.match(
    gestion,
    /const \{ remote: entitlement, owner: clerkOwner \} = useEntitlement\(\);/,
    "el bloque de gestión sólo puede leer el remoto: la vista efectiva incluye el snapshot cacheado"
  );
});

test("QA23-007 · el ciclo de capas corrige su fase con la confianza", () => {
  assert.match(CAPAS, /sessionPhaseUnderConfidence\(sessionPhase\(live\), confidence\)/);
  assert.match(CAPAS, /const retrySession = retry;/);
});

test("QA23-007 · el aviso es accesible y no escribe un solo color a mano", () => {
  assert.doesNotMatch(AVISO, /#[0-9a-fA-F]{3,8}\b/, "los colores salen de @/theme/boot");
  assert.doesNotMatch(AVISO, /rgba?\(/);
  for (const token of ["BOOT_ACCENT", "BOOT_BACKGROUND", "BOOT_TEXT", "BOOT_TEXT_MUTED"]) {
    assert.match(AVISO, new RegExp(token), token);
  }
  // Botón real, objetivo táctil real y pista de lo que hace.
  assert.match(AVISO, /accessibilityRole="button"/);
  assert.match(AVISO, /accessibilityHint=\{hint\}/);
  assert.match(AVISO, /minHeight: 44/);
  // La franja y el bloqueo se anuncian sin interrumpir.
  assert.match(AVISO, /accessibilityRole="alert"/);
  assert.match(AVISO, /accessibilityLiveRegion="polite"/);
  // La franja va arriba de un shell sin header: sin el inset quedaría debajo
  // del notch y de la hora.
  assert.match(AVISO, /paddingTop: insets\.top \+ 14/);
  // Y dice QUÉ se ve, no sólo que algo se ve: el detalle va en pantalla y
  // también en la etiqueta que lee el lector de pantalla.
  assert.match(AVISO, /\{DEGRADED_SESSION_COVERAGE\}/);
  assert.match(AVISO, /\$\{DEGRADED_SESSION_COVERAGE\}/);
});

test("QA23-007 · el copy vive en el dominio, en español y sin promesas", () => {
  const textos = [
    DEGRADED_SESSION_TITLE,
    DEGRADED_SESSION_BODY,
    DEGRADED_SESSION_COVERAGE,
    DEGRADED_SESSION_A11Y_HINT,
    UNCONFIRMED_SESSION_TITLE,
    UNCONFIRMED_SESSION_BODY,
    TRANSIENT_SESSION_TITLE,
    TRANSIENT_SESSION_BODY
  ];
  for (const texto of textos) {
    assert.ok(texto.trim().length > 0);
    // Sin inglés suelto en una superficie de producto.
    assert.doesNotMatch(texto, /\b(offline|retry|loading|error|session)\b/i, texto);
  }
  assert.equal(SESSION_RETRY_LABEL, "REINTENTAR");
  // El aviso del shell tiene que decir las TRES cosas bloqueadas.
  assert.match(DEGRADED_SESSION_BODY, /comprar/);
  assert.match(DEGRADED_SESSION_BODY, /datos de nacimiento/);
  assert.match(DEGRADED_SESSION_BODY, /eliminar tu cuenta/);
  // Y que lo que se ve es lo último de ESTE teléfono, no algo recién traído.
  assert.match(DEGRADED_SESSION_BODY, /último que guardamos en este teléfono/);
  // El bloqueo sin identidad segura dice por qué no muestra nada.
  assert.match(TRANSIENT_SESSION_BODY, /no podemos verificar/);
});

test("QA23-007 · la cobertura declarada es la real: ni de más, ni de menos", () => {
  // Lo que SÍ está persistido en el teléfono y se puede mostrar sin red.
  for (const dato of ["perfil", "lecturas guardadas", "diario"]) {
    assert.match(DEGRADED_SESSION_COVERAGE, new RegExp(dato), `falta declarar ${dato}`);
  }
  // Lo que NO: Convex no persiste las capas, ni las comparaciones, ni el plan en
  // el dispositivo, así que esas secciones no tienen un último valor que mostrar
  // y el aviso no puede prometerlo.
  for (const seccion of ["capas del día", "vínculos", "plan"]) {
    assert.match(DEGRADED_SESSION_COVERAGE, new RegExp(seccion), `falta declarar ${seccion}`);
  }
  assert.match(DEGRADED_SESSION_COVERAGE, /no muestran nada/);
  assert.match(DEGRADED_SESSION_COVERAGE, /volver a intentarlo/);
  // Y no promete que las capas vuelvan de un caché local que no existe.
  assert.doesNotMatch(DEGRADED_SESSION_COVERAGE, /guardadas en este teléfono las capas/);
});
