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
   * Email tipeado en el paso de cuenta (índice 13) o traído del login por
   * `?email=`. Se conserva porque es justo el dato que la vuelta de Clerk hacía
   * perder: se tipea, el navegador remonta `/empezar` y había que tipearlo de
   * nuevo.
   *
   * OPCIONAL: un borrador guardado por una versión sin paso de cuenta no lo
   * trae, y eso no puede invalidarlo — simplemente queda sin email.
   */
  email?: string;
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
    email: optStr(d.email)
  };
}

export function serializeDraft(draft: OnboardingDraft): string {
  return JSON.stringify(draft);
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
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(ONBOARDING_DRAFT_KEY);
  } catch {
    // no-op
  }
}
