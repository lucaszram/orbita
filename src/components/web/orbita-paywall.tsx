import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { RequireSession, WebNotice } from "@/components/web/require-session";
import { WebLayoutProvider } from "@/components/web/web-layout-provider";
import { checkoutStartErrorKind } from "@/domain/paywall";
import { proposedApi } from "@/services/appRefs";

const colors = {
  black: "#07080A",
  copperSoft: "#D69A6A",
  boneMuted: "rgba(244, 238, 228, 0.72)"
};

/**
 * `/paywall` — LANZADOR de pago, no una pantalla comercial.
 *
 * Antes acá vivía una oferta intermedia (precio, prueba, lista de beneficios,
 * navegación y legales) que la persona tenía que leer y volver a aceptar
 * DESPUÉS de haber tocado un CTA que ya decía "activar Plus". Esa pantalla
 * repetía lo que Stripe Checkout muestra igual —precio, moneda, prueba,
 * renovación y términos— y agregaba un paso donde se perdía gente.
 *
 * Ahora la ruta no vende nada: monta, crea UNA sesión mensual de Checkout y
 * manda al pago. Los CTA de Perfil, Carta, recepción y Home pueden seguir
 * apuntando acá sin cambiar: lo que cambia es que este destino abre Stripe.
 *
 * Lo único que se muestra mientras tanto es que el pago se está abriendo. La
 * oferta —qué desbloquea Plus— se explica en la superficie que trae a la
 * persona hasta acá, que es donde tiene sentido leerla.
 */
export function OrbitaPaywall() {
  // La ruta es standalone (no cuelga de `WebAppShell`): el provider se conserva
  // para que el subárbol autenticado resuelva su modo igual que antes.
  return (
    <WebLayoutProvider>
      <RequireSession>
        <CheckoutLauncher />
      </RequireSession>
    </WebLayoutProvider>
  );
}

/**
 * Crea la sesión de Checkout y redirige. La oferta es UNA sola suscripción
 * mensual: el plan es el único que existe (`monthly`) y el precio, la moneda y
 * los días de prueba los pone Stripe con el Price configurado en el backend —
 * el cliente no escribe ni un importe.
 */
function CheckoutLauncher() {
  const createCheckout = useAction(proposedApi.createCheckoutSession);
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"abriendo" | "error" | "ya_plus">("abriendo");
  /**
   * Guard SINCRÓNICO de la creación. Un `useState` no alcanza: el efecto de
   * React 18 en StrictMode corre montar → desmontar → montar, y un re-render
   * cualquiera volvería a entrar antes de que el estado se refleje. Cada
   * intento se marca ANTES del await y por su número, así un reintento explícito
   * (que incrementa `attempt`) sí puede correr y un remontaje no.
   *
   * Importa de verdad: cada llamada crea una sesión de pago en Stripe.
   */
  const startedFor = useRef<number | null>(null);

  useEffect(() => {
    if (startedFor.current === attempt) return;
    startedFor.current = attempt;
    let alive = true;
    setState("abriendo");
    createCheckout({ plan: "monthly" })
      .then(({ url }) => {
        // Se abre EXCLUSIVAMENTE la URL que devolvió el backend. `replace` es
        // deliberado: `/paywall` es un lanzador técnico y no puede quedar en
        // el historial, porque Atrás desde Stripe volvería a montarlo y abriría
        // otra sesión. Así Atrás regresa a Carta/Perfil/Recepción/Home.
        if (typeof window !== "undefined") window.location.replace(url);
      })
      .catch((err) => {
        if (!alive) return;
        setState(checkoutStartErrorKind(err) === "ya_plus" ? "ya_plus" : "error");
      });
    return () => {
      alive = false;
    };
  }, [createCheckout, attempt]);

  if (state === "ya_plus") {
    return (
      <WebNotice
        title="Ya tenés Órbita Plus"
        body="Tu cuenta ya tiene acceso. Podés ver y gestionar tu suscripción desde tu perfil."
        action={{ label: "Ir a Perfil", onPress: () => router.replace("/perfil") }}
      />
    );
  }

  if (state === "error") {
    return (
      <WebNotice
        title="No pudimos abrir el pago"
        body="No se generó ningún cobro. Volvé a intentar en un momento."
        action={{ label: "Reintentar", onPress: () => setAttempt((a) => a + 1) }}
      />
    );
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.copperSoft} />
      <Text selectable style={styles.status}>
        Abriendo el pago seguro…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    backgroundColor: colors.black,
    flex: 1,
    gap: 16,
    justifyContent: "center",
    padding: 24
  },
  status: { color: colors.boneMuted, fontSize: 15, textAlign: "center" }
});

export default OrbitaPaywall;
