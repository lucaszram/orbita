import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Caption, Title } from "../components/Type";
import { Wheel, WHEEL_ROW_H } from "../components/Wheel";
import { font, GUTTER, orbita } from "../theme";

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const PERIODS = ["AM", "PM"];

export type BirthTime = { hour: number; minute: number; period: "AM" | "PM" };

type Props = {
  step: number;
  value: BirthTime;
  onChange: (v: BirthTime) => void;
  unknown: boolean;
  onToggleUnknown: () => void;
  onNext: () => void;
  onBack: () => void;
};

/** 09 — Birth time wheel picker + "No sé la hora". */
export function BirthTimeScreen({ step, value, onChange, unknown, onToggleUnknown, onNext, onBack }: Props) {
  return (
    <Screen bg={A.dailyTexture} wash={0.52}>
      <Header step={step} total={15} onBack={onBack} />
      <View style={styles.body}>
        <Title>¿A qué hora naciste?</Title>
        <Body style={styles.sub}>La hora afina tu ascendente y tus casas.</Body>

        <View style={[styles.pickerZone, unknown && styles.dimmed]} pointerEvents={unknown ? "none" : "auto"}>
          <View style={styles.hairlineTop} pointerEvents="none" />
          <View style={styles.hairlineBottom} pointerEvents="none" />
          <View style={styles.wheels}>
            <Wheel
              items={HOURS}
              index={value.hour - 1}
              onChange={(i) => onChange({ ...value, hour: i + 1 })}
              width={72}
            />
            <Wheel
              items={MINUTES}
              index={value.minute}
              onChange={(i) => onChange({ ...value, minute: i })}
              width={72}
            />
            <Wheel
              items={PERIODS}
              index={value.period === "AM" ? 0 : 1}
              onChange={(i) => onChange({ ...value, period: i === 0 ? "AM" : "PM" })}
              width={72}
            />
          </View>
        </View>

        <Pressable
          onPress={onToggleUnknown}
          style={[styles.unknownCard, { borderColor: unknown ? orbita.copper : "rgba(214,154,106,0.45)" }]}
        >
          <View style={styles.unknownTxts}>
            <Text style={styles.unknownTitle}>No sé la hora</Text>
            <Text style={styles.unknownSub}>Usamos una carta aproximada.</Text>
          </View>
          <View style={[styles.check, unknown && styles.checkOn]}>
            {unknown ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
        </Pressable>

        <View style={styles.spacer} />
        <Caption style={styles.note}>
          Podés continuar sin hora exacta. La lectura será menos precisa.
        </Caption>
        <View style={styles.footer}>
          <CTA label="Continuar" onPress={onNext} />
        </View>
      </View>
    </Screen>
  );
}

const HAIRLINE_TOP = WHEEL_ROW_H * 2;

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: GUTTER, paddingTop: 26 },
  check: {
    alignItems: "center",
    borderColor: orbita.lineStrong,
    borderRadius: 11,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  checkMark: { color: orbita.ink, fontFamily: font.sansBold, fontSize: 12 },
  checkOn: { backgroundColor: orbita.copper, borderColor: orbita.copper },
  dimmed: { opacity: 0.35 },
  footer: { paddingBottom: 12, paddingTop: 12 },
  hairlineBottom: {
    backgroundColor: "rgba(196,106,58,0.5)",
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: HAIRLINE_TOP + WHEEL_ROW_H,
    zIndex: 2,
  },
  hairlineTop: {
    backgroundColor: "rgba(196,106,58,0.5)",
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: HAIRLINE_TOP,
    zIndex: 2,
  },
  note: { marginBottom: 8, textAlign: "center" },
  pickerZone: { marginTop: 28 },
  spacer: { flex: 1, minHeight: 12 },
  sub: { marginTop: 10 },
  unknownCard: {
    alignItems: "center",
    backgroundColor: "rgba(18,20,26,0.6)",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 26,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  unknownSub: { color: orbita.muted, fontFamily: font.sans, fontSize: 12, marginTop: 3 },
  unknownTitle: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 14 },
  unknownTxts: { flex: 1 },
  wheels: { flexDirection: "row", justifyContent: "center", gap: 22 },
});
