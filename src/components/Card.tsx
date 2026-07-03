import { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { theme } from "@/theme/theme";

type CardProps = {
  children: ReactNode;
  tone?: "light" | "warm" | "plum";
  style?: ViewStyle;
};

export function Card({ children, tone = "light", style }: CardProps) {
  return <View style={[styles.card, styles[tone], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  light: {
    backgroundColor: "rgba(255, 255, 255, 0.88)"
  },
  warm: {
    backgroundColor: "rgba(255, 240, 223, 0.92)"
  },
  plum: {
    backgroundColor: theme.colors.plum
  }
});
