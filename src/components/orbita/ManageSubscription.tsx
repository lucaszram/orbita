import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native";

import { Body, Divider, Eyebrow, Note, Pill } from "@/components/orbita/kit";
import { createOwnerGates, runExclusive } from "@/domain/exclusive";
import {
  backendConfirmsStorePurchase,
  entitlementBelongsTo,
  safeEntitlement,
  nativeSubscriptionManagement,
  ownedValue,
  publishOwnedValue,
  readOwnedValue,
  type OwnedValue
} from "@/domain/nativeCommerce";
import { useLiveApp } from "@/hooks/useLiveApp";
import { clearPurchaseGuard, storePurchaseGuard } from "@/services/purchaseGuard";
import { appApi, proposedApi } from "@/services/appRefs";
import { useRevenueCat } from "@/services/revenuecat/RevenueCatProvider";
import { orbita } from "@/theme/orbita";

const SUPPORT_URL = "https://orbitaastrologia.xyz/support";

const MENSAJE_ACTIVANDO =
  "La tienda confirmó tu compra. Estamos activando el acceso en Órbita; no vuelvas a comprar.";

type CommerceState = { checkoutEnabled: boolean };
type UiState = "idle" | "opening" | "restoring" | "error";

/** Plan y gestión en la app nativa. La variante web hermana conserva Stripe. */
export function ManageSubscriptionBlock() {
  const { auth, isLive } = useLiveApp();
  /**
   * El entitlement se pide SÓLO con la sesión viva.
   *
   * Sin el `skip`, el resultado montado con la sesión de A seguía publicado
   * durante la ventana A → B: el bloque de plan mostraba el plan de A, y el
   * efecto que limpia el marcador de compra podía borrar el guard de B con una
   * confirmación que era de A.
   */
  const rawEntitlement = useQuery(appApi.subscriptions.getCurrent, isLive ? {} : "skip");
  const getWebOffer = useAction(proposedApi.getWebOffer);
  const createPortal = useAction(proposedApi.createPortalSession);
  // Mutation, no action: deja el trabajo de reparación escrito en la misma
  // transacción que consume el cupo. Una action pública es at-most-once y podía
  // morir antes de crear nada.
  const reconcile = useMutation(appApi.subscriptions.requestStoreReconcile);
  const revenueCat = useRevenueCat();
  const clerkOwner = auth?.isSignedIn ? auth.userId ?? null : null;
  /**
   * El entitlement CORRELACIONADO con el dueño de Clerk.
   *
   * El `skip` no alcanza: Convex conserva el último valor mientras la nueva
   * suscripción resuelve, así que el plan de A sigue publicado durante uno o
   * varios renders de B. Sin esto, B veía el plan de A y —peor— podía abrir el
   * portal o restaurar sobre esa lectura. `undefined` = validando, y `view`
   * responde `loading`: ninguna salida se ofrece.
   */
  const entitlement = safeEntitlement(rawEntitlement, clerkOwner);
  const management = nativeSubscriptionManagement(entitlement);
  const view = management.view;
  /**
   * DOS dueños, porque son dos comercios distintos.
   *
   * `clerkOwner` es la cuenta de Órbita: es la identidad que el backend deriva
   * de `ctx.auth` para crear la sesión del portal de Stripe, y no depende de
   * RevenueCat para nada. Atar el portal a `revenueCat.identifiedUserId` dejaba
   * a una suscripción de Stripe VIVA sin ninguna forma de cancelarla en cuanto
   * el SDK de la tienda estuviera `unavailable` (build sin clave, error de
   * configuración, plataforma sin compras): el botón estaba, y no hacía nada.
   *
   * `storeOwner` es la identidad del SDK de la tienda, y sólo gobierna lo que
   * toca la tienda: restaurar y el Customer Center. Esos sí exigen que
   * RevenueCat esté identificado con la misma cuenta.
   */
  const storeOwner = revenueCat.identifiedUserId;
  const [commerceEnabled, setCommerceEnabled] = useState<boolean | null | undefined>(undefined);
  /**
   * Estado y mensaje CON DUEÑO.
   *
   * Un restore de A que resuelve después de que Clerk pasó a B pintaba el
   * mensaje —y el `finally` con su estado— en la pantalla de B. Publicados con
   * el dueño capturado y leídos sólo para el vigente, eso es inexpresable.
   *
   * El dueño de la UI es el de CLERK: es el único que existe siempre. Si fuera
   * el de la tienda, el bloque entero se quedaría sin estado ni mensajes cuando
   * RevenueCat no está disponible, que es justo el caso en el que sólo hay
   * Stripe.
   */
  const [stateSlot, setStateSlot] = useState<OwnedValue<UiState>>(() => ownedValue(null, "idle"));
  const [messageSlot, setMessageSlot] = useState<OwnedValue<string | null>>(() =>
    ownedValue(null, null)
  );
  const state = readOwnedValue(stateSlot, clerkOwner, "idle");
  const message = readOwnedValue(messageSlot, clerkOwner, null);
  /**
   * Dueños VIGENTES, en refs.
   *
   * Las continuaciones capturan el closure del render en el que arrancaron:
   * comparar contra el `owner` de ese render decía "sigo siendo yo" aunque Clerk
   * ya hubiera pasado a B. Se espejan durante el render: son derivados.
   */
  const ownerRef = useRef<string | null>(clerkOwner);
  ownerRef.current = clerkOwner;
  const storeOwnerRef = useRef<string | null>(storeOwner);
  storeOwnerRef.current = storeOwner;

  /** Publica estado/mensaje sólo si su dueño sigue siendo el vigente. */
  const publicarEstado = useCallback(
    (producedBy: string | null, value: UiState) =>
      setStateSlot((previous) => publishOwnedValue(previous, producedBy, ownerRef.current, value)),
    []
  );
  const publicarMensaje = useCallback(
    (producedBy: string | null, value: string | null) =>
      setMessageSlot((previous) => publishOwnedValue(previous, producedBy, ownerRef.current, value)),
    []
  );
  // Gestionar y Restaurar son dos botones vivos a la vez. `state` se aplica en
  // el render siguiente, así que dos toques del mismo tick pasaban las dos
  // guardas y salían las dos acciones. El candado es UNO solo para el bloque:
  // abrir la gestión y restaurar tampoco pueden convivir.
  //
  // Y es POR DUEÑO: era uno global, así que una acción de A en vuelo dejaba a B
  // sin poder tocar nada, y el `finally` de A liberaba el candado de B.
  const gates = useRef(createOwnerGates()).current;
  const gate = gates.for(clerkOwner);
  const busy = state === "opening" || state === "restoring";

  const needsStripePortal = management.showStripePortal;
  useEffect(() => {
    if (!needsStripePortal) return;
    let alive = true;
    getWebOffer({})
      .then((result) => {
        if (alive) setCommerceEnabled((result as CommerceState).checkoutEnabled);
      })
      .catch(() => {
        if (alive) setCommerceEnabled(false);
      });
    return () => {
      alive = false;
    };
  }, [getWebOffer, needsStripePortal]);

  /**
   * Convex confirmó el acceso DE LA TIENDA para ESTE dueño.
   *
   * Recién ahí se retira el marcador y se dice "restaurada". `entitlement.isPro`
   * no alcanzaba: alguien con Stripe activo lo tiene desde el primer día, así
   * que Restaurar afirmaba una compra de Apple que nadie había confirmado.
   */
  useEffect(() => {
    if (!backendConfirmsStorePurchase(entitlement)) return;
    // El marcador es de la TIENDA y está guardado bajo su identidad.
    if (!storeOwner) return;
    // Y la confirmación tiene que haber sido calculada para ESTA cuenta: en un
    // cambio A → B la query conserva el valor de A durante uno o más renders.
    if (!entitlementBelongsTo(entitlement, storeOwner)) return;
    let alive = true;
    void clearPurchaseGuard(storeOwner)
      .then(() => {
        if (!alive) return;
        setMessageSlot((previous) =>
          previous.owner === storeOwner && previous.value === MENSAJE_ACTIVANDO
            ? publishOwnedValue(previous, storeOwner, ownerRef.current, "Tu compra está restaurada.")
            : previous
        );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [entitlement, storeOwner]);

  /**
   * Portal de Stripe, con el dueño de CLERK revalidado DOS veces.
   *
   * La URL del portal es una sesión de facturación de UNA cuenta. Si A la pide,
   * Clerk pasa a B y la respuesta llega tarde, abrirla le mostraría a B la
   * facturación de A. Se revalida justo antes de pedirla y otra vez justo antes
   * de abrirla; la URL de A nunca se reusa para B, se descarta.
   *
   * RevenueCat no entra en esta decisión: el portal es de Stripe.
   */
  const openStripePortal = useCallback(async () => {
    const dueño = clerkOwner;
    if (!dueño) return;
    await runExclusive(gate, async () => {
      publicarEstado(dueño, "opening");
      publicarMensaje(dueño, null);
      try {
        if (ownerRef.current !== dueño) return;
        const { url } = await createPortal({});
        // Segunda revalidación: el cambio de cuenta pudo ocurrir mientras
        // Stripe generaba la sesión.
        if (ownerRef.current !== dueño) return;
        await Linking.openURL(url);
        publicarEstado(dueño, "idle");
      } catch {
        publicarEstado(dueño, "error");
        publicarMensaje(dueño, "No pudimos abrir la gestión de tu suscripción. Probá de nuevo.");
      }
    });
  }, [clerkOwner, createPortal, gate, publicarEstado, publicarMensaje]);

  /** El Customer Center SÍ es de la tienda: exige la identidad de RevenueCat. */
  const openCustomerCenter = useCallback(async () => {
    const dueño = clerkOwner;
    const dueñoTienda = storeOwner;
    if (!dueño || !dueñoTienda) return;
    await runExclusive(gate, async () => {
      publicarEstado(dueño, "opening");
      publicarMensaje(dueño, null);
      try {
        if (ownerRef.current !== dueño || storeOwnerRef.current !== dueñoTienda) return;
        await revenueCat.presentCustomerCenter();
        publicarEstado(dueño, "idle");
      } catch {
        publicarEstado(dueño, "error");
        publicarMensaje(dueño, "No pudimos abrir la gestión de tu suscripción. Probá de nuevo.");
      }
    });
  }, [clerkOwner, gate, publicarEstado, publicarMensaje, revenueCat, storeOwner]);

  /**
   * Restaurar desde el Perfil usa EXACTAMENTE el mismo circuito que el paywall.
   *
   * Dos cosas que faltaban:
   *
   * 1. **El marcador se ESCRIBE antes.** Restaurar puede revelar una compra
   *    activa; sin marcador, entre esa revelación y la confirmación de Convex
   *    la pantalla habilitaba comprar de nuevo.
   * 2. **La confirmación es de RevenueCat, no `isPro`.** Ver el efecto de
   *    arriba: sólo `backendConfirmsStorePurchase` limpia y dice "restaurada".
   */
  const restore = useCallback(async () => {
    const dueño = clerkOwner;
    // Restaurar toca la TIENDA: sin identidad de RevenueCat alineada no corre.
    const dueñoTienda = storeOwner;
    if (!dueño || !dueñoTienda) return;
    await runExclusive(gate, async () => {
      publicarEstado(dueño, "restoring");
      publicarMensaje(dueño, null);
      try {
        await storePurchaseGuard(dueñoTienda, Date.now());
        const result = await revenueCat.restore();
        publicarEstado(dueño, "idle");
        if (result === "active") {
          // Hay compra: el marcador NO se levanta hasta que Convex lo confirme.
          publicarMensaje(dueño, MENSAJE_ACTIVANDO);
        } else {
          // Respuesta definitiva: no hay compra. El marcador se levanta, y sólo
          // si el borrado tuvo éxito se afirma que no hay nada pendiente.
          try {
            await clearPurchaseGuard(dueñoTienda);
            publicarMensaje(dueño, "No encontramos una compra activa para esta cuenta de la tienda.");
          } catch {
            publicarMensaje(
              dueño,
              "No encontramos una compra activa, pero no pudimos limpiar el estado local."
            );
          }
        }
      } catch {
        publicarEstado(dueño, "error");
        publicarMensaje(dueño, "No pudimos restaurar tus compras. Revisá la conexión y probá de nuevo.");
      }
      // La reparación se pide sólo si el dueño que la originó SIGUE siendo el
      // de la pantalla, leído de la ref y no del closure del render viejo: el
      // resultado de A no puede disparar la reconciliación de B ni gastarle su
      // cupo. El backend deriva la cuenta de `ctx.auth`, así que no hay forma
      // honesta de pedir la de A desde la sesión de B: se descarta.
      if (ownerRef.current !== dueño) return;
      try {
        await reconcile({});
      } catch {
        // La reconciliación es best-effort desde el cliente; nunca concede.
      }
    });
  }, [clerkOwner, gate, publicarEstado, publicarMensaje, reconcile, revenueCat, storeOwner]);

  if (view === "loading") {
    return (
      <PlanBlock>
        <ActivityIndicator color={orbita.colors.copper} />
      </PlanBlock>
    );
  }
  if (view === "unavailable") return null;

  if (view === "free") {
    return (
      <PlanBlock eyebrow="TU PLAN">
        <Body bone>Estás en Órbita Free.</Body>
        <Note>Tenés Hoy, Tránsitos, Vínculos, tu carta base y tres preguntas por día en El Umbral.</Note>
        <View style={styles.actionGap} />
        <Pill label="ACTIVAR ÓRBITA PLUS" onPress={() => router.push("/paywall")} />
        <RestoreLink state={state} ready={storeOwner !== null} onPress={() => void restore()} />
        <Message text={message} />
      </PlanBlock>
    );
  }

  /**
   * Bloque ACTIVO, compuesto por flags.
   *
   * Antes se elegía una rama por `view`, que nombra a UN ganador por rango: la
   * rama `stripe` renderizaba sólo el portal —escondiendo un Customer Center de
   * una compra de Apple viva— y la rama de respaldo (`stub` ganador) ignoraba
   * los dos flags y sólo ofrecía soporte. Acá cada salida se declara por
   * separado y se muestran todas las que existan, gane quien gane.
   */
  const lifetime = view === "lifetime";
  const esperandoComercioWeb = management.showStripePortal && commerceEnabled === undefined;
  const sinSalidaReal = !management.showStoreCenter && !management.showStripePortal;

  return (
    <PlanBlock>
      <Body bone>{lifetime ? "Tenés Órbita Plus de por vida." : "Tenés Órbita Plus activo."}</Body>
      <Note>
        {management.dual
          ? // El caso que dejaba un cobro corriendo a ciegas: dos compras vivas
            // y una sola salida visible, la del proveedor ganador.
            "Tenés dos suscripciones activas y cada una se cancela por su propio canal. Revisá las dos para no pagar dos veces."
          : lifetime
            ? "Este acceso no tiene una renovación que cancelar."
            : management.showStoreCenter
              ? "Desde acá podés revisar el plan, la renovación y las opciones disponibles en la tienda."
              : management.showStripePortal
                ? "Tu suscripción se gestiona con el proveedor con el que la contrataste."
                : "Si necesitás revisar este acceso, escribinos y lo resolvemos."}
      </Note>

      {management.showStoreCenter ? (
        <>
          <View style={styles.actionGap} />
          <Pill
            label={state === "opening" ? "ABRIENDO…" : management.dual ? "GESTIONAR EN LA TIENDA" : "GESTIONAR SUSCRIPCIÓN"}
            disabled={busy}
            onPress={() => void openCustomerCenter()}
          />
        </>
      ) : null}

      {management.showStripePortal ? (
        <>
          <View style={styles.actionGap} />
          {esperandoComercioWeb ? (
            <ActivityIndicator color={orbita.colors.copper} />
          ) : (
            <Pill
              label={
                state === "opening"
                  ? "ABRIENDO…"
                  : management.showStoreCenter
                    ? "GESTIONAR LA SUSCRIPCIÓN WEB"
                    : "GESTIONAR SUSCRIPCIÓN"
              }
              // Con el comercio apagado el portal tiraría: el botón queda
              // bloqueado y al lado se explica por dónde seguir.
              disabled={busy || commerceEnabled !== true}
              onPress={() => void openStripePortal()}
            />
          )}
          {commerceEnabled === false ? (
            <Pressable onPress={() => Linking.openURL(SUPPORT_URL)} accessibilityRole="link" hitSlop={8}>
              <Note>La gestión online no está disponible en este momento. Escribinos y lo resolvemos.</Note>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {sinSalidaReal ? (
        <Pressable onPress={() => Linking.openURL(SUPPORT_URL)} accessibilityRole="link" hitSlop={8}>
          <Note>Si necesitás revisar este acceso, escribinos y lo resolvemos.</Note>
        </Pressable>
      ) : null}

      <RestoreLink state={state} ready={storeOwner !== null} onPress={() => void restore()} />
      <Message text={message} />
    </PlanBlock>
  );
}

function PlanBlock({ eyebrow = "SUSCRIPCIÓN", children }: { eyebrow?: string; children: ReactNode }) {
  return (
    <View style={styles.block}>
      <Divider />
      <Eyebrow>{eyebrow}</Eyebrow>
      {children}
    </View>
  );
}

function RestoreLink({ state, ready, onPress }: { state: UiState; ready: boolean; onPress: () => void }) {
  const disabled = !ready || state === "restoring" || state === "opening";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={[styles.restore, disabled && styles.restoreDisabled]}
    >
      <Note>{state === "restoring" ? "Restaurando compras…" : ready ? "Restaurar compras" : "Preparando restauración…"}</Note>
    </Pressable>
  );
}

function Message({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Note>{text}</Note>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: orbita.spacing.sm },
  actionGap: { height: orbita.spacing.sm },
  restore: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44 },
  restoreDisabled: { opacity: 0.5 }
});
