import { StyleSheet } from "react-native";
import { theme } from "./theme";

export const textStyles = StyleSheet.create({
  eyebrow: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: theme.colors.ink,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 38
  },
  sectionTitle: {
    color: theme.colors.ink,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 28
  },
  cardTitle: {
    color: theme.colors.ink,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 22
  },
  body: {
    color: theme.colors.ink,
    fontSize: 16,
    lineHeight: 23
  },
  muted: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20
  }
});
