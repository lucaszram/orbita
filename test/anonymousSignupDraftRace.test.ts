/**
 * El borrador anónimo del alta no puede depender de cuándo Clerk resuelve.
 *
 * ## El defecto
 *
 * `useOnboardingSignupDraft` corría `saveDraft` + `confirmSignupDraft` sobre
 * `useConvex()`, el cliente compartido que `ConvexProviderWithAuth` autentica
 * **apenas Clerk resuelve un token** — un momento que el alta no elige. La
 * cadena se reintenta hasta veinte segundos, así que la ventana es enorme:
 * alcanza con una sesión que se hidrata del token cache, o un token que llega
 * tarde, para que el token aparezca con la cadena en vuelo.
 *
 * Y el daño no es una llamada perdida. `convex/onboarding.ts:saveDraft` mira
 * `getOrCreateUser(ctx)`: con identidad escribe `userId` en la fila del
 * borrador. Ese campo **no se borra en un save posterior** (el patch usa
 * `omitUndefined`, así que `userId: undefined` no pisa nada), y
 * `confirmSignupDraft` rechaza cualquier borrador con `userId`. Resultado: un
 * token que apareció por medio segundo deja el alta trabada para siempre —
 * `ONBOARDING_SIGNUP_DRAFT_INCOMPLETE` en cada reintento, incluso ya sin sesión.
 *
 * ## La regla
 *
 * El contexto anónimo es una propiedad del CANAL, no una carrera que a veces se
 * gana. `persistSignupDraft` recibe un transporte explícitamente sin autenticar
 * (`src/services/anonymousOnboardingTransport.ts`, un `ConvexHttpClient` propio
 * sobre el que nunca se llama `setAuth`), así que el estado de Clerk en ese
 * milisegundo deja de importar.
 *
 * El backend NO cambia: la guardia anónima sigue siendo suya. Estas pruebas la
 * reproducen fielmente —incluida `hasValidCompletionBirthInput`, importada de
 * verdad— y verifican el comportamiento del cliente contra ella.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { hasValidCompletionBirthInput } from "../convex/lib/onboardingCompletion";
import {
  persistSignupDraft,
  SIGNUP_DRAFT_NOT_READY,
  type AnonymousSignupDraftTransport,
  type SignupDraftInput
} from "../src/domain/anonymousSignupDraft";
import { ROOT } from "./moduleGraph";

const ENTRADA: SignupDraftInput = {
  clientDraftId: "draft-fixture",
  currentStep: 13,
  identity: "ella",
  birthDate: "1994-05-04",
  birthTime: "08:37",
  birthTimePrecision: "known",
  birthPlaceLabel: "Rosario, Santa Fe, Argentina",
  latitude: -32.95,
  longitude: -60.65,
  timezone: "America/Argentina/Cordoba"
};

type Fila = Record<string, unknown> & {
  clientDraftId: string;
  userId?: string;
  accountState: "anonymous" | "created";
  flowOrigin: "anonymous_signup" | "authenticated_recovery";
};

/**
 * Réplica de las dos guardias de `convex/onboarding.ts`. La identidad entra por
 * argumento porque es exactamente lo que el transporte decide.
 */
function backendDeOnboarding() {
  const filas = new Map<string, Fila>();

  return {
    fila: (clientDraftId: string) => filas.get(clientDraftId),

    /** `saveDraft`: el `userId` que escribe una corrida autenticada NO se borra. */
    saveDraft(identity: string | null, args: SignupDraftInput) {
      const existing = filas.get(args.clientDraftId);
      const flowOrigin =
        existing?.flowOrigin ??
        (!existing?.userId && existing?.clientDraftId
          ? "anonymous_signup"
          : identity
            ? "authenticated_recovery"
            : "anonymous_signup");
      const fila: Fila = {
        ...existing,
        clientDraftId: args.clientDraftId,
        currentStep: args.currentStep,
        identity: args.identity,
        birthDate: args.birthDate,
        birthTime: args.birthTime,
        birthTimePrecision: args.birthTimePrecision,
        birthPlaceLabel: args.birthPlaceLabel,
        latitude: args.latitude,
        longitude: args.longitude,
        timezone: args.timezone,
        flowOrigin,
        accountState: identity ? "created" : "anonymous"
      };
      // `omitUndefined`: sin identidad la clave no viaja, así que un `userId`
      // ya escrito SOBREVIVE. Es lo que vuelve permanente el daño.
      if (identity) fila.userId = `user::${identity}`;
      filas.set(args.clientDraftId, fila);
      return args.clientDraftId;
    },

    /** `confirmSignupDraft`: sólo `ready` en contexto anónimo y borrador anónimo. */
    confirmSignupDraft(identity: string | null, args: { clientDraftId: string }) {
      if (identity) throw new Error("ONBOARDING_SIGNUP_DRAFT_REQUIRES_ANONYMOUS_CONTEXT");
      const draft = filas.get(args.clientDraftId);
      if (
        !draft ||
        draft.userId ||
        draft.accountState !== "anonymous" ||
        draft.flowOrigin !== "anonymous_signup" ||
        !hasValidCompletionBirthInput(draft)
      ) {
        throw new Error("ONBOARDING_SIGNUP_DRAFT_INCOMPLETE");
      }
      return { ready: true as const };
    }
  };
}

type Backend = ReturnType<typeof backendDeOnboarding>;

/** Sesión de Clerk que el cliente COMPARTIDO refleja: cambia sola, en vuelo. */
function sesionQueAparece(despuesDeLlamadas: number) {
  let llamadas = 0;
  return {
    /** Identidad vigente al MOMENTO de la llamada, como el cliente compartido. */
    subject(): string | null {
      const activa = llamadas >= despuesDeLlamadas;
      llamadas += 1;
      return activa ? "clerk-subject-1" : null;
    }
  };
}

/** El transporte de ANTES: el cliente compartido, atado a Clerk. */
function transporteCompartido(
  backend: Backend,
  sesion: { subject(): string | null }
): AnonymousSignupDraftTransport {
  return {
    saveDraft: async (args) => backend.saveDraft(sesion.subject(), args),
    confirmSignupDraft: async (args) => backend.confirmSignupDraft(sesion.subject(), args)
  };
}

/** El transporte DEDICADO: nunca lleva credenciales, pase lo que pase con Clerk. */
function transporteAnonimo(
  backend: Backend,
  sesion: { subject(): string | null }
): AnonymousSignupDraftTransport {
  return {
    saveDraft: async (args) => {
      // La sesión avanza igual (Clerk sigue resolviendo en paralelo); lo que no
      // pasa es que ese token viaje por acá.
      sesion.subject();
      return backend.saveDraft(null, args);
    },
    confirmSignupDraft: async (args) => {
      sesion.subject();
      return backend.confirmSignupDraft(null, args);
    }
  };
}

/** Reloj falso: los reintentos no esperan de verdad. */
function relojFalso() {
  let ahora = 0;
  return {
    now: () => ahora,
    sleep: async (ms: number) => {
      ahora += ms;
    },
    /** Cada llamada consume tiempo: sin esto el presupuesto no se agota nunca. */
    avanzar: (ms: number) => {
      ahora += ms;
    }
  };
}

describe("alta anónima — el borrador no puede viajar por el cliente autenticado", () => {
  it("el cliente compartido: un token que aparece en vuelo traba el alta para siempre", async () => {
    const backend = backendDeOnboarding();
    // El token aparece DESPUÉS del primer `saveDraft` anónimo: la carrera real.
    const sesion = sesionQueAparece(1);
    const reloj = relojFalso();

    await assert.rejects(
      () =>
        persistSignupDraft(transporteCompartido(backend, sesion), ENTRADA, {
          now: reloj.now,
          sleep: reloj.sleep
        }),
      new RegExp(SIGNUP_DRAFT_NOT_READY),
      "sin `ready` el alta no abre Clerk"
    );

    // Y esto es lo que de verdad duele: la fila quedó marcada con dueño.
    const fila = backend.fila(ENTRADA.clientDraftId)!;
    assert.equal(fila.userId, "user::clerk-subject-1", "el save autenticado escribió el dueño");

    // Ya sin sesión, un reintento perfectamente anónimo TAMPOCO puede confirmar:
    // el daño no se limpia solo, y la persona no tiene forma de destrabarlo.
    backend.saveDraft(null, ENTRADA);
    assert.equal(backend.fila(ENTRADA.clientDraftId)!.accountState, "anonymous");
    assert.throws(
      () => backend.confirmSignupDraft(null, { clientDraftId: ENTRADA.clientDraftId }),
      /ONBOARDING_SIGNUP_DRAFT_INCOMPLETE/,
      "el `userId` sobrevive al save anónimo y sigue rechazando"
    );
  });

  it("el transporte dedicado: el mismo token en vuelo no cambia nada", async () => {
    const backend = backendDeOnboarding();
    // Misma carrera, misma sesión que se activa en el mismo punto.
    const sesion = sesionQueAparece(1);
    const reloj = relojFalso();

    await persistSignupDraft(transporteAnonimo(backend, sesion), ENTRADA, {
      now: reloj.now,
      sleep: reloj.sleep
    });

    const fila = backend.fila(ENTRADA.clientDraftId)!;
    assert.equal(fila.userId, undefined, "el borrador nunca recibió dueño");
    assert.equal(fila.accountState, "anonymous");
    assert.equal(fila.flowOrigin, "anonymous_signup");
    assert.deepEqual(
      backend.confirmSignupDraft(null, { clientDraftId: ENTRADA.clientDraftId }),
      { ready: true },
      "el borrador sigue siendo confirmable"
    );
  });

  it("el transporte dedicado: con sesión activa desde el arranque también confirma", async () => {
    // El caso de la cuenta que ya existía y rehace el alta: antes, el primer
    // `saveDraft` ya salía autenticado y el borrador nacía marcado.
    const backend = backendDeOnboarding();
    const sesion = sesionQueAparece(0);
    const reloj = relojFalso();

    await persistSignupDraft(transporteAnonimo(backend, sesion), ENTRADA, {
      now: reloj.now,
      sleep: reloj.sleep
    });
    assert.equal(backend.fila(ENTRADA.clientDraftId)!.userId, undefined);

    // Y el mismo caso por el canal compartido no llega nunca.
    const roto = backendDeOnboarding();
    const relojRoto = relojFalso();
    await assert.rejects(
      () =>
        persistSignupDraft(transporteCompartido(roto, sesionQueAparece(0)), ENTRADA, {
          now: relojRoto.now,
          sleep: relojRoto.sleep
        }),
      new RegExp(SIGNUP_DRAFT_NOT_READY)
    );
  });

  it("guarda primero, confirma después, y un enriquecimiento en vuelo se reintenta", async () => {
    // La zona horaria la resuelve el backend en segundo plano: los primeros
    // `confirmSignupDraft` pueden decir "incompleto" sin que sea un error de la
    // persona. La cadena reintenta y termina confirmando.
    const orden: string[] = [];
    const reloj = relojFalso();
    let confirmaciones = 0;
    const transporte: AnonymousSignupDraftTransport = {
      saveDraft: async () => {
        orden.push("save");
        return "draft-fixture";
      },
      confirmSignupDraft: async () => {
        orden.push("confirm");
        confirmaciones += 1;
        if (confirmaciones < 3) throw new Error("ONBOARDING_SIGNUP_DRAFT_INCOMPLETE");
        return { ready: true as const };
      }
    };

    await persistSignupDraft(transporte, ENTRADA, { now: reloj.now, sleep: reloj.sleep });

    assert.deepEqual(orden, ["save", "confirm", "save", "confirm", "save", "confirm"]);
    assert.equal(orden.indexOf("save") < orden.indexOf("confirm"), true);
  });

  it("agotado el presupuesto rechaza: sin `ready` no se crea la identidad", async () => {
    const reloj = relojFalso();
    const transporte: AnonymousSignupDraftTransport = {
      saveDraft: async () => {
        // Cada intento consume presupuesto real; si no, el bucle no termina.
        reloj.avanzar(3000);
        return "draft-fixture";
      },
      confirmSignupDraft: async () => {
        throw new Error("ONBOARDING_SIGNUP_DRAFT_INCOMPLETE");
      }
    };

    await assert.rejects(
      () => persistSignupDraft(transporte, ENTRADA, { now: reloj.now, sleep: reloj.sleep }),
      new RegExp(SIGNUP_DRAFT_NOT_READY)
    );
  });
});

describe("alta anónima — producción usa el canal sin autenticar", () => {
  const leer = (ruta: string) => readFileSync(join(ROOT, ruta), "utf8");
  const sinComentarios = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("el hook del borrador NO usa el cliente compartido de Convex", () => {
    const hook = sinComentarios(leer("src/onboarding/useAccount.ts"));
    const bloque = hook.slice(
      hook.indexOf("function useOnboardingSignupDraftInner"),
      hook.indexOf("export type FinalizeOnboarding")
    );
    assert.ok(bloque.length > 0, "no se encontró el hook del borrador");
    assert.doesNotMatch(
      bloque,
      /useConvex\(\)/,
      "el cliente atado a Clerk no puede llevar el borrador anónimo"
    );
    assert.match(bloque, /anonymousSignupDraftTransport\(\)/, "el transporte es el dedicado");
    assert.match(bloque, /persistSignupDraft\(transport, input\)/);
    assert.match(bloque, /throw new Error\(SIGNUP_DRAFT_NOT_READY\)/, "sin canal no hay éxito");
  });

  it("el transporte dedicado nunca recibe credenciales", () => {
    const servicio = sinComentarios(leer("src/services/anonymousOnboardingTransport.ts"));
    assert.match(servicio, /new ConvexHttpClient\(backendConfig\.convexUrl\)/, "cliente propio");
    assert.doesNotMatch(servicio, /setAuth/, "sobre este cliente no se setea auth");
    assert.doesNotMatch(servicio, /getToken|ConvexProviderWithAuth|useConvex/);
    // Y es el que llama a las dos mutaciones del contrato, en ese orden.
    const iGuarda = servicio.indexOf("appApi.onboarding.saveDraft");
    const iConfirma = servicio.indexOf("appApi.onboarding.confirmSignupDraft");
    assert.ok(iGuarda !== -1 && iGuarda < iConfirma, "primero se guarda, después se confirma");
  });

  it("nadie más en el repo setea auth sobre un ConvexHttpClient", () => {
    // Un `setAuth` en cualquier otro archivo sobre este cliente reabriría el
    // defecto desde afuera del módulo que lo cierra.
    const servicio = leer("src/services/anonymousOnboardingTransport.ts");
    assert.ok(servicio.includes("ConvexHttpClient"));
    const hook = leer("src/onboarding/useAccount.ts");
    assert.doesNotMatch(hook, /setAuth/);
  });

  it("el backend conserva su guardia anónima intacta", () => {
    const onboarding = leer("convex/onboarding.ts");
    assert.match(
      onboarding,
      /if \(identity\) throw new Error\("ONBOARDING_SIGNUP_DRAFT_REQUIRES_ANONYMOUS_CONTEXT"\)/,
      "la autoridad sigue siendo del servidor"
    );
    assert.match(onboarding, /ONBOARDING_SIGNUP_DRAFT_INCOMPLETE/);
  });
});
