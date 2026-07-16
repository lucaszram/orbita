import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  accountSnapshotKey,
  parseAccountSnapshot,
  type AccountSnapshot
} from "@/domain/accountLocalData";
import { storageKeys as keys } from "@/domain/storageKeys";
import { DailyReading, JournalEntry, UserProfile } from "@/domain/types";

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
