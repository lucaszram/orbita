import { StyleSheet, Text, View } from "react-native";
import { DailyReading } from "@/domain/types";
import { formatSign } from "@/domain/zodiac";
import { Card } from "./Card";
import { MetricPill } from "./MetricPill";
import { textStyles } from "@/theme/text";
import { theme } from "@/theme/theme";

type ReadingCardProps = {
  reading: DailyReading;
};

export function ReadingCard({ reading }: ReadingCardProps) {
  return (
    <Card tone="plum">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{formatSign(reading.sign)} - {reading.dateLabel}</Text>
        <Text style={styles.title}>{reading.hook}</Text>
      </View>
      <Text style={styles.message}>{reading.message}</Text>
      <View style={styles.metrics}>
        <MetricPill icon="sparkles" label="Energia" value={`${reading.energyScore}%`} />
        <MetricPill icon="color-palette" label="Color" value={reading.color} />
      </View>
      <View style={styles.metrics}>
        <MetricPill icon="dice" label="Numero" value={String(reading.luckyNumber)} />
        <MetricPill icon="chatbubble-ellipses" label="Clave" value={reading.energyLabel} />
      </View>
      <View style={styles.mantraBox}>
        <Text style={textStyles.eyebrow}>Frase guia</Text>
        <Text style={styles.mantra}>{reading.mantra}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.sm
  },
  eyebrow: {
    color: "#f2c27e",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 34
  },
  message: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 17,
    lineHeight: 25
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  mantraBox: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: theme.radius.sm,
    gap: theme.spacing.sm,
    padding: theme.spacing.md
  },
  mantra: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 23
  }
});
