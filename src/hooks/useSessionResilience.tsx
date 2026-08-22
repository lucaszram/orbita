import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { useQuery } from "convex/react";
import { readClientDraftId } from "@/domain/onboardingDraft";
import type { OnboardingCompletion } from "@/domain/onboardingReadiness";
import type { UserRowState } from "@/domain/screenPhase";
import {
  nextSecureIdentityStep,
  publishSecureIdentity,
  SECURE_SLOT_BROKEN,
  SECURE_SLOT_EMPTY,
  SECURE_SLOT_HYDRATING,
  secureSlotBusy,
  secureSlotSettled,
  type SecureIdentitySlot
} from "@/domain/secureIdentity";
import {
  publishableViewer,
  resolveSessionConfidence,
  SESSION_CONFIRMATION_TIMEOUT_MS,
  sensitiveOperationAllowed,
  type SensitiveOperation,
  type SessionConfidence,
  type SessionSignals
} from "@/domain/sessionResilience";
import { useAppState } from "@/hooks/useAppState";
import { useEntitlement, useLiveApp } from "@/hooks/useLiveApp";
import { appApi } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";
import {
  clearSecureIdentity,
  readSecureIdentity,
  SECURE_IDENTITY_SUPPORTED,
  writeSecureIdentity
} from "@/services/secureIdentity";

/**
 * Confianza de sesión, central (QA23-007).
 *
 * Existe como PROVIDER y no como hook suelto por dos razones concretas:
 *
 * 1. **Un solo plazo.** El timeout de confirmación es un hecho de la sesión, no
 *    de la pantalla. Con un `setTimeout` por consumidor, la raíz, el gate de las
 *    pestañas y el Perfil vencían en momentos distintos sobre el mismo hecho, y
 *    el aviso podía aparecer en una superficie y no en la de al lado.
 * 2. **Una sola consulta autoritativa.** `onboarding.getCompletionStatus` vivía
 *    dentro de `useAccountDestination`, que se monta en cada `AccountGate`.
 *    Acá se pide una vez y la comparten el destino y la resiliencia, así que no
 *    puede haber dos ideas de "el estado de la cuenta ya resolvió".
 * 3. **Una sola identidad previamente confirmada.** El llavero se lee UNA vez y
 *    se escribe desde UN lugar. Con un lector por pantalla, dos superficies
 *    podrían discrepar sobre quién es el dueño previo mientras la lectura viaja,
 *    y esa discrepancia decide qué datos se muestran.
 *
 * El `clientDraftId` sigue viajando igual: distingue un alta iniciada en este
 * flujo de una cuenta preexistente incompleta.
 */

const BACKEND_CONFIGURED = backendConfig.isConfigured;

export type SessionResilience = {
  confidence: SessionConfidence;
  /** Estado autoritativo de la cuenta. `undefined` = todavía no resolvió. */
  completion: OnboardingCompletion | undefined;
  /**
   * El dueño con el que se puede publicar un dato local. `null` = con ninguno.
   *
   * Normalmente es el `userId` que Clerk publica en este proceso. Durante un
   * timeout completo puede ser el último dueño confirmado del llavero, pero sólo
   * si la identidad local entera cerró contra él —el perfil y cada snapshot
   * declarado—; si algo no coincide, es `null`. Ver `publishableViewer`.
   */
  viewer: string | null;
  /**
   * Reintenta confirmar la sesión SIN reiniciar la app.
   *
   * Vuelve a disparar `getOrCreateCurrentUser` (el reintento que ya existía) y,
   * cuando lo que se está mirando es el gate y no el producto, rearma el plazo
   * para que la espera se vea. En el shell degradado el plazo NO se rearma: eso
   * devolvería la pantalla a un spinner y desmontaría los datos que la persona
   * está leyendo, que es justo lo que este modo existe para evitar. La
   * reconexión real la detecta el propio estado: cuando Convex vuelve a validar
   * el token y la fila `users` queda lista, la confianza pasa sola a
   * `confirmed-signed-in` y el aviso desaparece.
   */
  retry: () => void;
};

/**
 * Sin provider —build sin envs, o un árbol que no lo monta— la respuesta es
 * "no hay sesión que confirmar". Es la misma lectura que hace
 * `resolveAccountDestination`, que sin backend corta antes de mirar nada más.
 */
const SIN_PROVIDER: SessionResilience = {
  confidence: "confirmed-signed-out",
  completion: undefined,
  viewer: null,
  retry: () => undefined
};

const SessionResilienceContext = createContext<SessionResilience | null>(null);

/** Montar UNA vez en el layout raíz, dentro de `AppStateProvider`. */
export function SessionResilienceProvider({ children }: { children: ReactNode }) {
  // Los envs no cambian en runtime: la rama es constante y el orden de hooks
  // queda estable aunque haya un return temprano.
  if (!BACKEND_CONFIGURED) return <>{children}</>;
  return <SessionResilienceProviderInner>{children}</SessionResilienceProviderInner>;
}

/** Sin snapshot local publicable no hay dueño extra contra el cual cerrar. */
const SIN_SNAPSHOTS: readonly (string | null)[] = [];

function SessionResilienceProviderInner({ children }: { children: ReactNode }) {
  const { isLive, userError, retryUser, auth } = useLiveApp();
  const { isReady, profile, profileOwner } = useAppState();
  const { owner: dueñoDelPlan, source: origenDelPlan } = useEntitlement();
  const [timedOut, setTimedOut] = useState(false);
  const [slot, setSlot] = useState<SecureIdentitySlot>(SECURE_SLOT_HYDRATING);

  const completion = useQuery(
    appApi.onboarding.getCompletionStatus,
    isLive ? { clientDraftId: readClientDraftId() ?? undefined } : "skip"
  ) as OnboardingCompletion | undefined;

  /**
   * La fila `users`, reconstruida desde lo que publica `useLiveApp`.
   *
   * `isLive` ya es "Convex autenticado Y la fila lista para este dueño", y
   * `userError` es "agotó los tres intentos". Cualquier otra cosa es espera. No
   * hace falta exponer el slot crudo para saber eso.
   */
  const userRow: UserRowState = userError ? "error" : isLive ? "ready" : "pending";
  /** Dueño publicado por Clerk EN ESTE PROCESO. Lo único que puede escribir. */
  const liveOwner = auth?.isSignedIn ? auth.userId ?? null : null;

  /**
   * El único snapshot local que esta app publica sin remoto: el plan cacheado.
   *
   * Vive bajo una clave por cuenta (`orbita:entitlement-snapshot:<owner>`) y sólo
   * se lee para el dueño vivo, así que estructuralmente no puede aparecer bajo
   * una identidad previa. Se declara igual, y no como comentario: la regla es que
   * la identidad segura tiene que cerrar contra el perfil **y contra cada
   * snapshot que se vaya a publicar**, y una regla que depende de que nadie
   * agregue un segundo snapshot no es una regla.
   */
  const snapshotOwners = origenDelPlan === "cache" ? [dueñoDelPlan] : SIN_SNAPSHOTS;

  /**
   * La identidad previamente confirmada, tal como la política puede leerla.
   *
   * El estado crudo (`slot`) incluye la operación de llavero en vuelo; lo que se
   * publica sale de `publishSecureIdentity`, y la conversión no es decorativa:
   * `ready` es "el llavero contestó Y no hay nada en vuelo", porque una
   * operación viajando es tan poco publicable como una lectura sin terminar —en
   * las dos, el disco está en un estado que este proceso no conoce—. Mientras
   * tanto, y ante cualquier fallo, no hay dueño previo y por esa vía no se abre
   * nada.
   */
  const secure = publishSecureIdentity(slot);

  const signals: SessionSignals = {
    backendConfigured: true,
    localReady: isReady,
    // `isLoaded` REAL: el plazo vencido no se disfraza de "cargado", que es
    // exactamente lo que convertía un timeout en un signed-out.
    clerkLoaded: auth ? auth.isLoaded : false,
    clerkSignedIn: !!auth?.isSignedIn,
    clerkUserId: auth?.userId ?? null,
    convexAuthenticated: !!auth?.isAuthenticated,
    userRow,
    authoritativeResolved: completion !== undefined,
    confirmationTimedOut: timedOut,
    hasLocalProfile: !!profile,
    localOwner: profileOwner,
    snapshotOwners,
    secureIdentitySupported: SECURE_IDENTITY_SUPPORTED,
    secureIdentityReady: secure.ready,
    secureIdentityError: secure.error,
    secureOwner: secure.owner
  };

  const confidence = resolveSessionConfidence(signals);
  /**
   * Con quién se puede publicar un dato en pantalla.
   *
   * Con Clerk vivo es su `userId`, como siempre. Durante un timeout completo
   * puede ser el último dueño confirmado del llavero, pero SÓLO si la identidad
   * local entera cerró contra él —el perfil y cada snapshot declarado—; si no,
   * es `null` y no se publica nada.
   */
  const viewer = publishableViewer(signals);

  const confidenceRef = useRef(confidence);
  confidenceRef.current = confidence;

  /**
   * ¿Sigue vivo el árbol que arrancó esto?
   *
   * Un resultado que llega tarde al MISMO árbol vivo se aplica igual: es el de
   * la única operación que hubo, y descartarlo dejaría el llavero en vuelo para
   * siempre —sin publicar dueño y sin poder arrancar el paso siguiente—. Lo
   * único que se descarta es publicar sobre un árbol que ya no está.
   */
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  /**
   * El candado: como máximo UNA operación de llavero en vuelo.
   *
   * Es un ref y no un estado porque tiene que valer en el mismo tick en que se
   * decide, antes de cualquier render. Confiar en que el render siguiente vea el
   * registro ya marcado no alcanza —un cambio de `liveOwner` en esa ventana, o
   * un efecto que se vuelve a montar, arrancan la segunda operación igual—, y
   * dos operaciones en vuelo dejan de ser una secuencia: el resultado pasa a
   * depender de cuál promesa del llavero resuelva última, y una de las
   * posibilidades es el `clear` borrando al dueño que el `write` acaba de dejar.
   */
  const enVuelo = useRef(false);

  /** Cierra la operación: suelta el candado SIEMPRE y publica si hay árbol. */
  const cerrarOperacion = useCallback((resultado: SecureIdentitySlot) => {
    enVuelo.current = false;
    if (montado.current) setSlot(resultado);
  }, []);

  /**
   * El llavero se lee UNA vez, al montar, y la lectura sólo puede HIDRATAR.
   *
   * Si para cuando contesta este proceso ya escribió o borró, manda lo que se
   * hizo: aceptar la lectura ahí sería publicar un dueño que el propio proceso
   * acaba de invalidar. Y no se vuelve a leer nunca, por lo mismo.
   */
  const hidratar = useCallback((leido: SecureIdentitySlot) => {
    if (!montado.current) return;
    setSlot((previo) => (previo.hydrated || previo.busy ? previo : leido));
  }, []);

  useEffect(() => {
    void readSecureIdentity().then(
      (lectura) => hidratar(lectura.ok ? secureSlotSettled(lectura.owner) : SECURE_SLOT_BROKEN),
      () => hidratar(SECURE_SLOT_BROKEN)
    );
  }, [hidratar]);

  /**
   * Qué hacer con la identidad previa, según lo que se sabe AHORA.
   *
   * `nextSecureIdentityStep` se guarda las tres puertas: no decide con la
   * lectura sin terminar —escribir sobre lo que todavía no se leyó es cómo se
   * pisa un registro sin saber qué había—, no arranca una segunda operación
   * mientras hay una en vuelo, y no vuelve a tocar un llavero que falló.
   */
  const accionSegura = nextSecureIdentityStep({ slot, confidence, liveOwner });

  useEffect(() => {
    if (accionSegura === "keep") return;
    // El candado, y no el orden en que resuelvan las promesas, es lo que impide
    // que un `clear` y un `write` se pisen.
    if (enVuelo.current) return;
    enVuelo.current = true;
    // La identidad previa deja de ser publicable ANTES de tocar el disco.
    setSlot(secureSlotBusy);
    const trabajo: Promise<SecureIdentitySlot> =
      accionSegura === "write" && liveOwner
        ? writeSecureIdentity(liveOwner).then((ok) =>
            ok ? secureSlotSettled(liveOwner) : SECURE_SLOT_BROKEN
          )
        : clearSecureIdentity().then((ok) => (ok ? SECURE_SLOT_EMPTY : SECURE_SLOT_BROKEN));
    // Cualquier fallo deja BROKEN, que no abre nada. Y el paso siguiente —el
    // `write` de un cambio de identidad— lo decide el render que ve el `clear`
    // ya terminado; nunca este efecto, que para entonces ya soltó el candado.
    void trabajo.then(cerrarOperacion, () => cerrarOperacion(SECURE_SLOT_BROKEN));
  }, [accionSegura, cerrarOperacion, liveOwner]);

  /**
   * El plazo.
   *
   * Se arma sólo mientras la confianza es `loading`, y se desarma —y se
   * olvida— apenas la sesión queda confirmada en cualquiera de los dos
   * sentidos. Sin la segunda mitad, un vencimiento viejo sobreviviría a una
   * reconexión exitosa; sin la primera, el vencimiento se rearmaría solo en
   * bucle apenas la confianza deja de ser `loading` por haber vencido.
   */
  useEffect(() => {
    if (confidence === "confirmed-signed-in" || confidence === "confirmed-signed-out") {
      if (timedOut) setTimedOut(false);
      return;
    }
    if (confidence !== "loading") return;
    const t = setTimeout(() => setTimedOut(true), SESSION_CONFIRMATION_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [confidence, timedOut]);

  const retry = useCallback(() => {
    retryUser();
    // Ver `SessionResilience.retry`: el shell degradado conserva su vencimiento
    // para no desmontarse; el gate lo rearma para mostrar la espera.
    if (confidenceRef.current !== "degraded-local") setTimedOut(false);
  }, [retryUser]);

  const value = useMemo<SessionResilience>(
    () => ({ confidence, completion, viewer, retry }),
    [confidence, completion, viewer, retry]
  );

  return (
    <SessionResilienceContext.Provider value={value}>{children}</SessionResilienceContext.Provider>
  );
}

export function useSessionResilience(): SessionResilience {
  return useContext(SessionResilienceContext) ?? SIN_PROVIDER;
}

/**
 * ¿Esta superficie puede ejecutar esta operación sensible AHORA?
 *
 * Azúcar sobre `sensitiveOperationAllowed` para que ninguna pantalla arme su
 * propia comparación contra `isLive`, que es lo que hacía que cada una tuviera
 * su propia idea de "sesión confirmada".
 */
export function useSensitiveOperation(operation: SensitiveOperation): {
  allowed: boolean;
  confidence: SessionConfidence;
  retry: () => void;
} {
  const { confidence, retry } = useSessionResilience();
  return { allowed: sensitiveOperationAllowed(operation, confidence), confidence, retry };
}
