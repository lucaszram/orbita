import { Pressable, StyleSheet, Text, View } from "react-native";
import { orbita } from "@/theme/orbita";

export type UmbralSection = "preguntar" | "tarot";

export const UMBRAL_SECTIONS: { key: UmbralSection; label: string }[] = [
  { key: "preguntar", label: "PREGUNTAR" },
  { key: "tarot", label: "TAROT" }
];

/**
 * Las dos formas de cruzar el Umbral.
 *
 * Es una píldora segmentada, no una tira de pestañas: va DEBAJO del encabezado
 * de la sección activa, dentro de su columna, como en los frames de la sección
 * Tarot del tablero web. Por eso el Umbral la recibe como nodo y la dibuja ahí
 * mismo, en vez de que un envoltorio la ponga arriba de todo.
 */
export function UmbralSelector({
  active,
  onChange
}: {
  active: UmbralSection;
  onChange: (section: UmbralSection) => void;
}) {
  return (
    <View style={styles.pill}>
      {UMBRAL_SECTIONS.map((s) => {
        const on = s.key === active;
        return (
          <Pressable
            key={s.key}
            onPress={() => onChange(s.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Umbral · ${s.label}`}
            style={[styles.option, on && styles.optionOn]}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{s.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "center",
    borderColor: orbita.colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    padding: 4
  },
  option: { borderRadius: 999, paddingHorizontal: orbita.spacing.lg, paddingVertical: orbita.spacing.sm },
  optionOn: { backgroundColor: "rgba(196,106,58,0.14)", borderColor: orbita.colors.copper, borderWidth: 1 },
  label: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.mono,
    fontSize: 12,
    letterSpacing: 1.2
  },
  labelOn: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium }
});
