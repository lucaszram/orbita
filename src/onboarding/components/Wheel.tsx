import { useRef } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { font, orbita } from "../theme";

export const WHEEL_ROW_H = 40;
const VISIBLE_ROWS = 5;

type Props = {
  items: string[];
  index: number;
  onChange: (index: number) => void;
  width: number;
  align?: "left" | "center" | "right";
  /**
   * Cómo se llama esta columna ("Día", "Mes", "Año", "Hora", "Minuto").
   *
   * Sin esto la rueda se expone como un `AXSlider` sin nombre: VoiceOver anuncia
   * el valor pero no qué se está cambiando, y tres columnas seguidas suenan
   * idénticas. La certificación lo registró como `AXLabel: null` (D3).
   */
  label?: string;
};

/**
 * Columna de rueda con snap, compartida por los selectores de fecha y hora.
 *
 * **Accesible como control, no como lista.** Se anuncia con el rol `adjustable`,
 * que es el que VoiceOver maneja con el gesto de deslizar arriba/abajo, y
 * responde a `increment`/`decrement`: quien usa lector de pantalla puede
 * cambiar el valor sin arrastrar con precisión sobre una fila de 40 puntos.
 * El valor anunciado es el ítem seleccionado, no un número de índice.
 */
export function Wheel({ items, index, onChange, width, align = "center", label }: Props) {
  const ref = useRef<ScrollView>(null);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / WHEEL_ROW_H);
    const clamped = Math.max(0, Math.min(items.length - 1, i));
    if (clamped !== index) onChange(clamped);
  };

  /** Un paso del rotor de VoiceOver. Mueve el valor Y la posición de la rueda. */
  const paso = (delta: number) => {
    const next = Math.max(0, Math.min(items.length - 1, index + delta));
    if (next === index) return;
    ref.current?.scrollTo({ y: next * WHEEL_ROW_H, animated: false });
    onChange(next);
  };

  return (
    <View style={[styles.wrap, { width }]}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ROW_H}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: index * WHEEL_ROW_H }}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: WHEEL_ROW_H * 2 }}
        nestedScrollEnabled
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: items[index] }}
        accessibilityActions={[
          { name: "increment", label: "Siguiente" },
          { name: "decrement", label: "Anterior" },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "increment") paso(1);
          if (event.nativeEvent.actionName === "decrement") paso(-1);
        }}
      >
        {items.map((item, i) => {
          const selected = i === index;
          return (
            <View
              key={`${item}-${i}`}
              style={styles.row}
              // Las filas no son elementos accesibles propios: la columna entera
              // ya es UN control con su valor. Sin esto, VoiceOver recorrería 60
              // minutos de a uno antes de llegar al botón de confirmar.
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Text
                style={[
                  styles.item,
                  { textAlign: align },
                  selected ? styles.selected : styles.unselected,
                ]}
              >
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { fontFamily: font.serifReg, width: "100%" },
  row: { height: WHEEL_ROW_H, justifyContent: "center", paddingHorizontal: 4 },
  selected: { color: orbita.bone, fontFamily: font.serif, fontSize: 22 },
  unselected: { color: orbita.faint, fontSize: 16 },
  wrap: { height: WHEEL_ROW_H * VISIBLE_ROWS },
});
