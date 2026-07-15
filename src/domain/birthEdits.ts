import type { UserProfile } from "./types";
import { getZodiacSign } from "./zodiac";

/**
 * Lógica pura del editor "Editar datos" (Perfil → /editar-datos, hotfix build 11).
 * La pantalla junta la edición y estas funciones deciden qué se guarda local
 * y qué se manda al backend, sin pisar datos remotos que el editor no tocó.
 */

export type PlaceEdit = {
  label: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  /** true solo si el usuario eligió un lugar nuevo del buscador. */
  changed: boolean;
};

export type BirthEdits = {
  /** YYYY-MM-DD */
  birthDate: string;
  /** "HH:MM" · null = "No sé la hora". */
  birthTime: string | null;
  place: PlaceEdit;
};

/** ¿El editor tiene algo distinto a lo guardado? (Guardar deshabilitado si no.) */
export function hasBirthChanges(profile: UserProfile, edits: BirthEdits): boolean {
  return (
    edits.birthDate !== profile.birthDate ||
    (edits.birthTime ?? undefined) !== profile.birthTime ||
    edits.place.changed
  );
}

/** Cambios para `updateProfile` (perfil local). Cancelar = no llamar a esto. */
export function applyBirthEdits(profile: UserProfile, edits: BirthEdits): Partial<UserProfile> {
  return {
    birthDate: edits.birthDate,
    birthTime: edits.birthTime ?? undefined,
    birthPlace: edits.place.label || profile.birthPlace,
    zodiacSign: getZodiacSign(edits.birthDate)
  };
}

export type RemoteBirthSnapshot = {
  birthPlaceLabel?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
} | null;

export type BackendBirthPayload = {
  birthDate: string;
  birthTime?: string;
  birthPlaceLabel?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
};

/**
 * Payload para persistir en Convex. Si el lugar NO cambió, preserva el label y
 * las coordenadas remotas (el editor no las conoce localmente); si cambió, usa
 * las del lugar nuevo. Evita degradar una carta calculada con coords reales.
 */
export function buildBackendBirthPayload(edits: BirthEdits, remote: RemoteBirthSnapshot): BackendBirthPayload {
  const keepRemotePlace = !edits.place.changed && remote != null;
  const editorLabel = edits.place.label || undefined;
  return {
    birthDate: edits.birthDate,
    birthTime: edits.birthTime ?? undefined,
    birthPlaceLabel: keepRemotePlace ? (remote.birthPlaceLabel ?? editorLabel) : editorLabel,
    latitude: keepRemotePlace ? remote.latitude : edits.place.latitude,
    longitude: keepRemotePlace ? remote.longitude : edits.place.longitude,
    timezone: keepRemotePlace ? remote.timezone : edits.place.timezone
  };
}

// --- Helpers fecha/hora del editor (Date nativo ↔ strings del perfil) ---

/** "YYYY-MM-DD" → Date local a mediodía (evita corrimientos de timezone). */
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y || 1996, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "HH:MM" → Date de hoy con esa hora (para el picker de hora). */
export function timeToDate(hhmm: string | undefined): Date {
  const [h, m] = (hhmm ?? "12:00").split(":").map(Number);
  const date = new Date();
  date.setHours(Number.isFinite(h) ? h : 12, Number.isFinite(m) ? m : 0, 0, 0);
  return date;
}

export function dateToTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
