import { StyleSheet, View } from "react-native";

import type { BirthDatePartsValue, BirthTimePartsValue } from "@/domain/birthInput";

import { MONTHS } from "../months";
import { orbita } from "../theme";
import { Wheel, WHEEL_ROW_H } from "./Wheel";

/**
 * Selección de fecha y hora de nacimiento — implementación NATIVA (rueda).
 *
 * El hermano `BirthPicker.web.tsx` (extensión de plataforma de Metro) implementa
 * la MISMA interfaz con controles del navegador. Este archivo se bundlea en
 * iOS/Android; ese otro, en web.
 *
 * Acá la rueda queda EXACTAMENTE como estaba: mismos anchos, mismo alto de fila,
 * mismas hairlines. La rueda funciona en nativo —`contentOffset` y los eventos
 * de momentum existen— y no hay ningún motivo para tocarla.
 */

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const FIRST_YEAR = 2014;
const YEARS = Array.from({ length: 90 }, (_, i) => String(FIRST_YEAR - i));

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export type BirthDatePickerProps = {
  value: BirthDatePartsValue;
  onChange: (next: BirthDatePartsValue) => void;
};

export type BirthTimePickerProps = {
  value: BirthTimePartsValue;
  onChange: (next: BirthTimePartsValue) => void;
  /** `No sé la hora` activo. */
  unknown: boolean;
};

export function BirthDatePicker({ value, onChange }: BirthDatePickerProps) {
  const yearIndex = YEARS.indexOf(String(value.year));
  return (
    <View style={styles.pickerZone}>
      <View style={styles.hairlineTop} pointerEvents="none" />
      <View style={styles.hairlineBottom} pointerEvents="none" />
      <View style={styles.dateWheels}>
        <Wheel
          items={DAYS}
          index={value.day - 1}
          onChange={(i) => onChange({ ...value, day: i + 1 })}
          width={64}
          align="center"
        />
        <Wheel
          items={[...MONTHS]}
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
  );
}

export function BirthTimePicker({ value, onChange, unknown }: BirthTimePickerProps) {
  return (
    <View style={[styles.timeZone, unknown && styles.dimmed]} pointerEvents={unknown ? "none" : "auto"}>
      <View style={styles.hairlineTopCopper} pointerEvents="none" />
      <View style={styles.hairlineBottomCopper} pointerEvents="none" />
      <View style={styles.timeWheels}>
        <Wheel items={HOURS} index={value.hour} onChange={(i) => onChange({ ...value, hour: i })} width={84} />
        <Wheel items={MINUTES} index={value.minute} onChange={(i) => onChange({ ...value, minute: i })} width={84} />
      </View>
    </View>
  );
}

const HAIRLINE_TOP = WHEEL_ROW_H * 2;
const COPPER_HAIRLINE = "rgba(196,106,58,0.5)";

const styles = StyleSheet.create({
  dateWheels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8 },
  dimmed: { opacity: 0.35 },
  hairlineBottom: {
    backgroundColor: orbita.lineStrong,
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: HAIRLINE_TOP + WHEEL_ROW_H,
    zIndex: 2,
  },
  hairlineBottomCopper: {
    backgroundColor: COPPER_HAIRLINE,
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
  hairlineTopCopper: {
    backgroundColor: COPPER_HAIRLINE,
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: HAIRLINE_TOP,
    zIndex: 2,
  },
  pickerZone: { marginTop: 40 },
  timeWheels: { flexDirection: "row", gap: 22, justifyContent: "center" },
  timeZone: { marginTop: 28 },
});
