/**
 * Borrador del onboarding.
 *
 * El flujo canónico (`src/onboarding/OnboardingFlow.tsx`) mantiene su estado en
 * `useState`. En la web, crear la cuenta hace que Clerk vuelva a `/empezar`, y
 * cualquier remonte en esa vuelta borraba identidad, fecha, lugar, hora y paso:
 * la persona volvía a empezar de cero justo después de registrarse.
 *
 * Se guarda en `sessionStorage`, no en `localStorage`, a propósito: son datos
 * de nacimiento. Duran lo que dura la pestaña —que es exactamente lo que hace
 * falta para sobrevivir la vuelta de Clerk— y no quedan en una máquina
 * compartida después de cerrar.
 *
 * En nativo no hay nada que guardar (no hay remonte por redirect de Clerk) y
 * las funciones de acceso no-opean.
 */

import { createClientDraftId, isClientDraftId } from "./onboardingReadiness";

export const ONBOARDING_DRAFT_KEY = "orbita:onboarding-draft";

/** Espejo de los tipos del flujo canónico, sin importarlos (evita un ciclo). */
export type DraftBirthDate = { day: number; month: number; year: number };
export type DraftBirthTime = { hour: number; minute: number };
export type DraftPlace = {
  label: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  [key: string]: unknown;
};

export type OnboardingDraft = {
  step: number;
  identity?: string;
  birthDate?: DraftBirthDate;
  placeQuery: string;
  birthPlace?: DraftPlace;
  birthTime?: DraftBirthTime;
  timeUnknown: boolean;
  /**
   * Email tipeado en la superficie de acceso (paso 0) o traído del login por
   * `?email=`. Se conserva porque es justo el dato que la vuelta de Clerk hacía
   * perder: se tipea, el navegador remonta `/empezar` y había que tipearlo de
   * nuevo.
   *
   * OPCIONAL: un borrador guardado por una versión sin paso de cuenta no lo
   * trae, y eso no puede invalidarlo — simplemente queda sin email.
   */
  email?: string;
  /**
   * Dueño del borrador: el `userId` de Clerk que estaba activo al escribirlo.
   *
   * Con el acceso PRIMERO, los datos natales se cargan con sesión activa, así
   * que el borrador tiene dueño desde el primer dato. Si otra cuenta abre la
   * misma pestaña, el borrador ajeno se descarta: ninguna cuenta puede heredar
   * fecha, lugar u hora de otra. OPCIONAL: un borrador anterior a este campo
   * simplemente no declara dueño y el flujo lo descarta ante una sesión con
   * identidad distinta de la que pudo haberlo escrito.
   */
  ownerUserId?: string;
  /**
   * Id del borrador REMOTO de este alta (`onboardingDrafts.clientDraftId`).
   *
   * Es lo que sobrevive a la vuelta de Clerk y permite adjuntar a la cuenta
   * recién creada el borrador que se guardó anónimo, conservando su
   * `flowOrigin: "anonymous_signup"`. Sin él, la misma persona quedaría como una
   * recuperación de cuenta preexistente y volvería a `/editar-datos` en vez de
   * cerrar su alta.
   */
  clientDraftId?: string;
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const optStr = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

function intIn(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

/** Una fecha parcial o fuera de rango se descarta entera: no se completa nada. */
function parseBirthDate(v: unknown): DraftBirthDate | undefined {
  if (!v || typeof v !== "object") return undefined;
  const d = v as Record<string, unknown>;
  const day = intIn(d.day, 1, 31);
  const month = intIn(d.month, 1, 12);
  const year = intIn(d.year, 1900, 2100);
  return day && month && year ? { day, month, year } : undefined;
}

function parseBirthTime(v: unknown): DraftBirthTime | undefined {
  if (!v || typeof v !== "object") return undefined;
  const t = v as Record<string, unknown>;
  const hour = intIn(t.hour, 0, 23);
  const minute = intIn(t.minute, 0, 59);
  // 0 es válido para las dos, así que se compara contra null explícitamente.
  return hour !== null && minute !== null ? { hour, minute } : undefined;
}

function parsePlace(v: unknown): DraftPlace | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const p = v as Record<string, unknown>;
  return typeof p.label === "string" && p.label ? (p as DraftPlace) : undefined;
}

/**
 * Lectura defensiva: un borrador de otra versión, truncado o manipulado a mano
 * no puede romper el arranque del onboarding. Ante cualquier duda, `null` y se
 * empieza limpio.
 */
export function parseDraft(raw: string | null, stepCount: number): OnboardingDraft | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const d = value as Record<string, unknown>;

  const step = intIn(d.step, 0, stepCount - 1);
  if (step === null) return null;

  return {
    step,
    identity: optStr(d.identity),
    birthDate: parseBirthDate(d.birthDate),
    placeQuery: str(d.placeQuery),
    birthPlace: parsePlace(d.birthPlace),
    birthTime: parseBirthTime(d.birthTime),
    timeUnknown: d.timeUnknown === true,
    // `optStr`: un email que no sea un string no vacío queda en `undefined`,
    // igual que el resto de los campos opcionales. `writeDraft` ya lo serializa
    // y `OnboardingFlow` ya lo lee — sin esta línea el ida y vuelta lo
    // descartaba en silencio y `saved?.email` era código muerto.
    email: optStr(d.email),
    // Sólo si existe: un `ownerUserId: undefined` fijo rompería la igualdad del
    // ida y vuelta de un borrador que nunca lo tuvo (igual que `clientDraftId`).
    ...(optStr(d.ownerUserId) ? { ownerUserId: optStr(d.ownerUserId) } : {}),
    // Un id manipulado a mano no puede adjuntar el borrador de otra persona:
    // se acepta sólo la forma opaca que emite `createClientDraftId`. La
    // propiedad se agrega SÓLO si existe: un `clientDraftId: undefined` fijo
    // rompía la igualdad del ida y vuelta de un borrador que nunca lo tuvo.
    ...(isClientDraftId(d.clientDraftId) ? { clientDraftId: d.clientDraftId } : {})
  };
}

export function serializeDraft(draft: OnboardingDraft): string {
  return JSON.stringify(draft);
}

/**
 * ¿Esta sesión puede usar este borrador?
 *
 * - Sin identidad todavía, sólo un borrador SIN dueño (lo único que puede
 *   haberse escrito antes de autenticar: paso, email y el id remoto).
 * - Con identidad, el borrador escrito por ESA misma cuenta; o uno sin dueño
 *   que NO cargue datos natales (el marcador pre-acceso, que la cuenta recién
 *   creada adopta al volver del redirect de Clerk).
 * - Un borrador de otra cuenta —o uno viejo sin dueño que SÍ carga datos y no
 *   puede probar de quién son— se descarta entero: ninguna cuenta hereda
 *   fecha, lugar u hora de otra.
 *
 * Función pura para poder fijar la regla con tests.
 */
export function draftUsableBy(
  draft: Pick<OnboardingDraft, "ownerUserId" | "identity" | "birthDate" | "birthPlace"> | null,
  userId: string | null
): boolean {
  if (!draft) return false;
  if (!userId) return !draft.ownerUserId;
  if (draft.ownerUserId) return draft.ownerUserId === userId;
  return !draft.identity && !draft.birthDate && !draft.birthPlace;
}

/**
 * Persiste YA el id del borrador remoto, aun sin nada cargado.
 *
 * El acceso es el paso 0: al abrir OAuth el navegador se va entero y vuelve
 * con la memoria en blanco. `writeDraft` no guarda un borrador vacío
 * (`isWorthSaving`), así que sin esto el remonte no podía reencontrar el
 * marcador de "alta en curso" y la cuenta recién creada se clasificaba como
 * recuperación de cuenta preexistente (`edit_birth_data`). En nativo no hay
 * redirect ni sessionStorage y la función no-opea, igual que el resto.
 */
export function persistClientDraftId(id?: string): void {
  const draftId = id ?? readClientDraftId();
  if (!draftId) return;
  // El espejo en memoria también se repone: un `clearDraft()` previo (p. ej.
  // descartar el marcador al caer a un ingreso) lo había anulado, y el flujo
  // puede volver al modo alta con el MISMO id capturado.
  memoryClientDraftId = draftId;
  const s = storage();
  if (!s) return;
  try {
    const existing = parseDraft(s.getItem(ONBOARDING_DRAFT_KEY), Number.MAX_SAFE_INTEGER);
    const base: OnboardingDraft = existing ?? { step: 0, placeQuery: "", timeUnknown: false };
    s.setItem(ONBOARDING_DRAFT_KEY, serializeDraft({ ...base, clientDraftId: draftId }));
  } catch {
    // Cuota llena o modo privado: el acceso sigue; el id vive en memoria.
  }
}

/** ¿Vale la pena guardar? En el paso 0 y sin nada cargado no aporta nada. */
export function isWorthSaving(draft: OnboardingDraft): boolean {
  return draft.step > 0 || Boolean(draft.birthPlace || draft.placeQuery);
}

// --- Acceso a sessionStorage (sólo web; en nativo no-opean) ------------------

function storage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    // Safari en modo privado puede tirar al tocar sessionStorage.
    return null;
  }
}

export function readDraft(stepCount: number): OnboardingDraft | null {
  const s = storage();
  if (!s) return null;
  try {
    return parseDraft(s.getItem(ONBOARDING_DRAFT_KEY), stepCount);
  } catch {
    return null;
  }
}

export function writeDraft(draft: OnboardingDraft): void {
  const s = storage();
  if (!s) return;
  try {
    if (!isWorthSaving(draft)) return;
    s.setItem(ONBOARDING_DRAFT_KEY, serializeDraft(draft));
  } catch {
    // Cuota llena o modo privado: el onboarding sigue funcionando en memoria.
  }
}

/** El onboarding terminó: el borrador no debe sobrevivir. */
export function clearDraft(): void {
  memoryClientDraftId = null;
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(ONBOARDING_DRAFT_KEY);
  } catch {
    // no-op
  }
}

// --- Id del borrador remoto --------------------------------------------------

/**
 * Espejo en memoria del `clientDraftId`.
 *
 * En nativo no hay `sessionStorage` y el alta tampoco remonta por redirect, así
 * que la memoria del proceso alcanza. En web el espejo evita releer y reescribir
 * el borrador entero en cada consulta; `sessionStorage` sigue siendo el que
 * sobrevive a la vuelta de Clerk.
 */
let memoryClientDraftId: string | null = null;

/** El id de ESTE alta, o `null` si todavía no se generó ninguno. */
export function readClientDraftId(): string | null {
  if (memoryClientDraftId) return memoryClientDraftId;
  const saved = readDraft(Number.MAX_SAFE_INTEGER)?.clientDraftId;
  if (saved) memoryClientDraftId = saved;
  return memoryClientDraftId;
}

/**
 * Id estable del alta: se genera UNA sola vez y después siempre devuelve el
 * mismo. Volver a generarlo dejaría huérfano el borrador remoto ya guardado.
 */
export function ensureClientDraftId(): string {
  const existing = readClientDraftId();
  if (existing) return existing;
  memoryClientDraftId = createClientDraftId();
  return memoryClientDraftId;
}
