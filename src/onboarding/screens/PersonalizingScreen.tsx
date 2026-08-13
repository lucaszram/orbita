import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Emblem } from "../components/Emblem";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Caption, Title } from "../components/Type";
import type { TriadStatus } from "../useAccount";
import { font, GUTTER, orbita } from "../theme";

type Props = {
  step: number;
  onDone: () => void;
  onBack: () => void;
  /** Estado del cálculo real de la carta (Sol/Luna/Ascendente). */
  triadStatus: TriadStatus;
  /** Motivo del fallo, ya redactado para el usuario. */
  triadError: string | null;
  onRetryTriad: () => void;
  /** Salida explícita: seguir sin la tríada, con el usuario enterado. */
  onContinueWithoutTriad: () => void;
};

/** Con estos estados la carta ya no está pendiente y el alta puede avanzar. */
const SETTLED: TriadStatus[] = ["ready", "unavailable", "skipped"];

/**
 * 12 — Personalizing. La barra ya no es sólo decorativa: la pantalla espera al
 * cálculo REAL de la tríada y, si falla, ofrece reintento en vez de seguir de
 * largo y llegar a la recepción sin Luna ni ascendente.
 */
export function PersonalizingScreen({
  step,
  onDone,
  onBack,
  triadStatus,
  triadError,
  onRetryTriad,
  onContinueWithoutTriad,
}: Props) {
  const [chart, setChart] = useState(8);
  const [transits, setTransits] = useState(0);
  const done = useRef(false);
  // onDone en ref: si estuviera en las deps del effect, un re-render de arriba
  // (p. ej. el cálculo de la tríada) re-ejecutaría el effect y cancelaría el
  // timeout de avance → la pantalla quedaba pegada al 100%.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const failed = triadStatus === "error";
  const waiting = triadStatus === "loading" || triadStatus === "idle";

  useEffect(() => {
    if (failed) return;
    const id = setInterval(() => {
      setChart((v) => Math.min(100, v + 4));
      setTransits((v) => (v === 0 && Math.random() < 0.6 ? 0 : Math.min(100, v + 5)));
    }, 90);
    return () => clearInterval(id);
  }, [failed]);

  useEffect(() => {
    if (chart >= 100 && transits >= 100 && SETTLED.includes(triadStatus) && !done.current) {
      done.current = true;
      const t = setTimeout(() => onDoneRef.current(), 700);
      return () => clearTimeout(t);
    }
  }, [chart, transits, triadStatus]);

  return (
    <Screen bg={A.transitsBg} wash={0.48}>
      <Header step={step} total={15} onBack={onBack} />
      <View style={styles.body}>
        <Title style={styles.title}>{failed ? "No pudimos armar tu carta" : "Alineando tu cielo…"}</Title>
        <Body style={styles.sub}>
          {failed ? (triadError ?? "No pudimos calcular tu carta ahora mismo.") : "Tu carta se está armando."}
        </Body>

        {failed ? null : (
          <View style={styles.bars}>
            <Row label="Carta natal" value={chart} />
            <View style={styles.gap} />
            <Row label="Tránsitos del día" value={transits} />
          </View>
        )}

        <View style={styles.emblemZone}>
          <Emblem source={A.chartDiagram} size={230} opacity={failed ? 0.28 : 0.55} />
        </View>

        <View style={styles.spacer} />

        {failed ? (
          <View style={styles.recovery}>
            <CTA label="Reintentar" onPress={onRetryTriad} />
            <View style={styles.recoveryGap} />
            <CTA
              label="Continuar sin mi Luna y ascendente"
              variant="secondary"
              onPress={onContinueWithoutTriad}
            />
          </View>
        ) : (
          <Caption style={styles.note}>
            {chart >= 100 && waiting
              ? "Estamos calculando tus planetas y tus casas."
              : "Ubicamos tus planetas y tus casas."}
          </Caption>
        )}
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <View>
      <View style={styles.rowTop}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowPct}>{Math.round(value)}%</Text>
      </View>
      <Progress
        value={value}
        className="mt-2 h-1 rounded-full bg-white/10"
        indicatorClassName="rounded-full bg-[#C46A3A]"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { marginTop: 44 },
  body: { flex: 1, paddingHorizontal: GUTTER, paddingTop: 26 },
  emblemZone: { alignItems: "center", marginTop: 44 },
  gap: { height: 26 },
  note: { marginBottom: 20, textAlign: "center" },
  recovery: { marginBottom: 24 },
  recoveryGap: { height: 12 },
  rowLabel: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 15 },
  rowPct: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 15 },
  rowTop: { flexDirection: "row", justifyContent: "space-between" },
  spacer: { flex: 1, minHeight: 12 },
  sub: { marginTop: 10, textAlign: "center" },
  title: { textAlign: "center" },
});
