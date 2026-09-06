import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { OnboardingProfile, UserProfile } from "@/domain/profileTypes";
// Guardadas y diario son datos OPACOS acá: se archivan y se restauran enteros,
// nunca se leen por dentro. El tipo viaja sólo para el compilador.
import type { JournalEntry, DailyReading } from "@/domain/types";
import { getZodiacSign } from "@/domain/zodiac";
import { useLiveApp } from "@/hooks/useLiveApp";
import {
  MAX_SAVED_READINGS,
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

/**
 * AppState del producto NATIVO V4.9.2.
 *
 * Metro resuelve este archivo antes que `useAppState.tsx` en iOS/Android; la
 * variante web (el fallback sin sufijo) queda intacta. Existe por ALCANCE, no
 * por comportamiento: el AppState compartido importaba `@/domain/readingEngine`
 * para fabricar la lectura del día, la Home y el vínculo del ritual legado, y
 * con eso arrastraba `@/content/catalog` (y el resto del árbol editorial de ese
 * ritual) a TODO bundle nativo — incluido el arranque, que ni siquiera abre esas
 * pantallas. Nada de ese contenido se muestra en el producto nativo actual.
 *
 * Por eso acá NO se genera ninguna lectura ni se exponen `todayReading`,
 * `homeReading`, `weeklyEnergy`, `weeklyReading`, `transitEvent`,
 * `relationshipReading`, `saveTodayReading`, `removeSavedReading` ni
 * `addJournalNote`: nada nativo los consume. Lo que sí queda, completo y con la
 * misma semántica, es la cuenta — alta, edición, ownership, logout con
 * snapshot, restauración y eliminación pendiente — porque ahí un no-op sería
 * pérdida de datos real, no una pantalla de menos.
 *
 * Las guardadas y el diario se leen y se escriben (nunca se generan): son las
 * dos listas que sólo viven en el teléfono, y el snapshot del logout tiene que
 * poder archivarlas y devolverlas. Acá viajan como DATOS OPACOS: no se abre una
 * lectura ni se mira su carta. La sincronización remota de guardadas —el merge
 * contra `readings.listSaved`, la reconciliación por lápidas y el `unsave`
 * pendiente— es del ritual legado y vive entera en la variante web, que la
 * corre en su propio arranque con las mismas lápidas.
 */
type CreateProfileInput = OnboardingProfile;

/** Techo de lápidas: 2 claves por lectura, el mismo de la lista activa. */
const MAX_TOMBSTONE_KEYS = MAX_SAVED_READINGS * 2;

/**
 * Unión de lápidas al restaurar una cuenta: lo archivado primero (es lo que
 * todavía no se pudo confirmar contra el servidor), después lo que ya había,
 * sin repetidas y con techo.
 *
 * Es aritmética de strings a propósito: una lápida es una clave opaca y acá no
 * se resuelve nada con ella. Perderlas sí sería pérdida real —una lectura
 * borrada volvería desde `listSaved` en el próximo login— así que se conservan
 * completas y sólo se recorta el excedente más viejo, igual que en la web.
 */
function unionTombstones(current: string[], restored: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const key of [...restored, ...current]) {
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(key);
  }
  return next.slice(0, MAX_TOMBSTONE_KEYS);
}

type AppStateValue = {
  isReady: boolean;
  profile: UserProfile | null;
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
  // La eliminación pendiente NO vive acá: la resuelve `PendingDeletionBoundary`,
  // que envuelve a este provider. Mientras haya un marcador este hook ni se
  // monta, así que hidratar no puede publicar los datos de una cuenta borrada ni
  // correr una purga a ciegas — que era exactamente el doble camino peligroso.
};

const AppStateContext = createContext<AppStateValue | null>(null);

// Duplicado a propósito respecto de la variante web: importarlo desde el otro
// archivo lo volvería a meter en el grafo nativo con todo el ritual detrás.
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
  // Guardadas, lápidas y diario: NO se publican en el value (ninguna pantalla
  // nativa los muestra). Se sostienen para que el snapshot del logout archive
  // lo que hay en el teléfono en vez de perderlo.
  const [savedReadings, setSavedReadings] = useState<DailyReading[]>([]);
  const [savedTombstones, setSavedTombstones] = useState<string[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      // La eliminación pendiente NO se mira acá.
      //
      // Se miraba, y ése era el segundo camino peligroso: la hidratación leía el
      // marcador y (antes) hasta purgaba, ANTES de saber quién estaba logueado.
      // Ahora el único dueño de esa decisión es `PendingDeletionBoundary`, que
      // envuelve a este provider: si hay marcador, este hook ni se monta.
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
      // Sin reconciliar: la lista se publica tal como está en disco. Reconciliar
      // contra las lápidas obliga a mirar adentro de cada lectura —fecha y
      // carta— y eso es el sync del ritual, no algo que este producto haga. Las
      // lápidas se conservan intactas y viajan con el snapshot, así que la web
      // retira en su propio arranque lo que haya quedado con borrado pendiente.
      setSavedReadings(storedReadings);
      setSavedTombstones(storedTombstones);
      setJournalEntries(storedJournal);
      setIsReady(true);
    }

    hydrate();

    return () => {
      mounted = false;
    };
  }, []);

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

  const resetApp = useCallback(async () => {
    setProfile(null);
    setProfileOwner(null);
    setPendingOwnerAdoption(false);
    setSavedReadings([]);
    setSavedTombstones([]);
    setJournalEntries([]);
    await clearLocalData();
  }, []);

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
      // Restaurar las lápidas archivadas: el merge remoto (web) no resucita lo
      // borrado y el `unsave` pendiente sigue vivo para cuando se retome.
      if (snapshot.savedReadingTombstones.length > 0) {
        const nextTombstones = unionTombstones(currentTombstones, snapshot.savedReadingTombstones);
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
  const { auth } = useLiveApp();
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
      createProfile,
      updateProfile,
      resetApp,
      archiveAccountData,
      restoreAccountData,
      profileOwner,
      profileAdoptionPending: pendingOwnerAdoption,
      adoptLocalProfile
    }),
    [
      adoptLocalProfile,
      archiveAccountData,
      createProfile,
      isReady,
      pendingOwnerAdoption,
      profile,
      profileOwner,
      resetApp,
      restoreAccountData,
      updateProfile
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
