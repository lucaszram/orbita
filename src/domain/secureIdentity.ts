import type { SessionConfidence } from "@/domain/sessionResilience";

/**
 * La identidad previamente confirmada (QA23-007).
 *
 * ## Qué es y por qué existe
 *
 * Un solo dato: el `clerkUserId` de la última sesión que ESTA app confirmó de
 * punta a punta. Nada más. No es un token, no autoriza nada y no viaja a ningún
 * lado; sirve para una sola pregunta, y sólo cuando no hay red:
 *
 * > Lo que hay guardado en este teléfono, ¿es de quien está mirando?
 *
 * Sin él, un timeout COMPLETO de Clerk —abrir la app sin red, con la sesión
 * viva en el llavero— no tiene ninguna respuesta posible: Clerk no publica
 * `userId`, así que el dueño del perfil en disco no se puede contrastar contra
 * nada y el producto entero queda tapado por un bloqueo. Ése es exactamente el
 * caso de aceptación del bloque, y es el que esta pieza cubre.
 *
 * ## Lo que NO hace
 *
 * - **No lee ni toca los tokens de Clerk.** Clerk tiene su propio almacén y su
 *   propia clave; acá se escribe una clave nuestra con un identificador público
 *   de cuenta, el mismo que ya vive en claro en `orbita:profile-owner`.
 * - **No autoriza.** Cualquier operación sensible sigue exigiendo
 *   `confirmed-signed-in` (ver `sensitiveOperationAllowed`). Esto sólo puede
 *   habilitar una LECTURA de lo que ya está en el aparato.
 * - **No migra nada.** El registro es versionado y un formato desconocido se lee
 *   como ausencia: perder la identidad previa cuesta un bloqueo con reintento,
 *   aceptar un formato que no entendemos costaría mostrarle a alguien los datos
 *   de otra cuenta.
 *
 * ## La secuencia fail-closed
 *
 * `secureIdentityAction` es la política entera, y su forma importa:
 *
 * - **Escribir** sólo con `confirmed-signed-in`. Ni una espera, ni un timeout,
 *   ni una sesión degradada pueden dejar una identidad nueva en disco.
 * - **Borrar** ante un signed-out confirmado, y ante CUALQUIER dueño vivo
 *   distinto del guardado — antes de escribir el nuevo, no después. Un cambio de
 *   identidad se resuelve en dos pasos (`clear` y recién en la vuelta siguiente
 *   `write`) para que un cierre de la app en el medio deje el registro vacío,
 *   que no abre nada, en vez de dejar al dueño anterior, que abriría lo que no
 *   debe.
 * - **No tocar** en todo lo demás. Un corte de red no puede alterar el disco.
 *
 * ## Y los dos pasos son dos DE VERDAD
 *
 * `secureIdentityAction` dice QUÉ corresponde hacer con el registro tal como se
 * lo conoce; no alcanza para ejecutarlo, porque entre que una operación arranca
 * y que el llavero contesta hay un intervalo en el que el registro no es ni lo
 * viejo ni lo nuevo. Si en ese intervalo se vuelve a preguntar, la respuesta se
 * calcula contra un disco que ya no existe: el render siguiente a un `clear` ve
 * el registro vacío, pide `write`, y las dos operaciones quedan en vuelo a la
 * vez. Ahí el resultado deja de ser una secuencia y pasa a depender de cuál
 * promesa resuelva última, y una de las dos posibilidades es el `clear` borrando
 * al dueño que el `write` acababa de escribir.
 *
 * Por eso el estado del registro se modela entero —`SecureIdentitySlot`— y las
 * dos preguntas se hacen sobre él: `nextSecureIdentityStep` no autoriza un
 * segundo paso mientras el primero esté en vuelo, y `publishSecureIdentity` no
 * publica ningún dueño mientras el disco no haya confirmado. Las dos son
 * fail-closed: mientras no se sabe, no se abre.
 *
 * Módulo puro: lo único que importa es un tipo, así que no arrastra nada al
 * bundle y las pruebas lo ejecutan de verdad.
 */

/**
 * Clave del registro.
 *
 * Sin `:` a propósito: `expo-secure-store` sólo admite alfanuméricos, `.`, `-` y
 * `_`, así que el prefijo `orbita:` de `AsyncStorage` no sirve acá.
 */
export const SECURE_IDENTITY_KEY = "orbita.session.last-confirmed-owner";

/** Versión del registro. Un valor distinto se lee como ausencia, sin migrar. */
export const SECURE_IDENTITY_VERSION = 1;

export function serializeSecureIdentity(owner: string): string {
  return JSON.stringify({ v: SECURE_IDENTITY_VERSION, owner });
}

/**
 * Lee el registro. Devuelve el dueño o `null` ante cualquier duda.
 *
 * «Cualquier duda» incluye: vacío, JSON roto, objeto sin forma, versión
 * desconocida, dueño que no es string y dueño no canónico (vacío o con padding).
 * La última condición es la misma que ya exige `esOwnerCanonico` para el
 * marcador de eliminación: un id con espacios alrededor compara distinto que el
 * mismo id sin ellos, y esa diferencia decide quién ve qué.
 */
export function parseSecureIdentity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const { v, owner } = parsed as { v?: unknown; owner?: unknown };
    if (v !== SECURE_IDENTITY_VERSION) return null;
    if (typeof owner !== "string") return null;
    if (owner.length === 0 || owner.trim() !== owner) return null;
    return owner;
  } catch {
    return null;
  }
}

export type SecureIdentityAction = "keep" | "write" | "clear";

export function secureIdentityAction(input: {
  confidence: SessionConfidence;
  /** Dueño publicado por Clerk EN ESTE PROCESO. */
  liveOwner: string | null;
  /** Lo que hay hoy en el almacenamiento seguro. */
  storedOwner: string | null;
}): SecureIdentityAction {
  const { confidence, liveOwner, storedOwner } = input;
  // 1. Cambio de identidad: lo viejo cae ANTES de que nada nuevo se escriba.
  //    Con la sesión ya confirmada esto cuesta una vuelta más (`clear` y después
  //    `write`), y esa vuelta es justamente la garantía.
  if (liveOwner && storedOwner && liveOwner !== storedOwner) return "clear";
  // 2. Un signed-out CONFIRMADO retira la identidad previa. No es un fallo de
  //    red: Clerk contestó que no hay sesión.
  if (confidence === "confirmed-signed-out") return storedOwner ? "clear" : "keep";
  // 3. Sólo una sesión confirmada de punta a punta puede escribirla.
  if (confidence === "confirmed-signed-in") {
    // Confirmada sin dueño publicado no debería existir; si existiera, lo que no
    // se puede afirmar tampoco se puede conservar.
    if (!liveOwner) return storedOwner ? "clear" : "keep";
    return storedOwner === liveOwner ? "keep" : "write";
  }
  // 4. Espera, timeout y degradación no tocan el disco.
  return "keep";
}

// ---------------------------------------------------------------------------
// El registro, visto desde ESTE proceso
// ---------------------------------------------------------------------------

/**
 * Todo lo que este proceso sabe del registro, incluida la operación en vuelo.
 *
 * `busy` no es telemetría: es la única razón por la que los dos pasos de un
 * cambio de identidad son dos. Sin él, el render que sigue a un `clear` ve el
 * registro vacío, decide `write` y las dos operaciones se pisan.
 *
 * `hydrated` y `busy` son estados distintos —«todavía no sé qué hay» y «sé que
 * lo estoy cambiando»— y publican exactamente lo mismo, que es nada: en los dos
 * este proceso no puede afirmar de quién es lo que hay en el aparato.
 */
export type SecureIdentitySlot = {
  /** La lectura inicial del llavero ya contestó. */
  hydrated: boolean;
  /** Hay UNA operación (`write` o `clear`) en vuelo. */
  busy: boolean;
  /** El llavero falló: leyendo, escribiendo o borrando. No abre nada. */
  error: boolean;
  /** Último dueño que este proceso sabe que quedó en el llavero. */
  owner: string | null;
};

/** Antes de la primera lectura no se afirma nada. */
export const SECURE_SLOT_HYDRATING: SecureIdentitySlot = {
  hydrated: false,
  busy: false,
  error: false,
  owner: null
};

/** Leído o borrado, y sin registro: el estado de una instalación nueva. */
export const SECURE_SLOT_EMPTY: SecureIdentitySlot = {
  hydrated: true,
  busy: false,
  error: false,
  owner: null
};

/**
 * El llavero falló, y en este proceso es terminal.
 *
 * A propósito: reintentar en bucle no arregla un llavero roto, y cada intento
 * sería otra escritura sobre un registro que ya no sabemos en qué estado quedó.
 * No publica dueño —así que no abre nada— y la próxima apertura de la app vuelve
 * a leer desde cero, que es donde un fallo transitorio sí se puede recuperar.
 */
export const SECURE_SLOT_BROKEN: SecureIdentitySlot = {
  hydrated: true,
  busy: false,
  error: true,
  owner: null
};

/** El registro quieto y conocido: lo que el llavero confirmó. */
export function secureSlotSettled(owner: string | null): SecureIdentitySlot {
  return { hydrated: true, busy: false, error: false, owner };
}

/**
 * Arranca una operación.
 *
 * El dueño previo cae en memoria ACÁ, antes de que el llavero se toque: entre
 * que se decide el cambio y que el disco contesta, esta app no puede seguirle
 * creyendo a un dueño que ya sabe viejo.
 */
export function secureSlotBusy(slot: SecureIdentitySlot): SecureIdentitySlot {
  return { hydrated: slot.hydrated, busy: true, error: slot.error, owner: null };
}

/** Lo único que el registro le puede decir a la política de sesión. */
export type SecureIdentityPublication = {
  /** El llavero contestó y no hay nada en vuelo. */
  ready: boolean;
  error: boolean;
  /** El dueño publicable, o `null` mientras no haya un registro confirmado. */
  owner: string | null;
};

/**
 * Qué se publica de este registro.
 *
 * Fail-closed en las tres esperas —la lectura inicial, la operación en vuelo y
 * el fallo—: en las tres, `owner` es `null` y por esa vía no se abre nada.
 */
export function publishSecureIdentity(slot: SecureIdentitySlot): SecureIdentityPublication {
  const quieto = slot.hydrated && !slot.busy;
  return {
    ready: quieto,
    error: slot.error,
    owner: quieto && !slot.error ? slot.owner : null
  };
}

/**
 * La única operación que se puede arrancar AHORA.
 *
 * Es `secureIdentityAction` con las tres puertas que convierten la política en
 * una secuencia: no se decide con la lectura sin terminar, no se arranca una
 * segunda operación mientras hay una en vuelo, y un llavero que falló no se
 * vuelve a tocar en este proceso.
 */
export function nextSecureIdentityStep(input: {
  slot: SecureIdentitySlot;
  confidence: SessionConfidence;
  liveOwner: string | null;
}): SecureIdentityAction {
  const { slot, confidence, liveOwner } = input;
  if (!slot.hydrated || slot.busy || slot.error) return "keep";
  return secureIdentityAction({ confidence, liveOwner, storedOwner: slot.owner });
}
