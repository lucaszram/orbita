import type { BirthEdits, PlaceEdit } from "@/domain/birthEdits";
import { parseDateInput, parseTimeInput } from "@/domain/birthInput";
import { BirthPayloadError, validateBirthPayload } from "@/domain/birthPayload";
import type { BirthSyncUx } from "@/domain/birthEdits";

/**
 * De DÓNDE saca el editor sus valores iniciales.
 *
 * Con sesión iniciada, la única autoridad sobre los datos natales es el
 * documento REMOTO. El editor arrancaba con `profile?.birthDate ?? "1996-01-15"`
 * y `timeToDate(undefined)` = 12:00: una fecha inventada y un mediodía
 * inventado, presentados como datos de la persona y a un toque de Guardar de
 * quedar escritos en la cuenta. El perfil local tampoco sirve de semilla: cae a
 * `createFallbackProfile()`, así que "lo local" puede ser puro relleno.
 *
 * La regla acá es una sola: con sesión, lo que no viene del remoto NO EXISTE.
 * Si el remoto todavía no resolvió, el editor no tiene semilla y no se muestra
 * el formulario (ni se escribe nada). Si el remoto resolvió pero le falta un
 * campo, ese campo arranca VACÍO y Guardar queda bloqueado hasta que la persona
 * lo elija explícitamente.
 *
 * El invitado sí usa el perfil local: es el único dato que tiene, y guarda solo
 * en el teléfono.
 */

export type RemoteBirthSeedDoc = {
  birthDate?: string;
  birthTime?: string;
  birthPlaceLabel?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
} | null;

export type LocalProfileSeedDoc = {
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
} | null;

/** Valores autoritativos con los que abre el editor. `null` = no hay dato. */
export type BirthEditorSeed = {
  /** `YYYY-MM-DD` o `null`. Nunca una fecha de relleno. */
  birthDate: string | null;
  /** `HH:MM` o `null`. `null` deja `No sé la hora` activo. */
  birthTime: string | null;
  /** Etiqueta del lugar, o `""` si no hay lugar elegido. */
  placeLabel: string;
  /**
   * El lugar de la semilla alcanza para guardar tal cual. Con sesión eso exige
   * etiqueta + coordenadas + zona (el documento remoto se arrastra completo);
   * de invitado alcanza con la etiqueta, porque el guardado es solo local.
   */
  placeUsable: boolean;
};

export type BirthEditorSeedState =
  /** Sin identidad confirmada o sin documento remoto: no hay qué mostrar todavía. */
  | { status: "loading" }
  | { status: "ready"; seed: BirthEditorSeed };

export type BirthEditorSeedInput = {
  /** Clerk/Convex todavía resolviendo: no se puede elegir origen de datos. */
  authLoading: boolean;
  signedIn: boolean;
  /** La query de `birthData` ya resolvió (aunque el doc sea `null`). */
  remoteResolved: boolean;
  remote: RemoteBirthSeedDoc;
  profile: LocalProfileSeedDoc;
};

const isoDate = (raw: string | undefined): string | null => {
  const parsed = parseDateInput((raw ?? "").trim());
  if (!parsed) return null;
  return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
};

const isoTime = (raw: string | undefined): string | null => {
  const parsed = parseTimeInput((raw ?? "").trim());
  if (!parsed) return null;
  return `${String(parsed.h).padStart(2, "0")}:${String(parsed.m).padStart(2, "0")}`;
};

/**
 * ¿El lugar remoto se puede arrastrar tal cual a un guardado?
 *
 * Se pregunta con la MISMA función del borde de escritura, con una fecha
 * sintética para aislar la parte del lugar. Si divergieran, el editor podría
 * dejar guardar un lugar que el backend después rechaza.
 */
export function remotePlaceUsable(doc: RemoteBirthSeedDoc): boolean {
  if (!doc) return false;
  try {
    validateBirthPayload({ ...doc, birthDate: "2000-01-01" });
    return true;
  } catch (e) {
    if (e instanceof BirthPayloadError) return false;
    throw e;
  }
}

/** Etiqueta presentable: el relleno viejo `Sin especificar` no es un lugar elegido. */
function seedPlaceLabel(raw: string | undefined): string {
  const label = (raw ?? "").trim();
  return label.toLowerCase() === "sin especificar" ? "" : label;
}

export function resolveBirthEditorSeed(input: BirthEditorSeedInput): BirthEditorSeedState {
  // Sin identidad confirmada no se elige origen: sembrar del perfil local acá
  // significaría mostrar datos de relleno a alguien que sí tiene cuenta.
  if (input.authLoading) return { status: "loading" };

  if (input.signedIn) {
    if (!input.remoteResolved) return { status: "loading" };
    const doc = input.remote;
    return {
      status: "ready",
      seed: {
        birthDate: isoDate(doc?.birthDate),
        birthTime: isoTime(doc?.birthTime),
        placeLabel: seedPlaceLabel(doc?.birthPlaceLabel),
        placeUsable: remotePlaceUsable(doc)
      }
    };
  }

  // Invitado: el perfil local es el único dato que existe.
  if (!input.profile) return { status: "loading" };
  const placeLabel = seedPlaceLabel(input.profile.birthPlace);
  return {
    status: "ready",
    seed: {
      birthDate: isoDate(input.profile.birthDate),
      birthTime: isoTime(input.profile.birthTime),
      placeLabel,
      placeUsable: placeLabel !== ""
    }
  };
}

// --- Borrador en edición ------------------------------------------------------

export type BirthEditorDraft = {
  birthDate: string | null;
  birthTime: string | null;
  /** `No sé la hora`. Arranca activo si el remoto no trae hora. */
  timeUnknown: boolean;
  place: PlaceEdit;
};

export function draftFromSeed(seed: BirthEditorSeed): BirthEditorDraft {
  return {
    birthDate: seed.birthDate,
    birthTime: seed.birthTime,
    // Sin hora remota NO se propone un mediodía: se declara que no se sabe.
    timeUnknown: seed.birthTime === null,
    place: { label: seed.placeLabel, changed: false }
  };
}

/** La hora efectiva del borrador: `No sé la hora` la anula. */
export function draftTime(draft: BirthEditorDraft): string | null {
  return draft.timeUnknown ? null : draft.birthTime;
}

/**
 * ¿Hay algo distinto de la SEMILLA? La comparación es contra el dato
 * autoritativo, no contra el perfil local: con sesión, comparar contra lo local
 * marcaba "cambiado" un editor que nadie tocó (y "sin cambios" uno que sí).
 */
export function isDraftDirty(seed: BirthEditorSeed, draft: BirthEditorDraft): boolean {
  return (
    draft.birthDate !== seed.birthDate ||
    draftTime(draft) !== seed.birthTime ||
    draft.place.changed
  );
}

// --- ¿Se puede guardar? -------------------------------------------------------

export type BirthEditorReadiness =
  | "loading-remote"
  | "retry-remote"
  | "missing-date"
  | "missing-time"
  | "missing-place"
  | "unchanged"
  | "ready";

export function birthEditorReadiness(input: {
  sync: BirthSyncUx;
  seed: BirthEditorSeed | null;
  draft: BirthEditorDraft | null;
}): BirthEditorReadiness {
  if (input.sync === "retry") return "retry-remote";
  if (input.sync === "waiting" || !input.seed || !input.draft) return "loading-remote";
  const { seed, draft } = input;

  // Nada se completa por nosotros: cada faltante es una elección pendiente.
  if (draft.birthDate === null) return "missing-date";
  if (!draft.timeUnknown && draft.birthTime === null) return "missing-time";
  // El lugar solo vale elegido del autocompletado, o arrastrado de un remoto
  // que ya venía completo.
  if (!draft.place.changed && !seed.placeUsable) return "missing-place";
  if (!isDraftDirty(seed, draft)) return "unchanged";
  return "ready";
}

export function canSaveBirthEditor(readiness: BirthEditorReadiness): boolean {
  return readiness === "ready";
}

/** Qué falta, en palabras. `null` cuando no hay nada que avisar. */
export function birthEditorBlockMessage(readiness: BirthEditorReadiness): string | null {
  switch (readiness) {
    case "missing-date":
      return "Elegí tu fecha de nacimiento para poder guardar.";
    case "missing-time":
      return "Elegí tu hora de nacimiento, o activá «No sé la hora».";
    case "missing-place":
      return "Elegí tu lugar de nacimiento de la lista para poder guardar.";
    case "retry-remote":
      return "No pudimos sincronizar los datos de tu cuenta. No cambiamos nada; podés reintentar o cancelar.";
    default:
      return null;
  }
}

/**
 * Borrador → payload de guardado. `null` si falta algo: la conversión es el
 * último borde antes de escribir, y no rellena nada.
 */
export function draftToEdits(draft: BirthEditorDraft): BirthEdits | null {
  if (draft.birthDate === null) return null;
  const time = draftTime(draft);
  if (!draft.timeUnknown && time === null) return null;
  return { birthDate: draft.birthDate, birthTime: time, place: draft.place };
}
