import { StyleSheet, Text, View } from "react-native";
import { RelationshipReading } from "@/domain/types";
import { formatSign } from "@/domain/zodiac";
import { Card } from "./Card";
import { textStyles } from "@/theme/text";
import { theme } from "@/theme/theme";

type RelationshipCardProps = {
  reading: RelationshipReading;
};

export function RelationshipCard({ reading }: RelationshipCardProps) {
  return (
    <Card tone="plum">
      <Text style={styles.eyebrow}>Vinculo amoroso</Text>
      <Text style={styles.title}>
        {formatSign(reading.userSign)} + {formatSign(reading.partnerSign)}
      </Text>
      <Text style={styles.body}>{reading.partnerName}: {reading.chemistryScore}% de energia para mirar.</Text>
      <View style={styles.blocks}>
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Tu energia</Text>
          <Text style={styles.blockText}>{reading.userEnergy}</Text>
        </View>
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Su energia</Text>
          <Text style={styles.blockText}>{reading.partnerEnergy}</Text>
        </View>
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Entre ustedes</Text>
          <Text style={styles.blockText}>{reading.sharedEnergy}</Text>
        </View>
      </View>
      <View style={styles.advice}>
        <Text style={textStyles.eyebrow}>Accion sin ansiedad</Text>
        <Text style={styles.adviceText}>{reading.advice}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: "#f2c27e",
    fontSize: 12,
    fontWeight: "900",
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
  body: {
    color: "rgba(255, 255, 255, 0.88)",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 23
  },
  blocks: {
    gap: theme.spacing.sm
  },
  block: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: theme.radius.sm,
    gap: theme.spacing.xs,
    padding: theme.spacing.md
  },
  blockLabel: {
    color: "#f2c27e",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  blockText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 21
  },
  advice: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: theme.radius.sm,
    gap: theme.spacing.sm,
    padding: theme.spacing.md
  },
  adviceText: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 22
  }
});
