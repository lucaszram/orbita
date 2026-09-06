import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  accountSnapshotKey,
  parseAccountSnapshot,
  type AccountSnapshot
} from "@/domain/accountLocalData";
import {
  esOwnerCanonico,
  parsePendingDeletionMarker,
  type PendingDeletionPhase,
  type PendingDeletionRead
} from "@/domain/accountDeletion";
import type { UserProfile } from "@/domain/profileTypes";
// Guardadas y diario son DATOS OPACOS para el storage: se leen y se escriben
// enteros, nunca se inspeccionan. Por eso el import es de tipo puro y no mete
// el vocabulario del ritual legado en el bundle nativo.
import type { DailyReading, JournalEntry } from "@/domain/types";

const keys = {
  profile: "orbita:profile",
  profileOwner: "orbita:profile-owner",
  savedReadings: "orbita:saved-readings",
  savedReadingTombstones: "orbita:saved-readings-tombstones",
  journal: "orbita:journal"
};

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  const rawValue = await AsyncStorage.getItem(key);

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

async function writeJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getStoredProfile(): Promise<UserProfile | null> {
  return readJSON<UserProfile | null>(keys.profile, null);
}

export async function storeProfile(profile: UserProfile): Promise<void> {
  await writeJSON(keys.profile, profile);
}

export async function getSavedReadings(): Promise<DailyReading[]> {
  return readJSON<DailyReading[]>(keys.savedReadings, []);
}

export async function storeSavedReadings(readings: DailyReading[]): Promise<void> {
  await writeJSON(keys.savedReadings, readings);
}

// Lápidas de guardadas borradas (claves de savedReadingsSync): impiden que el
// merge remoto resucite una lectura y dejan pendiente el `unsave` en Convex.
export async function getSavedReadingTombstones(): Promise<string[]> {
  const stored = await readJSON<string[]>(keys.savedReadingTombstones, []);
  return Array.isArray(stored) ? stored.filter((key) => typeof key === "string") : [];
}

export async function storeSavedReadingTombstones(tombstones: string[]): Promise<void> {
  await writeJSON(keys.savedReadingTombstones, tombstones);
}

export async function getJournalEntries(): Promise<JournalEntry[]> {
  return readJSON<JournalEntry[]>(keys.journal, []);
}

export async function storeJournalEntries(entries: JournalEntry[]): Promise<void> {
  await writeJSON(keys.journal, entries);
}

// Dueño del perfil local (clerkUserId) — vive FUERA de UserProfile para no
// tocar el contrato de dominio. "Sin clave" = perfil guest/legado sin dueño.
export async function getProfileOwner(): Promise<string | null> {
  return (await AsyncStorage.getItem(keys.profileOwner)) || null;
}

export async function storeProfileOwner(userId: string | null): Promise<void> {
  if (userId) {
    await AsyncStorage.setItem(keys.profileOwner, userId);
  } else {
    await AsyncStorage.removeItem(keys.profileOwner);
  }
}

export async function clearLocalData(): Promise<void> {
  await AsyncStorage.multiRemove([
    keys.profile,
    keys.profileOwner,
    keys.savedReadings,
    keys.savedReadingTombstones,
    keys.journal
  ]);
}

// --- Eliminación de cuenta pendiente de limpieza local (ver domain/accountDeletion) ---
// El marcador se escribe DESPUÉS de que Convex confirma el borrado y ANTES de
// borrar Clerk, con la FASE alcanzada: `backend_deleted` (Convex borrado,
// identidad quizás viva) o `identity_deleted` (Clerk también borrado). Es la
// ÚNICA autorización para que el arranque complete la purga local — y solo
// `identity_deleted` (o `backend_deleted` con Clerk confirmado signed-out)
// purga de verdad. Sin marcador rige la regla de preservar datos ante una
// sesión perdida (resolveStart no purga nada por sí solo).

const pendingAccountDeletionKey = "orbita:pending-account-deletion";

/**
 * Escribe el marcador. Un marcador INVÁLIDO no se puede escribir: sin dueño no
 * hay nada que autorizar después, y el arranque quedaría bloqueado por un raw
 * que escribimos nosotros.
 */
export async function storePendingAccountDeletion(
  userId: string,
  phase: PendingDeletionPhase
): Promise<void> {
  // MISMA regla que el parser (`esOwnerCanonico`): ni vacío, ni de puro
  // espacio, ni con padding. Escribir un id que el parser después rechaza deja
  // el arranque bloqueado por un raw que generamos nosotros.
  if (!esOwnerCanonico(userId)) {
    throw new Error("PENDING_DELETION_OWNER_REQUIRED");
  }
  if (
    phase !== "deletion_requested" &&
    phase !== "backend_deleted" &&
    phase !== "identity_deleted"
  ) {
    throw new Error("PENDING_DELETION_PHASE_INVALID");
  }
  await AsyncStorage.setItem(pendingAccountDeletionKey, JSON.stringify({ userId, phase }));
}

/**
 * Lee el marcador SIN normalizar nada.
 *
 * El parser vive en el dominio y distingue ausencia real, raw vacío, JSON roto,
 * objeto incompleto y fase desconocida. Antes todo eso se aplanaba a
 * `{ userId: "", phase: "backend_deleted" }` o a `null` —un error de lectura se
 * devolvía como "no hay nada"— y el arranque seguía como si la eliminación no
 * existiera.
 */
export async function readPendingAccountDeletion(): Promise<PendingDeletionRead> {
  return parsePendingDeletionMarker(await AsyncStorage.getItem(pendingAccountDeletionKey));
}

export async function clearPendingAccountDeletion(): Promise<void> {
  await AsyncStorage.removeItem(pendingAccountDeletionKey);
}

/** Nombre de la clave del marcador, para escuchar cambios cross-tab en web. */
export const PENDING_DELETION_STORAGE_KEY = pendingAccountDeletionKey;

// --- Snapshot local por cuenta (logout sin pérdida; ver domain/accountLocalData) ---

export async function storeAccountSnapshot(userId: string, snapshot: AccountSnapshot): Promise<void> {
  await AsyncStorage.setItem(accountSnapshotKey(userId), JSON.stringify(snapshot));
}

export async function readAccountSnapshot(userId: string): Promise<AccountSnapshot | null> {
  return parseAccountSnapshot(await AsyncStorage.getItem(accountSnapshotKey(userId)));
}

export async function clearAccountSnapshot(userId: string): Promise<void> {
  await AsyncStorage.removeItem(accountSnapshotKey(userId));
}
