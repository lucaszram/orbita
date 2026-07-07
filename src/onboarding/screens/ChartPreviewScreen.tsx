import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Emblem } from "../components/Emblem";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Caption, Label, Title } from "../components/Type";
import type { OnboardingChart } from "../useAccount";
import { font, GUTTER, orbita } from "../theme";

type Props = {
  step: number;
  total: number;
  /** Signo solar calculado en el cliente (fallback si no hay carta real). */
  sunFallback: string;
  /** Carta real leída de Convex; `null` si no hay backend. */
  chart: OnboardingChart | null;
  /** Si el usuario cargó la hora (para distinguir "sin hora" de "falló la API"). */
  timeKnown: boolean;
  /** Fuerza el recálculo de la tríada. */
  onRetry?: () => void;
  onNext: () => void;
  onBack: () => void;
};

/**
 * 14 — Preview de la carta base. Muestra la tríada REAL (Sol/Luna/Ascendente)
 * como gancho, y corta el resto (casas, aspectos, personalidad, valores) detrás
 * del paywall. Degrada a solo-Sol si no hay carta real (invitado / sin sesión).
 */
export function ChartPreviewScreen({ step, total, sunFallback, chart, timeKnown, onRetry, onNext, onBack }: Props) {
  const backendActive = chart !== null;
  const loading = backendActive && !chart!.resolved;

  const sun = chart?.sun ?? sunFallback;
  const moon = chart?.moon ?? null;
  const ascendant = chart?.ascendant ?? null;
  // Carta resuelta, con hora + lugar, pero sin Luna/Asc → la API falló (no es "sin hora").
  const failed = backendActive && !loading && timeKnown && !moon && !ascendant;

  return (
    <Screen bg={A.dailyTexture} wash={0.5}>
      <Header step={step} total={total} onBack={onBack} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Title style={styles.title}>Tu carta base.</Title>
        <Body style={styles.sub}>
          {loading ? "Estamos armando tu carta…" : "Estos son tus tres pilares. El resto de tu carta te espera adentro."}
        </Body>

        <View style={styles.emblemZone}>
          <Emblem source={A.chartDiagram} size={200} opacity={loading ? 0.4 : 0.7} />
        </View>

        <View style={styles.triad}>
          <TriadCol label="Sol" value={sun} loading={loading} />
          <View style={styles.triadDivider} />
          <TriadCol label="Luna" value={moon} loading={loading} pending="con tu hora" />
          <View style={styles.triadDivider} />
          <TriadCol label="Ascendente" value={ascendant} loading={loading} pending="con tu lugar" />
        </View>

        {failed ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>No pudimos calcular tu carta</Text>
            <Caption style={styles.errorText}>
              El servicio de cartas no devolvió tu Luna y Ascendente (puede ser un límite temporal de la API). Reintentá en unos segundos.
            </Caption>
            {onRetry ? (
              <Pressable onPress={onRetry} style={styles.retryBtn} accessibilityRole="button">
                <Text style={styles.retryTxt}>Reintentar</Text>
              </Pressable>
            ) : null}
          </View>
        ) : !backendActive ? (
          <Caption style={styles.note}>Tu Luna y ascendente se afinan con tu carta completa.</Caption>
        ) : null}

        <View style={styles.lockedCard}>
          <View style={styles.lockedHead}>
            <Label>Tu carta completa</Label>
            <View style={styles.plusChip}>
              <Text style={styles.plusChipTxt}>PLUS</Text>
            </View>
          </View>
          {LOCKED_ROWS.map((row) => (
            <View key={row} style={styles.lockedRow}>
              <Text style={styles.lockIcon}>◵</Text>
              <Text style={styles.lockedRowTxt}>{row}</Text>
            </View>
          ))}
          <Caption style={styles.lockedNote}>Casas, aspectos, tu horóscopo de personalidad y tu mapa de valores.</Caption>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <CTA label="Ver mi carta completa" onPress={onNext} />
      </View>
    </Screen>
  );
}

const LOCKED_ROWS = [
  "Tus 12 casas y qué activa cada una",
  "Tus aspectos: dónde fluís y dónde hay fricción",
  "Tu horóscopo de personalidad",
  "Tu mapa de valores",
];

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
      <Label style={styles.triadLabel}>{label}</Label>
      <Text style={styles.triadValue}>{loading ? "…" : (value ?? pending ?? "—")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emblemZone: { alignItems: "center", marginBottom: 26, marginTop: 18 },
  errorCard: {
    alignItems: "center",
    backgroundColor: "rgba(214,154,106,0.08)",
    borderColor: "rgba(214,154,106,0.35)",
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  errorText: { marginTop: 6, textAlign: "center" },
  errorTitle: { color: orbita.bone, fontFamily: font.serif, fontSize: 18 },
  retryBtn: { backgroundColor: orbita.copper, borderRadius: 10, marginTop: 12, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: orbita.ink, fontFamily: font.sansBold, fontSize: 13, letterSpacing: 0.4 },
  footer: { paddingBottom: 26, paddingHorizontal: GUTTER, paddingTop: 12 },
  lockIcon: { color: orbita.copperSoft, fontFamily: font.sans, fontSize: 14 },
  lockedCard: {
    backgroundColor: "rgba(14,16,20,0.72)",
    borderColor: orbita.line,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
    padding: 20,
  },
  lockedHead: { alignItems: "center", flexDirection: "row", gap: 10, marginBottom: 6 },
  lockedNote: { marginTop: 12 },
  lockedRow: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 12 },
  lockedRowTxt: { color: orbita.bone, fontFamily: font.sansMed, fontSize: 14 },
  note: { marginTop: 14, textAlign: "center" },
  plusChip: {
    borderColor: "rgba(217,153,102,0.75)",
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  plusChipTxt: { color: orbita.copperSoft, fontFamily: font.sansBold, fontSize: 10, letterSpacing: 1 },
  scroll: { paddingBottom: 16, paddingHorizontal: GUTTER, paddingTop: 22 },
  sub: { marginTop: 12, textAlign: "center" },
  title: { fontSize: 32, lineHeight: 38, textAlign: "center" },
  triad: {
    backgroundColor: "rgba(14,16,20,0.55)",
    borderColor: orbita.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 10,
    paddingVertical: 20,
  },
  triadCol: { alignItems: "center", flex: 1, paddingHorizontal: 4 },
  triadDivider: { backgroundColor: orbita.line, width: 1 },
  triadLabel: { textAlign: "center" },
  triadValue: {
    color: orbita.bone,
    fontFamily: font.serif,
    fontSize: 18,
    lineHeight: 24,
    marginTop: 8,
    textAlign: "center",
  },
});
