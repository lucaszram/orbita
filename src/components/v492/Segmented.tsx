import { StyleSheet, View } from "react-native";
import { Touchable } from "@/components/v492/Touchable";
import { Label } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";

/**
 * Selector de vista (Ahora · Tu momento) — dos PÍLDORAS sueltas, como el frame.
 *
 * El canon V4.9.2 no dibuja un segmentado encerrado en un contenedor: son dos
 * píldoras independientes, la activa llena en hueso con texto oscuro y la otra
 * sólo contorneada. Antes esto era un único contenedor con borde y el activo
 * apenas cambiaba de color, que es la diferencia que registró la certificación.
 *
 * Es una lista de pestañas para VoiceOver —rol `tablist` con estado
 * seleccionado—, no dos botones sueltos, y cada opción respeta el mínimo táctil
 * de 44 px de alto. Las píldoras se ajustan a su texto (no ocupan medio ancho
 * cada una), así que con Dynamic Type grande la fila se repliega en vez de
 * recortarlas.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel
}: {
  options: ReadonlyArray<{ key: T; label: string }>;
  value: T;
  onChange: (key: T) => void;
  accessibilityLabel: string;
}) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Touchable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={[styles.item, selected ? styles.itemOn : styles.itemOff]}
            pressedStyle={styles.pressed}
          >
            <Label style={selected ? styles.labelOn : styles.label}>{option.label}</Label>
          </Touchable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: "center",
    borderRadius: v492.radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: v492.touch,
    paddingHorizontal: v492.space.xl
  },
  itemOff: { borderColor: v492.colors.line },
  itemOn: { backgroundColor: v492.colors.text, borderColor: v492.colors.text },
  label: { color: v492.colors.textMuted },
  labelOn: { color: v492.colors.background },
  pressed: { opacity: 0.7 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: v492.space.md }
});
