import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { router, useFocusEffect } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { createOwnerGates, runExclusive } from "@/domain/exclusive";
import { useLiveApp } from "@/hooks/useLiveApp";
import {
  defaultNativePlan,
  applyStoreAnswer,
  backendConfirmsStorePurchase,
  emptyPurchaseSession,
  entitlementBelongsTo,
  safeEntitlement,
  nativeActivationPhase,
  nativePrimaryAction,
  nativeSubscriptionManagement,
  ownedValue,
  publishOwnedValue,
  purchaseSessionForOwner,
  readOwnedValue,
  storeAnswerClearsPurchaseGuard,
  type NativeActivationPhase,
  type NativePrimaryAction,
  type NativePurchaseSession,
  type NativeStoreAnswer,
  type NativeStorePlan,
  type NativeStoreTrial,
  type OwnedValue
} from "@/domain/nativeCommerce";
import { purchaseGuardBlocks } from "@/domain/purchaseGuard";
import { appApi } from "@/services/appRefs";
import { clearPurchaseGuard, readPurchaseGuard, storePurchaseGuard } from "@/services/purchaseGuard";
import { useRevenueCat } from "@/services/revenuecat/RevenueCatProvider";
import { A } from "@/onboarding/assets";
import { CTA } from "@/onboarding/components/CTA";
import { Screen } from "@/onboarding/components/Screen";
import { Body, Caption, Eyebrow } from "@/onboarding/components/Type";
import { font, GUTTER, orbita } from "@/onboarding/theme";

const PRIVACY_URL = "https://orbitaastrologia.xyz/privacy";
const TERMS_URL = "https://orbitaastrologia.xyz/terminos";
const BACKEND_ACTIVATION_WAIT_MS = 20_000;

type ActionPhase = "idle" | "purchasing" | "restoring" | "checking";

/** Paywall nativo propio: la oferta y todos sus importes llegan de la tienda. */
export function PlusPaywallScreen() {
  const { isLive, auth } = useLiveApp();
  /**
   * El entitlement se pide SÓLO con la sesión viva…
   *
   * Sin el `skip`, la query se montaba con la sesión de A y su resultado seguía
   * publicado durante la ventana A → B.
   */
  const rawEntitlement = useQuery(appApi.subscriptions.getCurrent, isLive ? {} : "skip");
  /**
   * …y además se CORRELACIONA con el dueño de Clerk.
   *
   * El `skip` no alcanza: Convex conserva el último valor mientras la nueva
   * suscripción resuelve, así que el plan de A sigue publicado durante uno o
   * varios renders de B. Todo lo que decide plata en esta pantalla —el botón
   * primario, Restaurar, la oferta, la impresión y el marcador de compra— sale
   * de `entitlement`, que es `undefined` (o sea: validando) mientras no se pueda
   * afirmar que el resultado es de ESTA cuenta.
   */
  const clerkOwner = auth?.isSignedIn ? auth.userId ?? null : null;
  const entitlement = safeEntitlement(rawEntitlement, clerkOwner);
  const entitlementResuelto = entitlement !== undefined;
  const revenueCat = useRevenueCat();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  /**
   * Estado de pantalla CON DUEÑO.
   *
   * El `finally` de una acción de A, el mensaje de su error y el timer de su
   * activación llegan después de que Clerk pudo pasar a B. Publicados con el
   * dueño capturado y leídos sólo para el dueño vigente, nada de A se ve en B.
   */
  const [actionSlot, setActionSlot] = useState<OwnedValue<ActionPhase>>(() =>
    ownedValue(null, "idle")
  );
  const [noticeSlot, setNoticeSlot] = useState<OwnedValue<string | null>>(() =>
    ownedValue(null, null)
  );
  const [activationDelayed, setActivationDelayed] = useState<OwnedValue<boolean>>(() =>
    ownedValue(null, false)
  );
  /**
   * Estado de compra CON DUEÑO.
   *
   * Antes eran tres estados sueltos que no sabían de quién eran: en un cambio
   * A → B, el `guardLoaded: true` de A habilitaba "comprar" en el primer render
   * de B —antes de leer el marcador de B— y una continuación async de A podía
   * publicar o limpiar el estado de B. Con el dueño adentro, las dos cosas son
   * inexpresables. `purchaseReceived` sigue siendo presentación pura: nombra la
   * espera del webhook y nunca abre contenido.
   */
  const [session, setSession] = useState<NativePurchaseSession>(() => emptyPurchaseSession(null));
  // Mutation, no action: el backend deja el trabajo escrito en su transacción.
  // Una action pública podía morir antes de crear nada y este pedido se perdía.
  const reconcile = useMutation(appApi.subscriptions.requestStoreReconcile);
  // Un `useState` de "ocupado" se aplica en el render SIGUIENTE: dos toques del
  // mismo tick lo leen los dos en falso. El candado tiene que ser el mismo
  // objeto que ven los dos toques.
  //
  // Y es POR DUEÑO: era uno solo para la pantalla, así que una compra de A en
  // vuelo dejaba a B sin poder tocar nada, y el `finally` de A liberaba el
  // candado que podía estar usando B. Cada cuenta tiene el suyo.
  const gates = useRef(createOwnerGates()).current;

  const selected = useMemo(
    () => revenueCat.plans.find((plan) => plan.id === selectedPlan) ?? null,
    [revenueCat.plans, selectedPlan]
  );

  useEffect(() => {
    if (selectedPlan && revenueCat.plans.some((plan) => plan.id === selectedPlan)) return;
    setSelectedPlan(defaultNativePlan(revenueCat.plans));
  }, [revenueCat.plans, selectedPlan]);

  /**
   * Foco REAL de la pantalla.
   *
   * Que el componente esté montado no significa que alguien lo esté viendo: en
   * un stack, la pantalla anterior sigue montada debajo. La impresión se cuenta
   * por VISTA enfocada, así que al perder el foco se olvida la última contada y
   * volver a entrar cuenta de nuevo.
   */
  const impresionRef = useRef<string | null>(null);
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        impresionRef.current = null;
      };
    }, [])
  );

  const identifiedUserId = revenueCat.identifiedUserId;
  // La sesión SIEMPRE se lee a través del dueño vigente: un render con la
  // cuenta nueva no puede ver el estado de la anterior ni por un frame.
  const owned = purchaseSessionForOwner(session, identifiedUserId);
  const action = readOwnedValue(actionSlot, identifiedUserId, "idle");
  const notice = readOwnedValue(noticeSlot, identifiedUserId, null);
  const delayed = readOwnedValue(activationDelayed, identifiedUserId, false);
  /**
   * Dueño VIGENTE, en una ref.
   *
   * Las continuaciones asíncronas capturan el closure del render en el que
   * arrancaron: comparar contra `identifiedUserId` de ese render decía "sigo
   * siendo yo" aunque Clerk ya hubiera pasado a B. La ref es lo único que ve el
   * presente. Se espeja durante el render a propósito: es un valor derivado, no
   * un efecto.
   */
  const ownerRef = useRef<string | null>(identifiedUserId);
  ownerRef.current = identifiedUserId;
  /** El candado de ESTE dueño. B estrena el suyo; el `finally` de A libera el de A. */
  const gate = gates.for(identifiedUserId);

  /** Publica un aviso/estado sólo si su dueño sigue siendo el vigente. */
  const setNotice = useCallback(
    (owner: string | null, text: string | null) =>
      setNoticeSlot((previous) => publishOwnedValue(previous, owner, ownerRef.current, text)),
    []
  );
  const setAction = useCallback(
    (owner: string | null, phase: ActionPhase) =>
      setActionSlot((previous) => publishOwnedValue(previous, owner, ownerRef.current, phase)),
    []
  );

  // Al montar y al cambiar de cuenta se lee el marcador persistido ANTES de
  // habilitar nada. Sin identidad no hay marcador que leer ni compra posible.
  useEffect(() => {
    let alive = true;
    setSession(emptyPurchaseSession(identifiedUserId));
    if (!identifiedUserId) {
      setSession({ ...emptyPurchaseSession(null), guard: "clear" });
      return;
    }
    void readPurchaseGuard(identifiedUserId).then((read) => {
      if (!alive) return;
      setSession((previous) => {
        // Llegó tarde y la cuenta ya cambió: se descarta.
        if (previous.userId !== identifiedUserId) return previous;
        const blocks = purchaseGuardBlocks(read);
        return {
          ...previous,
          guard: blocks ? "blocked" : "clear",
          lastOutcome: blocks ? "ambiguous" : previous.lastOutcome
        };
      });
    });
    return () => {
      alive = false;
    };
  }, [identifiedUserId]);

  /**
   * Aplica una respuesta de la tienda para un dueño concreto.
   *
   * ## Lo que cambió, y por qué importa
   *
   * La decisión de BORRAR el marcador persistido sale de la respuesta capturada
   * (`storeAnswerClearsPurchaseGuard`), no de leer una bandera escrita dentro
   * del updater de `setSession`. Ese patrón dependía de cuándo React corre el
   * updater: con updater inmediato, un `store_confirmed` sobre una sesión que
   * arrancó `clear` borraba el marcador ANTES de que Convex confirmara —con el
   * cargo hecho—; con updater diferido, la cancelación y el restore vacío no lo
   * borraban nunca.
   *
   * ## El orden también importa
   *
   * Primero el disco, después la sesión. Si el borrado falla, la sesión NO se
   * limpia: la pantalla se queda en Restaurar en vez de habilitar una recompra
   * sobre un marcador que sigue vivo.
   *
   * El marcador es POR CUENTA, así que una respuesta definitiva tardía de A
   * puede limpiar el de A aunque la pantalla ya sea de B. Lo que no puede es
   * tocar el estado de B: de eso se encarga `applyStoreAnswer`.
   */
  const answerStore = useCallback(
    async (userId: string | null, answer: NativeStoreAnswer): Promise<boolean> => {
      const debeLimpiar = storeAnswerClearsPurchaseGuard(answer);
      if (debeLimpiar && userId) {
        try {
          await clearPurchaseGuard(userId);
        } catch {
          // No se pudo retirar la persistencia: no se afloja el bloqueo.
          setSession((previous) => applyStoreAnswer(previous, userId, "purchase_ambiguous"));
          return false;
        }
      }
      setSession((previous) => applyStoreAnswer(previous, userId, answer));
      return true;
    },
    []
  );

  /**
   * Pide la reparación y NO espera su resultado.
   *
   * Lo que devuelve es "quedó encolado", no "así está tu acceso": el acceso
   * llega por `subscriptions.getCurrent`, que es reactiva. Antes esto esperaba
   * el resultado de una action que podía morir sin dejar trabajo escrito.
   */
  const askBackendToReconcile = useCallback(async () => {
    try {
      return await reconcile({});
    } catch {
      return null;
    }
  }, [reconcile]);

  const backendIsPro = entitlement?.isPro;
  // La tienda puede confirmar el acceso por dos caminos: la compra que acaba de
  // ocurrir acá, o el `CustomerInfo` que el SDK ya tenía (reinstalación,
  // remonte de la pantalla, listener de RevenueCat).
  const storeConfirmed = owned.purchaseReceived || revenueCat.storeIsPro;
  const activation = nativeActivationPhase({ backendIsPro, storeConfirmed });

  /**
   * Impresión del paywall: UNA por vista enfocada, dueño y oferta.
   *
   * La analítica salía de la carga del Offering en el provider, que envuelve la
   * app entera: se contaba una impresión en el arranque de CUALQUIER sesión
   * —con la persona en la Home, sin haber visto nunca esta pantalla— y otra por
   * cada reintento de carga.
   *
   * Y no alcanza con que la pantalla esté montada: la oferta se dibuja SÓLO con
   * el entitlement correlacionado y `activation === "idle"`. Con el acceso
   * confirmado se muestra "Órbita Plus está activo"; con una compra ya aceptada
   * por la tienda, la tarjeta de activación. Contar cualquiera de esas dos como
   * impresión de paywall infla la métrica con gente que ya pagó — y contarla
   * mientras el plan todavía se valida la infla con vistas que no ocurrieron.
   */
  const paywallOwner = revenueCat.identifiedUserId;
  const paywallOfferingId = revenueCat.offeringId;
  const offeringVisible =
    focused && entitlementResuelto && activation === "idle" && revenueCat.phase === "ready";
  const trackImpression = revenueCat.trackPaywallImpression;
  useEffect(() => {
    if (!offeringVisible || !paywallOwner || !paywallOfferingId) return;
    const clave = `${paywallOwner}:${paywallOfferingId}`;
    if (impresionRef.current === clave) return;
    let alive = true;
    // Se marca emitida sólo si la llamada REALMENTE salió: el método del
    // provider revalida dueño y generación, y descarta la de una cuenta vieja.
    void trackImpression().then((emitida) => {
      if (alive && emitida) impresionRef.current = clave;
    });
    return () => {
      alive = false;
    };
  }, [offeringVisible, paywallOwner, paywallOfferingId, trackImpression]);

  /**
   * Convex confirmó el acceso DE LA TIENDA: recién ahí el marcador se levanta.
   *
   * `isPro` a secas no alcanza: alguien con Stripe activo lo tiene desde el
   * primer día, y usarlo acá dejaría la compra de Apple sin confirmar y el
   * botón "comprar" habilitado con un cargo en el aire.
   */
  useEffect(() => {
    // SÓLO la confirmación que incluye a RevenueCat. `isPro` a secas no
    // alcanza: alguien con Stripe activo lo tiene desde el primer día.
    if (!backendConfirmsStorePurchase(entitlement)) return;
    const userId = identifiedUserId;
    if (!userId) return;
    // Y SÓLO si el servidor calculó esa confirmación para ESTA cuenta: durante
    // un cambio A → B la query conserva el valor de A, y con él se levantaba el
    // marcador de compra de B.
    if (!entitlementBelongsTo(entitlement, userId)) return;
    let alive = true;
    // La sesión se limpia DESPUÉS de que la persistencia se retiró. Si el
    // borrado falla, el bloqueo se conserva y no se habilita la recompra.
    void clearPurchaseGuard(userId)
      .then(() => {
        if (!alive) return;
        setSession((previous) =>
          previous.userId === userId
            ? { ...previous, guard: "clear", lastOutcome: "none" }
            : previous
        );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [entitlement, identifiedUserId]);

  useEffect(() => {
    // El timer también tiene dueño: uno armado para A no puede pintar el aviso
    // demorado en la pantalla de B.
    const owner = identifiedUserId;
    const publicar = (valor: boolean) =>
      setActivationDelayed((previous) => publishOwnedValue(previous, owner, ownerRef.current, valor));
    if (activation !== "activating") {
      publicar(false);
      return;
    }
    publicar(false);
    const timeout = setTimeout(() => publicar(true), BACKEND_ACTIVATION_WAIT_MS);
    return () => clearTimeout(timeout);
  }, [activation, identifiedUserId]);

  const busy = action !== "idle";
  // Restaurar toca la tienda y puede revelar una compra: exige la identidad de
  // la tienda Y el plan validado para ESTA cuenta. Con el entitlement de A
  // arrastrado, restaurar bajo B era una acción comercial sobre datos ajenos.
  const restoreReady = revenueCat.identifiedUserId !== null && entitlementResuelto;
  const primary = nativePrimaryAction({
    offeringReady: revenueCat.phase === "ready" && Boolean(selected),
    backendIsPro,
    storeConfirmed,
    busy,
    lastOutcome: owned.lastOutcome,
    guardLoaded: owned.guard !== "loading"
  });

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/perfil");
  };

  /**
   * ¿El dueño que pidió esta acción sigue siendo el de la pantalla?
   *
   * Se lee de la ref, no del closure: una compra de A que resuelve después del
   * cambio a B no puede disparar `requestStoreReconcile` bajo la sesión de B ni
   * consumirle su cupo. Como el backend deriva la cuenta de `ctx.auth`, pedir
   * la reparación "de A" desde la sesión de B es imposible sin falsear la
   * identidad: la petición vieja simplemente se descarta.
   */
  const stillOwner = (userId: string | null) => userId !== null && userId === ownerRef.current;

  /**
   * Deja el marcador puesto en DISCO y en MEMORIA antes de tocar la tienda.
   *
   * Devuelve `false` si el disco falló: en ese caso no se toca la tienda. El
   * marcador es justamente lo que evita el cargo duplicado, así que abrir la
   * hoja sin él sería empezar un cobro sin red. Y como no hubo cargo, tampoco se
   * afirma que lo haya: el estado no se ensucia con "ambiguo".
   */
  const armStoreGuard = useCallback(
    async (userId: string | null): Promise<boolean> => {
      if (userId) {
        try {
          await storePurchaseGuard(userId, Date.now());
        } catch {
          return false;
        }
      }
      await answerStore(userId, "purchase_started");
      return true;
    },
    [answerStore]
  );

  const purchase = async () => {
    if (primary !== "purchase" || !selected) return;
    const userId = identifiedUserId;
    await runExclusive(gate, async () => {
      setNotice(userId, null);
      setAction(userId, "purchasing");
      try {
        // El marcador se escribe ANTES de abrir la hoja de la tienda —en disco y
        // en memoria—: si la app muere ahí, al volver la pantalla arranca en
        // Restaurar y no en comprar.
        if (!(await armStoreGuard(userId))) {
          setNotice(userId, "No pudimos preparar la compra en este teléfono. Probá de nuevo.");
          return;
        }
        const result = await revenueCat.purchase(selected.id);
        if (result === "cancelled") {
          // Cancelación demostrada por la tienda: no hubo cargo.
          const limpio = await answerStore(userId, "purchase_cancelled");
          setNotice(
            userId,
            limpio
              ? "La compra se canceló. No se hizo ningún cargo."
              : "La compra se canceló, pero no pudimos limpiar el estado local. Probá Restaurar."
          );
          return;
        }
        if (result === "inactive") {
          await answerStore(userId, "purchase_ambiguous");
          setNotice(userId, "La tienda no confirmó acceso a Órbita Plus. No vuelvas a comprar; probá Restaurar.");
          if (stillOwner(userId)) void askBackendToReconcile();
          return;
        }
        // La tienda cobró. El marcador NO se levanta todavía: falta que Convex
        // lo confirme. Se le pide la lectura autoritativa sin esperar el webhook.
        await answerStore(userId, "store_confirmed");
        if (stillOwner(userId)) void askBackendToReconcile();
      } catch {
        // No se sabe si hubo cargo. El marcador queda puesto y sobrevive al
        // desmontaje: repetir la compra es el camino al cargo duplicado.
        await answerStore(userId, "purchase_ambiguous");
        setNotice(userId, "No pudimos confirmar el resultado. No vuelvas a comprar; probá Restaurar.");
        if (stillOwner(userId)) void askBackendToReconcile();
      } finally {
        setAction(userId, "idle");
      }
    });
  };

  const restore = async () => {
    if (!restoreReady) return;
    const userId = identifiedUserId;
    await runExclusive(gate, async () => {
      setNotice(userId, null);
      setAction(userId, "restoring");
      try {
        // El marcador se pone ANTES de restaurar, en disco Y en memoria.
        //
        // Sólo estaba el disco: si `restore` tiraba, la pantalla mostraba el
        // error pero la SESIÓN seguía limpia, así que el botón primario volvía a
        // ser "comprar" con una compra posiblemente viva y ya revelada. El disco
        // recién frenaba en el próximo montaje. Ahora las dos cosas bloquean
        // juntas: la misma pantalla y el remonte.
        if (!(await armStoreGuard(userId))) {
          setNotice(userId, "No pudimos preparar la restauración en este teléfono. Probá de nuevo.");
          return;
        }
        const result = await revenueCat.restore();
        if (result === "inactive") {
          // Respuesta definitiva de la tienda: no hubo compra. Se levanta el
          // bloqueo para no dejar sin comprar a quien nunca fue cobrado.
          const limpio = await answerStore(userId, "restore_empty");
          setNotice(
            userId,
            limpio
              ? "No encontramos una compra activa para esta cuenta de la tienda."
              : "No encontramos una compra activa, pero no pudimos limpiar el estado local."
          );
          if (stillOwner(userId)) void askBackendToReconcile();
          return;
        }
        // Restore activo: hay compra, pero el marcador espera a Convex.
        await answerStore(userId, "store_confirmed");
        if (stillOwner(userId)) void askBackendToReconcile();
      } catch {
        // Restaurar tiró: no se sabe si esta cuenta tiene una compra viva. La
        // salida NO puede volver a ser comprar — ése es el camino al cargo
        // duplicado— así que el bloqueo se mantiene y la acción sigue siendo
        // Restaurar, acá y después de remontar.
        await answerStore(userId, "purchase_ambiguous");
        setNotice(userId, "No pudimos restaurar tus compras. Revisá la conexión y probá de nuevo.");
        if (stillOwner(userId)) void askBackendToReconcile();
      } finally {
        setAction(userId, "idle");
      }
    });
  };

  const retryActivation = async () => {
    const userId = identifiedUserId;
    await runExclusive(gate, async () => {
      setNotice(userId, null);
      setAction(userId, "checking");
      try {
        // La comprobación demorada empieza por el backend: si el webhook se
        // perdió, la lectura REST lo repara sin depender de la tienda local.
        await askBackendToReconcile();
        const active = await revenueCat.refreshCustomerInfo();
        if (!active) {
          // `getCustomerInfo` puede venir del caché del SDK: no prueba que no
          // haya compra, así que la salida sigue siendo Restaurar.
          await answerStore(userId, "recheck_empty");
          setNotice(userId, "La tienda todavía no informa una compra activa. Probá Restaurar.");
        }
      } catch {
        setNotice(userId, "No pudimos comprobar la compra. Tu acceso no se perdió; probá de nuevo en un momento.");
      } finally {
        setAction(userId, "idle");
      }
    });
  };

  const openCustomerCenter = async () => {
    const userId = identifiedUserId;
    await runExclusive(gate, async () => {
      setNotice(userId, null);
      try {
        await revenueCat.presentCustomerCenter();
      } catch {
        setNotice(userId, "No pudimos abrir la gestión de tu suscripción. Probá de nuevo desde Perfil.");
      }
    });
  };

  return (
    <Screen bg={A.paymentBg} bgOpacity={0.9} wash={0.64}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.nav}>
          <Pressable onPress={leave} hitSlop={12} style={styles.navButton} accessibilityRole="button" accessibilityLabel="Volver">
            <Text style={styles.chevron}>‹</Text>
          </Pressable>
          <Pressable
            onPress={() => void restore()}
            disabled={busy || !restoreReady}
            hitSlop={12}
            style={styles.restoreButton}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy || !restoreReady }}
          >
            <Text style={[styles.restore, (busy || !restoreReady) && styles.dimmed]}>
              {restoreReady ? "Restaurar" : "Preparando…"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.brandRow}>
          <Text style={styles.brand}>Órbita</Text>
          <View style={styles.plusBadge}>
            <Text style={styles.plusText}>PLUS</Text>
          </View>
        </View>

        <Eyebrow style={styles.eyebrow}>TU CARTA, SIN CORTES</Eyebrow>
        <Text style={styles.hero}>Tu cielo,{"\n"}con más profundidad.</Text>
        <Body style={styles.sub}>Abrí las capas de tu carta que dependen de Órbita Plus.</Body>

        {activation === "confirmed" ? (
          <View style={styles.statusCard} accessibilityLiveRegion="polite">
            <Text style={styles.statusTitle}>Órbita Plus está activo.</Text>
            <Body style={styles.statusBody}>Tus casas, tus aspectos y tu cupo Plus ya están disponibles.</Body>
            {/* La salida de la tienda depende de si RevenueCat está ACTIVO, no
                de quién gane el rango: con Stripe ganando por fecha, esto
                escondía el Customer Center de una compra de Apple viva. */}
            {nativeSubscriptionManagement(entitlement).showStoreCenter ? (
              <Pressable onPress={() => void openCustomerCenter()} accessibilityRole="button" style={styles.inlineAction}>
                <Text style={styles.inlineActionText}>GESTIONAR SUSCRIPCIÓN</Text>
              </Pressable>
            ) : null}
          </View>
        ) : !entitlementResuelto ? (
          // Plan todavía sin validar para ESTA cuenta: estado neutral. Ni la
          // oferta ni sus precios: con el entitlement de A arrastrado, B veía
          // una oferta calculada sobre el plan de otra persona.
          <View style={styles.statusCard} accessibilityLiveRegion="polite">
            <Text style={styles.statusTitle}>Estamos comprobando tu plan…</Text>
          </View>
        ) : activation === "idle" ? (
          <OfferingSection
            phase={revenueCat.phase}
            plans={revenueCat.plans}
            selectedPlan={selectedPlan}
            onSelect={setSelectedPlan}
            onRetry={() => void revenueCat.retry().catch(() => undefined)}
          />
        ) : null}

        <View style={styles.benefitsCard}>
          <Text style={styles.sectionTitle}>Qué abre Plus</Text>
          <Benefit text="Las doce casas de tu carta natal." />
          <Benefit text="Los aspectos entre los puntos de tu carta." />
          <Benefit text="Cinco preguntas por día en El Umbral, en vez de tres." />
        </View>

        {activation === "activating" ? (
          <View style={styles.syncCard} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Text style={styles.syncTitle}>Tu compra está confirmada.</Text>
            <Caption style={styles.syncCopy}>
              {delayed
                ? "Todavía estamos activando el acceso en Órbita. No vuelvas a comprar: podés comprobarlo de nuevo o seguir con Free mientras sincroniza."
                : "Estamos activando tu acceso en Órbita. Puede demorar unos segundos."}
            </Caption>
            {delayed ? (
              <Pressable
                onPress={() => void retryActivation()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                style={styles.inlineAction}
              >
                <Text style={[styles.inlineActionText, busy && styles.dimmed]}>COMPROBAR DE NUEVO</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {notice ? (
          <Caption accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>
            {notice}
          </Caption>
        ) : null}

        <View style={styles.legal}>
          <Caption>
            {selected?.trial
              ? `La prueba de ${selected.trial.label.replace(" gratis", "")} no tiene costo y, si no la cancelás antes de que termine, sigue como suscripción mensual con renovación automática. Podés cancelarla desde la gestión de tu cuenta; el precio y las condiciones finales son los que muestra la tienda antes de confirmar.`
              : "Suscripción mensual con renovación automática. Podés cancelarla desde la gestión de tu cuenta; el precio y las condiciones finales son los que muestra la tienda antes de confirmar."}
          </Caption>
          <View style={styles.legalLinks}>
            <Pressable onPress={() => Linking.openURL(TERMS_URL)} accessibilityRole="link" hitSlop={8}>
              <Text style={styles.legalLink}>Términos</Text>
            </Pressable>
            <Text style={styles.legalDot}>·</Text>
            <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link" hitSlop={8}>
              <Text style={styles.legalLink}>Privacidad</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <CTA
          label={primaryLabel({
            action,
            primary,
            activation,
            entitlementResolved: entitlementResuelto,
            trial: selected?.trial ?? null,
            phase: revenueCat.phase
          })}
          onPress={
            primary === "leave"
              ? leave
              : primary === "restore"
                ? () => void restore()
                : () => void purchase()
          }
          disabled={primary === "wait" || (primary === "restore" && !restoreReady)}
        />
        <Pressable
          onPress={leave}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          style={styles.freeButton}
        >
          <Text style={[styles.freeText, busy && styles.dimmed]}>SEGUIR CON ÓRBITA FREE</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function OfferingSection({
  phase,
  plans,
  selectedPlan,
  onSelect,
  onRetry
}: {
  phase: ReturnType<typeof useRevenueCat>["phase"];
  plans: readonly NativeStorePlan[];
  selectedPlan: string | null;
  onSelect: (id: string) => void;
  onRetry: () => void;
}) {
  if (phase === "ready") {
    return (
      <View style={styles.planCard} accessibilityRole="radiogroup" accessibilityLabel="Elegí un plan de Órbita Plus">
        {plans.map((plan, index) => (
          <View key={plan.id}>
            {index > 0 ? <View style={styles.planDivider} /> : null}
            <PlanRow plan={plan} selected={plan.id === selectedPlan} onPress={() => onSelect(plan.id)} />
          </View>
        ))}
      </View>
    );
  }

  const loading = phase === "waiting_for_session" || phase === "configuring" || phase === "loading_offering";
  return (
    <View style={styles.statusCard} accessibilityLiveRegion="polite">
      <Text style={styles.statusTitle}>
        {loading
          ? "Cargando los planes de la tienda…"
          : phase === "unavailable"
            ? "Las compras no están disponibles en este build."
            : phase === "no_offering"
              ? "No hay un plan disponible en la tienda ahora."
              : "No pudimos cargar los planes de la tienda."}
      </Text>
      {!loading && phase !== "unavailable" ? (
        <Pressable onPress={onRetry} accessibilityRole="button" style={styles.inlineAction}>
          <Text style={styles.inlineActionText}>REINTENTAR</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PlanRow({ plan, selected, onPress }: { plan: NativeStorePlan; selected: boolean; onPress: () => void }) {
  // La prueba se nombra en el mismo anuncio que el precio: quien usa VoiceOver
  // no puede depender de que el badge quede visualmente al lado.
  const trialSuffix = plan.trial ? `, ${plan.trial.label} y después` : ",";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${plan.label}${trialSuffix} ${plan.price} ${plan.cadence}`}
      style={styles.planRow}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      <View style={styles.planCopy}>
        <Text style={styles.planLabel}>{plan.label}</Text>
        {plan.trial ? (
          <View style={styles.trialBadge}>
            <Text style={styles.trialText}>{plan.trial.label.toUpperCase()}</Text>
          </View>
        ) : null}
        {plan.comparison ? <Caption>{plan.comparison}</Caption> : null}
      </View>
      <View style={styles.priceCopy}>
        <Text style={styles.price}>{plan.price}</Text>
        <Caption>{plan.cadence}</Caption>
      </View>
    </Pressable>
  );
}

function Benefit({ text }: { text: string }) {
  return (
    <View style={styles.benefitRow}>
      <Text style={styles.tick}>✓</Text>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

/**
 * Etiqueta del botón primario.
 *
 * "PREPARANDO LA OFERTA…" sólo se dice mientras algo se está preparando de
 * verdad. Con la tienda apagada, sin Offering o con un error de carga, la
 * espera no termina nunca y anunciarla como preparación es mentir.
 */
function primaryLabel({
  action,
  primary,
  activation,
  entitlementResolved,
  trial,
  phase
}: {
  action: ActionPhase;
  primary: NativePrimaryAction;
  activation: NativeActivationPhase;
  entitlementResolved: boolean;
  trial: NativeStoreTrial | null;
  phase: ReturnType<typeof useRevenueCat>["phase"];
}): string {
  if (action === "purchasing") return "CONFIRMANDO CON LA TIENDA…";
  if (action === "restoring") return "RESTAURANDO…";
  if (action === "checking") return "COMPROBANDO CON LA TIENDA…";

  if (primary === "leave") return "VOLVER A ÓRBITA";
  if (primary === "restore") return "RESTAURAR MI COMPRA";
  // La duración de la prueba viene de la tienda; sin prueba elegible el botón
  // no la nombra.
  if (primary === "purchase") {
    return trial ? `EMPEZAR ${trial.label.toUpperCase()}` : "DESBLOQUEAR ÓRBITA PLUS";
  }

  if (activation === "activating") return "ACTIVANDO ÓRBITA PLUS…";
  if (!entitlementResolved) return "CARGANDO TU PLAN…";
  if (phase === "unavailable") return "COMPRAS NO DISPONIBLES";
  if (phase === "no_offering") return "SIN OFERTA DISPONIBLE";
  if (phase === "error") return "NO PUDIMOS CARGAR LA OFERTA";
  return "PREPARANDO LA OFERTA…";
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 190, paddingHorizontal: GUTTER },
  nav: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 52 },
  navButton: { alignItems: "flex-start", justifyContent: "center", minHeight: 44, minWidth: 44 },
  restoreButton: { alignItems: "flex-end", justifyContent: "center", minHeight: 44, minWidth: 88 },
  chevron: { color: orbita.bone, fontFamily: font.sans, fontSize: 34, lineHeight: 38 },
  restore: { color: orbita.boneSoft, fontFamily: font.sansMed, fontSize: 14, textDecorationLine: "underline" },
  dimmed: { opacity: 0.45 },
  brandRow: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 8 },
  brand: { color: orbita.bone, fontFamily: font.serif, fontSize: 26 },
  plusBadge: { backgroundColor: orbita.copper, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  plusText: { color: orbita.ink, fontFamily: font.sansBold, fontSize: 10, letterSpacing: 1 },
  eyebrow: { marginTop: 34 },
  hero: { color: orbita.bone, fontFamily: font.serif, fontSize: 39, lineHeight: 43, marginTop: 12 },
  sub: { marginTop: 12 },
  planCard: {
    backgroundColor: "rgba(18,20,26,0.9)",
    borderColor: orbita.lineStrong,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 28,
    overflow: "hidden"
  },
  planRow: { alignItems: "center", flexDirection: "row", minHeight: 78, paddingHorizontal: 16, paddingVertical: 14 },
  planDivider: { backgroundColor: orbita.line, height: 1, marginHorizontal: 16 },
  radio: { alignItems: "center", borderColor: orbita.lineStrong, borderRadius: 10, borderWidth: 1, height: 20, justifyContent: "center", width: 20 },
  radioSelected: { borderColor: orbita.copperSoft },
  radioDot: { backgroundColor: orbita.copperSoft, borderRadius: 5, height: 10, width: 10 },
  planCopy: { flex: 1, marginLeft: 12 },
  trialBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(196,106,58,0.18)",
    borderColor: orbita.copper,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  trialText: { color: orbita.copperSoft, fontFamily: font.sansBold, fontSize: 10, letterSpacing: 0.7 },
  planLabel: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 15 },
  priceCopy: { alignItems: "flex-end", marginLeft: 12 },
  price: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 17 },
  statusCard: { backgroundColor: "rgba(18,20,26,0.9)", borderColor: orbita.lineStrong, borderRadius: 18, borderWidth: 1, marginTop: 28, padding: 18 },
  statusTitle: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 15, lineHeight: 21 },
  statusBody: { marginTop: 8 },
  inlineAction: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44, paddingTop: 10 },
  inlineActionText: { color: orbita.copperSoft, fontFamily: font.sansBold, fontSize: 12, letterSpacing: 0.8, textDecorationLine: "underline" },
  benefitsCard: { backgroundColor: "rgba(18,20,26,0.78)", borderColor: orbita.line, borderRadius: 18, borderWidth: 1, marginTop: 18, padding: 18 },
  sectionTitle: { color: orbita.bone, fontFamily: font.serif, fontSize: 22, marginBottom: 8 },
  benefitRow: { alignItems: "flex-start", flexDirection: "row", gap: 10, marginTop: 11 },
  tick: { color: orbita.copperSoft, fontFamily: font.sansBold, fontSize: 14 },
  benefitText: { color: orbita.boneSoft, flex: 1, fontFamily: font.sans, fontSize: 14, lineHeight: 20 },
  syncCard: { backgroundColor: "rgba(196,106,58,0.12)", borderColor: orbita.copper, borderRadius: 14, borderWidth: 1, marginTop: 18, padding: 16 },
  syncTitle: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 14 },
  syncCopy: { marginTop: 7 },
  notice: { color: orbita.boneSoft, marginTop: 16 },
  legal: { marginTop: 24 },
  legalLinks: { alignItems: "center", flexDirection: "row", gap: 9, marginTop: 10 },
  legalLink: { color: orbita.copperSoft, fontFamily: font.sansMed, fontSize: 12, textDecorationLine: "underline" },
  legalDot: { color: orbita.faint, fontFamily: font.sans, fontSize: 12 },
  footer: { backgroundColor: "rgba(10,11,14,0.96)", borderTopColor: orbita.line, borderTopWidth: 1, bottom: 0, left: 0, paddingBottom: 12, paddingHorizontal: GUTTER, paddingTop: 14, position: "absolute", right: 0 },
  freeButton: { alignItems: "center", justifyContent: "center", minHeight: 44, marginTop: 6 },
  freeText: { color: orbita.boneSoft, fontFamily: font.sansBold, fontSize: 12, letterSpacing: 0.8, textDecorationLine: "underline" }
});
