import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Body, Divider, Eyebrow, Note, Pill } from "@/components/orbita/kit";
import { createOwnerGates, runExclusive } from "@/domain/exclusive";
import {
  ownedValue,
  publishOwnedValue,
  readOwnedValue,
  safeEntitlement,
  type OwnedValue
} from "@/domain/nativeCommerce";
import { manageSubscription, plusActivation, type WebOffer } from "@/domain/paywall";
import { useLiveApp } from "@/hooks/useLiveApp";
import { appApi, proposedApi } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

const SUPPORT_URL = "https://orbitaastrologia.xyz/support";

/**
 * El bloque de plan del Perfil EN WEB — la implementación de siempre, sin
 * cambios.
 *
 * Se separó por plataforma porque el comercio es web: acá `/paywall` existe,
 * abre Stripe y termina la compra, así que ofrecer Plus desde el Perfil es un
 * camino real. En la app nativa ese camino no puede completarse y el bloque es
 * otro (ver `ManageSubscription.tsx`). El Perfil sigue siendo UNA sola pantalla
 * compartida: lo que cambia es este bloque, que Metro resuelve por plataforma.
 *
 * Las dos caras tienen la MISMA autoridad: `subscriptions.getCurrent`.
 *
 * - Con acceso vigente: "Gestionar suscripción" → Customer Portal de Stripe.
 *   Sólo aparece cuando el backend dice `canManageInStripePortal` (o sea:
 *   suscripción de Stripe, activa y no lifetime). La URL del portal la genera
 *   el backend; el cliente no arma ninguna.
 * - Sin acceso: "ACTIVAR ÓRBITA PLUS" → `/paywall`, que resuelve por sí solo el
 *   estado del comercio (con `off` muestra "próximamente", sin precios ni
 *   camino a checkout). Hasta ahora Plus no se podía activar desde ninguna
 *   pantalla de la app autenticada.
 *
 * Los dos estados son excluyentes por construcción (ver `plusActivation`) y
 * ninguno se afirma mientras el entitlement no resolvió.
 */
export function ManageSubscriptionBlock() {
  const { auth, isLive } = useLiveApp();
  // El entitlement se pide SÓLO con la sesión viva: sin el `skip`, el resultado
  // montado con la cuenta anterior seguía publicado durante el cambio de cuenta.
  const rawEntitlement = useQuery(appApi.subscriptions.getCurrent, isLive ? {} : "skip");
  const getWebOffer = useAction(proposedApi.getWebOffer);
  const createPortal = useAction(proposedApi.createPortalSession);

  const [commerceEnabled, setCommerceEnabled] = useState<boolean | null | undefined>(undefined);
  /**
   * Estado CON DUEÑO.
   *
   * Era un `useState` suelto. Si A pedía el portal y Clerk pasaba a B, B abría
   * el bloque con el "ABRIENDO…" de A pegado y su propio botón bloqueado; y si
   * lo de A terminaba en error, B leía "no pudimos abrir tu suscripción" sin
   * haber pedido nada. Publicado con el dueño capturado y leído sólo para el
   * vigente, el estado de A no se ve —ni pisa— el de B.
   */
  const [stateSlot, setStateSlot] = useState<OwnedValue<"idle" | "abriendo" | "error">>(() =>
    ownedValue(null, "idle")
  );
  // Un `useState` de "ocupado" se aplica en el render SIGUIENTE: dos toques del
  // mismo tick lo leían los dos en `idle` y creaban DOS sesiones de portal. El
  // candado es el mismo objeto que ven los dos toques y cambia en el instante.
  // Es POR DUEÑO: un pedido de A en vuelo no puede dejar a B esperando.
  const gates = useRef(createOwnerGates()).current;

  /**
   * El entitlement CORRELACIONADO con el dueño de Clerk.
   *
   * El `skip` no alcanza: la query conserva su último valor mientras la nueva
   * suscripción resuelve, así que el plan de A queda publicado bajo la sesión de
   * B. `undefined` = validando: `manageSubscription` y `plusActivation` ya
   * tratan eso como carga, así que no se ofrece portal ni activación.
   */
  const owner = auth?.isSignedIn ? auth.userId ?? null : null;
  const entitlement = safeEntitlement(rawEntitlement, owner);

  // La oferta se pide sólo si el backend ya dijo que hay algo que gestionar:
  // no tiene sentido consultar el estado del comercio para un Free.
  const needsOffer = entitlement?.canManageInStripePortal === true;
  useEffect(() => {
    if (!needsOffer) return;
    let alive = true;
    getWebOffer({})
      .then((r) => { if (alive) setCommerceEnabled((r as WebOffer).checkoutEnabled); })
      .catch(() => { if (alive) setCommerceEnabled(false); });
    return () => { alive = false; };
  }, [getWebOffer, needsOffer]);

  /**
   * Dueño VIGENTE, en una ref.
   *
   * La URL del portal es una sesión de facturación de UNA cuenta. Si A la pide,
   * la sesión pasa a B y la respuesta llega tarde, navegar ahí le mostraría a B
   * la facturación de A. Se revalida antes de pedirla y otra vez antes de
   * navegar; la URL de A nunca se reusa para B.
   */
  const ownerRef = useRef<string | null>(owner);
  ownerRef.current = owner;
  const gate = gates.for(owner);
  const state = readOwnedValue(stateSlot, owner, "idle");

  /** Publica el estado sólo si su dueño sigue siendo el vigente. */
  const publicarEstado = useCallback(
    (producedBy: string | null, value: "idle" | "abriendo" | "error") =>
      setStateSlot((previous) => publishOwnedValue(previous, producedBy, ownerRef.current, value)),
    []
  );

  const openPortal = useCallback(async () => {
    const dueño = ownerRef.current;
    if (!dueño) return;
    await runExclusive(gate, async () => {
      publicarEstado(dueño, "abriendo");
      try {
        if (ownerRef.current !== dueño) return;
        const { url } = await createPortal({});
        // Segunda revalidación: el cambio de cuenta pudo ocurrir mientras Stripe
        // generaba la sesión. La URL vieja se descarta, no se reusa.
        if (ownerRef.current !== dueño) return;
        // Se abre EXCLUSIVAMENTE la URL que devolvió el backend.
        if (typeof window !== "undefined" && window.location) window.location.assign(url);
        else await Linking.openURL(url);
      } catch {
        publicarEstado(dueño, "error");
      }
    });
  }, [createPortal, gate, publicarEstado]);

  const decision = manageSubscription({ entitlement, commerceEnabled });
  const activacion = plusActivation({ entitlement });

  if (activacion === "activar") {
    // Cuenta sin acceso: la única puerta visible a Plus dentro de la app.
    return (
      <View style={styles.block}>
        <Divider />
        <Eyebrow>TU PLAN</Eyebrow>
        <Body bone>Estás en Órbita Free.</Body>
        <Note>
          Plus abre tu carta natal completa —la rueda, tus casas, tus aspectos y los siete
          capítulos— y el Tarot de todos los días.
        </Note>
        <View style={{ height: orbita.spacing.md }} />
        <Pill label="ACTIVAR ÓRBITA PLUS" onPress={() => router.push("/paywall")} />
      </View>
    );
  }

  if (decision === "oculto") return null;
  if (decision === "cargando") {
    return (
      <View style={styles.block}>
        <Divider />
        <Eyebrow>SUSCRIPCIÓN</Eyebrow>
        <ActivityIndicator color={orbita.colors.copper} />
      </View>
    );
  }
  if (decision === "soporte") {
    // Suscripción viva con el comercio apagado (rollback): el portal tiraría.
    return (
      <View style={styles.block}>
        <Divider />
        <Eyebrow>SUSCRIPCIÓN</Eyebrow>
        <Body bone>Tenés Órbita Plus activo.</Body>
        <Pressable onPress={() => Linking.openURL(SUPPORT_URL)} accessibilityRole="link" hitSlop={8}>
          <Note>La gestión online no está disponible en este momento. Escribinos y lo resolvemos.</Note>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <Divider />
      <Eyebrow>SUSCRIPCIÓN</Eyebrow>
      <Body bone>Cambiá de plan, actualizá tu tarjeta o cancelá cuando quieras.</Body>
      <View style={{ height: orbita.spacing.md }} />
      <Pill
        label={state === "abriendo" ? "ABRIENDO…" : state === "error" ? "REINTENTAR" : "GESTIONAR SUSCRIPCIÓN"}
        onPress={openPortal}
      />
      {state === "error" ? (
        <Note>No pudimos abrir la gestión de tu suscripción. Probá de nuevo.</Note>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: orbita.spacing.sm }
});
