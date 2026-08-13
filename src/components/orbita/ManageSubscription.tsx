import { useCallback, useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Body, Divider, Eyebrow, Note, Pill } from "@/components/orbita/kit";
import { manageSubscription, plusActivation, type WebOffer } from "@/domain/paywall";
import { appApi, proposedApi } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

const SUPPORT_URL = "https://orbitaastrologia.xyz/support";

/**
 * El bloque de plan del Perfil, con la MISMA autoridad para sus dos caras:
 * `subscriptions.getCurrent`.
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
  const entitlement = useQuery(appApi.subscriptions.getCurrent, {});
  const getWebOffer = useAction(proposedApi.getWebOffer);
  const createPortal = useAction(proposedApi.createPortalSession);

  const [commerceEnabled, setCommerceEnabled] = useState<boolean | null | undefined>(undefined);
  const [state, setState] = useState<"idle" | "abriendo" | "error">("idle");

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

  const openPortal = useCallback(async () => {
    if (state === "abriendo") return;
    setState("abriendo");
    try {
      const { url } = await createPortal({});
      // Se abre EXCLUSIVAMENTE la URL que devolvió el backend.
      if (typeof window !== "undefined" && window.location) window.location.assign(url);
      else await Linking.openURL(url);
    } catch {
      setState("error");
    }
  }, [createPortal, state]);

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
