import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
import { useLiveApp, useLiveHome, useLiveSavedReadings } from "@/hooks/useLiveApp";
import {
  buildAccountSnapshot,
  mergeAccountLists,
  planLogoutArchive
} from "@/domain/accountLocalData";
import {
  addTombstoneKeys,
  commitSavedReadingRemoval,
  mergeRemoteSavedReadings,
  parseRemoteSavedReadings,
  readingMatchKeys,
  remoteRowsToUnsave,
  removeTombstoneKeys
} from "@/domain/savedReadingsSync";
import {
  completePendingAccountDeletion,
  finalizePendingDeletionPurge,
  type PendingDeletionMarker
} from "@/domain/accountDeletion";
import { commitProfileCreation, shouldAdoptPendingProfile } from "@/domain/sessionStart";
import {
  clearAccountSnapshot,
  clearLocalData,
  clearPendingAccountDeletion,
  readPendingAccountDeletion,
  storePendingAccountDeletion,
  getJournalEntries,
  getProfileOwner,
  getSavedReadings,
  getSavedReadingTombstones,
  getStoredProfile,
  readAccountSnapshot,
  storeAccountSnapshot,
  storeJournalEntries,
  storeProfile,
  storeProfileOwner,
  storeSavedReadings,
  storeSavedReadingTombstones
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
  /** true mientras el archivo remoto de guardadas todavía no llegó (con sesión). */
  savedReadingsSyncing: boolean;
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
  /**
   * El perfil se creó con la sesión activa pero sin userId todavía: hay una
   * adopción pendiente. Los gates lo usan para NO leer ese perfil como guest
   * durante la ventana (ver sessionStart.profileAdoptionPending).
   */
  profileAdoptionPending: boolean;
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
  /**
   * Eliminación de cuenta en fase `backend_deleted` (Convex borrado, Clerk
   * quizás vivo): el gate de arranque debe resolverla con Clerk cargado antes
   * de dejar pasar (resolvePendingDeletionBoot). null = nada pendiente.
   */
  pendingAccountDeletion: PendingDeletionMarker | null;
  /**
   * Purga final una vez confirmado que la identidad ya no existe: promueve el
   * marcador a `identity_deleted`, limpia todo lo local (incluido el snapshot
   * por cuenta) y retira el marcador ÚLTIMO. Lanza si falla (el caller
   * muestra reintento; el marcador sigue protegiendo).
   */
  completePendingDeletionPurge: () => Promise<void>;
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
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletionMarker | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileOwner, setProfileOwner] = useState<string | null>(null);
  // Adopción diferida (carrera post-verify): solo en memoria. Si la app muere
  // en esa ventana, el arranque reconcilia el perfil sin dueño contra Convex
  // y lo recrea marcado — el fallback ya existente cubre la pérdida del flag.
  const [pendingOwnerAdoption, setPendingOwnerAdoption] = useState(false);
  const [savedReadings, setSavedReadings] = useState<DailyReading[]>([]);
  // Lápidas de guardadas borradas: bloquean la resurrección por merge remoto
  // y dejan pendiente el `unsave` en Convex hasta que se confirme.
  const [savedTombstones, setSavedTombstones] = useState<string[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      // Cuenta eliminada con limpieza local pendiente (la app murió o el
      // storage falló durante la eliminación): SOLO el marcador autoriza
      // purgar, y SOLO en fase `identity_deleted` se purga acá. En
      // `backend_deleted` ("awaiting-identity") la identidad de Clerk puede
      // seguir viva: no se toca nada y el gate de arranque resuelve con Clerk
      // cargado. En todos los casos con marcador este proceso arranca vacío —
      // nunca se publica el perfil de una cuenta eliminada ni se ofrece login
      // a esa cuenta.
      const pendingDeletion = await completePendingAccountDeletion({
        readMarker: readPendingAccountDeletion,
        clearLocalData,
        clearAccountSnapshot,
        clearMarker: clearPendingAccountDeletion
      });
      if (pendingDeletion.status !== "none") {
        if (!mounted) return;
        setProfile(null);
        setProfileOwner(null);
        setSavedReadings([]);
        setSavedTombstones([]);
        setJournalEntries([]);
        setPendingDeletion(pendingDeletion.status === "awaiting-identity" ? pendingDeletion.marker : null);
        setIsReady(true);
        return;
      }

      const [storedProfile, storedOwner, storedReadings, storedTombstones, storedJournal] = await Promise.all([
        getStoredProfile(),
        getProfileOwner(),
        getSavedReadings(),
        getSavedReadingTombstones(),
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
      // Reconciliar al arrancar: si el proceso murió entre la lápida y la
      // lista (borrado coordinado), acá se retira la lectura pendiente.
      const reconciled = mergeRemoteSavedReadings(storedReadings, [], storedTombstones);
      setSavedReadings(reconciled.merged);
      if (reconciled.changed) {
        await storeSavedReadings(reconciled.merged);
      }
      setSavedTombstones(storedTombstones);
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
  const {
    rows: remoteSavedRows,
    loading: savedReadingsSyncing,
    unsaveRemote
  } = useLiveSavedReadings(isLive);
  // unsaves ya despachados en esta sesión (evita repetir mientras están en vuelo)
  const unsavesInFlight = useRef<Set<string>>(new Set());

  // Sync del archivo remoto (readings.listSaved, PR #12): lo local va primero
  // y un remoto vacío nunca borra nada. Después del merge, ejecuta los
  // borrados pendientes (lápidas) contra Convex y recién ahí las levanta.
  useEffect(() => {
    if (!isReady || !remoteSavedRows) return;
    const remote = parseRemoteSavedReadings(remoteSavedRows);

    const { merged, changed } = mergeRemoteSavedReadings(savedReadings, remote, savedTombstones);
    if (changed) {
      setSavedReadings(merged);
      void storeSavedReadings(merged);
      return; // el efecto vuelve a correr con la lista ya mergeada
    }

    if (!unsaveRemote || savedTombstones.length === 0) return;
    const pendingRows = remoteRowsToUnsave(remote, savedTombstones).filter(
      (row) => !unsavesInFlight.current.has(row.savedReadingId)
    );
    if (pendingRows.length === 0) return;
    pendingRows.forEach((row) => unsavesInFlight.current.add(row.savedReadingId));
    void (async () => {
      const confirmedKeys: string[] = [];
      for (const row of pendingRows) {
        const removed = await unsaveRemote(row.savedReadingId);
        if (removed) {
          confirmedKeys.push(...readingMatchKeys(row.reading));
        } else {
          // reintentable en la próxima resolución de la query / sesión
          unsavesInFlight.current.delete(row.savedReadingId);
        }
      }
      if (confirmedKeys.length > 0) {
        setSavedTombstones((current) => {
          const next = removeTombstoneKeys(current, confirmedKeys);
          void storeSavedReadingTombstones(next);
          return next;
        });
      }
    })();
  }, [isReady, remoteSavedRows, savedReadings, savedTombstones, unsaveRemote]);

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
    // Re-guardar levanta la lápida de un borrado anterior de la misma lectura.
    const keys = readingMatchKeys(todayReading);
    if (savedTombstones.some((key) => keys.includes(key))) {
      const nextTombstones = removeTombstoneKeys(savedTombstones, keys);
      setSavedTombstones(nextTombstones);
      await storeSavedReadingTombstones(nextTombstones);
    }
    if (saveLive) {
      await saveLive(todayReading);
    }
  }, [savedReadings, savedTombstones, todayReading, saveLive]);

  const removeSavedReading = useCallback(
    async (readingId: string) => {
      const target = savedReadings.find((reading) => reading.id === readingId);
      if (!target) return;
      const nextReadings = savedReadings.filter((reading) => reading.id !== readingId);
      // La lápida persiste hasta que el `unsave` remoto se confirme (lo hace
      // el efecto de sync); sin sesión o sin red queda pendiente y no vuelve.
      const nextTombstones = addTombstoneKeys(savedTombstones, readingMatchKeys(target));
      // Coordinado: la intención (lápida) toca disco ANTES de publicar la
      // eliminación; un logout/crash en el medio nunca deja "sin lectura y
      // sin lápida". Lista + lápidas se publican juntas para que un archive
      // concurrente vea un estado consistente.
      await commitSavedReadingRemoval({
        persistTombstones: () => storeSavedReadingTombstones(nextTombstones),
        publishState: () => {
          setSavedTombstones(nextTombstones);
          setSavedReadings(nextReadings);
        },
        persistReadings: () => storeSavedReadings(nextReadings)
      });
    },
    [savedReadings, savedTombstones]
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
    setSavedTombstones([]);
    setJournalEntries([]);
    unsavesInFlight.current.clear();
    await clearLocalData();
  }, []);

  const completePendingDeletionPurge = useCallback(async () => {
    if (!pendingDeletion) return;
    // Promueve a `identity_deleted` ANTES de limpiar (persistir el hecho: si
    // la purga muere a mitad, el próximo arranque la completa solo) y retira
    // el marcador ÚLTIMO. Lanza si algo falla: el gate muestra reintento.
    await finalizePendingDeletionPurge(pendingDeletion, {
      promoteMarker: (marker) => storePendingAccountDeletion(marker.userId, marker.phase),
      clearLocalData,
      clearAccountSnapshot,
      clearMarker: clearPendingAccountDeletion
    });
    setPendingDeletion(null);
  }, [pendingDeletion]);

  const archiveAccountData = useCallback(
    async (userId: string | null) => {
      // Las lápidas pendientes viajan con la cuenta: si el `unsave` remoto no
      // llegó a confirmarse, el próximo login las necesita para no resucitar
      // la lectura desde `listSaved`.
      const snapshot = buildAccountSnapshot(
        profile,
        savedReadings,
        journalEntries,
        new Date().toISOString(),
        savedTombstones
      );
      const plan = planLogoutArchive(userId, snapshot);
      if (plan === "skip") return;
      if (plan === "error") {
        throw new Error("Órbita: logout con datos locales pero sin userId para archivarlos");
      }
      // AsyncStorage puede fallar: se propaga y el logout se aborta.
      await storeAccountSnapshot(userId as string, snapshot);
      // Marcar el dueño en disco ANTES del signOut: si la limpieza posterior
      // falla, el arranque ve un perfil con dueño y sin sesión y pide login en
      // vez de mostrárselo al próximo usuario.
      await storeProfileOwner(userId as string);
    },
    [profile, savedReadings, savedTombstones, journalEntries]
  );

  const restoreAccountData = useCallback(
    async (userId: string): Promise<{ restored: boolean; profileRestored: boolean }> => {
      const snapshot = await readAccountSnapshot(userId);
      if (!snapshot) return { restored: false, profileRestored: false };
      // Lo "actual" se lee del DISCO, no del closure: en un cambio de cuenta
      // el caller acaba de archivar y limpiar lo del usuario anterior, y el
      // estado de React todavía no lo refleja en esta misma vuelta. Con el
      // closure viejo, el merge le devolvía a ESTA cuenta las guardadas y el
      // diario del usuario anterior.
      const [currentSaved, currentJournal, currentProfile, currentTombstones] = await Promise.all([
        getSavedReadings(),
        getJournalEntries(),
        getStoredProfile(),
        getSavedReadingTombstones()
      ]);
      const merged = mergeAccountLists(snapshot, {
        savedReadings: currentSaved,
        journalEntries: currentJournal
      });
      setSavedReadings(merged.savedReadings);
      setJournalEntries(merged.journalEntries);
      await Promise.all([
        storeSavedReadings(merged.savedReadings),
        storeJournalEntries(merged.journalEntries)
      ]);
      // Restaurar las lápidas archivadas: el efecto de sync retoma los
      // `unsave` pendientes y el merge remoto no resucita lo borrado.
      if (snapshot.savedReadingTombstones.length > 0) {
        const nextTombstones = addTombstoneKeys(currentTombstones, snapshot.savedReadingTombstones);
        setSavedTombstones(nextTombstones);
        await storeSavedReadingTombstones(nextTombstones);
      }
      // El perfil archivado vuelve solo si no hay uno activo; si Convex tiene
      // birthData, el caller lo pisa después con el remoto (el remoto gana).
      let profileRestored = false;
      if (snapshot.profile && !currentProfile) {
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
    []
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
      savedReadingsSyncing,
      journalEntries,
      createProfile,
      updateProfile,
      saveTodayReading,
      removeSavedReading,
      addJournalNote,
      resetApp,
      archiveAccountData,
      restoreAccountData,
      pendingAccountDeletion: pendingDeletion,
      completePendingDeletionPurge,
      profileOwner,
      profileAdoptionPending: pendingOwnerAdoption,
      adoptLocalProfile
    }),
    [
      addJournalNote,
      adoptLocalProfile,
      archiveAccountData,
      completePendingDeletionPurge,
      createProfile,
      pendingDeletion,
      homeReading,
      homeSource,
      isReady,
      journalEntries,
      pendingOwnerAdoption,
      profile,
      profileOwner,
      relationshipReading,
      removeSavedReading,
      resetApp,
      restoreAccountData,
      saveTodayReading,
      savedReadings,
      savedReadingsSyncing,
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
