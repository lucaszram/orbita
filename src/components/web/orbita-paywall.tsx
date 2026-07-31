import { useCallback, useEffect, useState } from "react";
import { useAction } from "convex/react";
import { Link } from "expo-router";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { ImmersiveScreen } from "@/components/web/immersive-bg";
import { RequireSession, WebNotice } from "@/components/web/require-session";
import { WebNav } from "@/components/web/web-nav";
import {
  formatPlanPrice,
  offerPhase,
  planIntervalLabel,
  planTrialLabel,
  sortedPlans,
  type OfferPlan,
  type WebOffer
} from "@/domain/paywall";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/domain/support";
import { proposedApi } from "@/services/appRefs";

const colors = {
  black: "#07080A",
  copper: "#C46A3A",
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)",
  boneDim: "rgba(244, 238, 228, 0.5)",
  line: "rgba(214, 154, 106, 0.22)",
  panel: "rgba(11, 12, 15, 0.62)"
};

const BENEFITS = [
  "Tu carta natal completa: casas, aspectos y los siete capítulos de interpretación.",
  "La lectura diaria cruzada con tu carta, no sólo el clima general.",
  "Tránsitos por área: amor, trabajo, vínculos y energía.",
  "Cinco preguntas por día en El Umbral, en vez de tres.",
  "Tu Diario completo, sin límite de siete días."
];

export function OrbitaPaywall() {
  return (
    <RequireSession>
      <PaywallWithBackend />
    </RequireSession>
  );
}

function PaywallWithBackend() {
  const getWebOffer = useAction(proposedApi.getWebOffer);
  const [offer, setOffer] = useState<WebOffer | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setOffer(undefined);
    getWebOffer({})
      .then((r) => { if (alive) setOffer(r as WebOffer); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [getWebOffer, attempt]);

  const phase = offerPhase({ offer, failed });

  if (phase === "cargando") {
    return (
      <Shell>
        <View style={styles.centerBlock}>
          <ActivityIndicator color={colors.copperSoft} />
        </View>
      </Shell>
    );
  }
  if (phase === "error") {
    return (
      <WebNotice
        title="No pudimos cargar los planes"
        body="Volvé a intentar en un momento."
        action={{ label: "Reintentar", onPress: () => setAttempt((a) => a + 1) }}
      />
    );
  }
  if (phase === "proximamente") {
    // Comercio apagado: sin precios, sin planes y sin ningún camino a checkout.
    return (
      <Shell>
        <View style={styles.soonCard}>
          <Text selectable style={styles.soonTitle}>
            Órbita Plus estará disponible pronto
          </Text>
          <Text selectable style={styles.soonBody}>
            Todavía no se puede contratar. Mientras tanto, tu ritual diario, tu carta de Tarot y tu
            tríada natal siguen siendo gratis.
          </Text>
        </View>
        <BenefitList />
      </Shell>
    );
  }

  return (
    <Shell>
      <PlanPicker plans={sortedPlans(offer!.plans)} />
      <BenefitList />
    </Shell>
  );
}

function PlanPicker({ plans }: { plans: OfferPlan[] }) {
  const createCheckout = useAction(proposedApi.createCheckoutSession);
  // El anual va preseleccionado (decisión de producto vigente).
  const [selected, setSelected] = useState<OfferPlan["id"]>(plans[0]?.id ?? "yearly");
  const [state, setState] = useState<"idle" | "abriendo" | "error">("idle");

  const start = useCallback(async () => {
    if (state === "abriendo") return;
    setState("abriendo");
    try {
      const { url } = await createCheckout({ plan: selected });
      if (typeof window !== "undefined") window.location.assign(url);
    } catch {
      setState("error");
    }
  }, [createCheckout, selected, state]);

  return (
    <View style={styles.plans}>
      {plans.map((plan) => {
        const active = plan.id === selected;
        const trial = planTrialLabel(plan);
        return (
          <Pressable
            key={plan.id}
            onPress={() => setSelected(plan.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.plan, active && styles.planActive]}
          >
            <View style={styles.planHead}>
              <Text selectable style={styles.planName}>
                {plan.id === "yearly" ? "Anual" : "Semanal"}
              </Text>
              {trial ? <Text selectable style={styles.planTrial}>{trial}</Text> : null}
            </View>
            {/* Precio, moneda e intervalo salen de Stripe vía getWebOffer. */}
            <Text selectable style={styles.planPrice}>
              {formatPlanPrice(plan)}{" "}
              <Text selectable style={styles.planInterval}>{planIntervalLabel(plan)}</Text>
            </Text>
          </Pressable>
        );
      })}

      <Pressable onPress={start} disabled={state === "abriendo"} style={[styles.cta, state === "abriendo" && styles.ctaOff]}>
        <Text selectable style={styles.ctaText}>
          {state === "abriendo" ? "Abriendo el pago…" : "Continuar"}
        </Text>
      </Pressable>
      {state === "error" ? (
        <Text selectable style={styles.error}>No pudimos abrir el pago. Probá de nuevo.</Text>
      ) : null}
      <Text selectable style={styles.legal}>
        La suscripción se renueva sola hasta que la cancelés. Podés gestionarla desde tu perfil.
      </Text>
    </View>
  );
}

function BenefitList() {
  return (
    <View style={styles.benefits}>
      <Text selectable style={styles.benefitsLabel}>QUÉ INCLUYE</Text>
      {BENEFITS.map((b) => (
        <Text key={b} selectable style={styles.benefit}>
          {b}
        </Text>
      ))}
    </View>
  );
}

/**
 * Divulgación legal de la pantalla de compra: privacidad, términos y una vía de
 * soporte real, visibles desde el paywall mismo y en cualquiera de sus estados
 * (con o sin comercio habilitado). No cambia nada del checkout.
 */
function PaywallLegalLinks() {
  return (
    <View style={styles.legalLinks}>
      <View style={styles.legalRow}>
        <Link href="/privacy" asChild>
          <Pressable accessibilityRole="link" hitSlop={8}>
            <Text style={styles.legalLink}>Privacidad</Text>
          </Pressable>
        </Link>
        <Text style={styles.legalDot}>·</Text>
        <Link href="/terminos" asChild>
          <Pressable accessibilityRole="link" hitSlop={8}>
            <Text style={styles.legalLink}>Términos y condiciones</Text>
          </Pressable>
        </Link>
      </View>
      <Text selectable style={styles.legal}>
        ¿Dudas antes de suscribirte? Escribinos a{" "}
        <Text
          style={styles.legalLink}
          accessibilityRole="link"
          onPress={() => Linking.openURL(SUPPORT_MAILTO)}
        >
          {SUPPORT_EMAIL}
        </Text>
        .
      </Text>
    </View>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 900;
  const pad = isNarrow ? 24 : 120;
  return (
    <ImmersiveScreen asset="ringSystem" opacity={0.2}>
      <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <WebNav active="carta" />
        <View style={[styles.header, { paddingHorizontal: pad }]}>
          <Text selectable style={styles.eyebrow}>Órbita Plus</Text>
          <Text selectable style={[styles.title, isNarrow && styles.titleNarrow]}>
            Tu carta, leída entera.
          </Text>
        </View>
        <View style={{ gap: 20, paddingHorizontal: pad, paddingTop: 32 }}>
          {children}
          <PaywallLegalLinks />
        </View>
      </ScrollView>
    </ImmersiveScreen>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: "transparent", flex: 1 },
  pageContent: { backgroundColor: "transparent", paddingBottom: 96 },
  centerBlock: { alignItems: "center", paddingVertical: 64 },
  header: { gap: 12, paddingTop: 56 },
  eyebrow: { color: colors.copperSoft, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
  title: { color: colors.bone, fontSize: 44, lineHeight: 50 },
  titleNarrow: { fontSize: 32, lineHeight: 38 },

  soonCard: {
    backgroundColor: "rgba(196,106,58,0.08)",
    borderColor: "rgba(214,154,106,0.35)",
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    maxWidth: 640,
    padding: 24
  },
  soonTitle: { color: colors.bone, fontSize: 22, fontWeight: "500" },
  soonBody: { color: colors.boneMuted, fontSize: 15, lineHeight: 23 },

  plans: { gap: 12, maxWidth: 520 },
  plan: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 8, padding: 20 },
  planActive: { borderColor: colors.copperSoft, borderWidth: 2 },
  planHead: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  planName: { color: colors.bone, fontSize: 17, fontWeight: "700" },
  planTrial: { color: colors.copperSoft, fontSize: 13, fontWeight: "700" },
  planPrice: { color: colors.bone, fontSize: 26 },
  planInterval: { color: colors.boneMuted, fontSize: 15 },

  cta: { alignItems: "center", backgroundColor: colors.bone, borderRadius: 8, marginTop: 8, paddingVertical: 15 },
  ctaOff: { opacity: 0.5 },
  ctaText: { color: colors.black, fontSize: 15, fontWeight: "700" },
  error: { color: colors.copperSoft, fontSize: 14 },
  legal: { color: colors.boneDim, fontSize: 13, lineHeight: 19 },

  legalLinks: { borderTopColor: colors.line, borderTopWidth: 1, gap: 10, maxWidth: 640, paddingTop: 20 },
  legalRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10 },
  legalLink: { color: colors.copperSoft, fontSize: 13, fontWeight: "500" },
  legalDot: { color: colors.boneDim, fontSize: 13 },

  benefits: { gap: 10, maxWidth: 640, paddingTop: 12 },
  benefitsLabel: { color: colors.copperSoft, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  benefit: { color: colors.boneMuted, fontSize: 15, lineHeight: 23 }
});

export default OrbitaPaywall;
