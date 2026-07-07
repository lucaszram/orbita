import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Button } from "./button";
import { RadioGroupItem } from "./radio-group";

type PlanOptionProps = {
  badge?: string;
  caption: string;
  label: string;
  onPress: () => void;
  price: string;
  selected: boolean;
  style?: StyleProp<ViewStyle>;
  subprice: string;
  value?: string;
};

export function PlanOption({ badge, caption, label, onPress, price, selected, style, subprice, value }: PlanOptionProps) {
  const radioSize = selected ? 18 : 16;

  return (
    <Button
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      fill="transparent"
      onPress={onPress}
      radius={8}
      style={[
        styles.root,
        {
          borderColor: selected ? "rgba(196, 106, 58, 0.8)" : "transparent",
          borderWidth: selected ? 1 : 0,
          height: selected ? 76 : 72,
          left: selected ? 8 : 0,
          width: selected ? 329 : 345
        },
        style
      ]}
      variant="figma"
    >
      {value ? (
        <RadioGroupItem
          indicatorStyle={styles.radioDot}
          value={value}
          style={[
            styles.radio,
            {
              borderColor: selected ? "#C46A3A" : "rgba(247, 245, 239, 0.5)",
              borderRadius: radioSize / 2,
              height: radioSize,
              left: selected ? 18 : 20,
              top: selected ? 30 : 27,
              width: radioSize
            }
          ]}
        />
      ) : (
        <View
          style={[
            styles.radio,
            {
              borderColor: selected ? "#C46A3A" : "rgba(247, 245, 239, 0.5)",
              borderRadius: radioSize / 2,
              height: radioSize,
              left: selected ? 18 : 20,
              top: selected ? 30 : 27,
              width: radioSize
            }
          ]}
        >
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      )}
      <Text style={[styles.label, { top: selected ? 18 : 15 }]}>{label}</Text>
      <Text style={[styles.caption, { top: selected ? 42 : 39 }]}>{caption}</Text>
      {badge ? <Text style={styles.badge}>{badge}</Text> : null}
      <Text style={[styles.price, { top: selected ? 18 : 14 }]}>{price}</Text>
      <Text style={[styles.subprice, { top: selected ? 43 : 39 }]}>{subprice}</Text>
    </Button>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: 8,
    position: "absolute"
  },
  pressed: {
    opacity: 0.86
  },
  radio: {
    alignItems: "center",
    borderWidth: 1,
    justifyContent: "center",
    position: "absolute"
  },
  radioDot: {
    backgroundColor: "#C46A3A",
    borderRadius: 4,
    height: 8,
    width: 8
  },
  label: {
    color: "#F7F5EF",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    includeFontPadding: false,
    left: 54,
    lineHeight: 20,
    position: "absolute"
  },
  caption: {
    color: "rgba(247, 245, 239, 0.58)",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    includeFontPadding: false,
    left: 54,
    lineHeight: 15,
    position: "absolute"
  },
  badge: {
    backgroundColor: "transparent",
    borderColor: "#C46A3A",
    borderRadius: 4,
    borderWidth: 1,
    color: "#F5E8D8",
    fontFamily: "Inter_700Bold",
    fontSize: 8.5,
    height: 18,
    includeFontPadding: false,
    left: 150,
    lineHeight: 11,
    overflow: "hidden",
    paddingTop: 4,
    position: "absolute",
    textAlign: "center",
    top: 20,
    width: 86
  },
  price: {
    color: "#F7F5EF",
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    includeFontPadding: false,
    lineHeight: 22,
    position: "absolute",
    right: 22,
    textAlign: "right",
    width: 62
  },
  subprice: {
    color: "rgba(247, 245, 239, 0.58)",
    fontFamily: "Inter_500Medium",
    fontSize: 10.5,
    includeFontPadding: false,
    lineHeight: 15,
    position: "absolute",
    right: 22,
    textAlign: "right",
    width: 98
  }
});
