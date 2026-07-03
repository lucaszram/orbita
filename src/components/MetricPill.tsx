import { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/theme/theme";

type MetricPillProps = {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
};

export function MetricPill({ icon, label, value }: MetricPillProps) {
  return (
    <View style={styles.pill}>
      <Ionicons color={theme.colors.gold} name={icon} size={18} />
      <View style={styles.textWrap}>
        <Text style={styles.label}>{label}</Text>
        <Text numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    minHeight: 58,
    minWidth: 130,
    padding: theme.spacing.md
  },
  textWrap: {
    flex: 1
  },
  label: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  value: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: 2
  }
});
