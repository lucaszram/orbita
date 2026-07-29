/**
 * Borrador del onboarding web.
 *
 * Todo el onboarding vive en `useState` dentro de `OrbitaOnboarding`. Crear la
 * cuenta hace que Clerk navegue de vuelta a `/empezar`, y cualquier remonte en
 * esa vuelta borraba fecha, lugar, hora, tríada y paso: la persona volvía a
 * empezar de cero justo después de registrarse.
 *
 * Se guarda en `sessionStorage`, no en `localStorage`, a propósito: son datos
 * de nacimiento. Duran lo que dura la pestaña —que es exactamente lo que
 * necesitamos para sobrevivir la vuelta de Clerk— y no quedan en una máquina
 * compartida después de cerrar.
 */

export const ONBOARDING_DRAFT_KEY = "orbita:onboarding-draft";

export type DraftTriad = {
  resolved: boolean;
  sun: string | null;
  moon: string | null;
  ascendant: string | null;
};

export type DraftPlaceHit = {
  label: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  [key: string]: unknown;
};

export type OnboardingDraft = {
  index: number;
  identity?: string;
  day: string;
  month: string;
  year: string;
  placeQuery: string;
  place?: string;
  placeHit?: DraftPlaceHit;
  hour: string;
  minute: string;
  timeUnknown: boolean;
  plan?: string;
  triad?: DraftTriad;
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const optStr = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

function parseTriad(v: unknown): DraftTriad | undefined {
  if (!v || typeof v !== "object") return undefined;
  const t = v as Record<string, unknown>;
  if (typeof t.resolved !== "boolean") return undefined;
  const point = (x: unknown) => (typeof x === "string" ? x : null);
  return { resolved: t.resolved, sun: point(t.sun), moon: point(t.moon), ascendant: point(t.ascendant) };
}

/**
 * Lectura defensiva: un borrador guardado por una versión anterior, truncado o
 * manipulado a mano no puede romper el arranque del onboarding. Ante cualquier
 * duda se devuelve `null` y se empieza limpio.
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

  const index = typeof d.index === "number" && Number.isInteger(d.index) ? d.index : 0;
  if (index < 0 || index >= stepCount) return null;

  const placeHit =
    d.placeHit && typeof d.placeHit === "object" && !Array.isArray(d.placeHit)
      ? (d.placeHit as DraftPlaceHit)
      : undefined;

  return {
    index,
    identity: optStr(d.identity),
    day: str(d.day),
    month: str(d.month),
    year: str(d.year),
    placeQuery: str(d.placeQuery),
    place: optStr(d.place),
    placeHit,
    hour: str(d.hour),
    minute: str(d.minute),
    timeUnknown: d.timeUnknown === true,
    plan: optStr(d.plan),
    triad: parseTriad(d.triad)
  };
}

export function serializeDraft(draft: OnboardingDraft): string {
  return JSON.stringify(draft);
}

/** ¿Vale la pena guardar? Un borrador en el paso 0 y vacío no aporta nada. */
export function isWorthSaving(draft: OnboardingDraft): boolean {
  return (
    draft.index > 0 ||
    Boolean(draft.day || draft.month || draft.year || draft.place || draft.placeQuery || draft.identity)
  );
}

// --- Acceso a sessionStorage (sólo web; en nativo estas funciones no-opean) ---

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

/** Se llama cuando el onboarding terminó: el borrador ya no debe sobrevivir. */
export function clearDraft(): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(ONBOARDING_DRAFT_KEY);
  } catch {
    // no-op
  }
}
