import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
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
import { proposedApi } from "@/services/appRefs";

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

  const { isLive } = useLiveApp();
  const getWebOffer = useAction(proposedApi.getWebOffer);
  const getCheckoutStatus = useAction(proposedApi.getCheckoutStatus);

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
