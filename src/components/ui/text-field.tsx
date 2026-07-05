import { forwardRef } from "react";
import { StyleProp, StyleSheet, TextInput, TextInputProps, TextStyle, View, ViewStyle } from "react-native";
import { UiVariant } from "./button";
import { Input } from "./input";
import { Label } from "./label";

type TextFieldProps = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  label?: string;
  labelStyle?: StyleProp<TextStyle>;
  underline?: boolean;
  underlineStyle?: StyleProp<ViewStyle>;
  variant?: UiVariant;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    containerStyle,
    inputStyle,
    label,
    labelStyle,
    placeholderTextColor,
    style,
    underline = false,
    underlineStyle,
    variant = "light",
    ...props
  },
  ref
) {
  const colors = getFieldColors(variant);

  return (
    <View style={[styles.root, containerStyle]}>
      {label ? <Label style={[styles.label, { color: colors.accent }, labelStyle]}>{label}</Label> : null}
      <Input
        placeholderTextColor={placeholderTextColor ?? colors.placeholder}
        ref={ref}
        style={[styles.input, { color: colors.foreground }, style, inputStyle]}
        {...props}
      />
      {underline ? <View style={[styles.underline, { backgroundColor: colors.underline }, underlineStyle]} /> : null}
    </View>
  );
});

function getFieldColors(variant: UiVariant) {
  if (variant === "dark" || variant === "payment") {
    return {
      accent: "#D69A6A",
      foreground: "#F7F5EF",
      placeholder: "rgba(247, 245, 239, 0.36)",
      underline: "rgba(247, 245, 239, 0.54)"
    };
  }

  return {
    accent: "#C46A3A",
    foreground: "#111111",
    placeholder: "rgba(17, 17, 17, 0.36)",
    underline: "rgba(17, 17, 17, 0.72)"
  };
}

const styles = StyleSheet.create({
  root: {
    position: "absolute"
  },
  label: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    includeFontPadding: false,
    letterSpacing: 0,
    lineHeight: 12
  },
  input: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    includeFontPadding: false,
    letterSpacing: 0,
    lineHeight: 24,
    padding: 0
  },
  underline: {
    height: 1,
    width: "100%"
  }
});
