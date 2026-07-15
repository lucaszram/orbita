import { useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { Text } from "@/components/ui/text";

import { font, orbita } from "../theme";

export const CODE_LENGTH = 6;

type Props = {
  value: string;
  onChange: (code: string) => void;
  /** Se llama UNA vez con el código completo (auto-verificación). */
  onFilled?: (code: string) => void;
  autoFocus?: boolean;
};

/**
 * Código de verificación de 6 dígitos como casilleros (no un input de texto
 * estilo email). Un TextInput invisible cubre la fila y captura todo: tap en
 * cualquier casillero enfoca, `oneTimeCode` deja que iOS autocomplete el
 * código que llega por mail, y al sexto dígito se dispara `onFilled`.
 */
export function CodeInput({ value, onChange, onFilled, autoFocus = true }: Props) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const filledFor = useRef<string | null>(null);
  const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH);

  const handleChange = (raw: string) => {
    const next = raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
    onChange(next);
    if (next.length === CODE_LENGTH && filledFor.current !== next) {
      filledFor.current = next;
      onFilled?.(next);
    }
    if (next.length < CODE_LENGTH) {
      filledFor.current = null;
    }
  };

  const activeIndex = Math.min(digits.length, CODE_LENGTH - 1);

  return (
    <View style={styles.wrap}>
      <View style={styles.row} pointerEvents="none">
        {Array.from({ length: CODE_LENGTH }, (_, index) => {
          const digit = digits[index] ?? "";
          const active = focused && index === activeIndex && digits.length < CODE_LENGTH;
          return (
            <View key={index} style={[styles.cell, active && styles.cellActive]}>
              {digit ? (
                <Text style={styles.digit}>{digit}</Text>
              ) : active ? (
                <Text style={styles.caret}>|</Text>
              ) : null}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={digits}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        autoFocus={autoFocus}
        caretHidden
        style={styles.hiddenInput}
        accessibilityLabel="Código de verificación de 6 dígitos"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  caret: {
    color: orbita.copper,
    fontFamily: font.sans,
    fontSize: 22,
  },
  cell: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: orbita.lineStrong,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    height: 56,
    justifyContent: "center",
  },
  cellActive: {
    borderColor: orbita.copper,
  },
  digit: {
    color: orbita.bone,
    fontFamily: font.serifReg,
    fontSize: 26,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  wrap: {
    marginTop: 12,
  },
});
