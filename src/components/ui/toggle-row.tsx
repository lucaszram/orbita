import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { UiVariant } from "./button";
import { Toggle } from "./toggle";

type ToggleRowProps = {
  body?: string;
  bodyStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  dotStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  selected?: boolean;
  selectedTitleStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  title: string;
  titleStyle?: StyleProp<TextStyle>;
  variant?: UiVariant;
};

export function ToggleRow({
  body,
  bodyStyle,
  disabled = false,
  dotStyle,
  onPress,
  selected = false,
  selectedTitleStyle,
  style,
  title,
  titleStyle,
  variant = "light"
}: ToggleRowProps) {
  const colors = getToggleColors(variant);

  return (
    <Toggle
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPressedChange={() => onPress?.()}
      pressed={selected}
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          borderColor: selected ? colors.selectedBorder : colors.border
        },
        disabled && styles.disabled,
        style
      ]}
      variant="outline"
    >
      <Text style={[styles.title, { color: colors.title }, titleStyle, selected && selectedTitleStyle]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: colors.body }, bodyStyle]}>{body}</Text> : null}
      <View style={[styles.dot, dotStyle, { backgroundColor: selected ? colors.selectedBorder : colors.dot }]} />
    </Toggle>
  );
}

function getToggleColors(variant: UiVariant) {
  if (variant === "dark" || variant === "payment") {
    return {
      background: "rgba(20, 21, 27, 0.86)",
      body: "rgba(247, 245, 239, 0.58)",
      border: "rgba(247, 245, 239, 0.18)",
      dot: "#D08355",
      selectedBorder: "#C46A3A",
      title: "#F7F5EF"
    };
  }

  return {
    background: "rgba(255, 252, 246, 0.88)",
    body: "#6E675E",
    border: "rgba(216, 207, 194, 0.95)",
    dot: "#D08355",
    selectedBorder: "#C46A3A",
    title: "#111111"
  };
}

const styles = StyleSheet.create({
  root: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden"
  },
  disabled: {
    opacity: 0.44
  },
  pressed: {
    opacity: 0.86
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    includeFontPadding: false,
    left: 17,
    letterSpacing: 0,
    lineHeight: 18,
    position: "absolute",
    top: 12
  },
  body: {
    fontFamily: "Inter_500Medium",
    fontSize: 10.5,
    includeFontPadding: false,
    left: 17,
    letterSpacing: 0,
    lineHeight: 14,
    position: "absolute",
    top: 35
  },
  dot: {
    borderRadius: 4.5,
    height: 9,
    left: 291,
    position: "absolute",
    top: 26,
    width: 9
  }
});
