import { Link, Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { backendConfig } from "@/services/backendProviders";
import { useEntitlement } from "@/hooks/useEntitlement";

// Pantalla de retorno de Stripe Checkout (web). El acceso se activa vía webhook
// → Convex; useEntitlement es reactivo, así que apenas la fila se escribe, isPro
// pasa a true sin polling manual.
export default function CheckoutSuccessRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }
  if (!backendConfig.isConfigured) {
    return <Redirect href="/" />;
  }
  return <CheckoutSuccess />;
}

function CheckoutSuccess() {
  const { isPro } = useEntitlement();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isPro) return;
    const timer = setTimeout(() => setTimedOut(true), 30000);
    return () => clearTimeout(timer);
  }, [isPro]);

  if (isPro) {
    return (
      <Screen>
        <Text style={styles.badge}>PLUS</Text>
        <Text style={styles.title}>Ya sos Órbita Pro</Text>
        <Text style={styles.body}>Tu cielo, todos los días. Tu acceso quedó activo.</Text>
        <Link href="/home" style={styles.cta}>
          Ir a mi Órbita
        </Link>
      </Screen>
    );
  }

  if (timedOut) {
    return (
      <Screen>
        <Text style={styles.title}>Estamos confirmando tu pago</Text>
        <Text style={styles.body}>
          Puede demorar unos minutos en reflejarse. Si ya pagaste, no vuelvas a intentar: se activa solo.
          Si en un rato no aparece, escribinos.
        </Text>
        <Link href="/home" style={styles.cta}>
          Ir a mi Órbita
        </Link>
      </Screen>
    );
  }

  return (
    <Screen>
      <ActivityIndicator color="#C46A3A" size="large" />
      <Text style={styles.title}>Activando tu acceso…</Text>
      <Text style={styles.body}>Un segundo, estamos confirmando el pago.</Text>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
    backgroundColor: "#07080A"
  },
  badge: {
    color: "#C46A3A",
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: "600"
  },
  title: {
    color: "#F7F5EF",
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center"
  },
  body: {
    color: "#9A9A9A",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 420
  },
  cta: {
    marginTop: 8,
    color: "#07080A",
    backgroundColor: "#C46A3A",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    fontWeight: "600",
    overflow: "hidden"
  }
});
