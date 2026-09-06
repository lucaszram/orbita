import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Emblem } from "../components/Emblem";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Caption, Label, Title } from "../components/Type";
import { ONBOARDING_TOTAL } from "../steps";
import { font, GUTTER, orbita } from "../theme";
import type { OnboardingChart, TriadStatus } from "../useAccount";

/**
 * 09 — La ÚNICA superficie de cálculo de la tríada.
 *
 * Mientras carga es puramente editorial: "Preparando tu carta…", sin ningún
 * CTA para saltarla. Si el cálculo llega antes del techo visible, ESTA MISMA
 * superficie se transforma en "Tu carta ya está lista" y aparece `Continuar`.
 *
 * `timed_out` y `error` no se dibujan: el flujo avanza solo a Antes/Después
 * (`triadAutoAdvances`), sin pedir interacción y sin una pantalla técnica —
 * si por un frame llegan hasta acá, se muestra la misma superficie de
 * preparación mientras la navegación sale.
 *
 * Con hora exacta muestra Sol, Luna y Ascendente; sin hora, el Ascendente
 * explica que necesita una hora exacta y el avance continúa igual.
 */

type Props = {
  step: number;
  status: TriadStatus;
  chart: OnboardingChart | undefined;
  /** ¿La persona cargó una hora exacta? Define qué se dice del Ascendente. */
  timeKnown: boolean;
  onContinue: () => void;
  onBack: () => void;
};

export function TriadScreen({ step, status, chart, timeKnown, onContinue, onBack }: Props) {
  const ready = status === "ready";

  const sol = chart?.sun ?? null;
  const luna = chart?.moon ?? null;
  const asc = chart?.ascendant ?? null;
  const ascendantText = ready
    ? (asc ?? (timeKnown ? "Se completa sola en tu carta" : "Necesita una hora exacta"))
    : "Calculando…";

  return (
    <Screen bg={A.transitsBg} bgOpacity={0.85} wash={0.58}>
      <Header step={step} total={ONBOARDING_TOTAL} onBack={onBack} />
      <View style={styles.body}>
        {/* UN único anuncio del estado de carga: el título es la región viva. */}
        <Title accessibilityLiveRegion="polite">
          {ready ? "Tu carta ya está lista." : "Preparando tu carta…"}
        </Title>
        <Body style={styles.sub}>
          {ready ? "Preparando tu carta · completo" : "Ubicamos tu Sol, tu Luna y tu Ascendente."}
        </Body>

        <View style={styles.emblemZone} pointerEvents="none">
          <Emblem source={A.chartDiagram} size={210} opacity={ready ? 0.7 : 0.45} />
        </View>

        <View style={styles.rows}>
          <TriadRow label="Sol" value={sol ?? "Calculando…"} pending={!sol} />
          <TriadRow label="Luna" value={luna ?? "Calculando…"} pending={!luna} />
          <TriadRow label="Ascendente" value={ascendantText} pending={!asc} />
        </View>

        {ready && !timeKnown ? (
          <Caption style={styles.aviso}>Sumá tu hora exacta cuando la tengas. Podés seguir igual.</Caption>
        ) : null}

        <View style={styles.spacer} />
        <View style={styles.footer}>
          {/* El CTA existe SOLO con la carta revelada: la espera no tiene
              escapes manuales porque nunca supera el techo visible. */}
          {ready ? <CTA label="Continuar" onPress={onContinue} /> : null}
        </View>
      </View>
    </Screen>
  );
}

function TriadRow({ label, value, pending }: { label: string; value: string; pending: boolean }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.row}>
      <Label style={styles.rowLabel}>{label}</Label>
      <Text style={[styles.rowValue, pending && styles.rowValuePending]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: GUTTER, paddingTop: 20 },
  sub: { marginTop: 8 },
  emblemZone: { alignItems: "center", marginTop: 10, minHeight: 130 },
  rows: { marginTop: 6 },
  row: {
    alignItems: "center",
    borderBottomColor: orbita.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 46,
    paddingVertical: 6
  },
  rowLabel: { width: 104 },
  rowValue: { color: orbita.boneSoft, flex: 1, fontFamily: font.serif, fontSize: 17 },
  rowValuePending: { color: orbita.muted, fontFamily: font.serifReg },
  aviso: { marginTop: 14, textAlign: "center" },
  spacer: { flex: 1, minHeight: 10 },
  footer: { minHeight: 78, paddingBottom: 12, paddingTop: 12 }
});
