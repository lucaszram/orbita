import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

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
 * estilo email). Los casilleros son decorativos; el texto vive en un TextInput
 * oculto y `oneTimeCode` deja que iOS autocomplete el código del mail. Al sexto
 * dígito se dispara `onFilled`.
 *
 * ## El foco es PROGRAMÁTICO, nunca de una vista invisible
 *
 * La versión anterior confiaba en que el TextInput con `opacity: 0` recibiera
 * los toques. En iPhone físico con la New Architecture eso no pasa: el input no
 * tomaba foco, no se podía escribir ni borrar, y el login era imposible — lo
 * único que escribía era el autofill de QuickType, sin forma de corregirlo. En
 * simulador el `autoFocus` inicial lo disimulaba, por eso 15 pasadas de
 * certificación no lo vieron. Ahora el tap lo captura un Pressable real (los
 * casilleros) y enfoca por ref; el input oculto queda fuera del hit-testing.
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Escribir el código de verificación"
        onPress={() => inputRef.current?.focus()}
      >
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
      </Pressable>
      <TextInput
        pointerEvents="none"
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
