import { ReactNode } from "react";
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { Button, UiVariant } from "./button";
import { RadioGroupItem } from "./radio-group";

type RadioPosition = "left" | "right" | "none";

type SelectableRowProps = {
  accessibilityLabel?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  children?: ReactNode;
  disabled?: boolean;
  label?: string;
  labelStyle?: StyleProp<TextStyle>;
  onPress?: () => void;
  radioPosition?: RadioPosition;
  radioStyle?: StyleProp<ViewStyle>;
  radioValue?: string;
  selected?: boolean;
  selectedBackgroundColor?: string;
  selectedBorderColor?: string;
  selectedBorderWidth?: number;
  selectedLabelStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  variant?: UiVariant;
};

export function SelectableRow({
  accessibilityLabel,
  backgroundColor,
  borderColor,
  borderWidth = 1,
  children,
  disabled = false,
  label,
  labelStyle,
  onPress,
  radioPosition = "right",
  radioStyle,
  radioValue,
  selected = false,
  selectedBackgroundColor,
  selectedBorderColor,
  selectedBorderWidth = 1.5,
  selectedLabelStyle,
  style,
  variant = "dark"
}: SelectableRowProps) {
  const colors = getRowColors(variant);
  const resolvedBackground = selected ? selectedBackgroundColor ?? colors.selectedBackground : backgroundColor ?? colors.background;
  const resolvedBorder = selected ? selectedBorderColor ?? colors.selectedBorder : borderColor ?? colors.border;
  const radio =
    radioPosition === "none" ? null : radioValue ? (
      <RadioGroupItem indicatorStyle={styles.radioDot} value={radioValue} style={radioStyle} />
    ) : (
      <RadioMark selected={selected} style={radioStyle} variant={variant} />
    );

  return (
    <Button
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      fill={resolvedBackground}
      onPress={onPress}
      radius={0}
      style={[
        styles.root,
        styles[variant],
        {
          borderColor: resolvedBorder,
          borderWidth: selected ? selectedBorderWidth : borderWidth
        },
        disabled && styles.disabled,
        style
      ]}
      variant="figma"
    >
      {radioPosition === "left" ? radio : null}
      {children ?? (
        <Text style={[styles.label, { color: colors.foreground }, labelStyle, selected && selectedLabelStyle]}>{label}</Text>
      )}
      {radioPosition === "right" ? radio : null}
    </Button>
  );
}

function RadioMark({ selected, style, variant }: { selected: boolean; style?: StyleProp<ViewStyle>; variant: UiVariant }) {
  const colors = getRowColors(variant);

  return (
    <View style={[styles.radio, { borderColor: selected ? colors.selectedBorder : colors.radioBorder }, style]}>
      {selected ? <View style={[styles.radioDot, { backgroundColor: colors.selectedBorder }]} /> : null}
    </View>
  );
}

function getRowColors(variant: UiVariant) {
  if (variant === "light" || variant === "figma") {
    return {
      background: "transparent",
      border: "rgba(17, 17, 17, 0.14)",
      foreground: "#111111",
      radioBorder: "rgba(17, 17, 17, 0.36)",
      selectedBackground: "rgba(255, 252, 246, 0.88)",
      selectedBorder: "#C46A3A"
    };
  }

  if (variant === "payment") {
    return {
      background: "transparent",
      border: "transparent",
      foreground: "#F7F5EF",
      radioBorder: "rgba(247, 245, 239, 0.5)",
      selectedBackground: "rgba(196, 106, 58, 0.08)",
      selectedBorder: "#C46A3A"
    };
  }

  return {
    background: "#1E1F26",
    border: "#2A2B34",
    foreground: "#F7F5EF",
    radioBorder: "#504E56",
    selectedBackground: "#262730",
    selectedBorder: "#C46A3A"
  };
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    overflow: "hidden"
  },
  dark: {},
  light: {},
  payment: {},
  figma: {},
  disabled: {
    opacity: 0.44
  },
  pressed: {
    opacity: 0.86
  },
  label: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    includeFontPadding: false,
    letterSpacing: 0,
    lineHeight: 18
  },
  radio: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: "center",
    width: 20
  },
  radioDot: {
    borderRadius: 4,
    height: 8,
    width: 8
  }
});
