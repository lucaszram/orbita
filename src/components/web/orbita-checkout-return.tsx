import { useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { trackPurchaseCompleted } from "@/analytics/productTelemetry";
import { RequireSession, WebNotice } from "@/components/web/require-session";
import {
  CHECKOUT_POLL_INTERVAL_MS,
  CHECKOUT_POLL_TIMEOUT_MS,
  checkoutPollDecision,
  readCheckoutSessionId,
  type CheckoutStatus,
  type WebOffer
} from "@/domain/paywall";
import { useLiveApp } from "@/hooks/useLiveApp";
import { appApi, proposedApi } from "@/services/appRefs";

const colors = {
  black: "#07080A",
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)"
};

/**
 * Retorno de Stripe Checkout (`/checkout/success?session_id=…`).
 *
 * La URL no concede nada. `active` sólo lo dice el backend, y sólo después de
 * verificar que la sesión, el propietario y el customer son de esta cuenta y
 * que el webhook confirmó el entitlement.
 */
export function OrbitaCheckoutReturn() {
  return (
    <RequireSession>
      <CheckoutReturnInner />
    </RequireSession>
  );
}

function CheckoutReturnInner() {
  const router = useRouter();
  const params = useLocalSearchParams<{ session_id?: string | string[] }>();
  const raw = Array.isArray(params.session_id) ? params.session_id[0] : params.session_id;
  const sessionId = readCheckoutSessionId(raw);

  const { isLive, auth } = useLiveApp();
  const getWebOffer = useAction(proposedApi.getWebOffer);
  const getCheckoutStatus = useAction(proposedApi.getCheckoutStatus);
  /**
   * El estado REAL de la suscripción, que es lo único que separa un cobro de una
   * prueba gratuita.
   *
   * `getCheckoutStatus` no puede contestarlo: su unión de retorno tiene tres
   * literales (`pending | active | failed`) y el entitlement trata la prueba como
   * acceso concedido, así que `trialing` le vuelve `active`. Esta query conserva
   * el estado tal cual está en la base —`convex/schema.ts` declara `trialing`
   * aparte— y viaja con su dueño, que es lo que permite descartar el valor
   * cacheado de la cuenta anterior durante un cambio A → B.
   *
   * Es reactiva y no cuesta una llamada extra por render: es la misma query que
   * el resto del producto ya consulta para saber el plan.
   */
  const subscription = useQuery(appApi.subscriptions.getCurrent, isLive ? {} : "skip");

  const [commerceEnabled, setCommerceEnabled] = useState<boolean | null>(null);
  const [status, setStatus] = useState<CheckoutStatus | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef<number>(Date.now());

  // Con el comercio apagado no puede haber una sesión legítima: no se consulta
  // nada. Preguntar igual sólo invita a tantear la URL.
  useEffect(() => {
    let alive = true;
    getWebOffer({})
      .then((r) => { if (alive) setCommerceEnabled((r as WebOffer).checkoutEnabled); })
      .catch(() => { if (alive) setCommerceEnabled(false); });
    return () => { alive = false; };
  }, [getWebOffer]);

  // El último estado vive en un ref: si el efecto dependiera del `useState`,
  // cada transición lo remontaría y arrancaría un segundo ciclo de polling.
  const lastStatus = useRef<CheckoutStatus | null>(null);

  useEffect(() => {
    // Desmontaje y logout cortan el polling: una sesión cerrada no puede
    // seguir preguntando por el estado de una compra.
    if (commerceEnabled === null || !isLive) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const step = async () => {
      if (!alive) return;
      const decision = checkoutPollDecision({
        commerceEnabled,
        sessionId,
        lastStatus: lastStatus.current,
        elapsedMs: Date.now() - startedAt.current
      });
      if (decision === "timeout") {
        setTimedOut(true);
        return;
      }
      // `listo`, `fallo` e `inhabilitado` son terminales: no se vuelve a consultar.
      if (decision !== "consultar" && decision !== "esperar") return;
      try {
        const r = await getCheckoutStatus({ sessionId: sessionId! });
        if (!alive) return;
        const next = (r as { status: CheckoutStatus }).status;
        lastStatus.current = next;
        setStatus(next);
        if (next === "pending") timer = setTimeout(step, CHECKOUT_POLL_INTERVAL_MS);
      } catch {
        if (!alive) return;
        lastStatus.current = "failed";
        setStatus("failed");
      }
    };

    void step();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [commerceEnabled, isLive, sessionId, getCheckoutStatus]);

  /**
   * El cobro volvió confirmado y el acceso quedó otorgado
   * (`purchase_completed`, contrato v1.0.0).
   *
   * Esta pantalla NO decide: pasa las dos autoridades tal como las recibe y la
   * regla vive en `productEvents.ts`, donde se prueba ejecutándola.
   *
   *   · `status` es lo que confirmó el retorno del checkout. No lo dice la URL
   *     sino el backend, y sólo después de verificar que la sesión, el
   *     propietario y el customer son de esta cuenta y que el webhook confirmó el
   *     entitlement. Un cobro pendiente, uno fallido y el techo de espera sin
   *     respuesta no llegan nunca a `active`.
   *   · la suscripción es la que distingue el CARGO de la PRUEBA GRATUITA. El
   *     contrato descarta expresamente "en prueba gratuita sin cargo", y la
   *     oferta web de hoy es una sola: mensual con siete días gratis
   *     (`MONTHLY_TRIAL_DAYS`). Con `status === "active"` a secas, cada prueba se
   *     contaba como conversión y el número dejaba de medir lo que nombra.
   *
   * El dueño viaja con las dos: la query conserva su último valor mientras la
   * nueva resuelve, y sin comparar dueños la compra de una cuenta se contaba bajo
   * la sesión de la siguiente.
   *
   * Volver a abrir esta pantalla tampoco cuenta: dentro de la misma carga lo
   * impide el estado de módulo, y a una recarga —que lo estrena— la corta la
   * memoria de pestaña de `productTelemetry.ts`, con una clave que distingue ESTA
   * compra de la siguiente por el fin de su período. Es el único hecho de esta
   * tarjeta cuyo no-disparador cruza una carga de página.
   */
  useEffect(() => {
    trackPurchaseCompleted({
      checkoutStatus: status,
      subscriptionStatus: subscription?.status ?? null,
      subscriptionOwner: subscription?.clerkUserId ?? null,
      sessionOwner: auth?.userId ?? null,
      periodEnd: subscription?.currentPeriodEnd ?? null
    });
  }, [status, subscription, auth?.userId]);

  if (!sessionId) {
    return (
      <WebNotice
        title="No encontramos esa compra"
        body="El enlace de retorno no es válido. Si pagaste, tu plan se activa solo; abrí tu perfil en unos minutos."
        action={{ label: "Ir a mi perfil", onPress: () => router.replace("/perfil") }}
      />
    );
  }
  if (commerceEnabled === false) {
    return (
      <WebNotice
        title="Órbita Plus estará disponible pronto"
        body="Todavía no se pueden contratar planes."
        action={{ label: "Volver al inicio", onPress: () => router.replace("/home") }}
      />
    );
  }
  if (status === "active") {
    return (
      <WebNotice
        title="Listo, ya tenés Órbita Plus"
        body="Tu carta completa, los tránsitos por área y tu Diario sin límite ya están disponibles."
        action={{ label: "Ver mi carta", onPress: () => router.replace("/carta") }}
      />
    );
  }
  if (status === "failed") {
    return (
      <WebNotice
        title="El pago no se completó"
        body="No se te cobró nada. Podés intentarlo de nuevo cuando quieras."
        action={{ label: "Volver a los planes", onPress: () => router.replace("/paywall") }}
      />
    );
  }
  if (timedOut) {
    // Ni éxito ni fracaso: el webhook todavía no llegó. Se dice tal cual, sin
    // prometer Plus ni declarar un fallo que no ocurrió.
    return (
      <WebNotice
        title="Tu pago se está confirmando"
        body="Puede tardar unos minutos. No hace falta que pagues de nuevo: cuando se confirme, tu plan se activa solo."
        action={{ label: "Ir a mi perfil", onPress: () => router.replace("/perfil") }}
      />
    );
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.copperSoft} />
      <Text selectable style={styles.text}>Confirmando tu pago…</Text>
      <Pressable onPress={() => router.replace("/perfil")}>
        <Text selectable style={styles.link}>Seguir después</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", backgroundColor: colors.black, flex: 1, gap: 14, justifyContent: "center", padding: 24 },
  text: { color: colors.boneMuted, fontSize: 15 },
  link: { color: colors.bone, fontSize: 14, textDecorationLine: "underline" }
});

export default OrbitaCheckoutReturn;
