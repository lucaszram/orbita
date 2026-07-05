import { StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { useAppState } from "@/hooks/useAppState";
import { useRequireProfile } from "@/hooks/useRequireProfile";
import { textStyles } from "@/theme/text";
import { theme } from "@/theme/theme";

export default function JournalScreen() {
  const { isReady, profile } = useRequireProfile();
  const { savedReadings, journalEntries, removeSavedReading } = useAppState();

  if (!isReady || !profile) {
    return <Screen />;
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={textStyles.eyebrow}>Diario</Text>
        <Text style={textStyles.title}>Tus señales guardadas y notas personales.</Text>
      </View>

      <SectionHeader eyebrow="Lecturas" title="Guardadas" body="Volvé a los mensajes que te dejaron algo." />
      {savedReadings.length === 0 ? (
        <EmptyState
          body="Cuando una lectura te resuene, guardala desde la pantalla Hoy."
          icon="bookmark-outline"
          title="Todavía no hay lecturas guardadas"
        />
      ) : (
        savedReadings.map((reading) => (
          <Card key={reading.id}>
            <Text style={textStyles.eyebrow}>{reading.date}</Text>
            <Text style={textStyles.cardTitle}>{reading.headline}</Text>
            <Text style={textStyles.muted}>{reading.message}</Text>
            <AppButton icon="trash-outline" label="Quitar" onPress={() => removeSavedReading(reading.id)} variant="ghost" />
          </Card>
        ))
      )}

      <SectionHeader eyebrow="Notas" title="Lo que fuiste viendo" />
      {journalEntries.length === 0 ? (
        <EmptyState
          body="Escribí una nota desde Hoy cuando quieras dejar registro de una intuición o decisión."
          icon="create-outline"
          title="Tu diario está limpio"
        />
      ) : (
        journalEntries.map((entry) => (
          <Card key={entry.id} tone="warm">
            <Text style={textStyles.eyebrow}>{entry.date}</Text>
            <Text style={textStyles.cardTitle}>{entry.title}</Text>
            <Text style={styles.note}>{entry.note}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md
  },
  note: {
    color: theme.colors.ink,
    fontSize: 16,
    fontStyle: "italic",
    lineHeight: 24
  }
});
