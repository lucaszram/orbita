import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Screen } from "../components/Screen";
import { Body, Eyebrow, Label } from "../components/Type";
import type { OnboardingChart } from "../useAccount";
import { font, GUTTER, orbita } from "../theme";

export type PlanId = "weekly" | "annual";

const TRIAD_GLYPH: Record<string, string> = { Sol: "☉", Luna: "☽", Ascendente: "↑" };

const BENEFITS = [
  "Carta natal completa",
  "Tránsitos en tu carta",
  "Guía diaria personalizada",
  "Preguntale a Órbita",
  "Vínculos, calendario y fase lunar",
];

const STEPS: [string, string, string][] = [
  ["01", "Tu carta completa", "Tu carta natal con Sol, Luna, ascendente y casas."],
  ["02", "Tu día con contexto", "Una lectura diaria pensada desde tu carta."],
  ["03", "Preguntas más profundas", "Explorá amor, trabajo y vínculos con más detalle."],
];

type Props = {
  plan: PlanId;
  onPlan: (p: PlanId) => void;
  onUnlock: () => void;
  onBack: () => void;
  /** Carta real leída de Convex; `null` si no hay backend (invitado). */
  chart: OnboardingChart | null;
  /** Signo solar calculado en el cliente (fallback si no hay carta real). */
  sunFallback: string;
  /** Si el usuario cargó la hora (para distinguir "sin hora" de "falló la API"). */
  timeKnown: boolean;
  /** Fuerza el recálculo de la tríada. */
  onRetry?: () => void;
};

/**
 * 14 — Paywall único de Órbita PLUS. La tríada real (Sol/Luna/Ascendente) va
 * arriba como gancho: es el momento en que ves tu carta y el Semanal la
 * desbloquea. No hay pantalla de preview aparte (feedback Lucas).
 */
export function PaywallScreen({ plan, onPlan, onUnlock, onBack, chart, sunFallback, timeKnown, onRetry }: Props) {
  const backendActive = chart !== null;
  const loading = backendActive && !chart!.resolved;
  const sun = chart?.sun ?? sunFallback;
  const moon = chart?.moon ?? null;
  const ascendant = chart?.ascendant ?? null;
  // Carta resuelta, con hora + lugar, pero sin Luna/Asc → la API falló (no es "sin hora").
  const failed = backendActive && !loading && timeKnown && !moon && !ascendant;

  return (
    <Screen bg={A.paymentBg} bgOpacity={0.9} wash={0.6}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.nav}>
          <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Volver">
            <Text style={styles.chev}>‹</Text>
          </Pressable>
          {/* Testeo interno: no hay compras que restaurar, es texto inerte (no-op). */}
          <Text style={styles.restore}>Restaurar</Text>
        </View>

        <View style={styles.brandRow}>
          <Text style={styles.brand}>Órbita</Text>
          <View style={styles.plusBadge}>
            <Text style={styles.plusTxt}>PLUS</Text>
          </View>
        </View>

        <Eyebrow style={styles.triadEyebrow}>Tu carta base</Eyebrow>
        <View style={styles.triad}>
          <TriadCol label="Sol" value={sun} loading={loading} />
          <View style={styles.triadDivider} />
          <TriadCol label="Luna" value={moon} loading={loading} pending="con tu hora" />
          <View style={styles.triadDivider} />
          <TriadCol label="Ascendente" value={ascendant} loading={loading} pending="con tu lugar" />
        </View>
        {failed && onRetry ? (
          <Pressable onPress={onRetry} style={styles.retryRow} accessibilityRole="button">
            <Text style={styles.retryTxt}>No pudimos calcular tu Luna y ascendente · Reintentar</Text>
          </Pressable>
        ) : null}

        <Text style={styles.hero}>Tu cielo,{"\n"}todos los días.</Text>
        <Body style={styles.sub}>Tu carta completa, tus tránsitos y tu guía diaria.</Body>

        {/* Selección de plan cosmética: tocar cualquiera no bloquea; el CTA siempre pasa (feedback Lucas). */}
        <View style={styles.planCard}>
          <PlanRow
            selected={plan === "weekly"}
            onPress={() => onPlan("weekly")}
            label="Semanal"
            caption="Desbloquea tu carta natal completa"
            price="$5"
            subprice="por semana"
          />
          <View style={styles.planDivider} />
          <PlanRow
            selected={plan === "annual"}
            onPress={() => onPlan("annual")}
            label="Anual"
            caption="$0.58 por semana"
            badge="AHORRÁS 88%"
            price="$30"
            subprice="por año"
          />
        </View>

        <View style={styles.benefitsCard}>
          <Text style={styles.sectionTitle}>Qué incluye</Text>
          {BENEFITS.map((b) => (
            <View key={b} style={styles.benefitRow}>
              <Text style={styles.tick}>✓</Text>
              <Text style={styles.benefitTxt}>{b}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, styles.stepsTitle]}>Cómo te acompaña</Text>
        {STEPS.map(([num, title, body]) => (
          <View key={num} style={styles.stepRow}>
            <View style={styles.stepNum}>
              <Eyebrow style={styles.stepNumTxt}>{num}</Eyebrow>
            </View>
            <View style={styles.stepTxts}>
              <Text style={styles.stepTitle}>{title}</Text>
              <Text style={styles.stepBody}>{body}</Text>
            </View>
          </View>
        ))}

        <View style={styles.legalRow}>
          <Text style={styles.legalTick}>✓</Text>
          <Text style={styles.legal}>
            Cancelás cuando quieras · Renovación automática · Entretenimiento y autoconocimiento.
          </Text>
        </View>
      </ScrollView>

      {/* CTA fijo: siempre visible, elijas el plan que elijas (feedback Lucas). */}
      <View style={styles.stickyFooter}>
        <CTA label="Desbloquear Órbita" onPress={onUnlock} />
      </View>
    </Screen>
  );
}

function TriadCol({
  label,
  value,
  loading,
  pending,
}: {
  label: string;
  value: string | null;
  loading: boolean;
  pending?: string;
}) {
  return (
    <View style={styles.triadCol}>
      <Text style={styles.triadGlyph}>{TRIAD_GLYPH[label] ?? "·"}</Text>
      <Label style={styles.triadLabel}>{label}</Label>
      <Text style={styles.triadValue}>{loading ? "…" : (value ?? pending ?? "—")}</Text>
    </View>
  );
}

function PlanRow({
  selected,
  onPress,
  label,
  caption,
  badge,
  price,
  subprice,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  caption: string;
  badge?: string;
  price: string;
  subprice: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.planRow, selected && styles.planRowSelected]}
    >
      <View style={[styles.radio, { borderColor: selected ? orbita.copper : orbita.faint }]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.planTxts}>
        <View style={styles.planLabelRow}>
          <Text style={styles.planLabel}>{label}</Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.planCaption}>{caption}</Text>
      </View>
      <View style={styles.priceCol}>
        <Text style={styles.price}>{price}</Text>
        <Text style={styles.subprice}>{subprice}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderColor: orbita.copper,
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeTxt: { color: orbita.copperSoft, fontFamily: font.sansBold, fontSize: 9, letterSpacing: 0.5 },
  benefitRow: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 12 },
  benefitTxt: { color: orbita.bone, fontFamily: font.sansMed, fontSize: 14 },
  benefitsCard: {
    backgroundColor: "rgba(14,16,20,0.72)",
    borderColor: orbita.line,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 22,
    padding: 20,
  },
  brand: { color: orbita.bone, fontFamily: font.serif, fontSize: 24, lineHeight: 34 },
  brandRow: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 30 },
  chev: { color: orbita.bone, fontFamily: font.sans, fontSize: 26 },
  footer: { marginTop: 28 },
  hero: {
    color: orbita.bone,
    fontFamily: font.sansBold,
    fontSize: 36,
    lineHeight: 42,
    marginTop: 22,
  },
  legal: { color: orbita.faint, flex: 1, fontFamily: font.sans, fontSize: 12, lineHeight: 17 },
  legalRow: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 26 },
  legalTick: { color: orbita.copper, fontFamily: font.sansBold, fontSize: 12 },
  nav: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingTop: 10 },
  planCard: {
    backgroundColor: "rgba(14,16,20,0.72)",
    borderColor: "rgba(214,154,106,0.3)",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 28,
    padding: 8,
  },
  planCaption: { color: orbita.muted, fontFamily: font.sansMed, fontSize: 12, marginTop: 3 },
  planDivider: { backgroundColor: orbita.line, height: 1, marginHorizontal: 12, marginVertical: 4 },
  planLabel: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 16 },
  planLabelRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  planRow: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 14,
    padding: 14,
  },
  planRowSelected: {
    backgroundColor: "rgba(43,29,20,0.95)",
    borderColor: "rgba(217,153,102,0.65)",
    elevation: 8,
    shadowColor: orbita.copper,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
  },
  planTxts: { flex: 1 },
  plusBadge: {
    borderColor: "rgba(217,153,102,0.75)",
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  plusTxt: { color: orbita.copperSoft, fontFamily: font.sansBold, fontSize: 10, letterSpacing: 1 },
  price: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 18 },
  priceCol: { alignItems: "flex-end" },
  radio: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  radioDot: { backgroundColor: orbita.copper, borderRadius: 4, height: 8, width: 8 },
  restore: { color: orbita.muted, fontFamily: font.sansMed, fontSize: 14 },
  scroll: { paddingBottom: 16, paddingHorizontal: GUTTER },
  stickyFooter: {
    backgroundColor: "rgba(10,11,14,0.92)",
    borderTopColor: orbita.line,
    borderTopWidth: 1,
    paddingBottom: 26,
    paddingHorizontal: GUTTER,
    paddingTop: 14,
  },
  sectionTitle: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 18 },
  stepBody: { color: orbita.muted, fontFamily: font.sans, fontSize: 13, lineHeight: 18, marginTop: 3 },
  stepNum: {
    alignItems: "center",
    borderColor: "rgba(214,154,106,0.5)",
    borderRadius: 12,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    marginTop: 2,
    width: 24,
  },
  stepNumTxt: { fontSize: 9, letterSpacing: 0 },
  stepRow: { flexDirection: "row", gap: 14, marginTop: 20 },
  stepTitle: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 15 },
  stepTxts: { flex: 1 },
  stepsTitle: { marginTop: 30 },
  sub: { marginTop: 12 },
  subprice: { color: orbita.muted, fontFamily: font.sansMed, fontSize: 11, marginTop: 3 },
  tick: { color: orbita.copper, fontFamily: font.sansBold, fontSize: 13 },
  triadEyebrow: { marginTop: 22 },
  triad: {
    backgroundColor: "rgba(14,16,20,0.55)",
    borderColor: orbita.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 12,
    paddingVertical: 18,
  },
  triadCol: { alignItems: "center", flex: 1, paddingHorizontal: 4 },
  triadDivider: { backgroundColor: orbita.line, width: 1 },
  triadGlyph: { color: orbita.copperSoft, fontFamily: font.serif, fontSize: 20, marginBottom: 6 },
  triadLabel: { textAlign: "center" },
  triadValue: {
    color: orbita.bone,
    fontFamily: font.serif,
    fontSize: 17,
    lineHeight: 22,
    marginTop: 6,
    textAlign: "center",
  },
  retryRow: { marginTop: 12 },
  retryTxt: { color: orbita.copperSoft, fontFamily: font.sansMed, fontSize: 12, textAlign: "center" },
});
