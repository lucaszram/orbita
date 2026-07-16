import { accountSnapshotKeyPrefix } from "./storageKeys";
import type { DailyReading, JournalEntry, UserProfile } from "./types";

/**
 * Snapshot local por cuenta (hotfix build 11, logout sin pérdida).
 *
 * El diario y las lecturas guardadas HOY solo viven en el teléfono (no se
 * sincronizan con Convex), así que cerrar sesión no puede simplemente
 * borrarlos ("se recupera de Convex" sería falso) ni dejarlos visibles para
 * el próximo usuario del teléfono. Solución: al cerrar sesión se archiva el
 * estado local bajo una clave privada de esa cuenta; al volver a iniciar
 * sesión en este teléfono se restaura y se mergea con lo que haya.
 */

export type AccountSnapshot = {
  version: 1;
  savedAt: string;
  profile: UserProfile | null;
  savedReadings: DailyReading[];
  journalEntries: JournalEntry[];
  /**
   * Lápidas de guardadas con `unsave` remoto todavía sin confirmar (ver
   * savedReadingsSync). Viajan con la cuenta: si se pierden en el logout, la
   * lectura borrada resucita desde `listSaved` en el próximo login. Ausente
   * en snapshots viejos → [].
   */
  savedReadingTombstones: string[];
};

/** Límites de las listas activas (los mismos que usa useAppState). */
export const MAX_SAVED_READINGS = 60;
export const MAX_JOURNAL_ENTRIES = 120;

export function accountSnapshotKey(userId: string): string {
  return `${accountSnapshotKeyPrefix}${userId}`;
}

export function buildAccountSnapshot(
  profile: UserProfile | null,
  savedReadings: DailyReading[],
  journalEntries: JournalEntry[],
  savedAt: string,
  savedReadingTombstones: string[] = []
): AccountSnapshot {
  return { version: 1, savedAt, profile, savedReadings, journalEntries, savedReadingTombstones };
}

/** ¿Hay algo que valga la pena archivar? (Si no, no se escribe snapshot.)
 *  Una lápida pendiente también es data: perderla resucita un borrado. */
export function snapshotHasData(snapshot: AccountSnapshot): boolean {
  return (
    snapshot.profile != null ||
    snapshot.savedReadings.length > 0 ||
    snapshot.journalEntries.length > 0 ||
    snapshot.savedReadingTombstones.length > 0
  );
}

/**
 * Qué hacer con los datos locales ANTES de cerrar sesión. El orden del
 * logout es: archivar → signOut → limpiar. Si no se puede archivar, NO se
 * cierra la sesión (sería pérdida silenciosa).
 *
 * - "skip": no hay nada que archivar; se puede cerrar sesión directo.
 * - "archive": hay datos y hay identidad; escribir el snapshot primero.
 * - "error": hay datos pero no hay userId para archivarlos → abortar el
 *   logout y mostrar reintento, nunca borrar sin respaldo.
 */
export type LogoutArchivePlan = "archive" | "skip" | "error";

export function planLogoutArchive(
  userId: string | null | undefined,
  snapshot: AccountSnapshot
): LogoutArchivePlan {
  if (!snapshotHasData(snapshot)) return "skip";
  return userId ? "archive" : "error";
}

/** Parsea y valida un snapshot guardado; cualquier forma inesperada → null. */
export function parseAccountSnapshot(raw: string | null): AccountSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<AccountSnapshot> | null;
    if (!value || typeof value !== "object" || value.version !== 1) return null;
    if (!Array.isArray(value.savedReadings) || !Array.isArray(value.journalEntries)) return null;
    return {
      version: 1,
      savedAt: typeof value.savedAt === "string" ? value.savedAt : "",
      profile: value.profile && typeof value.profile === "object" ? (value.profile as UserProfile) : null,
      savedReadings: value.savedReadings as DailyReading[],
      journalEntries: value.journalEntries as JournalEntry[],
      savedReadingTombstones: Array.isArray(value.savedReadingTombstones)
        ? (value.savedReadingTombstones as unknown[]).filter((key): key is string => typeof key === "string")
        : []
    };
  } catch {
    return null;
  }
}

/**
 * Merge al restaurar: lo actual (creado después del snapshot, p. ej. como
 * invitado entre logout y re-login) va primero por ser más nuevo; después lo
 * del snapshot que no esté repetido (dedupe por id). Respeta los límites.
 */
export function mergeAccountLists(
  snapshot: AccountSnapshot,
  current: { savedReadings: DailyReading[]; journalEntries: JournalEntry[] }
): { savedReadings: DailyReading[]; journalEntries: JournalEntry[] } {
  const readingIds = new Set(current.savedReadings.map((reading) => reading.id));
  const journalIds = new Set(current.journalEntries.map((entry) => entry.id));
  return {
    savedReadings: [
      ...current.savedReadings,
      ...snapshot.savedReadings.filter((reading) => !readingIds.has(reading.id))
    ].slice(0, MAX_SAVED_READINGS),
    journalEntries: [
      ...current.journalEntries,
      ...snapshot.journalEntries.filter((entry) => !journalIds.has(entry.id))
    ].slice(0, MAX_JOURNAL_ENTRIES)
  };
}
