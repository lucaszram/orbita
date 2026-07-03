import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PickCardOption } from "@/domain/types";
import { Card } from "./Card";
import { textStyles } from "@/theme/text";
import { theme } from "@/theme/theme";

type PickCardStripProps = {
  options: PickCardOption[];
};

export function PickCardStrip({ options }: PickCardStripProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = options.find((option) => option.id === selectedId);

  return (
    <Card>
      <Text style={textStyles.eyebrow}>Pick-a-card diario</Text>
      <Text style={textStyles.cardTitle}>Elegí una carta y desbloqueá tu señal.</Text>
      <View style={styles.cards}>
        {options.map((option) => (
          <Pressable
            accessibilityRole="button"
            key={option.id}
            onPress={() => setSelectedId(option.id)}
            style={[styles.cardBack, selectedId === option.id && styles.selectedCard]}
          >
            <Text style={styles.position}>{option.position}</Text>
            <Text style={styles.prompt}>{option.prompt}</Text>
          </Pressable>
        ))}
      </View>
      {selected ? (
        <View style={styles.reveal}>
          <Text style={styles.revealTitle}>{selected.card.name}</Text>
          <Text style={styles.revealText}>{selected.reveal}</Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  cards: {
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  cardBack: {
    backgroundColor: theme.colors.plum,
    borderRadius: theme.radius.sm,
    flex: 1,
    gap: theme.spacing.sm,
    minHeight: 132,
    padding: theme.spacing.md
  },
  selectedCard: {
    backgroundColor: theme.colors.rose
  },
  position: {
    color: "#f2c27e",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0
  },
  prompt: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  reveal: {
    backgroundColor: theme.colors.surfaceWarm,
    borderRadius: theme.radius.sm,
    gap: theme.spacing.sm,
    padding: theme.spacing.md
  },
  revealTitle: {
    color: theme.colors.plum,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0
  },
  revealText: {
    color: theme.colors.ink,
    fontSize: 15,
    lineHeight: 22
  }
});
