import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  createSdkSerialQueue,
  storeIdentityIsCurrent,
  type SdkEnqueue
} from "@/domain/nativeCommerce";
import { runGuardedOfferingLoad, type OfferingGuard } from "@/domain/offeringRetry";
import { useLiveApp } from "@/hooks/useLiveApp";
import {
  currentNativeOffering,
  customerHasOrbitaPro,
  identifyRevenueCatUser,
  listenForCustomerInfo,
  logoutRevenueCatUser,
  presentNativeCustomerCenter,
  purchaseNativePackage,
  refreshNativeCustomerInfo,
  restoreNativePurchases,
  revenueCatPublicApiKey,
  trackNativePaywall,
  type NativeOffering
} from "@/services/revenuecat/client";
import type { RevenueCatContextValue, RevenueCatPhase } from "@/services/revenuecat/types";

const NOOP: RevenueCatContextValue = {
  phase: "waiting_for_session",
  plans: [],
  storeIsPro: false,
  identifiedUserId: null,
  offeringId: null,
  purchase: async () => "inactive",
  restore: async () => "inactive",
  presentCustomerCenter: async () => undefined,
  retry: async () => undefined,
  refreshCustomerInfo: async () => false,
  trackPaywallImpression: async () => false
};

const RevenueCatContext = createContext<RevenueCatContextValue>(NOOP);

/**
 * Puente Clerk → RevenueCat. Comprar/restaurar exige que `useLiveApp.isLive`
 * sea true y que el app user id del SDK coincida exactamente con Clerk.
 */
export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const live = useLiveApp();
  const liveUserId = live.isLive ? live.auth?.userId ?? null : null;
  const [phase, setPhase] = useState<RevenueCatPhase>("waiting_for_session");
  const [plans, setPlans] = useState<RevenueCatContextValue["plans"]>([]);
  const [storeIsPro, setStoreIsPro] = useState(false);
  const [identifiedUserId, setIdentifiedUserId] = useState<string | null>(null);
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const offeringRef = useRef<NativeOffering | null>(null);
  const identityRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  /**
   * UNA cola serial para todo lo que toca el SDK.
   *
   * Antes había dos candados independientes: uno para las transiciones de
   * identidad y otro para las acciones. Nada impedía que una transición A → B
   * corriera EN MEDIO de una compra de A, dejando el cargo del lado equivocado.
   * Con una sola cola, la transición espera a que la compra termine.
   */
  const sdkQueueRef = useRef<SdkEnqueue>(createSdkSerialQueue());

  /** Encola una operación del SDK detrás de todo lo que ya está en vuelo. */
  const enqueue = useCallback(<T,>(run: () => Promise<T>): Promise<T> => {
    return sdkQueueRef.current(run);
  }, []);

  const guardRef = useRef<OfferingGuard>({ generation: 0, userId: null });

  /**
   * Publica el Offering cargado. **No cuenta ninguna impresión.**
   *
   * Acá se emitía `trackNativePaywall` — y esto corre en el arranque de
   * CUALQUIER sesión (el provider envuelve la app entera) y otra vez en cada
   * `retry`. O sea: se contaba una impresión de paywall a gente que nunca lo
   * abrió, y dos por cada reintento de carga. La impresión la pide la pantalla
   * cuando está visible (`trackPaywallImpression`).
   */
  const publishOffering = useCallback((offering: NativeOffering | null) => {
    offeringRef.current = offering;
    setPlans(offering?.plans ?? []);
    setOfferingId(offering?.offering.identifier ?? null);
    setPhase(offering ? "ready" : "no_offering");
  }, []);

  useEffect(() => {
    const generation = ++generationRef.current;
    let removeListener: (() => void) | undefined;
    offeringRef.current = null;
    identityRef.current = null;
    setPlans([]);
    setOfferingId(null);
    setStoreIsPro(false);
    setIdentifiedUserId(null);

    const targetUserId = live.isLive ? liveUserId : null;
    if (!targetUserId) setPhase("waiting_for_session");
    const apiKey = targetUserId ? revenueCatPublicApiKey() : null;
    if (targetUserId && !apiKey) setPhase("unavailable");
    else if (targetUserId) setPhase("configuring");

    guardRef.current = { generation, userId: targetUserId };

    // La transición entra en la MISMA cola que las compras: no puede colarse
    // entre el `purchasePackage` de A y su respuesta.
    void enqueue(async () => {
      // Sin sesión no se toca el SDK: el logout de la app limpia el estado
      // local (arriba) y deja el id identificado como está.
      if (!targetUserId || !apiKey) {
        await logoutRevenueCatUser();
        return;
      }
      await runGuardedOfferingLoad({
        capture: () => ({ generation, userId: targetUserId }),
        current: () => guardRef.current,
        load: async () => {
          const customerInfo = await identifyRevenueCatUser(apiKey, targetUserId);
          if (generationRef.current !== generation) return null;
          identityRef.current = targetUserId;
          setIdentifiedUserId(targetUserId);
          setStoreIsPro(customerHasOrbitaPro(customerInfo));
          removeListener = listenForCustomerInfo((next) => {
            if (generationRef.current === generation && identityRef.current === targetUserId) {
              setStoreIsPro(customerHasOrbitaPro(next));
            }
          });
          setPhase("loading_offering");
          return await currentNativeOffering();
        },
        publish: publishOffering,
        fail: () => setPhase("error")
      });
    });

    return () => {
      generationRef.current += 1;
      removeListener?.();
    };
  }, [enqueue, live.isLive, liveUserId, publishOffering]);

  const requireIdentity = useCallback(() => {
    if (!live.isLive || !liveUserId || identityRef.current !== liveUserId) {
      throw new Error("REVENUECAT_IDENTIFIED_USER_REQUIRED");
    }
    return liveUserId;
  }, [live.isLive, liveUserId]);

  /**
   * Publica el estado de tienda SÓLO si la identidad sigue siendo la misma que
   * pidió la acción. Clerk puede cambiar de cuenta mientras la tienda resuelve,
   * y el `orbita_pro` de A no puede quedar pegado en la pantalla de B —aunque
   * no abra nada, porque el acceso lo decide Convex.
   */
  const publishStoreState = useCallback((userId: string, active: boolean) => {
    if (identityRef.current !== userId) return false;
    setStoreIsPro(active);
    return active;
  }, []);

  /**
   * Corre una operación del SDK en la cola serial, revalidando la identidad
   * JUSTO antes de tocarlo y publicando SÓLO para el dueño que la pidió.
   *
   * Tres cosas, y las tres hacen falta:
   *
   * 1. **La cola.** Toda operación sensible a identidad —configure/logIn, la
   *    carga del Offering, comprar, restaurar, el Customer Center, el refresh y
   *    el reintento— pasa por acá. `presentCustomerCenter` y
   *    `refreshCustomerInfo` llamaban al SDK directo, así que podían colarse
   *    entre el `logIn(B)` y su respuesta y abrir o leer la cuenta equivocada.
   * 2. **La revalidación adentro.** Entre que se encoló y que le toca el turno,
   *    Clerk pudo cambiar de cuenta.
   * 3. **El dueño capturado.** Se toma en el MOMENTO del pedido: si cuando le
   *    toca el turno la identidad ya es otra, la operación no corre. Sin esto,
   *    revalidar "hay alguien identificado" habría dejado que una acción pedida
   *    por A terminara ejecutándose sobre B.
   */
  const runOnStore = useCallback(
    async <T,>(run: (userId: string) => Promise<T>): Promise<T> => {
      const requestedBy = live.isLive ? liveUserId : null;
      const generation = generationRef.current;
      return await enqueue(async () => {
        const current = requireIdentity();
        if (!requestedBy || current !== requestedBy || generationRef.current !== generation) {
          throw new Error("REVENUECAT_IDENTIFIED_USER_REQUIRED");
        }
        return await run(requestedBy);
      });
    },
    [enqueue, live.isLive, liveUserId, requireIdentity]
  );

  const purchase = useCallback<RevenueCatContextValue["purchase"]>(
    async (planId) =>
      await runOnStore(async (userId) => {
        const item = offeringRef.current?.packages.get(planId);
        if (!item) throw new Error("REVENUECAT_PACKAGE_NOT_AVAILABLE");
        const result = await purchaseNativePackage(item, userId);
        if (result.customerInfo) publishStoreState(userId, customerHasOrbitaPro(result.customerInfo));
        return result.result;
      }),
    [publishStoreState, runOnStore]
  );

  const restore = useCallback<RevenueCatContextValue["restore"]>(
    async () =>
      await runOnStore(async (userId) => {
        const result = await restoreNativePurchases(userId);
        publishStoreState(userId, customerHasOrbitaPro(result.customerInfo));
        return result.result;
      }),
    [publishStoreState, runOnStore]
  );

  const presentCustomerCenter = useCallback(
    async () =>
      await runOnStore(async (userId) => {
        await presentNativeCustomerCenter(userId);
      }),
    [runOnStore]
  );

  const retry = useCallback(async () => {
    setPhase("loading_offering");
    // La recarga del Offering también entra en la cola y revalida adentro: ni
    // el éxito ni el error de A pueden aterrizar en la pantalla de B.
    await runOnStore(async (userId) => {
      const generation = generationRef.current;
      await runGuardedOfferingLoad({
        capture: () => ({ generation, userId }),
        current: () => guardRef.current,
        load: async () => await currentNativeOffering(),
        publish: publishOffering,
        fail: () => setPhase("error")
      });
    });
  }, [publishOffering, runOnStore]);

  /**
   * Impresión del paywall, pedida por la PANTALLA.
   *
   * Pasa por `runOnStore`, así que hereda las tres garantías del resto: cola
   * serial, dueño capturado al pedirla y revalidación de identidad y generación
   * justo antes de emitir. Una impresión pedida por A que llega tarde no se
   * cuenta bajo B — se descarta.
   */
  const trackPaywallImpression = useCallback(async () => {
    return await runOnStore(async () => {
      const offering = offeringRef.current;
      if (!offering) return false;
      await trackNativePaywall(offering.offering);
      return true;
    }).catch(() => false);
  }, [runOnStore]);

  const refreshCustomerInfo = useCallback(
    async () =>
      await runOnStore(async (userId) => {
        const next = await refreshNativeCustomerInfo(userId);
        return publishStoreState(userId, customerHasOrbitaPro(next));
      }),
    [publishStoreState, runOnStore]
  );

  /**
   * Estado público derivado SÍNCRONAMENTE de la sesión vigente.
   *
   * Cuando Clerk pasa A → B, el efecto que limpia el estado corre DESPUÉS del
   * render: en ese render intermedio, `identifiedUserId`, `plans`, `phase:
   * "ready"` y `storeIsPro` todavía eran los de A y quedaban expuestos bajo la
   * sesión de B. El paywall de B veía la oferta y el "ya sos Pro" de A.
   *
   * La identidad publicada sólo vale si coincide con el `liveUserId` de ESTE
   * render. Si no, se cae a un estado seguro: sin dueño, sin planes, sin store
   * y en espera. `unavailable` se conserva porque no depende de la identidad
   * (es un build sin clave) y taparlo mentiría sobre por qué no hay compras.
   */
  const publishedOwner = storeIdentityIsCurrent({
    isLive: live.isLive,
    liveUserId,
    publishedOwner: identifiedUserId
  })
    ? liveUserId
    : null;
  const publicPhase: RevenueCatPhase = publishedOwner
    ? phase
    : phase === "unavailable"
      ? "unavailable"
      : liveUserId && live.isLive
        ? "configuring"
        : "waiting_for_session";

  const value = useMemo<RevenueCatContextValue>(
    () => ({
      phase: publicPhase,
      plans: publishedOwner ? plans : [],
      storeIsPro: publishedOwner ? storeIsPro : false,
      identifiedUserId: publishedOwner,
      offeringId: publishedOwner ? offeringId : null,
      purchase,
      restore,
      presentCustomerCenter,
      retry,
      refreshCustomerInfo,
      trackPaywallImpression
    }),
    [
      publicPhase,
      publishedOwner,
      plans,
      offeringId,
      presentCustomerCenter,
      purchase,
      refreshCustomerInfo,
      restore,
      retry,
      storeIsPro,
      trackPaywallImpression
    ]
  );

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
}

export function useRevenueCat(): RevenueCatContextValue {
  return useContext(RevenueCatContext);
}
