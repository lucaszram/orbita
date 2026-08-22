import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import {
  attemptPendingDeletionFinalize,
  inspectPendingAccountDeletion,
  pendingDeletionRecovery,
  resolvePendingDeletionBoot,
  runGuardedPendingDeletionPurge,
  type PendingDeletionMarker,
  type PendingDeletionPurgeOutcome
} from "@/domain/accountDeletion";
import { useConvex } from "convex/react";

import { useOrbitaAuth, type OrbitaAuth } from "@/hooks/useOrbitaAuth";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { SignInScreen } from "@/onboarding/screens/SignInScreen";
import { useSignInFlow } from "@/onboarding/useAccount";
import { appApi } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";
import { clearPurchaseGuard } from "@/services/purchaseGuard";
import {
  clearAccountSnapshot,
  clearLocalData,
  clearPendingAccountDeletion,
  getProfileOwner,
  PENDING_DELETION_STORAGE_KEY,
  readPendingAccountDeletion,
  storePendingAccountDeletion
} from "@/services/storage";
import { BOOT_ACCENT, BOOT_BACKGROUND, BOOT_TEXT, BOOT_TEXT_MUTED } from "@/theme/boot";

const SUPPORT_URL = "https://orbitaastrologia.xyz/support";
const IS_WEB = process.env.EXPO_OS === "web";

/**
 * Boundary GLOBAL de eliminación pendiente.
 *
 * ## Por qué está acá arriba y no en una ruta
 *
 * El gate vivía dentro de `/` (`src/routes/v492/index.tsx`). Todo lo que no
 * pasara por `/` lo esquivaba: un deep link a `/perfil`, las tabs que el sistema
 * restaura al reabrir la app, `/paywall`. Y aunque la ruta bloqueara, para
 * entonces ya habían montado `OrbitaSessionProvider` —que corre
 * `getOrCreateCurrentUser` y puede RECREAR la fila de una cuenta recién
 * borrada—, `AccountBootstrapProvider` y `AppStateProvider`.
 *
 * ## Y por qué es el ÚNICO dueño de lo destructivo
 *
 * Borrar Clerk, escribir el checkpoint `identity_deleted` y purgar corren SOLO
 * acá, con el producto desmontado. El Perfil llega hasta el marcador
 * `backend_deleted` y se aparta: mientras esos pasos vivían en la pantalla,
 * el camino feliz era una carrera —entre la confirmación y el `user.delete()`
 * Clerk podía entregar otra sesión— y encima quedaba app navegable con un
 * marcador ajeno en disco.
 */
export type PendingDeletionGate = {
  /** El producto está tapado por el boundary. */
  blocking: boolean;
  /**
   * Publica un marcador YA PERSISTIDO y toma la pantalla EN ESTE RENDER.
   *
   * Lo usa el Perfil apenas Convex confirma el borrado: el producto se desmonta
   * antes de tocar Clerk, y el boundary sigue solo aunque el Perfil desaparezca.
   */
  publish: (marker: PendingDeletionMarker) => void;
};

const GateContext = createContext<PendingDeletionGate>({
  blocking: false,
  publish: () => undefined
});

export function usePendingDeletionGate(): PendingDeletionGate {
  return useContext(GateContext);
}

/** Lo que el boundary sabe del disco. `loading` también bloquea. */
type SlotState =
  | { kind: "loading" }
  | { kind: "clear" }
  | { kind: "marker"; marker: PendingDeletionMarker }
  | { kind: "invalid" };

export function PendingDeletionBoundary({ children }: { children: ReactNode }) {
  // `useOrbitaAuth` exige ClerkProvider + ConvexProvider montados. Sin backend
  // configurado no hay sesión posible: se decide con "Clerk cargado, sin sesión".
  return backendConfig.isConfigured ? (
    <BoundaryConAuth>{children}</BoundaryConAuth>
  ) : (
    <Boundary auth={null}>{children}</Boundary>
  );
}

function BoundaryConAuth({ children }: { children: ReactNode }) {
  const auth = useOrbitaAuth();
  /**
   * El cliente Convex CRUDO, no un `useMutation`.
   *
   * `useMutation` es un hook y este componente vive por encima de todo el
   * producto: la mutación destructiva se dispara una sola vez, desde un efecto,
   * y no necesita reactividad. Usar el cliente directo también deja claro que
   * acá NO hay suscripciones abiertas de la cuenta que se está borrando.
   */
  const convex = useConvex();
  return (
    <Boundary
      auth={auth}
      deleteBackend={(expectedClerkUserId) =>
        convex.mutation(appApi.users.deleteAccountV2, { expectedClerkUserId })
      }
      checkIdentityDeleted={async (clerkUserId) => {
        const estado = await convex.mutation(appApi.users.checkIdentityDeletionStatus, {
          clerkUserId
        });
        // Sólo `confirmed` es una prueba. `pending`, `unknown` y `rate_limited`
        // son todos "no se sabe", y se tratan igual de cerrados.
        return estado.status === "confirmed";
      }}
    >
      {children}
    </Boundary>
  );
}

function Boundary({
  auth,
  deleteBackend,
  checkIdentityDeleted,
  children
}: {
  auth: OrbitaAuth | null;
  /** Mutación destructiva de Convex. `null` sin backend configurado. */
  deleteBackend?: (expectedClerkUserId: string) => Promise<{ deleted: true }>;
  /**
   * Le pregunta al servidor si esa identidad ya se borró en Clerk.
   *
   * `null` sin backend: sin poder preguntar, el flujo queda exactamente como
   * estaba —fail closed— y nunca peor.
   */
  checkIdentityDeleted?: (clerkUserId: string) => Promise<boolean>;
  children: ReactNode;
}) {
  const [slot, setSlot] = useState<SlotState>({ kind: "loading" });
  const [attemptFailed, setAttemptFailed] = useState(false);
  const [purgeBlocked, setPurgeBlocked] = useState<Exclude<
    PendingDeletionPurgeOutcome,
    "completed"
  > | null>(null);
  const [tick, setTick] = useState(0);
  /**
   * Checkpoint confirmado pero NO persistido, atado a su dueño.
   *
   * `user.delete()` respondió ok y el disco falló al escribir `identity_deleted`.
   * El hecho es real: retenerlo evita mandar a alguien a autenticarse contra una
   * cuenta que ya no existe. Es SÓLO memoria: si el proceso muere, la prueba
   * durable no existe y el caso cae en `needs-owner` — fail closed a propósito,
   * nunca se infiere el borrado de un signed-out.
   */
  const [identityConfirmedFor, setIdentityConfirmedFor] = useState<string | null>(null);
  /**
   * **Prueba DURABLE**, traída del servidor, de que la identidad ya no existe.
   *
   * Es la diferencia con `identityConfirmedFor`: aquélla vive en memoria y se
   * pierde con el proceso, y ese era el callejón sin salida — al reiniciar, el
   * arranque mandaba a `needs-owner`, o sea a entrar con una cuenta borrada.
   * Ésta la escribió el finalizador server-side cuando Clerk confirmó, así que
   * sobrevive a todo.
   */
  const [identityDeletionConfirmedFor, setIdentityDeletionConfirmedFor] = useState<string | null>(
    null
  );
  const statusCheckInFlight = useRef(false);
  const finalizeInFlight = useRef(false);

  /**
   * Sesión VIVA, en una ref.
   *
   * Se consulta desde dentro de la purga, entre paso y paso: la decisión se tomó
   * con un signed-out y los awaits de AsyncStorage son tiempo suficiente para
   * que Clerk publique la sesión de B. Con B viva no se borra un solo dato.
   */
  const liveRef = useRef<{ loaded: boolean; isSignedIn: boolean; userId: string | null }>({
    loaded: true,
    isSignedIn: false,
    userId: null
  });
  liveRef.current = {
    loaded: auth ? auth.isLoaded : true,
    isSignedIn: !!auth?.isSignedIn,
    userId: auth?.userId ?? null
  };
  /**
   * Las TRES condiciones, en cada paso destructivo: Clerk cargado, sin sesión y
   * sin userId. Pedir sólo "no hay sesión" dejaba pasar la ventana en la que
   * Clerk todavía no cargó —donde `isSignedIn` es false por no saber, no por no
   * haber—, que es justo cuando la sesión de B está por aparecer.
   */
  const stillSafeToDelete = useCallback(
    () =>
      liveRef.current.loaded && !liveRef.current.isSignedIn && liveRef.current.userId === null,
    []
  );

  /** Relee el disco. Es lo que hace REINTENTAR: no sólo re-dispara el efecto. */
  useEffect(() => {
    let alive = true;
    setSlot({ kind: "loading" });
    void inspectPendingAccountDeletion({ readMarker: readPendingAccountDeletion })
      .then((resultado) => {
        if (!alive) return;
        if (resultado.status === "none") setSlot({ kind: "clear" });
        else if (resultado.status === "pending") setSlot({ kind: "marker", marker: resultado.marker });
        else setSlot({ kind: "invalid" });
      })
      .catch(() => {
        // `inspect` ya falla cerrado, pero si algo explotara acá tampoco se
        // deja pasar: sin lectura no se publica el producto.
        if (alive) setSlot({ kind: "invalid" });
      });
    return () => {
      alive = false;
    };
  }, [tick]);

  /**
   * Cambios CROSS-TAB del marcador (web).
   *
   * En web la app puede estar abierta en varias pestañas sobre el mismo
   * `localStorage`. Si una borra su cuenta, las otras tienen que enterarse y
   * bloquearse: seguían navegando el producto de una cuenta que ya no existe, y
   * podían crear datos que la purga de la otra pestaña iba a borrar.
   */
  useEffect(() => {
    if (!IS_WEB || typeof window === "undefined" || !window.addEventListener) return;
    const onStorage = (event: StorageEvent) => {
      // `key: null` = `localStorage.clear()`. Cualquier cambio del marcador —o
      // un clear— obliga a releer.
      if (event.key !== null && !event.key.includes(PENDING_DELETION_STORAGE_KEY)) return;
      setTick((t) => t + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const marker = slot.kind === "marker" ? slot.marker : null;
  const decision = resolvePendingDeletionBoot({
    marker,
    clerkLoaded: auth ? auth.isLoaded : true,
    isSignedIn: !!auth?.isSignedIn,
    currentUserId: auth?.userId ?? null,
    markerUnreadable: slot.kind === "invalid",
    identityConfirmedFor,
    identityDeletionConfirmedFor
  });

  /**
   * El rescate: cuando el arranque queda en `needs-owner`, preguntarle al
   * servidor si esa identidad ya se borró.
   *
   * `needs-owner` significa "volvé a entrar con tu cuenta así terminamos". Si el
   * checkpoint en memoria se perdió con el proceso, esa cuenta YA NO EXISTE y el
   * login no puede funcionar nunca: es el callejón sin salida que este paquete
   * cierra. La prueba durable la tiene el servidor.
   *
   * Se consulta UNA vez por montaje (`statusCheckInFlight`) y sólo en ese
   * estado: no es un poll. Si la consulta falla o el servidor no confirma, no se
   * toca nada y el bloqueo sigue ofreciendo volver a entrar — fail closed.
   */
  useEffect(() => {
    if (decision !== "needs-owner") return;
    if (!marker || !checkIdentityDeleted) return;
    if (statusCheckInFlight.current) return;
    statusCheckInFlight.current = true;

    const owner = marker.userId;
    void checkIdentityDeleted(owner)
      .then((confirmado) => {
        // Sólo se publica una confirmación positiva, y atada a su dueño. Un
        // `false` no es "sigue viva": es "no se sabe", y no cambia nada.
        if (confirmado) setIdentityDeletionConfirmedFor(owner);
      })
      .catch(() => {
        /* Sin respuesta no se infiere nada. El bloqueo queda como estaba. */
      })
      .finally(() => {
        statusCheckInFlight.current = false;
      });
  }, [decision, marker, checkIdentityDeleted]);

  useEffect(() => {
    if (attemptFailed || purgeBlocked) return;
    if (
      decision !== "purge" &&
      decision !== "delete-backend" &&
      decision !== "finalize-identity" &&
      decision !== "promote-checkpoint"
    ) {
      return;
    }
    if (!marker) return;
    if (finalizeInFlight.current) return;
    finalizeInFlight.current = true;
    void attemptPendingDeletionFinalize({
      decision,
      // La mutación destructiva sale de ACÁ, no del Perfil, y nombra al dueño
      // esperado: el backend lo revalida contra `identity.subject`.
      deleteBackendAccount: async () => {
        if (!deleteBackend) throw new Error("ACCOUNT_DELETE_BACKEND_UNAVAILABLE");
        await deleteBackend(marker.userId);
      },
      promoteBackendDeleted: () => storePendingAccountDeletion(marker.userId, "backend_deleted"),
      // El dueño esperado sale del MARCADOR: si Clerk cambió de cuenta entre la
      // decisión y este await, `deleteUser` lo rechaza.
      deleteIdentity: async () => {
        await auth?.deleteUser(marker.userId);
      },
      // Persistir el hecho y parar: la purga espera a que Clerk deje de publicar
      // la sesión. Recién ahí `identity_deleted` + signed-out autoriza borrar.
      promoteIdentityDeleted: () => storePendingAccountDeletion(marker.userId, "identity_deleted"),
      purge: async () => {
        /**
         * En WEB no se purga. Y no es una limitación temporal disfrazada: el
         * almacenamiento es un `localStorage` GLOBAL compartido por todas las
         * pestañas del origen, y `clearLocalData` hace un `multiRemove` de
         * claves que no llevan dueño. Otra pestaña con la sesión de B puede
         * estar escribiendo su perfil entre nuestra revalidación y el borrado:
         * es un TOCTOU real, y ningún "claim" por localStorage lo cierra
         * —escribir y releer no es una exclusión mutua—.
         *
         * Fail-closed: el producto queda bloqueado y la salida es soporte. Los
         * datos de Convex ya no existen; lo que sobrevive es caché local.
         */
        if (IS_WEB) {
          setPurgeBlocked("web-unsupported");
          return;
        }
        const outcome = await runGuardedPendingDeletionPurge(marker, {
          stillSafeToDelete,
          // Se RELEE en cada paso: entre await y await puede aparecer B con su
          // propio perfil marcado.
          readProfileOwner: getProfileOwner,
          promoteMarker: (next) => storePendingAccountDeletion(next.userId, next.phase),
          clearLocalData,
          clearAccountSnapshot,
          clearPurchaseGuard,
          clearMarker: clearPendingAccountDeletion
        });
        if (outcome !== "completed") setPurgeBlocked(outcome);
      }
    }).then((resultado) => {
      finalizeInFlight.current = false;
      if (resultado === "error") setAttemptFailed(true);
      // `deleteUser` respondió ok pero el checkpoint no se pudo escribir: el
      // hecho se retiene para ESTE dueño y se reintenta sólo la promoción.
      if (resultado === "checkpoint-pending") {
        setIdentityConfirmedFor(marker.userId);
        setAttemptFailed(true);
      }
      // Toda transición avanza releyendo el disco: es el disco, y no la memoria,
      // el que dice en qué fase quedó la eliminación.
      if (
        resultado === "completed" ||
        resultado === "backend-deleted" ||
        resultado === "identity-deleted"
      ) {
        setIdentityConfirmedFor(null);
        setTick((t) => t + 1);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision, marker?.userId, marker?.phase, attemptFailed, purgeBlocked]);

  const publish = useCallback((nuevo: PendingDeletionMarker) => {
    // Sincrónico a propósito: el producto se desmonta en este render, no en un
    // efecto posterior.
    setAttemptFailed(false);
    setPurgeBlocked(null);
    setSlot({ kind: "marker", marker: nuevo });
  }, []);

  /**
   * REINTENTAR: primero vuelve a "leyendo", DESPUÉS baja el bloqueo.
   *
   * El orden importa y es la corrección: bajar `attemptFailed` con el `slot`
   * todavía en el marcador anterior deja al efecto destructivo elegible con una
   * decisión vieja. Si mientras tanto el disco pasó a ser de B —otra pestaña,
   * otra cuenta—, ese intento salía con la autoridad de A. Pasando el slot a
   * `loading` en el mismo tick, la decisión es `proceed`/`wait` (no hay marker)
   * y no hay nada que ejecutar hasta que la relectura conteste.
   */
  const reintentar = useCallback(() => {
    setSlot({ kind: "loading" });
    setAttemptFailed(false);
    setPurgeBlocked(null);
    // `identityConfirmedFor` NO se limpia: es el hecho de que `deleteUser` ya
    // respondió ok en este proceso, y perderlo mandaría a autenticarse contra
    // una identidad que ya no existe. Está atado a su dueño, así que si el disco
    // ahora es de otra cuenta no aplica.
    setTick((t) => t + 1);
  }, []);

  const blocking = slot.kind !== "clear";
  const gate = useRef<PendingDeletionGate>({ blocking, publish });
  gate.current = { blocking, publish };

  const recovery = pendingDeletionRecovery({
    decision,
    attemptFailed,
    markerUnreadable: slot.kind === "invalid"
  });

  if (blocking) {
    return (
      <GateContext.Provider value={gate.current}>
        {/* `needs-owner` monta el login REAL; el resto, la pantalla de bloqueo. */}
        <PendingDeletionSurface
          recovery={purgeBlocked ? "none" : recovery}
          onSignedIn={() => setTick((t) => t + 1)}
        >
          <BlockingScreen
            loading={slot.kind === "loading"}
            recovery={recovery}
            purgeBlocked={purgeBlocked}
            owner={marker?.userId ?? null}
            onRetry={reintentar}
            onSignOutOther={auth ? () => void auth.signOut().catch(() => undefined) : undefined}
          />
        </PendingDeletionSurface>
      </GateContext.Provider>
    );
  }

  return <GateContext.Provider value={gate.current}>{children}</GateContext.Provider>;
}

/**
 * Pantalla del bloqueo. No importa nada del producto a propósito: tiene que
 * poder dibujarse con la sesión, el bootstrap y el AppState sin montar.
 */
function BlockingScreen({
  loading,
  recovery,
  purgeBlocked,
  owner,
  onRetry,
  onSignOutOther
}: {
  loading: boolean;
  recovery: ReturnType<typeof pendingDeletionRecovery>;
  purgeBlocked: Exclude<PendingDeletionPurgeOutcome, "completed"> | null;
  owner: string | null;
  onRetry: () => void;
  onSignOutOther?: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator color={BOOT_ACCENT} />
      </View>
    );
  }

  if (purgeBlocked === "foreign-local-data") {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>No pudimos terminar de borrar esa cuenta.</Text>
        <Text style={styles.body}>
          Los datos guardados en este dispositivo son de otra cuenta, así que no los tocamos.
          Escribinos y lo resolvemos.
        </Text>
        <Support />
      </View>
    );
  }

  if (purgeBlocked === "web-unsupported") {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Tu cuenta ya fue eliminada.</Text>
        <Text style={styles.body}>
          Tus datos y tu cuenta ya no existen. En el navegador no borramos lo que quedó guardado
          acá —podría ser de otra sesión abierta—, así que si necesitás que lo limpiemos,
          escribinos.
        </Text>
        <Support />
      </View>
    );
  }

  if (recovery === "sign-in-owner") {
    // El login REAL vive acá abajo (`OwnerSignIn`): esta rama no se dibuja.
    return null;
  }

  if (recovery === "sign-out-other") {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Hay otra cuenta abierta en este dispositivo.</Text>
        <Text style={styles.body}>
          Quedó una eliminación a medias de otra cuenta. Para terminarla hay que cerrar esta
          sesión; no vamos a tocar nada de la cuenta que está abierta.
        </Text>
        {onSignOutOther ? <Retry onPress={onSignOutOther} label="CERRAR ESTA SESIÓN" /> : null}
        <Support />
      </View>
    );
  }

  if (recovery === "support") {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>No pudimos leer el estado de tu cuenta.</Text>
        <Text style={styles.body}>
          Quedó una eliminación a medias que no podemos atribuir a nadie. No tocamos nada;
          escribinos y lo resolvemos.
        </Text>
        <Retry onPress={onRetry} label="REINTENTAR" />
        <Support />
      </View>
    );
  }

  if (recovery === "retry" || purgeBlocked === "owner-changed") {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>No pudimos terminar de borrar tu cuenta.</Text>
        <Text style={styles.body}>
          {owner
            ? "Tus datos ya fueron eliminados; falta el último paso."
            : "Falta el último paso de la eliminación."}
        </Text>
        <Retry onPress={onRetry} label="REINTENTAR" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Finalizando la eliminación…</Text>
      <ActivityIndicator color={BOOT_ACCENT} style={{ marginTop: 16 }} />
    </View>
  );
}

/**
 * Login REAL dentro del boundary, con el producto desmontado.
 *
 * `backend_deleted` + signed-out no prueba que Clerk se haya borrado, así que la
 * única salida honesta es volver a entrar con ESA cuenta y terminar. Antes esto
 * era un texto pidiendo "volvé a entrar" sin ninguna forma de hacerlo: un
 * callejón sin salida, porque el `Stack` está desmontado y no hay a dónde
 * navegar.
 *
 * Es el MISMO flujo canónico de email + código (`useSignInFlow` /
 * `SignInScreen`), con una diferencia: no se ofrece crear una cuenta. Una cuenta
 * nueva conviviendo con un marcador ajeno vivo es exactamente lo que no puede
 * pasar. Si entra OTRA cuenta, la decisión pasa a `blocked` y no se toca nada.
 */
function OwnerSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const flow = useSignInFlow();
  const fontsLoaded = useOrbitaFonts();
  if (!flow || !fontsLoaded) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator color={BOOT_ACCENT} />
      </View>
    );
  }
  return (
    <SignInScreen
      flow={flow}
      // Ni cuenta nueva ni SSO: los dos pueden terminar con OTRA cuenta viva
      // sobre un marcador ajeno. Sólo email + código o contraseña de ESTA cuenta.
      allowSignup={false}
      allowOAuth={false}
      onSignedIn={async () => onSignedIn()}
      onCreateAccount={() => undefined}
      onBack={() => void Linking.openURL(SUPPORT_URL).catch(() => undefined)}
    />
  );
}

/** Envoltorio para elegir entre el login real y las pantallas de bloqueo. */
export function PendingDeletionSurface({
  recovery,
  onSignedIn,
  children
}: {
  recovery: ReturnType<typeof pendingDeletionRecovery>;
  onSignedIn: () => void;
  children: ReactNode;
}) {
  if (recovery === "sign-in-owner") return <OwnerSignIn onSignedIn={onSignedIn} />;
  return <>{children}</>;
}

function Retry({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.button} hitSlop={8}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function Support() {
  return (
    <Pressable
      onPress={() => void Linking.openURL(SUPPORT_URL).catch(() => undefined)}
      accessibilityRole="link"
      hitSlop={8}
      style={styles.button}
    >
      <Text style={styles.buttonText}>ESCRIBIRNOS</Text>
    </Pressable>
  );
}

/**
 * El bloqueo es OSCURO (QA23-006).
 *
 * Este boundary es lo PRIMERO que se dibuja en cada arranque: mientras
 * `inspectPendingAccountDeletion` lee el disco, `slot.kind === "loading"` tapa
 * el producto entero. Pintaba el crema del MVP legado, así que la app abría con
 * un frame claro incluso en el camino feliz —el marcador casi nunca existe— y
 * recién después caía al negro del shell. Ahora es el mismo `#0A0B0E`, con el
 * texto y las acciones del mismo módulo para que ninguna quede oscuro sobre
 * oscuro.
 */
const styles = StyleSheet.create({
  body: {
    color: BOOT_TEXT_MUTED,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center"
  },
  button: {
    borderColor: BOOT_ACCENT,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 20,
    minHeight: 44,
    paddingHorizontal: 24,
    paddingVertical: 10
  },
  buttonText: {
    color: BOOT_ACCENT,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1
  },
  screen: {
    alignItems: "center",
    backgroundColor: BOOT_BACKGROUND,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32
  },
  title: {
    color: BOOT_TEXT,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center"
  }
});
