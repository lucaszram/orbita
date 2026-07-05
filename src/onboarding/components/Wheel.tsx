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
};

/** Snap-scroll wheel column (shared by the date and time pickers). */
export function Wheel({ items, index, onChange, width, align = "center" }: Props) {
  const ref = useRef<ScrollView>(null);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / WHEEL_ROW_H);
    const clamped = Math.max(0, Math.min(items.length - 1, i));
    if (clamped !== index) onChange(clamped);
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
      >
        {items.map((item, i) => {
          const selected = i === index;
          return (
            <View key={`${item}-${i}`} style={styles.row}>
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
