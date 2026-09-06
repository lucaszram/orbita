import { StyleSheet, Text, View } from "react-native";
import { useLiveApp, useLiveAppDocs } from "@/hooks/useLiveApp";
import { orbita } from "@/theme/orbita";

/**
 * La píldora de plan de la cabecera (`Web/Badge · Plan` del tablero `1308:2`,
 * CORE-239): `PLUS` rellena en cobre, `FREE` en contorno. Sale del entitlement
 * real (`subscriptions.getCurrent`): mientras la query no resolvió, o sin
 * sesión, no se dibuja nada antes que un plan inventado.
 */
export function planDeCabecera(subscription: { entitlement?: string } | null | undefined, isLive: boolean): "PLUS" | "FREE" | null {
  if (!isLive || !subscription || typeof subscription.entitlement !== "string") return null;
  return subscription.entitlement === "orbita_pro" ? "PLUS" : "FREE";
}

export function PlanBadge() {
  const { isLive } = useLiveApp();
  const docs = useLiveAppDocs(isLive);
  const plan = planDeCabecera(docs.subscription, isLive);
  if (!plan) return null;
  return (
    <View style={[styles.badge, plan === "PLUS" && styles.badgePlus]} accessibilityLabel={`Plan ${plan === "PLUS" ? "Órbita Plus" : "Free"}`}>
      <Text style={[styles.texto, plan === "PLUS" && styles.textoPlus]}>{plan}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    borderColor: "rgba(244, 238, 228, 0.35)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 24,
    paddingHorizontal: orbita.spacing.md
  },
  badgePlus: { backgroundColor: orbita.colors.copper, borderColor: orbita.colors.copper },
  texto: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 10, letterSpacing: 1.2 },
  textoPlus: { color: orbita.colors.onLight }
});
