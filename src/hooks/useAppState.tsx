import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  createActiveTransit,
  createDailyReading,
  createFallbackProfile,
  createHomeReading,
  createRelationshipReading,
  createWeeklyEnergy,
  createWeeklyReading,
  toISODate
} from "@/domain/readingEngine";
import {
  DailyReading,
  HomeReading,
  JournalEntry,
  OnboardingProfile,
  RelationshipReading,
  TransitEvent,
  UserProfile,
  WeeklyEnergy,
  WeeklyReading
} from "@/domain/types";
import { getZodiacSign } from "@/domain/zodiac";
import { toHomeReading } from "@/domain/homeAdapter";
import { useLiveApp, useLiveHome } from "@/hooks/useLiveApp";
import {
  buildAccountSnapshot,
  mergeAccountLists,
  planLogoutArchive
} from "@/domain/accountLocalData";
import { commitProfileCreation, shouldAdoptPendingProfile } from "@/domain/sessionStart";
import {
  clearAccountSnapshot,
  clearLocalData,
  getJournalEntries,
  getProfileOwner,
  getSavedReadings,
  getStoredProfile,
  readAccountSnapshot,
  storeAccountSnapshot,
  storeJournalEntries,
  storeProfile,
  storeProfileOwner,
  storeSavedReadings
} from "@/services/storage";
import { scheduleDailyReminder } from "@/services/notifications";

type CreateProfileInput = OnboardingProfile;

type AppStateValue = {
  isReady: boolean;
  profile: UserProfile | null;
  todayReading: DailyReading;
  homeReading: HomeReading;
  /** "live" cuando la lectura viene de Convex; "local" con el engine. */
  homeSource: "local" | "live";
  weeklyEnergy: WeeklyEnergy;
  weeklyReading: WeeklyReading;
  transitEvent: TransitEvent;
  relationshipReading: RelationshipReading;
  savedReadings: DailyReading[];
  journalEntries: JournalEntry[];
  /**
   * `ownerUserId`: clerkUserId dueño del perfil (flujos con sesión); null = guest.
   * `adoptWhenSessionReady`: la sesión se activó pero useAuth sigue stale en
   * este render (carrera post-verify) → adoptar apenas aparezca el userId.
   */
  createProfile: (
    input: CreateProfileInput,
    ownerUserId?: string | null,
    adoptWhenSessionReady?: boolean
  ) => Promise<void>;
  /** Dueño del perfil local (clerkUserId) o null si es guest/legado. */
  profileOwner: string | null;
  /** Sign-in de guest-upgrade: adopta el perfil local existente para la cuenta. */
  adoptLocalProfile: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  saveTodayReading: () => Promise<void>;
  removeSavedReading: (readingId: string) => Promise<void>;
  addJournalNote: (reading: DailyReading, note: string) => Promise<void>;
  resetApp: () => Promise<void>;
  /**
   * Paso 1 del logout (ANTES de cerrar Clerk): archiva el estado local bajo
   * la cuenta (diario y lecturas NO se sincronizan con Convex; borrarlos
   * sería pérdida real). LANZA si no puede archivar — hay datos sin userId o
   * falló la escritura — y en ese caso el caller NO debe cerrar la sesión.
   * Después de un signOut exitoso, el caller limpia con `resetApp()`.
   */
  archiveAccountData: (userId: string | null) => Promise<void>;
  /** Re-login en este teléfono: restaura y mergea lo archivado de esa cuenta. */
  restoreAccountData: (userId: string) => Promise<{ restored: boolean; profileRestored: boolean }>;
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
  const [profileOwner, setProfileOwner] = useState<string | null>(null);
  // Adopción diferida (carrera post-verify): solo en memoria. Si la app muere
  // en esa ventana, el arranque reconcilia el perfil sin dueño contra Convex
  // y lo recrea marcado — el fallback ya existente cubre la pérdida del flag.
  const [pendingOwnerAdoption, setPendingOwnerAdoption] = useState(false);
  const [savedReadings, setSavedReadings] = useState<DailyReading[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      const [storedProfile, storedOwner, storedReadings, storedJournal] = await Promise.all([
        getStoredProfile(),
        getProfileOwner(),
        getSavedReadings(),
        getJournalEntries()
      ]);

      if (!mounted) {
        return;
      }

      const normalizedProfile = normalizeProfile(storedProfile);
      setProfile(normalizedProfile);
      setProfileOwner(normalizedProfile ? storedOwner : null);
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

  // Live (Convex): sin sesión, `payload` es null y todo queda igual que siempre.
  // `isAuthLoading` sostiene la última lectura live durante una reconexión
  // para no pisar contenido real con el engine local delante del usuario.
  const localDate = toISODate();
  const { isLive, isAuthLoading, auth } = useLiveApp();
  const { payload: liveHomePayload, saveLive } = useLiveHome(isLive, localDate, isAuthLoading);

  const engineHomeReading = useMemo(
    () => createHomeReading(profile ?? createFallbackProfile(), toISODate()),
    [profile]
  );

  const homeReading = useMemo(
    () => (liveHomePayload ? toHomeReading(liveHomePayload, engineHomeReading) : engineHomeReading),
    [liveHomePayload, engineHomeReading]
  );

  const homeSource: "local" | "live" = liveHomePayload ? "live" : "local";

  const weeklyEnergy = useMemo(() => createWeeklyEnergy(profile ?? createFallbackProfile(), toISODate()), [profile]);

  const weeklyReading = useMemo(() => createWeeklyReading(profile ?? createFallbackProfile(), toISODate()), [profile]);

  const transitEvent = useMemo(() => createActiveTransit(profile ?? createFallbackProfile(), toISODate()), [profile]);

  const relationshipReading = useMemo(
    () => createRelationshipReading(profile ?? createFallbackProfile(), toISODate()),
    [profile]
  );

  const createProfile = useCallback(async (
    input: CreateProfileInput,
    ownerUserId?: string | null,
    adoptWhenSessionReady = false
  ) => {
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

    // Disco PRIMERO, estado después: publicar `pending` antes de terminar de
    // escribir dejaba que la adopción guardara el userId y la escritura
    // inicial (owner null) lo pisara. Ver commitProfileCreation.
    await commitProfileCreation({
      persistProfile: () => storeProfile(nextProfile),
      persistInitialOwner: () => storeProfileOwner(ownerUserId ?? null),
      publishState: () => {
        setProfile(nextProfile);
        setProfileOwner(ownerUserId ?? null);
        setPendingOwnerAdoption(!ownerUserId && adoptWhenSessionReady);
      }
    });
    await scheduleDailyReminder(nextProfile.notificationTime);
  }, []);

  const adoptLocalProfile = useCallback(
    async (userId: string) => {
      if (!profile) return;
      setProfileOwner(userId);
      setPendingOwnerAdoption(false);
      await storeProfileOwner(userId);
    },
    [profile]
  );

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
    if (saveLive) {
      await saveLive(todayReading);
    }
  }, [savedReadings, todayReading, saveLive]);

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
    setProfileOwner(null);
    setPendingOwnerAdoption(false);
    setSavedReadings([]);
    setJournalEntries([]);
    await clearLocalData();
  }, []);

  const archiveAccountData = useCallback(
    async (userId: string | null) => {
      const snapshot = buildAccountSnapshot(profile, savedReadings, journalEntries, new Date().toISOString());
      const plan = planLogoutArchive(userId, snapshot);
      if (plan === "skip") return;
      if (plan === "error") {
        throw new Error("Órbita: logout con datos locales pero sin userId para archivarlos");
      }
      // AsyncStorage puede fallar: se propaga y el logout se aborta.
      await storeAccountSnapshot(userId as string, snapshot);
      // Marcar el dueño en disco ANTES del signOut: si la limpieza posterior
      // falla, el arranque ve un perfil ajeno sin sesión y lo purga en vez de
      // mostrárselo al próximo usuario.
      await storeProfileOwner(userId as string);
    },
    [profile, savedReadings, journalEntries]
  );

  const restoreAccountData = useCallback(
    async (userId: string): Promise<{ restored: boolean; profileRestored: boolean }> => {
      const snapshot = await readAccountSnapshot(userId);
      if (!snapshot) return { restored: false, profileRestored: false };
      const merged = mergeAccountLists(snapshot, { savedReadings, journalEntries });
      setSavedReadings(merged.savedReadings);
      setJournalEntries(merged.journalEntries);
      await Promise.all([
        storeSavedReadings(merged.savedReadings),
        storeJournalEntries(merged.journalEntries)
      ]);
      // El perfil archivado vuelve solo si no hay uno activo; si Convex tiene
      // birthData, el caller lo pisa después con el remoto (el remoto gana).
      let profileRestored = false;
      if (snapshot.profile && !profile) {
        const normalized = normalizeProfile(snapshot.profile);
        if (normalized) {
          setProfile(normalized);
          setProfileOwner(userId);
          await storeProfile(normalized);
          await storeProfileOwner(userId);
          profileRestored = true;
        }
      }
      await clearAccountSnapshot(userId);
      return { restored: true, profileRestored };
    },
    [profile, savedReadings, journalEntries]
  );

  // Adopción diferida: el perfil se creó con la sesión recién activada pero
  // useAuth stale (owner null). Apenas Clerk publica isSignedIn + userId, el
  // perfil queda marcado como propio — mismo resultado que si el userId
  // hubiera estado disponible en el render de la creación.
  useEffect(() => {
    if (
      !shouldAdoptPendingProfile({
        adoptionPending: pendingOwnerAdoption,
        hasProfile: !!profile,
        profileOwner,
        isSignedIn: !!auth?.isSignedIn,
        userId: auth?.userId ?? null
      })
    ) {
      return;
    }
    void adoptLocalProfile(auth!.userId!);
  }, [pendingOwnerAdoption, profile, profileOwner, auth?.isSignedIn, auth?.userId, adoptLocalProfile, auth]);

  const value = useMemo(
    () => ({
      isReady,
      profile,
      todayReading,
      homeReading,
      homeSource,
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
      resetApp,
      archiveAccountData,
      restoreAccountData,
      profileOwner,
      adoptLocalProfile
    }),
    [
      addJournalNote,
      adoptLocalProfile,
      archiveAccountData,
      createProfile,
      homeReading,
      homeSource,
      isReady,
      journalEntries,
      profile,
      profileOwner,
      relationshipReading,
      removeSavedReading,
      resetApp,
      restoreAccountData,
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
