import { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/theme/theme";

type AppButtonProps = {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
};

export function AppButton({ label, icon, onPress, variant = "primary", disabled = false }: AppButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons color={variant === "primary" ? "#fff" : theme.colors.plum} name={icon} size={18} />
      </View>
      <Text style={[styles.label, variant === "primary" ? styles.primaryLabel : styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: theme.radius.sm,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: theme.spacing.lg
  },
  primary: {
    backgroundColor: theme.colors.plum
  },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1
  },
  ghost: {
    backgroundColor: "transparent"
  },
  disabled: {
    opacity: 0.44
  },
  pressed: {
    transform: [{ scale: 0.98 }]
  },
  iconWrap: {
    alignItems: "center",
    height: 20,
    justifyContent: "center",
    width: 20
  },
  label: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0
  },
  primaryLabel: {
    color: "#fff"
  },
  secondaryLabel: {
    color: theme.colors.plum
  }
});
