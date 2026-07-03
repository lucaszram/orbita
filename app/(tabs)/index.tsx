import { useState } from "react";
import { Alert, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { Card } from "@/components/Card";
import { PickCardStrip } from "@/components/PickCardStrip";
import { ReadingCard } from "@/components/ReadingCard";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { ShareCardPreview } from "@/components/ShareCardPreview";
import { TransitCard } from "@/components/TransitCard";
import { WeeklyEnergyCard } from "@/components/WeeklyEnergyCard";
import { useAppState } from "@/hooks/useAppState";
import { useRequireProfile } from "@/hooks/useRequireProfile";
import { textStyles } from "@/theme/text";
import { theme } from "@/theme/theme";

export default function TodayScreen() {
  const { isReady, profile } = useRequireProfile();
  const { todayReading, weeklyEnergy, saveTodayReading, addJournalNote } = useAppState();
  const [note, setNote] = useState("");

  if (!isReady || !profile) {
    return <Screen />;
  }

  async function saveReading() {
    await saveTodayReading();
    Alert.alert("Guardado", "Tu lectura quedó en el diario.");
  }

  async function saveNote() {
    await addJournalNote(todayReading, note);
    setNote("");
    Alert.alert("Nota guardada", "La dejamos junto a la lectura de hoy.");
  }

  async function shareSignal() {
    await Share.share({
      title: todayReading.shareCard.title,
      message: `${todayReading.shareCard.title}\n${todayReading.shareCard.subtitle}\n\n${todayReading.shareCard.body}\n${todayReading.shareCard.meta}`
    });
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={textStyles.eyebrow}>Guía diaria</Text>
        <Text style={textStyles.title}>{todayReading.greeting}</Text>
        <Text style={textStyles.body}>
          Hoy {todayReading.dateLabel}: tu mensaje, color, número, carta y acción simple en una lectura estable.
        </Text>
      </View>

      <ReadingCard reading={todayReading} />

      <View style={styles.actions}>
        <AppButton
          icon={todayReading.saved ? "bookmark" : "bookmark-outline"}
          label={todayReading.saved ? "Guardado" : "Guardar lectura"}
          onPress={saveReading}
          variant={todayReading.saved ? "secondary" : "primary"}
        />
        <AppButton icon="share-social" label="Compartir guía" onPress={shareSignal} variant="secondary" />
      </View>

      <Card tone="warm">
        <SectionHeader eyebrow="Recomendación" title={todayReading.recommendation.title} />
        <Text style={textStyles.body}>{todayReading.recommendation.body}</Text>
        <View style={styles.actionLine}>
          <Text style={styles.actionLabel}>Acción simple</Text>
          <Text style={styles.actionText}>{todayReading.recommendation.action}</Text>
        </View>
      </Card>

      <TransitCard transit={todayReading.transitEvent} />

      <WeeklyEnergyCard weeklyEnergy={weeklyEnergy} />

      <PickCardStrip options={todayReading.pickCards} />

      <Card>
        <SectionHeader eyebrow="Carta diaria" title={todayReading.tarotCard.name} />
        <Text style={textStyles.body}>{todayReading.tarotCard.meaning}</Text>
        <Text style={textStyles.muted}>Ritual: {todayReading.tarotCard.ritual}</Text>
      </Card>

      <ShareCardPreview card={todayReading.shareCard} onPress={shareSignal} />

      <Card>
        <SectionHeader eyebrow={`${todayReading.ritual.minutes} min`} title={todayReading.ritual.title} />
        {todayReading.ritual.steps.map((step, index) => (
          <View key={step} style={styles.step}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <SectionHeader
          eyebrow="Diario"
          title="Qué te movió esta lectura"
          body="Anotá una frase, una señal o una decisión. No hace falta escribir perfecto."
        />
        <TextInput
          multiline
          onChangeText={setNote}
          placeholder="Hoy noto que..."
          placeholderTextColor={theme.colors.muted}
          style={styles.noteInput}
          value={note}
        />
        <AppButton disabled={!note.trim()} icon="create" label="Guardar nota" onPress={saveNote} variant="secondary" />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md
  },
  actions: {
    gap: theme.spacing.sm
  },
  actionLine: {
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: theme.radius.sm,
    gap: theme.spacing.xs,
    padding: theme.spacing.md
  },
  actionLabel: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  actionText: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 23
  },
  step: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.spacing.md
  },
  stepNumber: {
    backgroundColor: theme.colors.plum,
    borderRadius: theme.radius.full,
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    height: 24,
    overflow: "hidden",
    textAlign: "center",
    width: 24
  },
  stepText: {
    color: theme.colors.ink,
    flex: 1,
    fontSize: 15,
    lineHeight: 22
  },
  noteInput: {
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.ink,
    fontSize: 16,
    minHeight: 110,
    padding: theme.spacing.md,
    textAlignVertical: "top"
  }
});
