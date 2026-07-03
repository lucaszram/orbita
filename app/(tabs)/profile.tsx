import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { AppButton } from "@/components/AppButton";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { Tag } from "@/components/Tag";
import { TopicSelector } from "@/components/TopicSelector";
import { GuidanceTone, Topic } from "@/domain/types";
import { formatSign } from "@/domain/zodiac";
import { useAppState } from "@/hooks/useAppState";
import { useRequireProfile } from "@/hooks/useRequireProfile";
import { textStyles } from "@/theme/text";
import { theme } from "@/theme/theme";

export default function ProfileScreen() {
  const { isReady, profile } = useRequireProfile();
  const { updateProfile, resetApp } = useAppState();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [notificationTime, setNotificationTime] = useState("09:00");
  const [interests, setInterests] = useState<Topic[]>([]);
  const [guidanceTone, setGuidanceTone] = useState<GuidanceTone>("protectora");

  useEffect(() => {
    if (!profile) {
      return;
    }

    setName(profile.name);
    setBirthDate(profile.birthDate);
    setBirthTime(profile.birthTime ?? "");
    setBirthPlace(profile.birthPlace ?? "");
    setNotificationTime(profile.notificationTime);
    setInterests(profile.interests);
    setGuidanceTone(profile.guidanceTone);
  }, [profile]);

  if (!isReady || !profile) {
    return <Screen />;
  }

  async function saveChanges() {
    if (!profile) {
      return;
    }

    await updateProfile({
      name: name.trim() || profile.name,
      birthDate,
      birthTime: birthTime.trim() || undefined,
      birthPlace: birthPlace.trim() || undefined,
      interests,
      guidanceTone,
      notificationTime
    });
    Alert.alert("Perfil actualizado", "Tus próximas lecturas van a tomar estos cambios.");
  }

  async function restart() {
    await resetApp();
    router.replace("/onboarding");
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={textStyles.eyebrow}>Perfil</Text>
        <Text style={textStyles.title}>Ajustá tu guía diaria de señales.</Text>
      </View>

      <Card tone="plum">
        <Text style={styles.plumEyebrow}>Tu energía base</Text>
        <Text style={styles.plumTitle}>{formatSign(profile.zodiacSign)}</Text>
        <Text style={styles.plumBody}>
          Fecha: {profile.birthDate} {profile.birthTime ? `- Hora: ${profile.birthTime}` : ""}
        </Text>
      </Card>

      <Card>
        <SectionHeader eyebrow="Datos" title="Perfil personal" />
        <View style={styles.field}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput onChangeText={setName} style={styles.input} value={name} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Fecha de nacimiento</Text>
          <TextInput inputMode="numeric" onChangeText={setBirthDate} style={styles.input} value={birthDate} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Hora de nacimiento</Text>
          <TextInput inputMode="numeric" onChangeText={setBirthTime} placeholder="HH:MM" style={styles.input} value={birthTime} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Lugar de nacimiento</Text>
          <TextInput autoCapitalize="words" onChangeText={setBirthPlace} placeholder="Ciudad, país" style={styles.input} value={birthPlace} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Hora de notificación</Text>
          <TextInput inputMode="numeric" onChangeText={setNotificationTime} style={styles.input} value={notificationTime} />
        </View>
      </Card>

      <Card tone="warm">
        <SectionHeader eyebrow="Preferencias" title="Temas principales" />
        <TopicSelector onChange={setInterests} selected={interests} />
      </Card>

      <Card>
        <SectionHeader eyebrow="Tono" title="Modo de guía" body="Esto cambia el tipo de lenguaje y CTA que priorizamos." />
        <View style={styles.toneWrap}>
          {(["protectora", "directa", "suave", "intensa"] as GuidanceTone[]).map((tone) => (
            <Tag key={tone} label={tone} onPress={() => setGuidanceTone(tone)} selected={guidanceTone === tone} />
          ))}
        </View>
      </Card>

      <Card>
        <SectionHeader eyebrow="Aviso" title="Entretenimiento y autoconocimiento" />
        <Text style={textStyles.muted}>
          Órbita ofrece señales simbólicas para reflexionar. No reemplaza consejo médico, legal, financiero ni
          psicológico, y no debería usarse para decisiones de riesgo.
        </Text>
      </Card>

      <AppButton icon="save" label="Guardar cambios" onPress={saveChanges} />
      <AppButton
        icon="refresh"
        label="Reiniciar onboarding"
        onPress={() =>
          Alert.alert("Reiniciar app", "Esto borra el perfil, lecturas y notas guardadas en este dispositivo.", [
            { text: "Cancelar", style: "cancel" },
            { text: "Reiniciar", onPress: restart, style: "destructive" }
          ])
        }
        variant="secondary"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md
  },
  field: {
    gap: theme.spacing.sm
  },
  label: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.ink,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: theme.spacing.md
  },
  toneWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  plumEyebrow: {
    color: "#f2c27e",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  plumTitle: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0
  },
  plumBody: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 16
  }
});
