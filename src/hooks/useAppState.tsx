import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  createActiveTransit,
  createDailyReading,
  createFallbackProfile,
  createRelationshipReading,
  createWeeklyEnergy,
  createWeeklyReading,
  toISODate
} from "@/domain/readingEngine";
import {
  DailyReading,
  JournalEntry,
  OnboardingProfile,
  RelationshipReading,
  TransitEvent,
  UserProfile,
  WeeklyEnergy,
  WeeklyReading
} from "@/domain/types";
import { getZodiacSign } from "@/domain/zodiac";
import {
  clearLocalData,
  getJournalEntries,
  getSavedReadings,
  getStoredProfile,
  storeJournalEntries,
  storeProfile,
  storeSavedReadings
} from "@/services/storage";
import { scheduleDailyReminder } from "@/services/notifications";

type CreateProfileInput = OnboardingProfile;

type AppStateValue = {
  isReady: boolean;
  profile: UserProfile | null;
  todayReading: DailyReading;
  weeklyEnergy: WeeklyEnergy;
  weeklyReading: WeeklyReading;
  transitEvent: TransitEvent;
  relationshipReading: RelationshipReading;
  savedReadings: DailyReading[];
  journalEntries: JournalEntry[];
  createProfile: (input: CreateProfileInput) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  saveTodayReading: () => Promise<void>;
  removeSavedReading: (readingId: string) => Promise<void>;
  addJournalNote: (reading: DailyReading, note: string) => Promise<void>;
  resetApp: () => Promise<void>;
};

const AppStateContext = createContext<AppStateValue | null>(null);

function normalizeProfile(profile: UserProfile | null): UserProfile | null {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    interests: profile.interests?.length ? profile.interests : ["claridad", "energia"],
    guidanceTone: profile.guidanceTone ?? "protectora",
    notificationTime: profile.notificationTime || "09:00"
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [savedReadings, setSavedReadings] = useState<DailyReading[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      const [storedProfile, storedReadings, storedJournal] = await Promise.all([
        getStoredProfile(),
        getSavedReadings(),
        getJournalEntries()
      ]);

      if (!mounted) {
        return;
      }

      const normalizedProfile = normalizeProfile(storedProfile);
      setProfile(normalizedProfile);
      if (normalizedProfile && normalizedProfile !== storedProfile) {
        await storeProfile(normalizedProfile);
      }
      setSavedReadings(storedReadings);
      setJournalEntries(storedJournal);
      setIsReady(true);
    }

    hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  const todayReading = useMemo(() => {
    const reading = createDailyReading(profile ?? createFallbackProfile(), toISODate());
    return {
      ...reading,
      saved: savedReadings.some((saved) => saved.id === reading.id)
    };
  }, [profile, savedReadings]);

  const weeklyEnergy = useMemo(() => createWeeklyEnergy(profile ?? createFallbackProfile(), toISODate()), [profile]);

  const weeklyReading = useMemo(() => createWeeklyReading(profile ?? createFallbackProfile(), toISODate()), [profile]);

  const transitEvent = useMemo(() => createActiveTransit(profile ?? createFallbackProfile(), toISODate()), [profile]);

  const relationshipReading = useMemo(
    () => createRelationshipReading(profile ?? createFallbackProfile(), toISODate()),
    [profile]
  );

  const createProfile = useCallback(async (input: CreateProfileInput) => {
    const nextProfile: UserProfile = {
      id: `${input.name.trim().toLowerCase().replace(/\s+/g, "-")}-${input.birthDate}`,
      name: input.name.trim() || "Visitante",
      birthDate: input.birthDate,
      birthTime: input.birthTime,
      birthPlace: input.birthPlace,
      zodiacSign: getZodiacSign(input.birthDate),
      interests: input.interests.length > 0 ? input.interests : ["claridad", "energia"],
      guidanceTone: input.guidanceTone,
      relationshipTarget: input.relationshipTarget?.name ? input.relationshipTarget : undefined,
      notificationTime: input.notificationTime,
      createdAt: new Date().toISOString()
    };

    setProfile(nextProfile);
    await storeProfile(nextProfile);
    await scheduleDailyReminder(nextProfile.notificationTime);
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      if (!profile) {
        return;
      }

      const nextProfile = {
        ...profile,
        ...updates,
        zodiacSign: updates.birthDate ? getZodiacSign(updates.birthDate) : profile.zodiacSign
      };

      setProfile(nextProfile);
      await storeProfile(nextProfile);

      if (updates.notificationTime) {
        await scheduleDailyReminder(updates.notificationTime);
      }
    },
    [profile]
  );

  const saveTodayReading = useCallback(async () => {
    if (savedReadings.some((reading) => reading.id === todayReading.id)) {
      return;
    }

    const nextReadings = [{ ...todayReading, saved: true }, ...savedReadings].slice(0, 60);
    setSavedReadings(nextReadings);
    await storeSavedReadings(nextReadings);
  }, [savedReadings, todayReading]);

  const removeSavedReading = useCallback(
    async (readingId: string) => {
      const nextReadings = savedReadings.filter((reading) => reading.id !== readingId);
      setSavedReadings(nextReadings);
      await storeSavedReadings(nextReadings);
    },
    [savedReadings]
  );

  const addJournalNote = useCallback(
    async (reading: DailyReading, note: string) => {
      const trimmedNote = note.trim();

      if (!trimmedNote) {
        return;
      }

      const entry: JournalEntry = {
        id: `${reading.id}-${Date.now()}`,
        readingId: reading.id,
        date: reading.date,
        title: reading.headline,
        note: trimmedNote,
        reading,
        createdAt: new Date().toISOString()
      };
      const nextEntries = [entry, ...journalEntries].slice(0, 120);
      setJournalEntries(nextEntries);
      await storeJournalEntries(nextEntries);
    },
    [journalEntries]
  );

  const resetApp = useCallback(async () => {
    setProfile(null);
    setSavedReadings([]);
    setJournalEntries([]);
    await clearLocalData();
  }, []);

  const value = useMemo(
    () => ({
      isReady,
      profile,
      todayReading,
      weeklyEnergy,
      weeklyReading,
      transitEvent,
      relationshipReading,
      savedReadings,
      journalEntries,
      createProfile,
      updateProfile,
      saveTodayReading,
      removeSavedReading,
      addJournalNote,
      resetApp
    }),
    [
      addJournalNote,
      createProfile,
      isReady,
      journalEntries,
      profile,
      relationshipReading,
      removeSavedReading,
      resetApp,
      saveTodayReading,
      savedReadings,
      todayReading,
      transitEvent,
      updateProfile,
      weeklyEnergy,
      weeklyReading
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }

  return context;
}
