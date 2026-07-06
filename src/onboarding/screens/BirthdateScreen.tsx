import { StyleSheet, View } from "react-native";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Caption, Title } from "../components/Type";
import { Wheel, WHEEL_ROW_H } from "../components/Wheel";
import { GUTTER, orbita } from "../theme";

export const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const YEARS = Array.from({ length: 90 }, (_, i) => String(2014 - i));

export type BirthDateParts = { day: number; month: number; year: number };

type Props = {
  step: number;
  value: BirthDateParts;
  onChange: (v: BirthDateParts) => void;
  onNext: () => void;
  onBack: () => void;
};

/** 05 — Birthdate wheel picker. */
export function BirthdateScreen({ step, value, onChange, onNext, onBack }: Props) {
  const yearIndex = YEARS.indexOf(String(value.year));
  return (
    <Screen bg={A.dailyTexture} wash={0.52}>
      <Header step={step} total={15} onBack={onBack} />
      <View style={styles.body}>
        <Title>¿Cuándo naciste?</Title>
        <Body style={styles.sub}>Tu fecha ubica el Sol en tu carta.</Body>

        <View style={styles.pickerZone}>
          <View style={styles.hairlineTop} pointerEvents="none" />
          <View style={styles.hairlineBottom} pointerEvents="none" />
          <View style={styles.wheels}>
            <Wheel
              items={DAYS}
              index={value.day - 1}
              onChange={(i) => onChange({ ...value, day: i + 1 })}
              width={64}
              align="center"
            />
            <Wheel
              items={MONTHS}
              index={value.month - 1}
              onChange={(i) => onChange({ ...value, month: i + 1 })}
              width={150}
              align="center"
            />
            <Wheel
              items={YEARS}
              index={yearIndex < 0 ? 0 : yearIndex}
              onChange={(i) => onChange({ ...value, year: Number(YEARS[i]) })}
              width={84}
              align="center"
            />
          </View>
        </View>

        <View style={styles.spacer} />
        <Caption style={styles.privacy}>
          La usamos para armar tu carta. Nunca vendemos ni compartimos tus datos.
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
  footer: { paddingBottom: 12, paddingTop: 12 },
  hairlineBottom: {
    backgroundColor: orbita.lineStrong,
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: HAIRLINE_TOP + WHEEL_ROW_H,
    zIndex: 2,
  },
  hairlineTop: {
    backgroundColor: orbita.lineStrong,
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: HAIRLINE_TOP,
    zIndex: 2,
  },
  pickerZone: { marginTop: 40 },
  privacy: { marginBottom: 8, textAlign: "center" },
  spacer: { flex: 1, minHeight: 16 },
  sub: { marginTop: 10 },
  wheels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8 },
});
