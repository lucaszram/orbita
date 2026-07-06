import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { Emblem } from "../components/Emblem";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Caption, Title } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";

type Props = { step: number; onDone: () => void; onBack: () => void };

/** 12 — Personalizing (chart forming + progress, auto-advances when done). */
export function PersonalizingScreen({ step, onDone, onBack }: Props) {
  const [chart, setChart] = useState(8);
  const [transits, setTransits] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      setChart((v) => Math.min(100, v + 4));
      setTransits((v) => (v === 0 && Math.random() < 0.6 ? 0 : Math.min(100, v + 5)));
    }, 90);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (chart >= 100 && transits >= 100 && !done.current) {
      done.current = true;
      const t = setTimeout(onDone, 700);
      return () => clearTimeout(t);
    }
  }, [chart, transits, onDone]);

  return (
    <Screen bg={A.transitsBg} wash={0.48}>
      <Header step={step} total={15} onBack={onBack} />
      <View style={styles.body}>
        <Title style={styles.title}>Alineando tu cielo…</Title>
        <Body style={styles.sub}>Tu carta se está armando.</Body>

        <View style={styles.bars}>
          <Row label="Carta natal" value={chart} />
          <View style={styles.gap} />
          <Row label="Tránsitos del día" value={transits} />
        </View>

        <View style={styles.emblemZone}>
          <Emblem source={A.chartDiagram} size={230} opacity={0.55} />
        </View>

        <View style={styles.spacer} />
        <Caption style={styles.note}>Ubicamos tus planetas y tus casas.</Caption>
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
  rowLabel: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 15 },
  rowPct: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 15 },
  rowTop: { flexDirection: "row", justifyContent: "space-between" },
  spacer: { flex: 1, minHeight: 12 },
  sub: { marginTop: 10, textAlign: "center" },
  title: { textAlign: "center" },
});
