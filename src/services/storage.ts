import AsyncStorage from "@react-native-async-storage/async-storage";
import { DailyReading, JournalEntry, UserProfile } from "@/domain/types";

const keys = {
  profile: "orbita:profile",
  savedReadings: "orbita:saved-readings",
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

export async function getJournalEntries(): Promise<JournalEntry[]> {
  return readJSON<JournalEntry[]>(keys.journal, []);
}

export async function storeJournalEntries(entries: JournalEntry[]): Promise<void> {
  await writeJSON(keys.journal, entries);
}

export async function clearLocalData(): Promise<void> {
  await AsyncStorage.multiRemove([keys.profile, keys.savedReadings, keys.journal]);
}
