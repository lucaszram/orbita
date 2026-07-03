import { StyleSheet, Text, View } from "react-native";
import { WeeklyEnergy } from "@/domain/types";
import { Card } from "./Card";
import { textStyles } from "@/theme/text";
import { theme } from "@/theme/theme";

type WeeklyEnergyCardProps = {
  weeklyEnergy: WeeklyEnergy;
};

export function WeeklyEnergyCard({ weeklyEnergy }: WeeklyEnergyCardProps) {
  return (
    <Card>
      <Text style={textStyles.eyebrow}>Calendario energetico</Text>
      <Text style={textStyles.cardTitle}>{weeklyEnergy.theme}</Text>
      <View style={styles.days}>
        {weeklyEnergy.days.map((day) => (
          <View key={day.id} style={styles.day}>
            <Text style={styles.dayName}>{day.dayName.slice(0, 3)}</Text>
            <Text style={styles.symbol}>{day.symbol}</Text>
            <Text numberOfLines={1} style={styles.color}>
              {day.color}
            </Text>
            <Text numberOfLines={2} style={styles.meaning}>
              {day.meaning}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  days: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  day: {
    backgroundColor: theme.colors.surfaceWarm,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: 3,
    minHeight: 118,
    padding: theme.spacing.sm,
    width: "31%"
  },
  dayName: {
    color: theme.colors.plum,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  symbol: {
    color: theme.colors.gold,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0
  },
  color: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0
  },
  meaning: {
    color: theme.colors.muted,
    fontSize: 11,
    lineHeight: 15
  }
});
