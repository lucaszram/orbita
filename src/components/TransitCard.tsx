import { StyleSheet, Text, View } from "react-native";
import { TransitEvent } from "@/domain/types";
import { formatSign } from "@/domain/zodiac";
import { Card } from "./Card";
import { textStyles } from "@/theme/text";
import { theme } from "@/theme/theme";

type TransitCardProps = {
  transit: TransitEvent;
};

export function TransitCard({ transit }: TransitCardProps) {
  return (
    <Card tone="warm">
      <View style={styles.row}>
        <View style={styles.intensity}>
          <Text style={styles.intensityValue}>{transit.intensity}%</Text>
          <Text style={styles.intensityLabel}>intensidad</Text>
        </View>
        <View style={styles.copy}>
          <Text style={textStyles.eyebrow}>Transito actual</Text>
          <Text style={textStyles.cardTitle}>{transit.title}</Text>
          <Text style={textStyles.body}>{transit.summary}</Text>
        </View>
      </View>
      <View style={styles.signs}>
        {transit.affectedSigns.map((sign) => (
          <Text key={sign} style={styles.signChip}>
            {formatSign(sign)}
          </Text>
        ))}
      </View>
      <View style={styles.guidanceGrid}>
        <View style={styles.guidanceBox}>
          <Text style={styles.guidanceLabel}>Hace</Text>
          <Text style={styles.guidanceText}>{transit.doThis}</Text>
        </View>
        <View style={styles.guidanceBox}>
          <Text style={styles.guidanceLabel}>Evita</Text>
          <Text style={styles.guidanceText}>{transit.avoid}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: theme.spacing.md
  },
  intensity: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    height: 82,
    justifyContent: "center",
    width: 82
  },
  intensityValue: {
    color: theme.colors.plum,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0
  },
  intensityLabel: {
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xs
  },
  signs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  signChip: {
    backgroundColor: "rgba(59, 33, 72, 0.08)",
    borderRadius: theme.radius.full,
    color: theme.colors.plum,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  guidanceGrid: {
    gap: theme.spacing.sm
  },
  guidanceBox: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: theme.radius.sm,
    gap: theme.spacing.xs,
    padding: theme.spacing.md
  },
  guidanceLabel: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  guidanceText: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21
  }
});
